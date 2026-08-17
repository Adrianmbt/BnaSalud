"""Correos por SMTP (Fase 3): tarjeta de bienvenida y recuperación de PIN.

Si no hay SMTP configurado en .env, las funciones devuelven False y el
sistema sigue en modo demo (PIN/código mostrado en pantalla).
"""
from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def smtp_habilitado() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_PORT)


def _plantilla_welcome(nombre: str, cedula: str, pin: str) -> str:
    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#f6f7f9;border-radius:16px;overflow:hidden;border:1px solid #e2e5ea">
      <div style="background:linear-gradient(135deg,#0b3d91,#1d4ed8);padding:22px 26px;color:#fff">
        <p style="margin:0;font-size:13px;letter-spacing:2px;opacity:.85">BNA SALUD · RED DE SALUD</p>
        <h1 style="margin:6px 0 0;font-size:20px">¡Bienvenido, {nombre}!</h1>
      </div>
      <div style="padding:24px 26px">
        <p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.6">
          Tu historia clínica fue creada en la red. Con tu cédula y este PIN
          puedes entrar al <b>Portal del Paciente</b> para ver citas, estudios y recetas.
        </p>
        <div style="background:#fff;border:1px dashed #1d4ed8;border-radius:12px;padding:16px 20px;margin:14px 0">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:1px;color:#6b7280">CÉDULA</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#0b3d91">{cedula}</p>
          <p style="margin:14px 0 6px;font-size:11px;letter-spacing:1px;color:#6b7280">PIN DE ACCESO</p>
          <p style="margin:0;font-size:26px;font-weight:800;letter-spacing:8px;color:#1d4ed8">{pin}</p>
        </div>
        <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6">
          Guarda este PIN en un lugar seguro. Nadie de BNA Salud te lo pedirá
          por teléfono ni por correo.
        </p>
      </div>
      <div style="padding:12px 26px;background:#eef1f6;font-size:11px;color:#9aa3b2">
        Correo automático del Sistema de Salud Barcelona. No respondas a este mensaje.
      </div>
    </div>
    """


def _plantilla_codigo(nombre: str, codigo: str, minutos: int) -> str:
    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#f6f7f9;border-radius:16px;overflow:hidden;border:1px solid #e2e5ea">
      <div style="background:linear-gradient(135deg,#0b3d91,#1d4ed8);padding:22px 26px;color:#fff">
        <p style="margin:0;font-size:13px;letter-spacing:2px;opacity:.85">BNA SALUD · RECUPERACIÓN DE PIN</p>
        <h1 style="margin:6px 0 0;font-size:20px">Hola, {nombre}</h1>
      </div>
      <div style="padding:24px 26px">
        <p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.6">
          Recibimos una solicitud para restablecer tu PIN de acceso. Usa este
          código en el portal del paciente:
        </p>
        <div style="background:#fff;border:1px dashed #1d4ed8;border-radius:12px;padding:16px;text-align:center;margin:14px 0">
          <p style="margin:0;font-size:30px;font-weight:800;letter-spacing:10px;color:#1d4ed8">{codigo}</p>
        </div>
        <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6">
          El código expira en <b>{minutos} minutos</b>. Si no solicitaste este cambio,
          ignora este mensaje; tu PIN actual sigue siendo válido.
        </p>
      </div>
      <div style="padding:12px 26px;background:#eef1f6;font-size:11px;color:#9aa3b2">
        Correo automático del Sistema de Salud Barcelona. No respondas a este mensaje.
      </div>
    </div>
    """


def enviar_correo(destinatario: str, asunto: str, html: str) -> bool:
    """Envía un correo HTML por SMTP. Devuelve False en modo demo o si falla."""
    if not smtp_habilitado() or not (destinatario or "").strip():
        return False
    try:
        mensaje = MIMEMultipart("alternative")
        mensaje["Subject"] = asunto
        mensaje["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@bnasalud.local"
        mensaje["To"] = destinatario.strip()
        mensaje.attach(MIMEText(html, "html", "utf-8"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as servidor:
            if settings.SMTP_USE_TLS:
                servidor.starttls()
            if settings.SMTP_USER:
                servidor.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
            servidor.sendmail(mensaje["From"], [mensaje["To"]], mensaje.as_string())
        return True
    except Exception:
        return False


def enviar_welcome(nombre: str, cedula: str, pin: str, email: str) -> bool:
    """Tarjeta de bienvenida con el PIN inicial (nuevo paciente)."""
    return enviar_correo(
        email,
        "¡Bienvenido a BNA Salud! Tu PIN de acceso al portal",
        _plantilla_welcome(nombre, cedula, pin),
    )


def enviar_codigo_recuperacion(nombre: str, codigo: str, minutos: int, email: str) -> bool:
    """Código de recuperación de PIN de 6 dígitos."""
    return enviar_correo(
        email,
        "Recuperación de PIN — BNA Salud",
        _plantilla_codigo(nombre, codigo, minutos),
    )