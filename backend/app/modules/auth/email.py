import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("datamind.email")


class EmailService:
    async def send_verification(self, email: str, token: str) -> None:
        settings = get_settings()
        await self._send(
            email,
            "Verify your DataMind AI email",
            f"Verify your email: {settings.frontend_url}/verify-email?token={token}",
        )

    async def send_password_reset(self, email: str, token: str) -> None:
        settings = get_settings()
        await self._send(
            email,
            "Reset your DataMind AI password",
            f"Reset your password: {settings.frontend_url}/reset-password?token={token}",
        )

    async def _send(self, recipient: str, subject: str, body: str) -> None:
        settings = get_settings()
        if not settings.smtp_host:
            if settings.environment == "production":
                raise RuntimeError("SMTP_HOST is required in production")
            logger.info(
                "\n==================== [DEV EMAIL SIMULATION] ====================\n"
                "To: %s\nSubject: %s\n%s\n"
                "================================================================",
                recipient,
                subject,
                body,
            )
            return
        message = EmailMessage()
        message["From"] = settings.smtp_from
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)

        def deliver() -> None:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls()
                if settings.smtp_username and settings.smtp_password:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(message)

        await asyncio.to_thread(deliver)
