# ==============================================================================
# Projet Sentinel — Discord Bot Gateway Worker
# ==============================================================================

import asyncio
import os
import structlog
import discord
from discord.ext import commands

from app.config import get_settings
from app.services.gemini_agent import run_agent_task
from app.database.connection import get_session

import time

logger = structlog.get_logger()
settings = get_settings()

# Configuration du Rate Limiter pour l'agent Brad (5 req/min)
RATE_LIMIT_WINDOW_SECONDS = 60.0
MAX_REQUESTS_PER_MINUTE = getattr(settings, "discord_rate_limit_rpm", 5)

request_timestamps: list[float] = []
rate_limit_lock = asyncio.Lock()


async def acquire_rate_limit_slot(status_msg: discord.Message | None = None) -> float:
    """
    Gestionnaire de débit (Rate Limiter) : garantit que l'agent Brad ne dépasse pas
    MAX_REQUESTS_PER_MINUTE (par défaut 5 req/min).
    Si la limite est atteinte, attend le délai nécessaire et informe l'utilisateur sur Discord.
    """
    async with rate_limit_lock:
        now = time.time()
        # Nettoyer les horodatages datant de plus de 60 secondes
        while request_timestamps and (now - request_timestamps[0]) >= RATE_LIMIT_WINDOW_SECONDS:
            request_timestamps.pop(0)

        if len(request_timestamps) >= MAX_REQUESTS_PER_MINUTE:
            oldest = request_timestamps[0]
            wait_time = (oldest + RATE_LIMIT_WINDOW_SECONDS) - now + 0.1
            if wait_time > 0:
                logger.warning(
                    "Discord bot rate limit reached",
                    max_rpm=MAX_REQUESTS_PER_MINUTE,
                    wait_seconds=round(wait_time, 2)
                )
                if status_msg:
                    try:
                        seconds_left = max(1, int(wait_time) + 1)
                        await status_msg.edit(
                            content=f"⏳ **Limite de débit atteinte ({MAX_REQUESTS_PER_MINUTE} req/min max)** : "
                                    f"Agent Brad patiente {seconds_left}s avant de traiter votre demande..."
                        )
                    except Exception as err:
                        logger.warning("Could not edit status message for rate limit", error=str(err))

                await asyncio.sleep(wait_time)

                if status_msg:
                    try:
                        await status_msg.edit(
                            content="⚡ **Sentinel Agent** analyse le dépôt GitHub et traite votre demande..."
                        )
                    except Exception as err:
                        logger.warning("Could not restore status message after rate limit delay", error=str(err))

            # Re-nettoyer les timestamps après attente
            now = time.time()
            while request_timestamps and (now - request_timestamps[0]) >= RATE_LIMIT_WINDOW_SECONDS:
                request_timestamps.pop(0)

        request_timestamps.append(now)
        return now


# Configuration des intendants (intents) Discord
intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)


@bot.event
async def on_ready():
    logger.info("Sentinel Discord Bot connected", user=str(bot.user), id=bot.user.id)
    print(f"🤖 Sentinel Discord Bot est connecté sous le nom de : {bot.user}")


@bot.event
async def on_message(message: discord.Message):
    # Ne pas répondre à soi-même
    if message.author == bot.user:
        return

    logger.info("Received Discord message", author=str(message.author), content=repr(message.content), channel=str(message.channel))


    is_dm = isinstance(message.channel, discord.DMChannel)
    bot_mentioned = (bot.user in message.mentions) if bot.user else False
    has_role_mention = len(message.role_mentions) > 0 or "<@&" in message.content
    is_direct_cmd = (
        message.content.startswith("!")
        or "brad" in message.content.lower()
        or "sentinel" in message.content.lower()
    )

    if bot_mentioned or has_role_mention or is_direct_cmd or is_dm:
        prompt = message.content
        # Nettoyer toutes les mentions utilisateur (<@123>), rôle (<@&123>) et préfixes
        import re
        prompt = re.sub(r"<@&?\d+>", "", prompt)
        prompt = (
            prompt.replace("!sentinel", "")
            .replace("!agent", "")
            .replace("!brad", "")
            .replace("!ping", "ping")
            .strip()
        )

        clean_prompt = prompt.lower().strip()

        # Réponses instantanées pour ping/aide
        if clean_prompt in ["ping", "pong"]:
            await message.channel.send("🏓 **Pong !** Agent Brad est en ligne et prêt pour la maintenance du dépôt GitHub.")
            return


        if not prompt:
            await message.channel.send("👋 Bonjour ! Envoyez-moi une instruction de maintenance ou de documentation (ex: `@Brad Mets à jour le README avec les endpoints agent`).")
            return


        async with message.channel.typing():
            logger.info("Discord Bot received task prompt", author=str(message.author), prompt=prompt[:100])
            
            # Message de confirmation initial
            status_msg = await message.channel.send("⚡ **Sentinel Agent** analyse le dépôt GitHub et traite votre demande...")

            # Application de la limite de débit de Brad (5 req/min)
            await acquire_rate_limit_slot(status_msg=status_msg)

            try:
                # Exécution de l'agent Gemini + Outils GitHub
                # Note: On obtient une session Neo4j pour l'historique du graphe
                async for session in get_session():
                    result = await run_agent_task(prompt=prompt, session=session)
                    break
                else:
                    result = await run_agent_task(prompt=prompt)

                pr_urls = result.get("pr_urls", [])
                response_text = result.get("message", "Tâche terminée.")

                # Formater la réponse Discord
                reply_lines = [f"✅ **Résultat de l'agent Sentinel :**\n{response_text}"]
                if pr_urls:
                    reply_lines.append("\n🔀 **Pull Request(s) générée(s) :**")
                    for url in pr_urls:
                        reply_lines.append(f"- <{url}>")

                final_reply = "\n".join(reply_lines)
                
                # découpage si la réponse dépasse la limite Discord de 2000 caractères
                if len(final_reply) > 2000:
                    final_reply = final_reply[:1990] + "..."

                await status_msg.edit(content=final_reply)

            except Exception as e:
                logger.error("Error processing Discord bot command", error=str(e))
                await status_msg.edit(content=f"❌ Erreur lors du traitement de la demande : {str(e)}")

    await bot.process_commands(message)


@bot.command(name="ping")
async def ping(ctx):
    """Vérifie que le bot Sentinel répond."""
    await ctx.send("Pong ! Sentinel Bot est opérationnel.")


def run_discord_bot():
    """Démarre le bot Discord worker."""
    token = settings.discord_bot_token or os.environ.get("DISCORD_BOT_TOKEN", "")
    if not token or token.strip() == "":
        logger.warning("DISCORD_BOT_TOKEN manquant. Le worker Discord ne peut pas démarrer.")
        print("⚠️ Impossible de démarrer le bot Discord : DISCORD_BOT_TOKEN non configuré.")
        return

    logger.info("Starting Sentinel Discord Bot Worker...")
    bot.run(token)


if __name__ == "__main__":
    run_discord_bot()
