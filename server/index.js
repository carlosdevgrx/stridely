require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const webpush = require('web-push');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Web Push VAPID ──────────────────────────────────────────────────────────
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:hola@stridely.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// Variables globales
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_OAUTH_BASE = 'https://www.strava.com/oauth/token';

// Almacenamiento en memoria (en producción usar base de datos)
const users = {};

// Push subscriptions en memoria: Map<endpoint, { subscription, athleteId, todaySession }>
const pushSubscriptions = new Map();

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

  const { activities, recent_checkins } = req.body;
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

    const checkinsContext = Array.isArray(recent_checkins) && recent_checkins.length > 0
      ? '\nFEEDBACK RECIENTE DEL CORREDOR (check-ins post-entrenamiento):\n' +
        recent_checkins.map((c, i) => `${i + 1}. ${c.date}: "${c.answer}"`).join('\n')
      : '';

    const prompt = `Eres un entrenador personal de running experto. Hoy es ${todayStr}.

CONTEXTO:
- ${restContext}
- ${weekContext}
- ${qualityContext}
- ${paceContext}${checkinsContext}

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

  const { goal, days_per_week, activities, mode, race_date, race_distance, weekly_km, longest_run, race_goal, target_time, long_run_day } = req.body;

  const isRace = mode === 'race';
  if (!isRace && (!goal || !days_per_week)) return res.status(400).json({ error: 'goal y days_per_week requeridos' });
  if (isRace && (!race_distance || !race_date || !days_per_week)) return res.status(400).json({ error: 'race_distance, race_date y days_per_week requeridos' });

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

    let prompt;

    if (isRace) {
      // ── Race-specific plan with periodization ──────────────────────────────
      const raceDistanceLabels = {
        '5km': '5 km',
        '10km': '10 km',
        'half': 'media maratón (21,1 km)',
        'marathon': 'maratón (42,2 km)',
      };
      const raceLabel = raceDistanceLabels[race_distance] ?? race_distance;
      const raceGoalLabel = race_goal === 'time' && target_time
        ? `terminarla en ${target_time}`
        : 'terminarla (objetivo: completarla)';

      // ── Precise week calculation — timezone-safe noon-based local dates ──
      const today = new Date();
      const todayDow = today.getDay(); // 0=Dom...6=Sáb
      const daysToMonday = todayDow === 0 ? -6 : 1 - todayDow;
      const planMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToMonday, 12, 0, 0);

      // Race date at local noon to avoid UTC parse shifting the day
      const [ryear, rmonth, rday] = race_date.split('-').map(Number);
      const raceDateNoon = new Date(ryear, rmonth - 1, rday, 12, 0, 0);
      const raceDow = raceDateNoon.getDay();

      // today in 1=Lun...7=Dom system
      const todayDayNumber = todayDow === 0 ? 7 : todayDow;
      const raceDayNumber = raceDow === 0 ? 7 : raceDow;
      const DAY_NAMES_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const todayDayName = DAY_NAMES_ES[todayDayNumber - 1];
      const raceDayName = DAY_NAMES_ES[raceDayNumber - 1];

      // Exact number of weeks from planMonday to race date (no forced minimum — frontend validates)
      const msToRace = raceDateNoon.getTime() - planMonday.getTime();
      const totalWeeks = Math.min(Math.ceil(msToRace / (7 * 24 * 60 * 60 * 1000)), 24);

      // Training weeks (excluding the race week)
      const trainingWeeks = totalWeeks - 1;
      const baseWeeks   = Math.max(1, Math.floor(trainingWeeks * 0.35));
      const buildWeeks  = Math.max(1, Math.floor(trainingWeeks * 0.40));
      const peakWeeks   = 1;
      const taperWeeks  = Math.max(1, trainingWeeks - baseWeeks - buildWeeks - peakWeeks);

      const longRunTarget = race_distance === 'marathon' ? '32-35 km'
        : race_distance === 'half' ? '18-19 km'
        : race_distance === '10km' ? '12-14 km'
        : '6-7 km';

      // Available days remaining in week 1 (today and onwards)
      const daysLeftInWeek = 7 - todayDayNumber + 1;
      const week1MaxSessions = Math.min(days_per_week, daysLeftInWeek);
      const week1Note = todayDayNumber === 1
        ? `La semana 1 empieza hoy lunes con las ${days_per_week} sesiones habituales.`
        : `La semana 1 empieza hoy ${todayDayName} (day_number ${todayDayNumber}). REGLAS ESTRICTAS:
  - Solo usar day_number >= ${todayDayNumber}.
  - Pon MÁXIMO ${week1MaxSessions} sesión/es (las que quepan con descanso entre ellas).
  - OBLIGATORIO: deja al menos 1 día de descanso entre cada sesión (no días consecutivos).
  - Ejemplos válidos con inicio en ${todayDayNumber}: ${
    todayDayNumber === 4 ? 'Jue(4)+Sáb(6), o Jue(4)+Dom(7), o solo Jue(4)' :
    todayDayNumber === 5 ? 'Vie(5)+Dom(7), o solo Vie(5)' :
    todayDayNumber === 6 ? 'Solo Sáb(6)' :
    todayDayNumber === 7 ? 'Solo Dom(7)' :
    `${todayDayNumber} y ${todayDayNumber + 2} si cabe`
  }.`;

      // Long run day instruction
      const longRunDayInstruction = long_run_day === 'saturday'
        ? 'sábado (day_number 6). En semanas donde el sábado no esté disponible o sea la carrera, usar el viernes (5).'
        : long_run_day === 'sunday'
          ? 'domingo (day_number 7). En semanas donde el domingo no esté disponible o sea la carrera, usar el sábado (6).'
          : 'sábado (day_number 6) o domingo (day_number 7), a tu criterio.';

      // Race week note
      const raceWeekSessions = raceDayNumber > 2
        ? `Sesiones suaves de activación solo en los días ANTES de la carrera (day_number < ${raceDayNumber}). Máximo 2 sesiones cortas y fáciles.`
        : `La carrera es ${raceDayName}, muy pronto en la semana. Solo la sesión de carrera, sin entrenamiento previo esa semana.`;

      prompt = `Eres un entrenador de running experto con conocimientos de periodización. Crea un plan de preparación para una carrera específica.

