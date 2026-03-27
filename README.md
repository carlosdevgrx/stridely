# Stridely

Aplicación personal de running que conecta con Strava, analiza tus entrenamientos y te guía con un plan de entrenamiento inteligente asistido por IA.

---

## Índice

1. [Funcionalidades](#funcionalidades)
2. [Stack técnico](#stack-técnico)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Páginas](#páginas)
5. [Componentes clave](#componentes-clave)
6. [Hooks y contexto](#hooks-y-contexto)
7. [API del servidor](#api-del-servidor)
8. [Flujo de datos](#flujo-de-datos)
9. [Variables de entorno](#variables-de-entorno)
10. [Desarrollo local](#desarrollo-local)

---

## Funcionalidades

### Autenticación
- Registro y login con email/password via **Supabase Auth**
- Rutas protegidas con `ProtectedRoute` — redirige a `/login` si no hay sesión

### Conexión con Strava
- OAuth 2.0 completo: el usuario autoriza desde la app, el servidor canjea el código por tokens
- Refresco automático de token cuando expira (cada 6 horas)
- Actividades cargadas y normalizadas al tipo `Workout`
- Perfil del atleta (nombre, foto) mostrado en el sidebar

### Dashboard
- Saludo personalizado con el nombre del atleta
- **Resumen semanal**: km, tiempo, salidas y desnivel de los últimos 7 días
- **Última salida**: distancia, tiempo, ritmo y desnivel de la actividad más reciente
- **Coach IA diario**: análisis y consejo del día según el historial reciente (OpenAI)
  - Si la sesión de hoy está completada, muestra tarjeta de enhorabuena con 🏆
- **Sesión de hoy**: próxima sesión del plan activo, con indicador verde si ya está completada

### Actividades
- Listado grid de todas las actividades de Strava
- Cada tarjeta: nombre, fecha, distancia, tiempo, ritmo, desnivel, tipo (icono)

### Detalle de actividad
- Métricas completas: distancia, tiempo, ritmo, desnivel, frecuencia cardíaca, cadencia, calorías

### Plan de entrenamiento
- Generación del plan con IA basada en: objetivo, semanas, nivel, km semanales actuales
- Plan estructurado por semanas → sesiones diarias (tipo, distancia, duración, bloques, consejos)
- Sesiones marcadas automáticamente como **completadas** (✓ verde) cuando hay actividad Strava coincidente por fecha y duración
- Plan guardado en Supabase (`training_plans`), un plan activo por usuario

### Detalle de sesión
- Descripción completa con bloques de entrenamiento
- Consejos de Coach IA pre-sesión (cacheados en `localStorage`)
- Si completada: análisis post-entreno del Coach IA (plan vs actividad real)
  - Titular, resumen, puntos bien hechos, puntos a mejorar, valoración global (cacheado)

### Estadísticas
- **Selector de período**: Esta semana / Este mes / Este año / Todo
- **4 KPIs**: km totales, tiempo total, nº salidas, desnivel acumulado
- **Barras semanales**: últimas 12 semanas; barra ámbar si supera +10% la anterior (alerta sobrecarga)
- **Récords personales** (all-time): mejor ritmo 5 km, mejor ritmo 10 km, carrera más larga, racha activa
- **Gráfico de progresión de ritmo**: SVG nativo, tiempo en X, ritmo en Y (rápido = arriba)
- **Distribución por tipo**: run / trail / race con barras proporcionales
- **Consistencia del plan**: sesiones planificadas vs completadas en el período

### Perfil
- Información del usuario y gestión de conexión con Strava (conectar/desconectar)

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + Vite + TypeScript |
| Estilos | SCSS (BEM) con design tokens centralizados |
| Auth | Supabase Auth (email/password) |
| Base de datos | Supabase (PostgreSQL) |
| Backend | Node.js + Express |
| IA | OpenAI GPT-4o-mini |
| Strava | OAuth 2.0 + Strava API v3 |
| Despliegue | GitHub → Vercel (frontend) |

---

## Estructura del proyecto

```
stridely/                     ← raíz del repo
├── stridely/                 ← frontend (React + Vite)
│   ├── src/
│   │   ├── pages/            ← una página = una ruta
│   │   ├── components/
│   │   │   ├── common/       ← AppSidebar, ProtectedRoute, LoadingSpinner
│   │   │   └── features/training/ ← TrainingPlan, MiniCalendar
│   │   ├── hooks/            ← useStrava, useAuth
│   │   ├── context/          ← AuthContext
│   │   ├── services/         ← strava/client, supabase/client
│   │   ├── styles/           ← _tokens.scss, _mixins.scss
│   │   ├── types/            ← Workout, ActivityDetail, etc.
│   │   └── utils/            ← formatters (formatPace, formatDistance…)
│   └── package.json
└── server/
    └── index.js              ← todos los endpoints API
```

---

## Páginas

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/login` | `Login.tsx` | Formulario de acceso |
| `/register` | `Register.tsx` | Registro de cuenta |
| `/auth/callback` | `AuthCallback.tsx` | Callback OAuth de Strava |
| `/dashboard` | `Dashboard.tsx` | Inicio: resumen semanal, última salida, Coach IA, sesión de hoy |
| `/activities` | `ActivitiesPage.tsx` | Grid de todas las actividades de Strava |
| `/activity/:id` | `ActivityDetail.tsx` | Detalle de una actividad |
| `/training-plan` | `TrainingPlanPage.tsx` | Plan de entrenamiento completo |
| `/training-plan/session/:planId/:week/:day` | `SessionDetailPage.tsx` | Detalle + análisis IA de sesión |
| `/stats` | `StatsPage.tsx` | Estadísticas y progresión |
| `/profile` | `ProfilePage.tsx` | Perfil y ajustes |

---

## Componentes clave

### `AppSidebar` — `src/components/common/AppSidebar.tsx`
Sidebar de navegación compartido. Muestra logo, 4 enlaces (Dashboard, Plan, Actividades, Estadísticas) y botón de perfil con avatar. En móvil: nav fijo en la parte inferior.

### `TrainingPlan` — `src/components/features/training/TrainingPlan.tsx`
Uso dual: página completa (`/training-plan`) y widget en Dashboard. Lógica de comparación plan↔actividad:
- `parsePlanDurationMin(session)` — extrae duración objetivo en minutos
- `findMatchingActivity(session, week, plan, activities)` — actividad Strava por fecha (±1 día) y duración (±30%)
- `isSessionCompleted(session, week, plan, activities)` — wrapper booleano

Exporta tipos: `PlanSession`, `PlanWeek`, `StoredPlan`.

### `MiniCalendar` — `src/components/features/training/MiniCalendar.tsx`
Calendario semanal en la vista del plan. Estado por sesión: pendiente / completada / hoy.

---

## Hooks y contexto

### `useStrava` — `src/hooks/useStrava.ts`
- `isConnected` — hay token en Supabase
- `activities: Workout[]` — actividades normalizadas
- `athleteData` — perfil del atleta (nombre, foto)
- `fetchActivities()` — carga desde el servidor (refresca token si es necesario)

### `useAuth` — `src/hooks/useAuth.ts`
Wrapper sobre Supabase Auth. Login, register, logout y estado de sesión.

### `AuthContext` — `src/context/AuthContext.tsx`
Provee `{ user, loading }` a toda la app vía React Context.

---

## API del servidor

Base URL: `http://localhost:3001` (dev) / `VITE_API_URL` en producción.

Rutas protegidas requieren `Authorization: Bearer <strava_access_token>`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Healthcheck |
| POST | `/api/strava/token` | Canjea código OAuth por tokens |
| POST | `/api/strava/refresh` | Refresca el access token |
| GET | `/api/strava/activities` | Lista actividades (`?page=&per_page=`) |
| GET | `/api/strava/activities/:id` | Detalle de una actividad |
| GET | `/api/strava/athlete` | Perfil del atleta |
| POST | `/api/ai/recommend` | Consejo diario del Coach IA (Dashboard) |
| POST | `/api/ai/training-plan` | Genera plan de entrenamiento completo |
| POST | `/api/ai/session-detail` | Consejos pre-sesión |
| POST | `/api/ai/session-review` | Análisis post-entreno (plan vs actividad real) |

---

## Flujo de datos

```
Usuario
  │
  ├─ Auth (Supabase) ──────────────► AuthContext → useAuth
  │
  ├─ Strava OAuth
  │    └─ /auth/callback → server /api/strava/token → tokens guardados en Supabase
  │
  ├─ useStrava
  │    ├─ Lee tokens de Supabase (refresca si expired)
  │    └─ GET /api/strava/activities → Workout[]
  │
  ├─ Plan de entrenamiento
  │    ├─ POST /api/ai/training-plan → JSON strukturado
  │    └─ Guardado en Supabase (training_plans)
  │
  └─ Análisis IA (todos cacheados en localStorage)
       ├─ POST /api/ai/recommend      → consejo diario
       ├─ POST /api/ai/session-detail → consejos pre-sesión
       └─ POST /api/ai/session-review → análisis post-entreno
```

---

## Variables de entorno

**`stridely/.env.local`**
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_STRAVA_CLIENT_ID=12345
VITE_API_URL=http://localhost:3001
```

**`server/.env`**
```env
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=xxxx
OPENAI_API_KEY=sk-...
PORT=3001
```

---

## Desarrollo local

```bash
# Terminal 1 — Servidor Express
cd server && npm install && npm start   # http://localhost:3001

# Terminal 2 — Frontend React
cd stridely && npm install && npm run dev  # http://localhost:5173
```

**Deploy:**
```bash
git add -A
git commit -m "feat: ..."
git push origin develop
git checkout main && git merge develop && git push origin main
git checkout develop
```