require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const webpush = require('web-push');
const cron = require('node-cron');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const {
  daysSinceLastRun,
  avgPace,
  weeklyKmProgression,
  hasRecentQualitySession,
  planCurrentWeek,
} = require('./helpers');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Web Push VAPID ──────────────────────────────────────────────────────────
let pushEnabled = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hola@stridely.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  pushEnabled = true;
  console.log('✅ Web Push configurado correctamente');
} else {
  console.warn('⚠️  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no definidas — push notifications desactivadas');
}

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — restrict to known origins in production ──────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null; // null = allow all (local development)

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (Capacitor app, curl, server-to-server)
    if (!origin || !allowedOrigins || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origen no permitido'));
  },
  credentials: true,
}));

// ─── Body parsing — with size limit to prevent DoS ───────────────────────────
app.use(express.json({ limit: '100kb' }));

// ─── Rate limiters ───────────────────────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones al coach, intenta en un momento' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, espera unos minutos' },
});

// Variables globales
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_OAUTH_BASE = 'https://www.strava.com/oauth/token';

// Almacenamiento en memoria (en producción usar base de datos)
const users = {};

// ─── Supabase client (server-side, uses service role key) ───────────────────
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;
if (!supabaseAdmin) console.warn('[Supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no definidas — push subscriptions no persistirán');

// Push subscriptions — in-memory cache, backed by Supabase for persistence
const pushSubscriptions = new Map();

async function loadSubsFromDB() {
  if (!supabaseAdmin) return;
  const { data, error } = await supabaseAdmin.from('push_subscriptions').select('*');
  if (error) { console.warn('[Push] Error cargando suscripciones:', error.message); return; }
  for (const row of data) {
    pushSubscriptions.set(row.endpoint, {
      subscription: row.subscription,
      athleteId: row.athlete_id,
      todaySession: row.today_session,
    });
  }
  console.log(`[Push] ${pushSubscriptions.size} suscripcion(es) cargadas desde Supabase`);
}
loadSubsFromDB();

async function upsertSub(endpoint, record) {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from('push_subscriptions').upsert({
    endpoint,
    subscription: record.subscription,
    athlete_id: record.athleteId,
    today_session: record.todaySession,
  }, { onConflict: 'endpoint' });
  if (error) console.error('[Push] Error guardando en Supabase:', error.message);
}

async function deleteSub(endpoint) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

// ─── Weather cache — in-memory, keyed by "lat,lon" rounded to 2 decimals ────
const weatherCache = new Map();
const WEATHER_CACHE_TTL = 45 * 60 * 1000; // 45 min

// ─── GET /api/weather — proxy to Open-Meteo (no API key required) ────────────
app.get('/api/weather', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'lat y lon válidos requeridos' });
  }

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lon.toFixed(4));
    url.searchParams.set('current', 'temperature_2m,weathercode,windspeed_10m');
    url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weathercode');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '1');

    const response = await fetch(url.toString());
    if (!response.ok) {
      const text = await response.text();
      console.error('[Weather] Open-Meteo error:', response.status, text);
      return res.status(502).json({ error: 'Error obteniendo datos meteorológicos' });
    }

    const raw = await response.json();

    const current = {
      temp: Math.round(raw.current.temperature_2m),
      weathercode: raw.current.weathercode,
      windspeed: Math.round(raw.current.windspeed_10m_10m ?? raw.current.windspeed_10m ?? 0),
    };

    // current hour in the location's timezone
    const nowLocal = new Date(raw.current.time);
    const currentHour = nowLocal.getHours();

    // Keep remaining hours of today (up to 8)
    const hourly = (raw.hourly.time ?? [])
      .map((t, i) => {
        const h = parseInt(t.split('T')[1]?.split(':')[0] ?? '0', 10);
        return {
          hour: h,
          temp: Math.round(raw.hourly.temperature_2m[i] ?? 0),
          precipProb: raw.hourly.precipitation_probability[i] ?? 0,
          weathercode: raw.hourly.weathercode[i] ?? 0,
        };
      })
      .filter(h => h.hour >= currentHour)
      .slice(0, 8);

    const data = { current, hourly, timezone: raw.timezone };
    weatherCache.set(cacheKey, { data, fetchedAt: Date.now() });
    res.json(data);
  } catch (err) {
    console.error('[Weather] Error:', err.message);
    res.status(500).json({ error: 'Error obteniendo el tiempo' });
  }
});

