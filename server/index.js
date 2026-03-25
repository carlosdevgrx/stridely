require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Variables globales
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_OAUTH_BASE = 'https://www.strava.com/oauth/token';

// Almacenamiento en memoria (en producción usar base de datos)
const users = {};

// Rutas de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// OAuth Callback - Intercambiar código por token
app.post('/api/strava/token', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'No code provided' });
    }

    console.log('Exchanging Strava code for token...');

    const response = await fetch(STRAVA_OAUTH_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Strava OAuth error:', error);
      return res.status(response.status).json({ 
        error: 'Failed to exchange code for token',
        details: error 
      });
    }

    const data = await response.json();
    console.log('Successfully obtained token');
    
    // Guardar token en memoria (con userId como clave)
    const userId = data.athlete.id.toString();
    users[userId] = {
      token: data.access_token,
      refreshToken: data.refresh_token,
      athleteId: data.athlete.id,
      athleteName: data.athlete.firstname + ' ' + data.athlete.lastname,
    };

    res.json({
      token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete: data.athlete,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy para obtener actividades
app.get('/api/strava/activities', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const params = new URLSearchParams({
      page: req.query.page || 1,
      per_page: req.query.per_page || 30,
    });

    console.log(`Fetching activities from Strava...`);

    const response = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Strava API error:', response.status, errorData);
      return res.status(response.status).json({ 
        error: 'Failed to fetch from Strava',
        details: errorData 
      });
    }

    const data = await response.json();
    console.log(`Successfully fetched ${data.length} activities`);
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy para obtener detalle de una actividad
app.get('/api/strava/activities/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const { id } = req.params;
    const response = await fetch(`${STRAVA_API_BASE}/activities/${id}?include_all_efforts=false`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorData = await response.text();
      return res.status(response.status).json({ error: 'Failed to fetch activity', details: errorData });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy para obtener perfil del atleta
app.get('/api/strava/athlete', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const response = await fetch(`${STRAVA_API_BASE}/athlete`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch athlete profile' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── AI Coach – diagnóstico GET /api/ai/test ──────────────────────────────
app.get('/api/ai/test', async (req, res) => {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.json({ ok: false, error: 'GROQ_API_KEY no definida' });

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Di "ok" en español.' }],
        max_tokens: 10,
      }),
    });
    const data = await r.json();
    res.json({ status: r.status, ok: r.ok, data });
  } catch (err) {
    res.json({ ok: false, fetchError: err.message });
  }
});

// ─── AI Coach – POST /api/ai/recommend ──────────────────────────────────────
app.post('/api/ai/recommend', async (req, res) => {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(503).json({ error: 'AI no configurada' });

  const { activities } = req.body;
  if (!Array.isArray(activities) || activities.length === 0) {
    return res.status(400).json({ error: 'activities requerido' });
  }

  try {
    const now = new Date();
    const todayStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Sort activities by date descending
    const sortedActs = [...activities].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Compute days since last run
    const lastDate = sortedActs[0]?.date ? new Date(sortedActs[0].date) : null;
    let restContext = 'No hay actividades registradas.';
    if (lastDate) {
      const diffMs = now - lastDate;
      const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (daysSince === 0) restContext = 'El corredor ya ha salido HOY.';
      else if (daysSince === 1) restContext = 'El corredor salió AYER.';
      else restContext = `El corredor lleva ${daysSince} días sin salir a correr.`;
    }

    const summary = sortedActs.slice(0, 10).map((a, i) => {
      const km = ((a.distance ?? 0) / 1000).toFixed(1);
      const mins = Math.floor((a.duration ?? 0) / 60);
      const pace = a.pace ?? 0;
      const paceMin = Math.floor(pace / 60);
      const paceSec = String(Math.round(pace % 60)).padStart(2, '0');
      const date = a.date ? new Date(a.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : '?';
      return `${i + 1}. ${date} — ${km} km · ${mins} min · ${paceMin}:${paceSec}/km`;
    }).join('\n');

    const prompt = `Eres un entrenador personal de running experto y motivador. Hoy es ${todayStr}.

Situación: ${restContext}

Últimas actividades del corredor:
${summary}

Analiza el historial y decide la sesión óptima para hoy teniendo en cuenta:
- Si salió HOY: recomienda descanso.
- Si salió ayer con alta intensidad: considera descanso o rodaje muy suave.
- Si lleva 2-3 días sin correr: ideal para sesión de calidad (series, tempo).
- Si lleva 4+ días sin correr: retomar progresivamente con rodaje suave.

Responde ÚNICAMENTE con un objeto JSON válido. Sin texto antes ni después. Sin bloque de código. Solo el JSON puro:
{
  "sessionType": "tipo de sesión en español (Rodaje suave / Series X m / Tempo / Fartlek / Descanso / etc.)",
  "distance": "X km",
  "targetPace": "M:SS /km",
  "recovery": "X min",
  "isRestDay": false,
  "message": "1-2 frases en español, motivadoras y personalizadas. Menciona cuántos días lleva sin correr si son más de 2. Si recomiendas descansar, explica brevemente por qué."
}
Nota: si es día de descanso pon isRestDay: true y distance, targetPace, recovery pueden ser null.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 350,
        temperature: 0.7,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      console.error('Groq error:', groqRes.status, JSON.stringify(data));
      return res.status(502).json({ error: 'Error de Groq', details: data?.error?.message ?? String(groqRes.status) });
    }

    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!raw) {
      console.error('Groq empty response:', JSON.stringify(data));
      return res.status(500).json({ error: 'Respuesta vacía' });
    }

    // Extract JSON object from response (handles any extra surrounding text)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in Groq response:', raw);
      return res.status(500).json({ error: 'Formato de respuesta inválido' });
    }

    let recommendation;
    try {
      recommendation = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message, jsonMatch[0]);
      return res.status(500).json({ error: 'Error parseando respuesta AI' });
    }

    res.json({ recommendation });
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ error: 'Error generando recomendación', details: err.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Stridely server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   OAuth callback: POST ${PORT}/api/strava/token`);
});
