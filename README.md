# Stridely

Aplicación web progresiva (PWA) de running que conecta con Strava, analiza tu historial de entrenamientos y te acompaña con un plan de entrenamiento personalizado asistido por IA.

<p align="center">
  <img src="stridely/docs/stridely-1.png" width="100%" alt="Dashboard de Stridely — vista desktop" />
</p>

<p align="center">
  <img src="stridely/docs/stridely-3.png" width="72%" alt="Coach IA y plan de entrenamiento — vista mobile" />
</p>

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
- **Webhook de Strava** — recibe eventos en tiempo real (nueva actividad, edición) via `POST /api/strava/webhook`
- Actividades cargadas y normalizadas al tipo `Workout`
- Perfil del atleta (nombre, foto) mostrado en el sidebar

### Dashboard
- Saludo personalizado con nombre del atleta y fecha actual
- **Racha de días seguidos** — badge de fuego con días consecutivos de actividad
- **Resumen semanal**: km, tiempo, salidas y desnivel de los últimos 7 días
- **Semana del plan activo** — mini calendario de L a D con estado de cada sesión (pendiente / completada / hoy)

#### Coach IA
- **Recomendación diaria** generada por GPT-4o-mini según el historial reciente (cacheada en Supabase por día)
- Muestra sesión del plan activo con tipo, duración, ritmo objetivo e intensidad
- **Indicador de carga semanal** (Carga: Alta / Normal / Baja) calculado sobre últimos 7 días vs semana anterior
- **Alerta de patrones** — detecta señales de sobreentrenamiento o inconsistencia y muestra un aviso contextual (descartable, no reaparece hasta el día siguiente)
- **Consultar al coach** — 4 preguntas preset (¿Cómo voy de forma? / ¿Cambio algo esta semana? / ¿Voy bien para mi objetivo? / ¿Descanso suficiente?) con respuesta generada en tiempo real
- Tarjeta de sesión completada (🏆) cuando ya hay actividad Strava coincidente con la sesión de hoy
- Día de descanso con siguiente sesión y días restantes

#### Post-run check-in
- Detecta automáticamente si hay una actividad de hoy (primera vez del día, no repetible)
- Hace una pregunta contextual sobre la sesión (¿cómo fue el ritmo? / ¿cómo te sentiste?) con chips de respuesta rápida
- Envía la respuesta al Coach IA y muestra un análisis personalizado breve

#### Notificaciones in-app
- Centro de notificaciones con badge de no leídas
- Avisos sobre sesiones pendientes y actividad reciente

#### Banner motivacional
- Aparece automáticamente cuando hay 2 o más sesiones del plan perdidas en la semana
- Mensaje diferenciado según si son 2 (recuperable) o 3+ sesiones (urgente)

### Actividades
- Grid de todas las actividades sincronizadas desde Strava
- Cada tarjeta: nombre, fecha, tipo (icono), distancia, tiempo y ritmo

### Detalle de actividad
- **Mapa interactivo** (Leaflet + CARTO Dark Matter) con ruta y polyline en color corporativo
- Métricas principales: distancia, tiempo, ritmo medio
- Métricas secundarias: desnivel, frecuencia cardíaca media/máx, cadencia, calorías
- Tabla de splits por kilómetro

### Plan de entrenamiento
- **Generación con IA** basada en: objetivo de carrera, distancia objetivo, semanas disponibles, nivel (principiante / intermedio / avanzado) y km semanales actuales
- Plan estructurado semana a semana → sesiones diarias con tipo, distancia/duración, ritmo orientativo y descripción
- Sesiones marcadas automáticamente como **completadas** (✓) cuando hay actividad Strava coincidente por fecha y duración (±30%)
- Vista hero banner con objetivo del plan y progreso (semana actual / total)
- Plan guardado en Supabase (`training_plans`), un plan activo por usuario

### Detalle de sesión
- Hero card con intensidad, tipo de sesión y número decorativo
- Stats: volumen y ritmo sugerido
- **Instrucciones pre-sesión generadas por Coach IA**: intro motivacional, calentamiento, parte principal, vuelta a la calma, ritmo objetivo y tiempo estimado (cacheado en `localStorage`)
- **Análisis post-entreno** (cuando la sesión está completada): titular, resumen, puntos bien hechos, puntos a mejorar y valoración global comparando plan vs actividad real (cacheado en `localStorage`)