CARRERA OBJETIVO: ${raceLabel}
FECHA DE LA CARRERA: ${race_date} (${raceDayName})
SEMANAS TOTALES DEL PLAN: EXACTAMENTE ${totalWeeks}
META DEL CORREDOR: ${raceGoalLabel}
DÍAS DE ENTRENAMIENTO POR SEMANA: ${days_per_week}

NIVEL ACTUAL:
- Kilómetros semanales habituales: ${weekly_km ?? 'desconocido'}
- Tirada más larga reciente: ${longest_run ?? 'desconocida'}

HISTORIAL RECIENTE:
${actSummary}

ESTRUCTURA DE PERIODIZACIÓN (semanas 1 a ${trainingWeeks}, excluyendo la semana de carrera ${totalWeeks}):
- FASE BASE (~${baseWeeks} semanas): rodajes suaves, construcción aeróbica. Volumen bajo-moderado.
- FASE ESPECÍFICA (~${buildWeeks} semanas): aumento de volumen, tiradas largas crecientes, intervalos a ritmo de carrera.
- SEMANA PICO (semana ${baseWeeks + buildWeeks + 1}): máximo volumen. Tirada larga más larga: ${longRunTarget}.
- TAPER (~${taperWeeks} semana/s, justo antes de la semana de carrera): reducción -30% a -50%, llegar descansado/a.

SEMANA 1 (REGLA ESPECIAL — CUMPLIR ESTRICTAMENTE):
${week1Note}

SEMANA ${totalWeeks} — SEMANA DE CARRERA (REGLA ESPECIAL OBLIGATORIA):
${raceWeekSessions}
El ÚLTIMO elemento de sessions en la semana ${totalWeeks} DEBE SER EXACTAMENTE:
{"day_number": ${raceDayNumber}, "type": "🏆 Día de carrera", "duration": "${raceLabel}", "description": "¡A por ello!", "intensity": "intenso", "pace_hint": ""}
NO añadas ninguna sesión con day_number > ${raceDayNumber} en la semana ${totalWeeks}.

