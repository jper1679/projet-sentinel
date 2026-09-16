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

logger = structlog.get_logger()
settings = get_settings()

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

    # Détecter la mention du bot (@Brad / @SentinelBot) ou commande directe
    bot_mentioned = bot.user in message.mentions if bot.user else False
    is_direct_cmd = (
        message.content.startswith("!sentinel")
        or message.content.startswith("!agent")
        or message.content.startswith("!brad")
    )

    if bot_mentioned or is_direct_cmd:
        prompt = message.content
        # Nettoyer les mentions et préfixes
        if bot.user:
            prompt = prompt.replace(f"<@{bot.user.id}>", "").replace(f"<@!{bot.user.id}>", "")
        prompt = (
            prompt.replace("!sentinel", "")
            .replace("!agent", "")
            .replace("!brad", "")
            .strip()
        )


        if not prompt:
            await message.channel.send("👋 Bonjour ! Envoyez-moi une instruction de maintenance ou de documentation (ex: `@SentinelBot Mets à jour le README avec les endpoints agent`).")
            return

        async with message.channel.typing():
            logger.info("Discord Bot received task prompt", author=str(message.author), prompt=prompt[:100])
            
            # Message de confirmation initial
            status_msg = await message.channel.send("⚡ **Sentinel Agent** analyse le dépôt GitHub et traite votre demande...")

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