### Estadísticas
- **Selector de período**: Esta semana / Este mes / Este año / Todo
- **4 KPIs**: km totales, tiempo total, nº salidas, desnivel acumulado
- **Barras semanales**: últimas 12 semanas; barra ámbar si supera +10% la semana anterior (alerta de sobrecarga de carga)
- **Récords personales** (all-time): mejor ritmo 5 km, mejor ritmo 10 km, carrera más larga, racha activa
- **Gráfico de progresión de ritmo**: SVG nativo, tiempo en X, ritmo en Y (rápido = arriba)
- **Distribución por tipo**: run / trail / race con barras proporcionales
- **Consistencia del plan**: sesiones planificadas vs completadas en el período

### Push Notifications (PWA)
- Suscripción/cancelación gestionada desde la página de perfil
- Notificación matutina diaria a las **08:00** (cron en servidor) con la sesión del plan de hoy
- Implementado con **Web Push API + VAPID** (claves configurables en servidor)

### Perfil
- Información del usuario y avatar
- Gestión de conexión con Strava (conectar / desconectar)
- Control de suscripción a push notifications

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + Vite 8 + TypeScript 5.9 |
| Estilos | SCSS (BEM) con design tokens centralizados |
| Routing | React Router v7 |
| Mapas | Leaflet + React Leaflet + CARTO Dark Matter tiles |
| Auth | Supabase Auth (email/password) |
| Base de datos | Supabase (PostgreSQL) |
| Backend | Node.js + Express |
| IA | OpenAI GPT-4o-mini |
| Strava | OAuth 2.0 + Strava API v3 + Webhook |
| Push | Web Push API + VAPID + node-cron |
| PWA | Service Worker (network-first, same-origin) + Web App Manifest |
| Mobile | Capacitor (configurado para exportar iOS/Android) |
| Despliegue | GitHub → Vercel (frontend) |

---

## Estructura del proyecto

```
stridely/                          ← raíz del repo
├── stridely/                      ← frontend (React + Vite)
│   ├── public/
│   │   ├── sw.js                  ← Service Worker (cache + push)
│   │   └── manifest.json          ← Web App Manifest (PWA)
│   └── src/
│       ├── pages/                 ← una página = una ruta
│       ├── components/
│       │   ├── common/            ← AppSidebar, ProtectedRoute, LoadingSpinner
│       │   └── features/training/ ← TrainingPlan, MiniCalendar
│       ├── hooks/                 ← useStrava, usePushNotifications
│       ├── context/               ← AuthContext
│       ├── services/              ← strava/client, supabase/client
│       ├── styles/                ← _tokens.scss, _mixins.scss, globals.scss
│       ├── types/                 ← Workout, ActivityDetail, etc.
│       └── utils/                 ← formatters (formatPace, formatDistance, toYMD…)
└── server/
    └── index.js                   ← todos los endpoints API + cron
```

---

## Páginas

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/login` | `Login.tsx` | Formulario de acceso |
| `/register` | `Register.tsx` | Registro de cuenta |
| `/auth/callback` | `AuthCallback.tsx` | Callback OAuth de Strava |
| `/dashboard` | `Dashboard.tsx` | Inicio: Coach IA, semana del plan, salidas recientes, estadísticas rápidas |
| `/activities` | `ActivitiesPage.tsx` | Grid de todas las actividades de Strava |
| `/activity/:id` | `ActivityDetail.tsx` | Detalle de actividad con mapa y splits |
| `/training-plan` | `TrainingPlanPage.tsx` | Plan de entrenamiento completo |
| `/training-plan/session/:planId/:week/:day` | `SessionDetailPage.tsx` | Detalle + instrucciones + análisis IA de sesión |
| `/stats` | `StatsPage.tsx` | Estadísticas, récords y progresión |
| `/profile` | `ProfilePage.tsx` | Perfil, Strava y push notifications |

---

## Componentes clave

### `AppSidebar` — `src/components/common/AppSidebar.tsx`
Sidebar de navegación compartido. Logo, 4 enlaces de navegación y botón de perfil con avatar del atleta. En móvil: barra fija en la parte inferior.

### `TrainingPlan` — `src/components/features/training/TrainingPlan.tsx`
Uso dual: página completa (`/training-plan`) y widget en Dashboard. Lógica de comparación plan↔actividad:
- `parsePlanDurationMin(session)` — extrae duración objetivo en minutos
- `findMatchingActivity(session, week, plan, activities)` — actividad Strava por fecha (±1 día) y duración (±30%)
- `isSessionCompleted(session, week, plan, activities)` — wrapper booleano

Exporta tipos: `PlanSession`, `PlanWeek`, `StoredPlan`.

### `MiniCalendar` — `src/components/features/training/MiniCalendar.tsx`
Calendario semanal (L–D) con estado visual por sesión: pendiente / completada / hoy.

---

## Hooks y contexto

### `useStrava` — `src/hooks/useStrava.ts`
- `isConnected` — hay token activo en Supabase
- `activities: Workout[]` — actividades normalizadas
- `athleteData` — perfil del atleta (nombre, foto)
- `fetchActivities()` — carga desde servidor, refresca token si está expirado

### `usePushNotifications` — `src/hooks/usePushNotifications.ts`
- `status: 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'`
- `subscribe(athleteId?, todaySession?)` — solicita permiso, registra suscripción VAPID en el servidor
- `unsubscribe()` — cancela suscripción