// Rutas de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// OAuth Callback - Intercambiar código por token
app.post('/api/strava/token', authLimiter, async (req, res) => {
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
app.post('/api/strava/refresh', authLimiter, async (req, res) => {
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
    res.status(500).json({ error: 'Error interno del servidor' });
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
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid activity ID' });
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

// ─── AI Coach – POST /api/ai/recommend ──────────────────────────────────────
app.post('/api/ai/recommend', aiLimiter, async (req, res) => {
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
    const daysSince = daysSinceLastRun(activities, now);
    let restContext = 'No hay actividades registradas.';
    if (daysSince >= 0) {
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
    const avg = avgPace(sortedActs);
    // Easy pace threshold: average + 30 s/km
    const easyThreshold = avg + 30;

    // Did the runner do a quality session (faster than avg) in the last 4 days?
    const recentQuality = hasRecentQualitySession(sortedActs, avg, 4, now);

    const weekContext = `Esta semana: ${sessionsThisWeek} sesión(es), ${totalKmThisWeek.toFixed(1)} km totales.`;
    const qualityContext = recentQuality
      ? 'Ya realizó una sesión de calidad (ritmo rápido) en los últimos 4 días.'
      : 'No ha realizado sesiones de calidad en los últimos 4 días.';
    const paceContext = avg > 0
      ? `Ritmo medio habitual: ${Math.floor(avg / 60)}:${String(Math.round(avg % 60)).padStart(2, '0')}/km. Rodaje suave recomendado: por encima de ${Math.floor(easyThreshold / 60)}:${String(Math.round(easyThreshold % 60)).padStart(2, '0')}/km.`
      : '';

    const checkinsContext = Array.isArray(recent_checkins) && recent_checkins.length > 0
      ? '\nFEEDBACK RECIENTE DEL CORREDOR (check-ins post-entrenamiento):\n' +
        recent_checkins.map((c, i) => `${i + 1}. ${c.date}: "${c.answer}"`).join('\n')
      : '';

    // 8-week weekly km progression for load trend detection
    const weeklyProgression = weeklyKmProgression(sortedActs, 8, now)
      .map(({ weekStart, km }) => {
        const d = new Date(weekStart);
        const label = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        return `Semana del ${label}: ${km.toFixed(1)} km`;
      })
      .join(' | ');

    const prompt = `Eres un entrenador personal de running experto. Hoy es ${todayStr}.

CONTEXTO:
- ${restContext}
- ${weekContext}
- ${qualityContext}
- ${paceContext}${checkinsContext}
${weeklyProgression ? `\nPROGRESIÓN DE CARGA (últimas 8 semanas):\n${weeklyProgression}` : ''}

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
app.post('/api/ai/training-plan', aiLimiter, async (req, res) => {
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

      // Week-1 start-day rules (same logic as race plan)
      const todayQ = new Date();
      const todayDowQ = todayQ.getDay(); // 0=Dom…6=Sáb
      const todayDayNumberQ = todayDowQ === 0 ? 7 : todayDowQ; // 1=Lun…7=Dom
      const DAY_NAMES_ES_Q = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const todayDayNameQ = DAY_NAMES_ES_Q[todayDayNumberQ - 1];
      const daysLeftInWeekQ = 7 - todayDayNumberQ + 1;
      const week1MaxSessionsQ = Math.min(days_per_week, daysLeftInWeekQ);

      const week1NoteQuick = todayDayNumberQ === 1
        ? `La semana 1 empieza hoy lunes. Distribuye con normalidad las ${days_per_week} sesiones desde el lunes (day_number 1).`
        : `La semana 1 empieza HOY ${todayDayNameQ} (day_number ${todayDayNumberQ}). REGLAS ESTRICTAS:
  - PROHIBIDO usar day_number < ${todayDayNumberQ} en la semana 1.
  - Evalúa cuántas sesiones caben desde hoy hasta el domingo con al menos 1 día de descanso entre ellas.
  - Puedes poner entre 1 y ${week1MaxSessionsQ} sesión/es en la semana 1 según lo que sea razonable.
  - Si el corredor solo empieza el ${todayDayNameQ} y quedan pocos días, es perfectamente correcto poner solo 1 o 2 sesiones esa semana.
  - Si crees que es mejor esperar al lunes siguiente para empezar con la semana completa, entonces pon 0 sesiones en la semana 1 e indica en la descripción de la semana 2 que es la semana de inicio real.
  - De la semana 2 en adelante: ${days_per_week} sesiones habituales cada semana.`;

      prompt = `Eres un entrenador de running experto. Crea un plan de entrenamiento personalizado.

OBJETIVO: ${goalLabel}
DÍAS DE ENTRENAMIENTO POR SEMANA: ${days_per_week}
DURACIÓN DEL PLAN: ${weeksRange} según el nivel del corredor
HISTORIAL RECIENTE DEL CORREDOR:
${actSummary}

SEMANA 1 — INICIO DEL PLAN (CUMPLIR ESTRICTAMENTE):
${week1NoteQuick}

REGLAS GENERALES:
- A partir de la semana 2: cada semana tiene EXACTAMENTE ${days_per_week} sesiones.
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
    res.status(500).json({ error: 'Error generando el plan de entrenamiento' });
  }
});

// ─── AI Session Review – POST /api/ai/session-review ────────────────────────
app.post('/api/ai/session-review', aiLimiter, async (req, res) => {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(503).json({ error: 'AI no configurada' });

  const { session, activity, plan_goal, week, total_weeks, recent_activities, splits } = req.body;
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

    let paceBaseCtx = '';
    if (Array.isArray(recent_activities) && recent_activities.length > 0) {
      const paced = recent_activities.filter(a => (a.pace ?? 0) > 0);
      if (paced.length > 0) {
        const avg = paced.reduce((s, a) => s + a.pace, 0) / paced.length;
        const avgStr = `${Math.floor(avg / 60)}:${String(Math.round(avg % 60)).padStart(2, '0')}/km`;
        paceBaseCtx = `\nRITMO MEDIO HABITUAL DEL ATLETA (últimas ${paced.length} salidas): ${avgStr} — úsalo para valorar si el ritmo de hoy es bueno, normal o bajo para este corredor.`;
      }
    }

    let splitsCtx = '';
    if (Array.isArray(splits) && splits.length > 1) {
      const splitsStr = splits.map(s => `km ${s.km}: ${s.pace}/km${s.hr ? ` (FC ${s.hr})` : ''}`).join(' · ');
      splitsCtx = `\nSPLITS POR KM (Strava): ${splitsStr}\n→ Usa la variación de ritmo entre km para evaluar el patrón de esfuerzo real. Para intervalos, los km rápidos son las series y los lentos la recuperación.`;
    }

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
${activity.elevation_m ? `- Desnivel: ${activity.elevation_m} m` : ''}${paceBaseCtx}${splitsCtx}

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
    res.status(500).json({ error: 'Error generando el análisis de sesión' });
  }
});

// ─── AI Session Detail – POST /api/ai/session-detail ────────────────────────
app.post('/api/ai/session-detail', aiLimiter, async (req, res) => {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(503).json({ error: 'AI no configurada' });

  const { session, plan_goal, week, total_weeks, activities } = req.body;
  if (!session || !plan_goal) return res.status(400).json({ error: 'session y plan_goal requeridos' });

  try {
    const goalLabels = {
      '5km': 'correr 5 km sin parar',
      '10km': 'correr 10 km sin parar',
      'half': 'completar una media maratón (21,1 km)',
      'marathon': 'completar un maratón (42,2 km)',
    };
    const goalLabel = goalLabels[plan_goal] ?? `completar una carrera de ${plan_goal}`;

    let fitnessCtx = '';
    if (Array.isArray(activities) && activities.length > 0) {
      const sorted = [...activities].sort((a, b) => new Date(b.date) - new Date(a.date));
      const last5 = sorted.slice(0, 5).map(a => {
        const km = ((a.distance ?? 0) / 1000).toFixed(1);
        const paceMin = Math.floor((a.pace ?? 0) / 60);
        const paceSec = String(Math.round((a.pace ?? 0) % 60)).padStart(2, '0');
        return `${km} km · ${paceMin}:${paceSec}/km`;
      }).join(', ');
      const paced = sorted.filter(a => (a.pace ?? 0) > 0).slice(0, 10);
      const avgPace = paced.length ? paced.reduce((s, a) => s + a.pace, 0) / paced.length : 0;
      const avgPaceStr = avgPace > 0
        ? `${Math.floor(avgPace / 60)}:${String(Math.round(avgPace % 60)).padStart(2, '0')}/km`
        : null;
      fitnessCtx = `\nNIVEL ACTUAL DEL CORREDOR:\n- Últimas salidas: ${last5}${avgPaceStr ? `\n- Ritmo medio habitual: ${avgPaceStr} — adapta los ritmos objetivo a su nivel real.` : ''}`;
    }

    const isIntervalSession = /series|intervalo|fartlek|velocidad|tempo/i.test(
      (session.type ?? '') + ' ' + (session.description ?? '')
    );

    const prompt = `Eres un entrenador de running experto. Detalla esta sesión de entrenamiento para un atleta que trabaja para ${goalLabel}.

CONTEXTO DEL PLAN:
- Objetivo: ${goalLabel}
- Semana ${week} de ${total_weeks} del plan${fitnessCtx}

SESIÓN:
- Tipo: ${session.type}
- Duración / Volumen: ${session.duration}
- Descripción: ${session.description}
${session.intensity ? `- Intensidad: ${session.intensity}` : ''}
${session.pace_hint ? `- Ritmo sugerido: ${session.pace_hint}` : ''}
${isIntervalSession ? `⚠ ESTA ES UNA SESIÓN DE INTERVALOS O SERIES. Debes incluir OBLIGATORIAMENTE los campos "interval_blocks" y "reps" en el JSON.` : ''}
Proporciona una guía completa y motivadora en español. Sé concreto con tiempos, ritmos y sensaciones. Habla directamente al atleta (usa "tú"). No uses markdown ni asteriscos.

Responde ÚNICAMENTE con JSON puro válido, sin texto antes ni después:
{
  "intro": "qué es esta sesión y por qué la hacemos hoy, 2-3 frases motivadoras",
  "warm_up": "calentamiento específico con duración concreta",
  "main": "descripción breve de la parte principal (1-2 frases)",${isIntervalSession ? `
  "interval_blocks": [
    { "type": "work", "duration": "X min", "pace": "X:XX/km", "label": "Serie" },
    { "type": "recovery", "duration": "X min", "pace": "X:XX/km", "label": "Recuperación" }
  ],
  "reps": 4,` : ''}
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
    res.status(500).json({ error: 'Error generando el detalle de sesión' });
  }
});

// ─── AI Post-run check-in – POST /api/ai/post-run-checkin ───────────────────
app.post('/api/ai/post-run-checkin', aiLimiter, async (req, res) => {
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
    res.status(500).json({ error: 'Error procesando el check-in' });
  }
});

// ─── AI Pattern Alert – POST /api/ai/pattern-alert ─────────────────────────
app.post('/api/ai/pattern-alert', aiLimiter, async (req, res) => {
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
    res.status(500).json({ error: 'Error generando la alerta' });
  }
});

// ─── AI Coach Question – POST /api/ai/coach-question ────────────────────────
app.post('/api/ai/coach-question', aiLimiter, async (req, res) => {
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
    res.status(500).json({ error: 'Error respondiendo la pregunta' });
  }
});

// ─── AI Plan Adjust – POST /api/ai/plan-adjust ───────────────────────────────
// Receives current plan + activities + list of missed sessions.
// Returns: { adjustable, banner, sessions_changed[] }
app.post('/api/ai/plan-adjust', aiLimiter, async (req, res) => {
  try {
    const { plan, activities = [], missed_sessions = [] } = req.body;
    if (!plan) return res.status(400).json({ error: 'plan required' });

    const goalLabels = {
      '5km': '5 km', '10km': '10 km', 'half': 'media maratón', 'marathon': 'maratón',
    };
    const goalLabel = goalLabels[plan.goal] ?? plan.goal;

    const currentWeekNum = planCurrentWeek(plan);

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
    res.status(500).json({ error: 'Error ajustando el plan' });
  }
});

// ─── Push Notification Endpoints ────────────────────────────────────────────

// GET /api/push/vapid-key — retorna la clave pública VAPID
app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — guarda una suscripción push
app.post('/api/push/subscribe', async (req, res) => {
  const { subscription, athleteId, todaySession } = req.body;
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'subscription inválida' });
  }
  const record = {
    subscription,
    athleteId: athleteId ? String(athleteId) : null,
    todaySession: todaySession ?? null,
  };
  pushSubscriptions.set(subscription.endpoint, record);
  await upsertSub(subscription.endpoint, record);
  if (!supabaseAdmin) console.warn('[Push] Supabase no configurado, suscripción solo en memoria');
  console.log(`[Push] Suscripción registrada. Total: ${pushSubscriptions.size}`);
  res.json({ ok: true });
});

// POST /api/push/unsubscribe — elimina una suscripción
app.post('/api/push/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    pushSubscriptions.delete(endpoint);
    await deleteSub(endpoint);
  }
  res.json({ ok: true });
});

// GET /api/push/debug — diagnóstico del estado de push (no envía nada)
app.get('/api/push/debug', async (req, res) => {
  let dbCount = null;
  let dbError = null;
  if (supabaseAdmin) {
    const { count, error } = await supabaseAdmin.from('push_subscriptions').select('*', { count: 'exact', head: true });
    dbCount = error ? null : count;
    dbError = error ? error.message : null;
  }
  res.json({
    pushEnabled,
    supabaseConfigured: !!supabaseAdmin,
    memorySubscriptions: pushSubscriptions.size,
    dbSubscriptions: dbCount,
    dbError,
    endpoints: [...pushSubscriptions.keys()].map(ep => ep.slice(-30)),
  });
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
  if (!pushEnabled) return { ok: 0, failed: 0 };
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
  expired.forEach((ep) => { pushSubscriptions.delete(ep); deleteSub(ep); });
  return { ok, failed };
}

// ─── Helper: enviar a una suscripción por athleteId ─────────────────────────
async function _sendToAthlete(athleteId, payloadStr) {
  if (!pushEnabled) return;
  const athleteStr = String(athleteId);
  for (const [endpoint, record] of pushSubscriptions.entries()) {
    if (record.athleteId === athleteStr) {
      try {
        await webpush.sendNotification(record.subscription, payloadStr);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          pushSubscriptions.delete(endpoint);
          deleteSub(endpoint);
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

// ─── Push matutino — lógica compartida ──────────────────────────────────────
async function sendMorningPushNotifications() {
  console.log('[Push] Enviando notificaciones matutinas de sesión...');
  let sent = 0;

  for (const [, record] of pushSubscriptions.entries()) {
    if (!record.todaySession) continue;

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
  console.log(`[Push] Notificaciones matutinas enviadas: ${sent}`);
  return sent;
}

// ─── Cron: notificación matutina a las 08:00 Madrid (UTC+2 → 06:00 UTC) ─────
// Solo activo fuera de Vercel (entorno serverless no soporta procesos persistentes)
if (process.env.VERCEL !== '1') {
  cron.schedule('0 6 * * *', () => sendMorningPushNotifications());
}

// ─── Endpoint HTTP para el cron externo (cron-job.org) ───────────────────────
// Protegido con CRON_SECRET para evitar llamadas no autorizadas
app.post('/api/cron/morning-push', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    const sent = await sendMorningPushNotifications();
    res.json({ ok: true, sent });
  } catch (err) {
    console.error('[Cron endpoint] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Delete Account ───────────────────────────────────────────────────────────
// Verifica el JWT del usuario, luego borra su cuenta mediante la Admin API de
// Supabase usando la service role key (solo disponible en servidor).
app.delete('/api/account', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: 'No autorizado' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Eliminación de cuenta no configurada' });
  }

  try {
    // 1. Verificar el JWT y obtener el user_id
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${jwt}`, 'apikey': SUPABASE_SERVICE_KEY },
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Token inválido' });
    const { id: userId } = await userRes.json();

    // 2. Borrar el usuario (cascade borra sus datos si FK está configurada)
    const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY },
    });
    if (!deleteRes.ok) {
      const body = await deleteRes.json().catch(() => ({}));
      console.error('Supabase delete user error:', deleteRes.status, body);
      return res.status(500).json({ error: 'Error al eliminar la cuenta' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── AI Coach Chat – POST /api/ai/coach-chat ────────────────────────────────
// Chat con el entrenador IA Strider. Conoce el plan activo del corredor,
// sus últimas salidas y puede mover sesiones de la semana actual en Supabase.
app.post('/api/ai/coach-chat', aiLimiter, async (req, res) => {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(503).json({ error: 'AI no configurada' });

  const { user_id, message, context } = req.body;

  if (!user_id || typeof user_id !== 'string' || user_id.length > 100) {
    return res.status(400).json({ error: 'user_id requerido' });
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message requerido' });
  }
  if (message.trim().length > 1000) {
    return res.status(422).json({ error: 'El mensaje es demasiado largo (máx 1000 caracteres)' });
  }

  const safeMessage = message.trim();
  const now = new Date();
  const todayDow = now.getDay(); // 0=Dom…6=Sáb
  const todayDayNumber = todayDow === 0 ? 7 : todayDow; // 1=Lun…7=Dom
  const todayStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  try {
    // ── 1. Historial de conversación ──────────────────────────────────────
    let history = [];
    if (supabaseAdmin) {
      const { data: msgs, error: histErr } = await supabaseAdmin
        .from('chat_messages')
        .select('role, content')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!histErr) history = (msgs ?? []).reverse();
    }

    // ── 2. Construir contexto completo del corredor ───────────────────────
    const goalLabels = {
      '5km': '5 km', '10km': '10 km',
      'half': 'media maratón', 'marathon': 'maratón',
    };

    let planContext = '';
    let canModifyPlan = false;

    if (context) {
      const { plan_goal, plan_id, current_week, total_weeks, last_week, last_day, week_sessions, recent_activities } = context;

      if (plan_goal && plan_id) {
        canModifyPlan = true;
        const cw = current_week ?? 1;
        const tw = total_weeks ?? 1;

        planContext += `\n\nPLAN ACTIVO: ${goalLabels[plan_goal] ?? plan_goal} — Semana ${cw} de ${tw}`;
        planContext += `\nPlan ID: ${plan_id}\n`;

        // Inform the AI about the plan's hard end boundary
        if (last_week && last_day) {
          const isLastWeek = cw === last_week;
          if (isLastWeek) {
            planContext += `\n\u26a0\ufe0f  SEMANA FINAL DEL PLAN: El plan termina el ${DAY_NAMES[last_day - 1]} (d\u00eda ${last_day}). NO se puede mover ninguna sesi\u00f3n m\u00e1s all\u00e1 del d\u00eda ${last_day} ni a semanas posteriores.`;
          } else {
            planContext += `\nFin del plan: semana ${last_week}, d\u00eda ${last_day} (${DAY_NAMES[last_day - 1]}).`;
          }
        }

        if (Array.isArray(week_sessions) && week_sessions.length > 0) {
          planContext += `\nSESIONES DE ESTA SEMANA (semana ${cw}):`;
          week_sessions.forEach(s => {
            const dayName = DAY_NAMES[(s.day_number ?? 1) - 1] ?? `Día ${s.day_number}`;
            const isPast  = (s.day_number ?? 0) < todayDayNumber;
            const isToday = (s.day_number ?? 0) === todayDayNumber;
            const status  = s.completed ? '✓ completada' : isPast ? '✗ no realizada' : isToday ? '← HOY' : 'pendiente';
            const hint    = s.pace_hint ? ` @ ${s.pace_hint}` : '';
            planContext += `\n  • ${dayName} (día ${s.day_number}): ${s.type} ${s.duration}${hint} [${s.intensity ?? 'fácil'}] — ${status}`;
          });
          // Días libres de la semana (para que el coach sepa dónde hay hueco)
          const usedDays = new Set(week_sessions.map(s => s.day_number));
          const freeDays = [1,2,3,4,5,6,7].filter(d => !usedDays.has(d)).map(d => DAY_NAMES[d-1]);
          planContext += `\n  Días libres esta semana: ${freeDays.join(', ')}`;
        }

        if (Array.isArray(recent_activities) && recent_activities.length > 0) {
          planContext += `\n\nÚLTIMAS SALIDAS:`;
          recent_activities.slice(0, 5).forEach((a, i) => {
            const km = ((a.distance ?? 0) / 1000).toFixed(1);
            const mins = Math.floor((a.duration ?? 0) / 60);
            const pace = a.pace ?? 0;
            const paceMin = Math.floor(pace / 60);
            const paceSec = String(Math.round(pace % 60)).padStart(2, '0');
            planContext += `\n  ${i + 1}. ${km} km · ${mins} min · ${paceMin}:${paceSec}/km`;
          });
        }
      } else if (plan_goal) {
        planContext += `\n\nPlan activo: ${goalLabels[plan_goal] ?? plan_goal}`;
        if (current_week && total_weeks) planContext += `, semana ${current_week} de ${total_weeks}`;
      }
    }

    // ── 3. System prompt con personalidad y capacidad de modificar plan ───
    const modifyBlock = canModifyPlan ? `

CAPACIDAD DE MODIFICAR EL PLAN:
Puedes mover sesiones de la semana actual si el usuario te lo pide Y tiene sentido desde el punto de vista del entrenamiento.
Antes de mover, evalúa siempre:
- La carga de las últimas salidas (si salió muy fuerte ayer, no muevas a un día intenso)
- Si el día destino está libre (mira los "Días libres" del contexto)
- Si el día destino es hoy o posterior (day_number >= ${todayDayNumber}): NUNCA muevas a un día ya pasado
- Si el contexto indica ⚠️ SEMANA FINAL, NUNCA muevas una sesión más allá del día límite indicado. Si no hay hueco antes de la carrera, díselo al usuario en lugar de mover.
- Si no es razonable el cambio, explica por qué y propón una alternativa

Si decides ejecutar el movimiento, añade EXACTAMENTE al final de tu respuesta — en una línea nueva y sin nada más después:
<<<ACTION:{"type":"move_session","week":NUMERO_SEMANA,"from_day":DIA_ORIGEN,"to_day":DIA_DESTINO}>>>

Solo añade el ACTION si realmente vas a hacer el cambio. Nunca incluyas el texto del ACTION en tu explicación.` : '';

    const systemPrompt = `Eres "Strider", el entrenador personal de running integrado en la app Stridely.

PERSONALIDAD Y ESTILO:
- Hablas como un entrenador real, directo y con criterio propio — no eres complaciente
- Si algo no es buena idea (mover un entreno intenso a un día con carga alta, entrenar con agujetas fuertes…), lo dices con argumentos claros y propones alternativas
- Respuestas concisas: 2-5 frases salvo que pidan explicación larga
- Usas terminología de running con naturalidad: tempo, fartlek, VO2max, tirada larga, umbral…
- Siempre en español${modifyBlock}

CONTINUIDAD DE CONVERSACIÓN (MUY IMPORTANTE):
- Tienes acceso al historial completo de esta conversación. Úsalo siempre.
- Si en tu último mensaje hiciste una pregunta o propusiste algo ("¿Quieres que…?", "¿Te explico…?", "¿Movemos…?") y el usuario responde con una afirmación (ok, sí, claro, adelante, venga, dale, bueno, por favor, perfecto…), HAZ EXACTAMENTE LO QUE ACABAS DE PROPONER. No cambies de tema. No hagas otra propuesta diferente.
- Si el usuario confirma que quiere consejos, da los consejos. Si confirma que quiere mover un entreno, muévelo. Cumple siempre lo que prometiste en el turno anterior.
- Solo propón cambios al plan de entrenamiento cuando el usuario lo solicite explícitamente en su mensaje actual. No lo introduzcas de forma espontánea si la conversación iba por otro lado.
- Si no queda claro a qué se refiere el usuario con una respuesta corta, mira el historial para deducirlo del contexto antes de responder.

CONTEXTO DEL CORREDOR:
Hoy es ${todayStr} (día número ${todayDayNumber} de la semana, donde 1=Lunes y 7=Domingo).${planContext}

REGLAS:
1. Solo respondes sobre running, entrenamiento, nutrición deportiva para corredores, recuperación y lesiones comunes del corredor.
2. Si te preguntan algo ajeno al running, di: "Solo puedo ayudarte con tu entrenamiento. ¿Tienes alguna pregunta sobre tu plan?"
3. Nunca inventes datos del corredor que no estén en el contexto.`;

    // ── 4. Llamar a Groq ──────────────────────────────────────────────────
    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: safeMessage },
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        max_tokens: 500,
        temperature: 0.72,
      }),
    });

    const groqData = await groqRes.json();
    if (!groqRes.ok) {
      console.error('[CoachChat] Groq error:', groqRes.status, groqData?.error?.message);
      return res.status(502).json({ error: 'Error de la IA. Inténtalo de nuevo.' });
    }

    const rawReply = groqData.choices?.[0]?.message?.content?.trim() ?? '';
    if (!rawReply) return res.status(500).json({ error: 'Respuesta vacía del coach' });

    // ── 5. Detectar ACTION y ejecutar modificación en Supabase ───────────
    let actionApplied = false;
    let actionDetail  = null;

    // Regex lenient: allows spaces around ACTION:, case-insensitive
    const actionMatch = rawReply.match(/<<<\s*ACTION\s*:\s*(\{[^>]+\})\s*>>>/i);
    // Eliminar el tag del reply final (nunca mostrar al usuario)
    const cleanReply = rawReply.replace(/\s*<<<\s*ACTION\s*:[^>]+>>>\s*/gi, '').trim();

    if (actionMatch && canModifyPlan && supabaseAdmin) {
      try {
        const action = JSON.parse(actionMatch[1]);
        const { type, from_day, to_day } = action;
        // Prefer week from action, fallback to context.current_week
        const week = action.week ?? context.current_week;

        console.log(`[CoachChat] ACTION detected: type=${type} week=${week} from=${from_day} to=${to_day} todayDay=${todayDayNumber}`);

        if (type === 'move_session' && week && from_day && to_day &&
            to_day >= 1 && to_day <= 7 &&
            from_day >= 1 && from_day <= 7 && from_day !== to_day) {

          // Hard boundary: never move a session beyond the last day of the plan
          const planLastWeek = context.last_week ?? null;
          const planLastDay  = context.last_day  ?? null;
          if (planLastWeek && planLastDay && week >= planLastWeek && to_day > planLastDay) {
            console.warn(`[CoachChat] BLOCKED — to_day=${to_day} exceeds plan end (last_week=${planLastWeek}, last_day=${planLastDay})`);
          } else {
          const { data: planData, error: planErr } = await supabaseAdmin
            .from('training_plans')
            .select('weeks')
            .eq('id', context.plan_id)
            .eq('user_id', user_id)
            .single();

          if (!planErr && planData) {
            const weeks = planData.weeks;
            // Try specified week, fallback to current week, then any week with a matching session
            let weekObj = weeks.find(w => w.week === week);
            if (!weekObj) weekObj = weeks.find(w => w.week === context.current_week);

            if (weekObj) {
              let sessionIdx = weekObj.sessions.findIndex(s => s.day_number === from_day);

              // Fallback: if session not at from_day, look for it nearby (±1 day)
              if (sessionIdx === -1) {
                sessionIdx = weekObj.sessions.findIndex(s =>
                  Math.abs((s.day_number ?? 0) - from_day) <= 1 && s.day_number !== to_day
                );
                if (sessionIdx !== -1) {
                  console.log(`[CoachChat] from_day fallback: expected ${from_day}, found at ${weekObj.sessions[sessionIdx].day_number}`);
                }
              }

              const destTaken = weekObj.sessions.some(s => s.day_number === to_day);

              console.log(`[CoachChat] sessionIdx=${sessionIdx} destTaken=${destTaken} weekObj.week=${weekObj.week}`);

              if (sessionIdx !== -1 && !destTaken) {
                const movedSession = { ...weekObj.sessions[sessionIdx], day_number: to_day };
                weekObj.sessions[sessionIdx] = movedSession;
                // Mantener las sesiones ordenadas por día
                weekObj.sessions.sort((a, b) => a.day_number - b.day_number);

                const { error: updateErr } = await supabaseAdmin
                  .from('training_plans')
                  .update({ weeks })
                  .eq('id', context.plan_id)
                  .eq('user_id', user_id);

                if (!updateErr) {
                  actionApplied = true;
                  actionDetail  = {
                    type:                 'move_session',
                    from_day,
                    to_day,
                    session_type:         movedSession.type,
                    session_duration:     movedSession.duration,
                    session_intensity:    movedSession.intensity,
                    session_description:  movedSession.description,
                    description:          `${movedSession.type} (${movedSession.duration}) movida del ${DAY_NAMES[from_day-1]} al ${DAY_NAMES[to_day-1]}`,
                  };
                  console.log(`[CoachChat] ✓ Plan ${context.plan_id}: ${actionDetail.description}`);
                } else {
                  console.warn('[CoachChat] Error actualizando plan:', updateErr.message);
                }
              } else {
                console.warn(`[CoachChat] Move inválido: from=${from_day} idx=${sessionIdx} destTaken=${destTaken}`);
              }
            } else {
              console.warn(`[CoachChat] weekObj no encontrado: week=${week} current=${context.current_week}`);
            }
          } else {
            console.warn('[CoachChat] Plan no encontrado o error:', planErr?.message);
          }
          } // end boundary check
        } else {
          console.warn(`[CoachChat] Validación ACTION fallida: type=${type} week=${week} from=${from_day} to=${to_day} todayDay=${todayDayNumber}`);
        }
      } catch (actionErr) {
        console.warn('[CoachChat] Error procesando ACTION:', actionErr.message, 'Raw:', actionMatch[1]);
      }
    } else if (!actionMatch && rawReply.includes('<<<')) {
      console.warn('[CoachChat] ACTION tag parcialmente detectado pero regex no coincidió. Raw reply snippet:', rawReply.slice(-200));
    }

    // ── 6. Guardar mensajes en Supabase ───────────────────────────────────
    if (supabaseAdmin) {
      const { error: insertErr } = await supabaseAdmin
        .from('chat_messages')
        .insert([
          { user_id, role: 'user',      content: safeMessage },
          { user_id, role: 'assistant', content: cleanReply },
        ]);
      if (insertErr) console.warn('[CoachChat] Error guardando mensajes:', insertErr.message);
    }

    res.json({ reply: cleanReply, action_applied: actionApplied, action_detail: actionDetail });

  } catch (err) {
    console.error('[CoachChat] Error:', err.message);
    res.status(500).json({ error: 'Error procesando tu mensaje' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Stridely server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   OAuth callback: POST ${PORT}/api/strava/token`);
  console.log(`   Push subscriptions activas: ${pushSubscriptions.size}`);
});

