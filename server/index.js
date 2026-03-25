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

// ─── Strava token refresh ────────────────────────────────────────────────────
app.post('/api/strava/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token requerido' });

  try {
    const response = await fetch(STRAVA_OAUTH_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Strava refresh error:', response.status, errorData);
      return res.status(response.status).json({ error: 'Error renovando token de Strava', details: errorData });
    }

    const data = await response.json();
    res.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    });
  } catch (err) {
    console.error('Strava refresh exception:', err.message);
    res.status(500).json({ error: err.message });
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

    // Extra context: sessions this week + quality session in last 4 days
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    const dayOfWeek = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const sessionsThisWeek = sortedActs.filter(a => a.date && new Date(a.date) >= weekStart).length;
    const totalKmThisWeek = sortedActs
      .filter(a => a.date && new Date(a.date) >= weekStart)
      .reduce((s, a) => s + ((a.distance ?? 0) / 1000), 0);

    // Avg pace of all recorded runs (seconds/km)
    const pacedRuns = sortedActs.filter(a => (a.pace ?? 0) > 0);
    const avgPace = pacedRuns.length
      ? pacedRuns.reduce((s, a) => s + a.pace, 0) / pacedRuns.length
      : 0;
    // Easy pace threshold: average + 30 s/km
    const easyThreshold = avgPace + 30;

    // Did the runner do a quality session (faster than avg) in the last 4 days?
    const fourDaysAgo = new Date(now); fourDaysAgo.setDate(now.getDate() - 4);
    const recentQuality = sortedActs.some(a =>
      a.date && new Date(a.date) >= fourDaysAgo && (a.pace ?? 0) > 0 && a.pace < avgPace
    );

    const weekContext = `Esta semana: ${sessionsThisWeek} sesión(es), ${totalKmThisWeek.toFixed(1)} km totales.`;
    const qualityContext = recentQuality
      ? 'Ya realizó una sesión de calidad (ritmo rápido) en los últimos 4 días.'
      : 'No ha realizado sesiones de calidad en los últimos 4 días.';
    const paceContext = avgPace > 0
      ? `Ritmo medio habitual: ${Math.floor(avgPace / 60)}:${String(Math.round(avgPace % 60)).padStart(2, '0')}/km. Rodaje suave recomendado: por encima de ${Math.floor(easyThreshold / 60)}:${String(Math.round(easyThreshold % 60)).padStart(2, '0')}/km.`
      : '';

    const prompt = `Eres un entrenador personal de running experto. Hoy es ${todayStr}.

CONTEXTO:
- ${restContext}
- ${weekContext}
- ${qualityContext}
- ${paceContext}

Últimas actividades:
${summary}

REGLAS DE ENTRENAMIENTO (aplícalas en orden de prioridad):
1. Si salió HOY → Descanso obligatorio.
2. Si salió ayer Y fue sesión intensa (ritmo rápido) → Descanso o rodaje muy suave (+45 s/km sobre su ritmo medio).
3. La distribución correcta es 80% sesiones suaves y 20% de calidad. Las series o tempo solo tienen sentido 1-2 veces por semana como máximo.
4. Si ya hizo una sesión de calidad esta semana o en los últimos 4 días → NO recomendar series ni tempo, recomendar rodaje suave o continuo.
5. Si lleva 4+ días sin correr → Retomar con rodaje suave de duración moderada, no con calidad.
6. Si lleva 2-3 días sin correr Y no hay calidad reciente → Puede ser buena sesión de calidad (solo si el volumen semanal lo permite).
7. En la mayoría de los casos la recomendación debe ser: rodaje suave de X km o de Y minutos, rodaje continuo, o rodaje largo. Las series son la excepción, no la norma.

TIPOS DE SESIÓN disponibles (elige el más adecuado):
- Rodaje suave: distancia cómoda (6-14 km típicamente) a ritmo fácil. Usa "X km" en distance.
- Rodaje continuo: ritmo medio sostenido, 8-16 km. Usa "X km".
- Rodaje largo: distancia larga (16-24 km) a ritmo suave. Usa "X km".
- Rodaje por tiempo: cuando la distancia no es el objetivo. Usa "X min" en distance (nota: aquí distance es duración).
- Tempo / Umbral: 6-10 km a ritmo de umbral. Solo si está descansado y sin calidad reciente.
- Fartlek: juego de ritmos variados. Solo si está descansado.
- Series X m: repeticiones cortas con recuperación. SOLO si está muy descansado (2+ días) y no hay calidad reciente esta semana. En recovery indica el descanso entre series (ej: "90 seg").
- Descanso: si salió hoy o está fatigado.

Responde ÚNICAMENTE con un objeto JSON válido. Sin texto antes ni después. Sin bloque de código. Solo el JSON puro:
{
  "sessionType": "nombre del tipo de sesión",
  "distance": "X km  o  X min  (según el tipo)",
  "targetPace": "M:SS /km  o  null si es rodaje libre",
  "recovery": "solo para series: tiempo entre repeticiones, ej '90 seg'. Para el resto: null",
  "isRestDay": false,
  "message": "1-2 frases en español, motivadoras y concretas. Menciona el contexto relevante (días sin correr, semana cargada, etc.)."
}
Si es día de descanso: isRestDay true, distance/targetPace/recovery null.`;

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

// ─── AI Training Plan – POST /api/ai/training-plan ──────────────────────────
app.post('/api/ai/training-plan', async (req, res) => {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(503).json({ error: 'AI no configurada' });

  const { goal, days_per_week, activities } = req.body;
  if (!goal || !days_per_week) return res.status(400).json({ error: 'goal y days_per_week requeridos' });

  try {
    const actSummary = Array.isArray(activities) && activities.length > 0
      ? activities.slice(0, 5).map((a, i) => {
          const km = ((a.distance ?? 0) / 1000).toFixed(1);
          const mins = Math.floor((a.duration ?? 0) / 60);
          const pace = a.pace ?? 0;
          const paceMin = Math.floor(pace / 60);
          const paceSec = String(Math.round(pace % 60)).padStart(2, '0');
          return `${i + 1}. ${km} km · ${mins} min · ${paceMin}:${paceSec}/km`;
        }).join('\n')
      : 'Sin historial previo — corredor principiante.';

    const goalLabel = goal === '5km' ? 'correr 5 km sin parar' : 'correr 10 km sin parar';
    const weeksRange = goal === '5km' ? '4-6 semanas' : '7-10 semanas';

    const prompt = `Eres un entrenador de running experto. Crea un plan de entrenamiento personalizado.

OBJETIVO: ${goalLabel}
DÍAS DE ENTRENAMIENTO POR SEMANA: ${days_per_week}
DURACIÓN DEL PLAN: ${weeksRange} según el nivel del corredor
HISTORIAL RECIENTE DEL CORREDOR:
${actSummary}

REGLAS:
- Cada semana tiene EXACTAMENTE ${days_per_week} sesiones.
- Progresión gradual: las primeras semanas son más suaves, aumenta el volumen/intensidad gradualmente.
- Distribuye las sesiones con descanso entre ellas (ej: si son 3 días, usa lunes/miércoles/viernes → day_number 1/3/5).
- Variedad de sesiones: rodaje suave, rodaje continuo, intervalos cortos, fartlek, rodaje largo.
- Duraciones en minutos (ej: "20 min") para sesiones por tiempo, o distancias (ej: "3 km") para principiantes avanzados.
- Descripciones cortas, concretas y motivadoras en español (máx 10 palabras).
- day_number: 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 7=Dom.

Responde ÚNICAMENTE con JSON puro válido, sin ningún texto antes ni después:
{
  "total_weeks": number,
  "weeks": [
    {
      "week": number,
      "sessions": [
        {
          "day_number": number,
          "type": "tipo de sesión en español",
          "duration": "X min o X km",
          "description": "frase corta motivadora"
        }
      ]
    }
  ]
}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.6,
      }),
    });

    const data = await groqRes.json();
    if (!groqRes.ok) {
      console.error('Groq training plan error:', groqRes.status, JSON.stringify(data));
      return res.status(502).json({ error: data?.error?.message ?? 'Error de Groq' });
    }

    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON in training plan response:', raw);
      return res.status(500).json({ error: 'Formato de respuesta inválido' });
    }

    let plan;
    try { plan = JSON.parse(jsonMatch[0]); }
    catch (e) { return res.status(500).json({ error: 'Error parseando plan' }); }

    res.json({ plan });
  } catch (err) {
    console.error('Training plan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Stridely server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   OAuth callback: POST ${PORT}/api/strava/token`);
});
