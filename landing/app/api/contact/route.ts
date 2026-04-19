import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// ─── Configuración ────────────────────────────────────────────────────────────
// RESEND_API_KEY  → variable de entorno en Vercel (.env.local en dev)
// CONTACT_EMAIL   → tu email personal donde recibirás los mensajes
//
// Sin dominio propio todavía:
//   from: "Stridely <onboarding@resend.dev>"  ← sender por defecto de Resend
//   to:   process.env.CONTACT_EMAIL           ← tu email personal
//
// Cuando tengas dominio (ej. stridely.app), solo cambia el "from" a:
//   "Stridely Contact <hola@stridely.app>"
// ─────────────────────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

// Temas permitidos — validación en servidor para evitar spam con categorías falsas
const ALLOWED_TOPICS = ['general', 'soporte', 'colaboracion', 'prensa', 'otro'] as const;

// Límite de longitud para evitar payloads excesivamente grandes
const MAX_NAME_LEN    = 100;
const MAX_EMAIL_LEN   = 254; // RFC 5321
const MAX_MESSAGE_LEN = 2000;

export async function POST(request: Request) {
  // ── 1. Parsear body ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición inválido.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  const { name, email, topic, message } = body as Record<string, unknown>;

  // ── 2. Validación ──────────────────────────────────────────────────────────
  if (
    typeof name    !== 'string' || name.trim().length    < 2 || name.trim().length    > MAX_NAME_LEN    ||
    typeof email   !== 'string' || email.trim().length   < 5 || email.trim().length   > MAX_EMAIL_LEN   ||
    typeof message !== 'string' || message.trim().length < 10 || message.trim().length > MAX_MESSAGE_LEN
  ) {
    return NextResponse.json({ error: 'Los campos no cumplen los requisitos mínimos.' }, { status: 422 });
  }

  // Validación básica de formato email (el frontend ya valida, pero siempre en servidor también)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return NextResponse.json({ error: 'El email no tiene un formato válido.' }, { status: 422 });
  }

  // Validar que el tema sea uno de los permitidos (si se envió uno)
  const safeTopic = typeof topic === 'string' && (ALLOWED_TOPICS as readonly string[]).includes(topic)
    ? topic
    : 'general';

  const topicLabels: Record<string, string> = {
    general:      'Consulta general',
    soporte:      'Soporte técnico',
    colaboracion: 'Colaboración / Partnership',
    prensa:       'Prensa / Medios',
    otro:         'Otro',
  };

  const safeName    = name.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeMessage = message.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeEmail   = email.trim().toLowerCase();

  // ── 3. Envío con Resend ────────────────────────────────────────────────────
  const contactEmail = process.env.CONTACT_EMAIL;
  if (!process.env.RESEND_API_KEY || !contactEmail) {
    console.error('[contact] Faltan variables de entorno RESEND_API_KEY o CONTACT_EMAIL');
    return NextResponse.json({ error: 'Servicio de email no configurado.' }, { status: 503 });
  }

  const { error } = await resend.emails.send({
    from:    'Stridely <hola@stridelyapp.com>',
    to:      contactEmail,
    replyTo: safeEmail,
    subject: `[Stridely Contact] ${topicLabels[safeTopic]} — ${safeName}`,
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#F3F4F6; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6; padding: 40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%;">

        <!-- Header con logo -->
        <tr>
          <td style="background:#111827; border-radius:12px 12px 0 0; padding:24px 32px; text-align:center;">
            <span style="font-size:22px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">
              stridely
            </span>
            <span style="font-size:22px; font-weight:800; color:#7C3AED; letter-spacing:-0.5px;">.</span>
          </td>
        </tr>

        <!-- Cuerpo -->
        <tr>
          <td style="background:#ffffff; padding:32px;">
            <!-- Badge -->
            <div style="display:inline-block; background:#EDE9FE; color:#5B21B6; font-size:11px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; padding:4px 10px; border-radius:20px; margin-bottom:20px;">
              Nuevo mensaje de contacto
            </div>

            <h2 style="margin:0 0 4px; font-size:20px; font-weight:700; color:#111827;">Tienes un mensaje de ${safeName}</h2>
            <p style="margin:0 0 24px; font-size:14px; color:#6B7280;">${topicLabels[safeTopic]}</p>

            <!-- Campo de datos -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB; border:1px solid #E5E7EB; border-radius:8px; margin-bottom:24px;">
              <tr>
                <td style="padding:12px 16px; border-bottom:1px solid #E5E7EB;">
                  <span style="font-size:11px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:2px;">Nombre</span>
                  <span style="font-size:14px; font-weight:600; color:#111827;">${safeName}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;">
                  <span style="font-size:11px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:2px;">Email (responder a)</span>
                  <a href="mailto:${safeEmail}" style="font-size:14px; font-weight:600; color:#7C3AED; text-decoration:none;">${safeEmail}</a>
                </td>
              </tr>
            </table>

            <!-- Mensaje -->
            <p style="font-size:12px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 8px;">Mensaje</p>
            <div style="background:#F9FAFB; border-left:3px solid #7C3AED; border-radius:0 8px 8px 0; padding:16px; font-size:15px; color:#374151; line-height:1.7; white-space:pre-wrap;">${safeMessage}</div>

            <!-- CTA responder -->
            <div style="margin-top:28px; text-align:center;">
              <a href="mailto:${safeEmail}?subject=Re: ${topicLabels[safeTopic]}" style="display:inline-block; background:#7C3AED; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; padding:12px 28px; border-radius:8px;">
                Responder a ${safeName}
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer corporativo -->
        <tr>
          <td style="background:#111827; border-radius:0 0 12px 12px; padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:15px; font-weight:700; color:#ffffff;">stridely</span>
                  <span style="font-size:15px; font-weight:700; color:#7C3AED;">.</span>
                  <p style="margin:6px 0 0; font-size:12px; color:#9CA3AF; line-height:1.5;">
                    Tu entrenador de running con IA.<br>
                    <a href="https://stridelyapp.com" style="color:#7C3AED; text-decoration:none;">stridelyapp.com</a>
                    &nbsp;·&nbsp;
                    <a href="mailto:hola@stridelyapp.com" style="color:#6B7280; text-decoration:none;">hola@stridelyapp.com</a>
                  </p>
                </td>
                <td align="right" valign="middle">
                  <!-- Iconos redes sociales (placeholder texto) -->
                  <a href="https://instagram.com/stridelyapp" style="color:#6B7280; text-decoration:none; font-size:12px; margin-left:12px;">Instagram</a>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top:16px; border-top:1px solid #1F2937; margin-top:16px;">
                  <p style="margin:0; font-size:11px; color:#4B5563; line-height:1.5;">
                    Este mensaje fue enviado automáticamente desde el formulario de contacto de stridelyapp.com.
                    Si no esperabas este email, puedes ignorarlo.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>
    `,
  });

  if (error) {
    console.error('[contact] Resend error:', error);
    return NextResponse.json({ error: 'No se pudo enviar el mensaje. Inténtalo de nuevo.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// Rechazar métodos que no sean POST
export async function GET()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
