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
    from:    'Stridely <onboarding@resend.dev>',
    to:      contactEmail,
    replyTo: safeEmail,
    subject: `[Stridely Contact] ${topicLabels[safeTopic]} — ${safeName}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
        <h2 style="margin: 0 0 24px; font-size: 20px; color: #111827;">Nuevo mensaje de contacto</h2>

        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          <tr>
            <td style="padding:8px 0; color:#6B7280; width:100px; vertical-align:top;">Nombre</td>
            <td style="padding:8px 0; font-weight:600; color:#111827;">${safeName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#6B7280; vertical-align:top;">Email</td>
            <td style="padding:8px 0; font-weight:600; color:#111827;">${safeEmail}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#6B7280; vertical-align:top;">Tema</td>
            <td style="padding:8px 0; color:#111827;">${topicLabels[safeTopic]}</td>
          </tr>
        </table>

        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />

        <p style="font-size:14px; color:#6B7280; margin:0 0 8px;">Mensaje:</p>
        <p style="font-size:15px; color:#111827; line-height:1.6; margin:0; white-space:pre-wrap;">${safeMessage}</p>

        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="font-size:12px; color:#9CA3AF; margin:0;">Este mensaje fue enviado desde el formulario de contacto de <a href="https://stridelyapp.com" style="color:#7C3AED;">stridely.app</a></p>
      </div>
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
