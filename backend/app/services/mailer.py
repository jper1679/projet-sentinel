# ==============================================================================
# Projet Sentinel — Service Mailer (Brevo SMTP v3 API)
# Utilise httpx async pour les appels à l'API transactionnelle Brevo
# ==============================================================================

from typing import Optional

import httpx
import structlog

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


async def send_email(
    to_email: str,
    to_name: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
) -> str:
    """
    Envoie un e-mail via l'API Brevo (ex-Sendinblue).
    Retourne le message ID Brevo ou lève une exception en cas d'erreur.
    """
    payload = {
        "sender": {
            "email": settings.brevo_sender_email,
            "name": settings.brevo_sender_name,
        },
        "to": [{"email": to_email, "name": to_name}],
        "subject": subject,
        "htmlContent": html_content,
    }
    if text_content:
        payload["textContent"] = text_content

    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": settings.brevo_api_key,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(BREVO_API_URL, json=payload, headers=headers)

    if response.status_code not in (200, 201):
        logger.error(
            "Brevo email send failed",
            status=response.status_code,
            body=response.text,
        )
        raise RuntimeError(f"Brevo API error {response.status_code}: {response.text}")

    data = response.json()
    message_id = data.get("messageId", "unknown")
    logger.info("Email sent via Brevo", to=to_email, message_id=message_id)
    return message_id