REGLAS GENERALES:
- El JSON final DEBE tener total_weeks: ${totalWeeks}.
- Las semanas 2 a ${trainingWeeks} tienen EXACTAMENTE ${days_per_week} sesiones cada una.
- Distribuye los ${days_per_week} días con AL MENOS 1 día de descanso entre ellos. NUNCA días consecutivos (ej 3 días → lun/mié/sáb → day_number 1/3/6).
- Progresión de volumen gradual, no más del 10% por semana en fase específica.
- TIRADAS LARGAS: programar SIEMPRE en ${longRunDayInstruction}
- description: etiqueta corta máx 3 palabras.
- intensity: "fácil" | "moderado" | "intenso".
- pace_hint: ritmo orientativo SOLO para moderado/intenso (ej: "6:30-7:00/km"). Vacío para fácil.
- duration: distancia en km para rodajes, tiempo en min para intervalos/fartlek.
- day_number: 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 7=Dom.

Responde ÚNICAMENTE con JSON puro válido, sin ningún texto antes ni después:
{
  "total_weeks": ${totalWeeks},
  "weeks": [
    {
      "week": number,
      "sessions": [
        {
          "day_number": number,
          "type": "tipo de sesión en español",
          "duration": "X min o X km",
          "description": "etiqueta corta máx 3 palabras",
          "intensity": "fácil|moderado|intenso",
          "pace_hint": "X:XX-X:XX/km o vacío"
        }
      ]
    }
  ]
}`;
    } else {
      // ── Quick plan (5km / 10km) ────────────────────────────────────────────
      const goalLabel = goal === '5km' ? 'correr 5 km sin parar' : 'correr 10 km sin parar';
      const weeksRange = goal === '5km' ? '4-6 semanas' : '7-10 semanas';

      prompt = `Eres un entrenador de running experto. Crea un plan de entrenamiento personalizado.

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
- Alterna entre sesiones por tiempo ("20 min", "30 min") y por distancia ("3 km", "4 km") según el nivel y la semana.
- description: etiqueta corta del tipo de esfuerzo, máx 3 palabras (ej: "Carrera fácil", "Intervalos", "Ritmo cómodo", "Largo lento").
- intensity: nivel de esfuerzo objetivo → "fácil" para rodajes suaves/largos lentos, "moderado" para rodajes continuos/fartlek, "intenso" para intervalos/series.
- pace_hint: ritmo orientativo SOLO para sesiones moderadas e intensas (ej: "6:30-7:00/km"). Usar cadena vacía "" para sesiones fáciles.
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
          "description": "etiqueta corta máx 3 palabras",
          "intensity": "fácil|moderado|intenso",
          "pace_hint": "X:XX-X:XX/km o vacío"
        }
      ]
    }
  ]
}`;
    }

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

// ─── AI Session Review – POST /api/ai/session-review ────────────────────────
app.post('/api/ai/session-review', async (req, res) => {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(503).json({ error: 'AI no configurada' });

  const { session, activity, plan_goal, week, total_weeks } = req.body;
  if (!session || !activity || !plan_goal) {
    return res.status(400).json({ error: 'session, activity y plan_goal requeridos' });
  }

  try {
    const goalLabels = {
      '5km': 'correr 5 km sin parar',
      '10km': 'correr 10 km sin parar',
      'half': 'completar una media maratón (21,1 km)',
      'marathon': 'completar un maratón (42,2 km)',
    };
    const goalLabel = goalLabels[plan_goal] ?? `completar una carrera de ${plan_goal}`;

    const prompt = `Eres un entrenador de running personal, cercano y motivador. Analiza la sesión que acaba de completar tu atleta y escríbele un análisis como si fuera un mensaje directo de su entrenador.

OBJETIVO DEL PLAN: ${goalLabel}
Semana ${week} de ${total_weeks} del plan

SESIÓN PLANIFICADA:
- Tipo: ${session.type}
- Duración objetivo: ${session.duration}
- Descripción: ${session.description}
${session.intensity ? `- Intensidad esperada: ${session.intensity}` : ''}
${session.pace_hint ? `- Ritmo objetivo: ${session.pace_hint}` : ''}