### `AuthContext` — `src/context/AuthContext.tsx`
Provee `{ user, loading }` a toda la app via React Context. Utilizado por `ProtectedRoute`.

---

## API del servidor

Base URL: `http://localhost:3001` (dev) / `VITE_API_URL` en producción.

### Strava

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Healthcheck |
| POST | `/api/strava/token` | Canjea código OAuth por tokens |
| POST | `/api/strava/refresh` | Refresca el access token |
| GET | `/api/strava/activities` | Lista actividades (`?page=&per_page=`) |
| GET | `/api/strava/activities/:id` | Detalle de una actividad |
| GET | `/api/strava/athlete` | Perfil del atleta |
| GET | `/api/strava/webhook` | Verificación del webhook de Strava |
| POST | `/api/strava/webhook` | Receptor de eventos en tiempo real |

### Coach IA

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/ai/recommend` | Recomendación diaria (Dashboard) |
| POST | `/api/ai/training-plan` | Genera plan de entrenamiento completo |
| POST | `/api/ai/session-detail` | Instrucciones pre-sesión |
| POST | `/api/ai/session-review` | Análisis post-entreno (plan vs actividad real) |
| POST | `/api/ai/post-run-checkin` | Respuesta al check-in post-carrera |
| POST | `/api/ai/pattern-alert` | Detecta patrones de carga o inconsistencia |
| POST | `/api/ai/coach-question` | Responde preguntas rápidas del usuario al coach |
| POST | `/api/ai/plan-adjust` | Sugiere ajustes al plan activo |

### Push Notifications

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/push/vapid-key` | Devuelve la clave pública VAPID |
| POST | `/api/push/subscribe` | Registra una suscripción push |
| POST | `/api/push/unsubscribe` | Cancela una suscripción push |
| POST | `/api/push/test` | Envía notificación de prueba |

**Cron:** todos los días a las **08:00 (Madrid)** el servidor envía a todos los suscriptores la notificación con la sesión del plan de hoy.

---

## Flujo de datos

```
Usuario
  │
  ├─ Auth (Supabase) ──────────────► AuthContext → ProtectedRoute
  │
  ├─ Strava OAuth
  │    └─ /auth/callback → POST /api/strava/token → tokens en Supabase
  │
  ├─ useStrava
  │    ├─ Lee tokens de Supabase (refresca si expirado)
  │    └─ GET /api/strava/activities → Workout[]
  │
  ├─ Plan de entrenamiento
  │    ├─ POST /api/ai/training-plan → JSON estructurado
  │    └─ Guardado en Supabase (training_plans)
  │
  ├─ Análisis IA (cacheados en localStorage o Supabase)
  │    ├─ POST /api/ai/recommend       → consejo diario (caché Supabase/día)
  │    ├─ POST /api/ai/session-detail  → instrucciones pre-sesión (localStorage)
  │    ├─ POST /api/ai/session-review  → análisis post-entreno (localStorage)
  │    ├─ POST /api/ai/post-run-checkin → check-in tras carrera (localStorage)
  │    ├─ POST /api/ai/pattern-alert   → alerta de patrones (localStorage/día)
  │    └─ POST /api/ai/coach-question  → pregunta libre al coach
  │
  └─ Push Notifications
       ├─ usePushNotifications → POST /api/push/subscribe (VAPID)
       └─ Cron 08:00 → webpush.sendNotification() a todos los suscriptores
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
VAPID_PUBLIC_KEY=BM...
VAPID_PRIVATE_KEY=xxxx
VAPID_SUBJECT=mailto:hola@stridely.app
PORT=3001
```

> Sin las variables VAPID el servidor arranca igual pero las push notifications quedan desactivadas (aviso en consola).

---

## Desarrollo local

```bash
# Terminal 1 — Servidor Express
cd server && npm install && npm run dev   # http://localhost:3001

# Terminal 2 — Frontend React
cd stridely && npm install && npm run dev # http://localhost:5173
```

**Deploy:**
```bash
git add -A
git commit -m "feat: ..."
git push origin develop
git checkout main && git merge develop --no-edit && git push origin main
git checkout develop
```


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