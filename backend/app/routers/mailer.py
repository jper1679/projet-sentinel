# ==============================================================================
# Projet Sentinel — Router Mailer (ADMIN uniquement)
# POST /api/mailer/send
# ==============================================================================

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

from app.auth.dependencies import AdminOnly
from app.services.mailer import send_email

router = APIRouter()


class MailRequest(BaseModel):
    to_email: EmailStr
    to_name: str
    subject: str
    html_content: str
    text_content: Optional[str] = None


@router.post("/send", summary="Envoyer un e-mail via Brevo (ADMIN)")
async def send_mail(body: MailRequest, _admin: AdminOnly):
    result = await send_email(
        to_email=body.to_email,
        to_name=body.to_name,
        subject=body.subject,
        html_content=body.html_content,
        text_content=body.text_content,
    )
    return {"status": "sent", "message_id": result}