ACTIVIDAD REAL (Strava):
- Nombre: ${activity.name}
- Distancia: ${activity.distance_km} km
- Duración real: ${activity.duration_min} min
- Ritmo medio: ${activity.pace_str}
${activity.elevation_m ? `- Desnivel: ${activity.elevation_m} m` : ''}

Habla directamente al atleta (usa "tú" o "has"). Sé específico, usa los datos reales. Sé breve, directo y motivador. No uses asteriscos ni markdown, solo texto plano.

Responde ÚNICAMENTE con JSON puro válido, sin texto antes ni después:
{
  "headline": "Un titular corto y motivador de 4-7 palabras",
  "summary": "2-3 frases que describan qué hizo el atleta, comparando lo real con lo planificado, usando los datos concretos",
  "well_done": ["Punto positivo 1 concreto con datos", "Punto positivo 2 si aplica"],
  "improve": ["Una cosa a mejorar o a tener en cuenta para la próxima, con consejo concreto"],
  "overall": "1-2 frases finales motivadoras mirando hacia adelante en el plan"
}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 700,
        temperature: 0.75,
      }),
    });

    const data = await groqRes.json();
    if (!groqRes.ok) {
      console.error('Groq session review error:', groqRes.status, JSON.stringify(data));
      return res.status(502).json({ error: data?.error?.message ?? 'Error de Groq' });
    }

    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Formato de respuesta inválido' });

    let review;
    try { review = JSON.parse(jsonMatch[0]); }
    catch (e) { return res.status(500).json({ error: 'Error parseando review' }); }

    res.json({ review });
  } catch (err) {
    console.error('Session review error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Session Detail – POST /api/ai/session-detail ────────────────────────
app.post('/api/ai/session-detail', async (req, res) => {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(503).json({ error: 'AI no configurada' });

  const { session, plan_goal, week, total_weeks } = req.body;
  if (!session || !plan_goal) return res.status(400).json({ error: 'session y plan_goal requeridos' });

  try {
    const goalLabels = {
      '5km': 'correr 5 km sin parar',
      '10km': 'correr 10 km sin parar',
      'half': 'completar una media maratón (21,1 km)',
      'marathon': 'completar un maratón (42,2 km)',
    };
    const goalLabel = goalLabels[plan_goal] ?? `completar una carrera de ${plan_goal}`;
    const prompt = `Eres un entrenador de running experto. Detalla esta sesión de entrenamiento para un atleta que trabaja para ${goalLabel}.

CONTEXTO DEL PLAN:
- Objetivo: ${goalLabel}
- Semana ${week} de ${total_weeks} del plan

SESIÓN:
- Tipo: ${session.type}
- Duración / Volumen: ${session.duration}
- Descripción: ${session.description}
${session.intensity ? `- Intensidad: ${session.intensity}` : ''}
${session.pace_hint ? `- Ritmo sugerido: ${session.pace_hint}` : ''}

Proporciona una guía completa y motivadora en español. Sé concreto con tiempos, ritmos y sensaciones. Habla directamente al atleta (usa "tú").

Responde ÚNICAMENTE con JSON puro válido, sin texto antes ni después:
{
  "intro": "qué es esta sesión y por qué la hacemos hoy, 2-3 frases motivadoras",
  "warm_up": "calentamiento específico con duración concreta",
  "main": "parte principal detallada: ritmo, sensaciones, cómo estructurarla",
  "cool_down": "vuelta a la calma específica",
  "pace_target": "ritmo objetivo concreto como 6:30-7:00/km, o cadena vacía si no aplica",
  "estimated_time": "tiempo total estimado incluyendo calentamiento y vuelta a la calma",
  "tip": "un consejo práctico y motivador específico para esta sesión"
}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    const data = await groqRes.json();
    if (!groqRes.ok) {
      console.error('Groq session detail error:', groqRes.status, JSON.stringify(data));
      return res.status(502).json({ error: data?.error?.message ?? 'Error de Groq' });
    }

    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Formato de respuesta inválido' });

    let detail;
    try { detail = JSON.parse(jsonMatch[0]); }
    catch (e) { return res.status(500).json({ error: 'Error parseando detalle' }); }

    res.json({ detail });
  } catch (err) {
    console.error('Session detail error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Post-run check-in – POST /api/ai/post-run-checkin ───────────────────
app.post('/api/ai/post-run-checkin', async (req, res) => {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(503).json({ error: 'AI no configurada' });

  const { activity, session, checkin_answer, plan_goal } = req.body;
  if (!activity || !checkin_answer) {
    return res.status(400).json({ error: 'activity y checkin_answer requeridos' });
  }

  try {
    const goalLabels = {
      '5km': 'correr 5 km sin parar',
      '10km': 'correr 10 km sin parar',
      'half': 'completar una media maratón (21,1 km)',
      'marathon': 'completar un maratón (42,2 km)',
    };
    const goalLabel = plan_goal ? (goalLabels[plan_goal] ?? `completar una carrera de ${plan_goal}`) : null;

    const sessionCtx = session
      ? `SESIÓN PLANIFICADA: ${session.type} · ${session.duration}${session.pace_hint ? ` · Ritmo objetivo: ${session.pace_hint}` : ''}${session.intensity ? ` · Intensidad: ${session.intensity}` : ''}`
      : 'El atleta salió a correr sin sesión planificada en el plan.';

    const prompt = `Eres un entrenador de running personal, cercano y directo. Un atleta acaba de terminar una salida y te ha dado feedback.

SALIDA COMPLETADA:
- Nombre: ${activity.name}
- Distancia: ${activity.distance_km} km
- Duración: ${activity.duration_min} min
- Ritmo medio: ${activity.pace_str}
${activity.elevation_m ? `- Desnivel: ${activity.elevation_m} m` : ''}

${sessionCtx}
${goalLabel ? `OBJETIVO DEL PLAN: ${goalLabel}` : ''}

RESPUESTA DEL ATLETA A TU PREGUNTA: "${checkin_answer}"

Escríbele un mensaje breve y útil como entrenador: reconoce su feedback, saca una conclusión concreta, y di UNA cosa práctica sobre los próximos días si aplica. Máximo 2 frases. Habla directamente (usa "tú" o "has"). Sin asteriscos, sin markdown, solo texto plano.

Responde ÚNICAMENTE con JSON puro válido, sin texto antes ni después:
{"message": "tu mensaje aquí"}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 180,
        temperature: 0.7,
      }),
    });

    const data = await groqRes.json();
    if (!groqRes.ok) return res.status(502).json({ error: data?.error?.message ?? 'Error de Groq' });

    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Formato inválido' });

    let result;
    try { result = JSON.parse(jsonMatch[0]); }
    catch (e) { return res.status(500).json({ error: 'Error parseando respuesta' }); }

    res.json({ message: result.message });
  } catch (err) {
    console.error('Post-run checkin error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Pattern Alert – POST /api/ai/pattern-alert ─────────────────────────
app.post('/api/ai/pattern-alert', async (req, res) => {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(503).json({ error: 'AI no configurada' });

  const { checkins } = req.body;
  if (!Array.isArray(checkins) || checkins.length < 3) {
    return res.json({ alert: null });
  }

  try {
    const summary = checkins.map((c, i) =>
      `${i + 1}. ${c.date}: "${c.answer}"`
    ).join('\n');

    const prompt = `Eres un entrenador de running personal. Analiza estos check-ins post-entrenamiento recientes de un atleta:

${summary}

¿Ves un patrón preocupante o relevante que merezca una alerta proactiva? Solo considera estos casos:
- Sensación de fatiga, carga alta o piernas pesadas repetidas (≥3 veces)
- Ritmo sistemáticamente peor de lo esperado
- Menciones repetidas de molestias físicas o dolor
- Patrón de motivación baja repetida

Si hay un patrón claro, escribe UNA frase corta y útil como coach (máximo 15 palabras), directa, sin alarmismos. Si no hay patrón notable, devuelve null.

Responde ÚNICAMENTE con JSON puro válido:
{"alert": "tu aviso aquí"} o {"alert": null}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.4,
      }),
    });

    const data = await groqRes.json();
    if (!groqRes.ok) return res.status(502).json({ error: data?.error?.message ?? 'Error de Groq' });

    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ alert: null });

    let result;
    try { result = JSON.parse(jsonMatch[0]); }
    catch { return res.json({ alert: null }); }

    res.json({ alert: result.alert ?? null });
  } catch (err) {
    console.error('Pattern alert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Coach Question – POST /api/ai/coach-question ────────────────────────
app.post('/api/ai/coach-question', async (req, res) => {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(503).json({ error: 'AI no configurada' });

  const { question_key, activities, plan, recent_checkins } = req.body;
  if (!question_key || !Array.isArray(activities)) {
    return res.status(400).json({ error: 'question_key y activities requeridos' });
  }

  const questionFocus = {
    fitness:
      'Analiza la tendencia del ritmo de carrera en las últimas semanas. ¿Está mejorando, empeorando o estable? Sé concreto con números si los hay.',
    week:
      'Evalúa la carga de esta semana (km, sesiones, intensidad percibida en check-ins) vs lo habitual. ¿Debería cambiar algo en los próximos días — más descanso, más volumen, bajar intensidad?',
    goal:
      'Valora el progreso hacia el objetivo del plan de entrenamiento. ¿Va bien encaminado para conseguirlo? ¿Qué aspecto necesita más atención?',
    rest:
      'Analiza la distribución de descanso vs carga de los últimos 14 días. ¿Está descansando suficiente o hay riesgo de sobreentrenamiento?',
  };

  const focus = questionFocus[question_key] ?? questionFocus.fitness;

  try {
    const actsSummary = activities.slice(0, 12).map((a, i) => {
      const paceMin = a.pace_sec > 0 ? `${Math.floor(a.pace_sec / 60)}:${String(Math.round(a.pace_sec % 60)).padStart(2, '0')}/km` : null;
      return `${i + 1}. ${a.date} — ${a.km} km${paceMin ? ` · ${paceMin}` : ''}`;
    }).join('\n');

    const planCtx = plan
      ? `PLAN ACTIVO: objetivo "${plan.goal}", semana ${plan.current_week} de ${plan.total_weeks}.`
      : 'Sin plan de entrenamiento activo.';

    const checkinsCtx = Array.isArray(recent_checkins) && recent_checkins.length > 0
      ? '\nFEEDBACK RECIENTE:\n' + recent_checkins.map((c, i) => `${i + 1}. ${c.date}: "${c.answer}"`).join('\n')
      : '';

    const prompt = `Eres un entrenador de running personal, experto y directo. Un atleta te hace una pregunta sobre su entrenamiento.

ACTIVIDADES RECIENTES:
${actsSummary}

${planCtx}${checkinsCtx}

PREGUNTA DEL ATLETA (enfoque): ${focus}

Responde en 2-3 frases máximo, en español, con datos concretos de sus actividades cuando sea posible. Habla directamente ("has", "llevas", "tu ritmo"). Sin asteriscos, sin markdown, solo texto plano.

Responde ÚNICAMENTE con JSON puro válido:
{"answer": "tu respuesta aquí"}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 220,
        temperature: 0.6,
      }),
    });

    const data = await groqRes.json();
    if (!groqRes.ok) return res.status(502).json({ error: data?.error?.message ?? 'Error de Groq' });

    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Formato inválido' });

    let result;
    try { result = JSON.parse(jsonMatch[0]); }
    catch { return res.status(500).json({ error: 'Error parseando respuesta' }); }

    res.json({ answer: result.answer });
  } catch (err) {
    console.error('Coach question error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Plan Adjust – POST /api/ai/plan-adjust ───────────────────────────────
// Receives current plan + activities + list of missed sessions.
// Returns: { adjustable, banner, sessions_changed[] }
app.post('/api/ai/plan-adjust', async (req, res) => {
  try {
    const { plan, activities = [], missed_sessions = [] } = req.body;
    if (!plan) return res.status(400).json({ error: 'plan required' });

    const goalLabels = {
      '5km': '5 km', '10km': '10 km', 'half': 'media maratón', 'marathon': 'maratón',
    };
    const goalLabel = goalLabels[plan.goal] ?? plan.goal;

    const currentWeekNum = (() => {
      const [sy, sm, sd] = plan.started_at.split('-').map(Number);
      const startUTC = Date.UTC(sy, sm - 1, sd);
      const startDow = new Date(startUTC).getUTCDay();
      const daysToMonday = startDow === 0 ? -6 : 1 - startDow;
      const planMondayUTC = startUTC + daysToMonday * 86400000;
      const now = new Date();
      const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      return Math.min(Math.floor((todayUTC - planMondayUTC) / 86400000 / 7) + 1, plan.total_weeks);
    })();

    const weeksLeft = plan.total_weeks - currentWeekNum;
    const recentActs = (activities || []).slice(0, 8).map(a =>
      `${a.date?.split('T')[0] ?? ''}: ${a.distance_km ?? (a.distance / 1000).toFixed(1)} km`
    ).join(', ') || 'Sin actividades registradas';

    const missedSummary = missed_sessions.length > 0
      ? missed_sessions.map(m => `Semana ${m.week}, ${m.type} (${m.duration})`).join('; ')
      : 'Ninguna';

    const prompt = `Eres un coach de running experto. Analiza el estado de un plan de entrenamiento y genera un diagnóstico claro.

PLAN: Objetivo ${goalLabel}, ${plan.total_weeks} semanas totales, iniciado el ${plan.started_at}.
SEMANA ACTUAL: ${currentWeekNum} de ${plan.total_weeks} (quedan ${weeksLeft} semanas).
SESIONES NO COMPLETADAS (históricas): ${missedSummary}.
ACTIVIDADES RECIENTES: ${recentActs}.

Tu tarea:
1. Determina si el corredor puede recuperarse y seguir hacia el objetivo (adjustable = true/false).
   - Si perdió 1-2 sesiones de volumen fácil sin patrón de semanas: adjustable = true.
   - Si perdió 3+ sesiones, o semanas críticas de carga, o lleva >2 semanas sin correr: adjustable = false.
2. Escribe UN banner de máximo 2 frases en español, directo y sin emojis, explicando:
   - Qué ha pasado con el plan y por qué las próximas sesiones son así (si adjustable=true).
   - O qué riesgo hay de no llegar al objetivo y qué recomiendas (si adjustable=false).
3. Si adjustable=true, lista las sesiones que el coach cambiaría en las próximas 2 semanas (pueden ser 0 si no hace falta cambiar nada, solo explicar).
   Cada cambio: { week: número, day_number: número, old_type: string, new_type: string, new_duration: string, reason: string (1 frase) }.

Responde SOLO con JSON válido sin markdown:
{
  "adjustable": boolean,
  "banner": "string",
  "sessions_changed": []
}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.4,
      }),
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const result = JSON.parse(jsonMatch[0]);

    // Validate and sanitize
    if (typeof result.adjustable !== 'boolean') result.adjustable = true;
    if (typeof result.banner !== 'string') result.banner = '';
    if (!Array.isArray(result.sessions_changed)) result.sessions_changed = [];

    res.json(result);
  } catch (err) {
    console.error('Plan adjust error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Push Notification Endpoints ────────────────────────────────────────────

// GET /api/push/vapid-key — retorna la clave pública VAPID
app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — guarda una suscripción push
app.post('/api/push/subscribe', (req, res) => {
  const { subscription, athleteId, todaySession } = req.body;
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'subscription inválida' });
  }
  pushSubscriptions.set(subscription.endpoint, {
    subscription,
    athleteId: athleteId ? String(athleteId) : null,
    todaySession: todaySession ?? null,
  });
  console.log(`[Push] Suscripción registrada. Total: ${pushSubscriptions.size}`);
  res.json({ ok: true });
});

// POST /api/push/unsubscribe — elimina una suscripción
app.post('/api/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) pushSubscriptions.delete(endpoint);
  res.json({ ok: true });
});

// POST /api/push/test — envía una notificación de prueba a todas las suscripciones
app.post('/api/push/test', async (req, res) => {
  const payload = JSON.stringify({
    title: '¡Stridely funciona! 🏃',
    body: 'Las notificaciones push están activas.',
    url: '/dashboard',
    tag: 'stridely-test',
  });
  const results = await _sendToAll(payload);
  res.json({ sent: results.ok, failed: results.failed });
});

// ─── Helper: enviar a todas las suscripciones activas ───────────────────────
async function _sendToAll(payloadStr) {
  let ok = 0;
  let failed = 0;
  const expired = [];

  for (const [endpoint, record] of pushSubscriptions.entries()) {
    try {
      await webpush.sendNotification(record.subscription, payloadStr);
      ok++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        expired.push(endpoint); // suscripción caducada
      } else {
        console.error('[Push] Error enviando a', endpoint.slice(-20), err.message);
      }
      failed++;
    }
  }
  expired.forEach((ep) => pushSubscriptions.delete(ep));
  return { ok, failed };
}

// ─── Helper: enviar a una suscripción por athleteId ─────────────────────────
async function _sendToAthlete(athleteId, payloadStr) {
  const athleteStr = String(athleteId);
  for (const [endpoint, record] of pushSubscriptions.entries()) {
    if (record.athleteId === athleteStr) {
      try {
        await webpush.sendNotification(record.subscription, payloadStr);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          pushSubscriptions.delete(endpoint);
        } else {
          console.error('[Push] Error enviando al atleta', athleteStr, err.message);
        }
      }
    }
  }
}

// ─── Strava Webhook ──────────────────────────────────────────────────────────
// Strava verifica el webhook con un GET enviando hub.challenge
app.get('/api/strava/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'stridely-verify';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Strava Webhook] Verificación OK');
    return res.json({ 'hub.challenge': challenge });
  }
  res.status(403).json({ error: 'Forbidden' });
});

// Strava envía un POST cuando se crea/actualiza una actividad
app.post('/api/strava/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED'); // responder rápido a Strava

  const { object_type, aspect_type, owner_id, object_id } = req.body;
  if (object_type !== 'activity' || aspect_type !== 'create') return;

  const athleteId = String(owner_id);
  console.log(`[Strava Webhook] Nueva actividad ${object_id} del atleta ${athleteId}`);

  // Intentar obtener detalles de la actividad para la notificación
  try {
    const userRecord = users[athleteId];
    let activityDetails = null;

    if (userRecord?.token) {
      const actRes = await fetch(`${STRAVA_API_BASE}/activities/${object_id}`, {
        headers: { Authorization: `Bearer ${userRecord.token}` },
      });
      if (actRes.ok) activityDetails = await actRes.json();
    }

    const km = activityDetails
      ? ((activityDetails.distance ?? 0) / 1000).toFixed(1)
      : null;
    const name = activityDetails?.name ?? 'Actividad';
    const body = km
      ? `${name} · ${km} km registrados.`
      : 'Tu actividad se ha registrado correctamente.';

    const payload = JSON.stringify({
      title: '¡Entrenamiento completado! 🎉',
      body,
      url: '/dashboard',
      tag: 'stridely-workout',
      icon: '/icon-192.png',
    });

    await _sendToAthlete(athleteId, payload);
  } catch (err) {
    console.error('[Strava Webhook] Error procesando actividad:', err.message);
  }
});

// ─── Cron: notificación matutina a las 08:00 Madrid (UTC+2 → 06:00 UTC) ─────
// Formato cron: '0 6 * * *' = todos los días a las 06:00 UTC
cron.schedule('0 6 * * *', async () => {
  console.log('[Cron] Enviando notificaciones matutinas de sesión...');
  let sent = 0;

  for (const [, record] of pushSubscriptions.entries()) {
    if (!record.todaySession) continue; // sin sesión guardada, omitir

    const { type, distance } = record.todaySession;
    const payload = JSON.stringify({
      title: '¡Hoy toca entrenar! 🏃',
      body: `${type}${distance ? ` · ${distance}` : ''} te espera. ¡Vamos!`,
      url: '/dashboard',
      tag: 'stridely-morning',
      icon: '/icon-192.png',
    });

    try {
      await webpush.sendNotification(record.subscription, payload);
      sent++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        pushSubscriptions.delete(record.subscription.endpoint);
      }
    }
  }
  console.log(`[Cron] Notificaciones matutinas enviadas: ${sent}`);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Stridely server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   OAuth callback: POST ${PORT}/api/strava/token`);
  console.log(`   Push subscriptions activas: ${pushSubscriptions.size}`);
});

