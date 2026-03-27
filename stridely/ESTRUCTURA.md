# Estructura de archivos — Stridely

Árbol real del proyecto tal como está construido (sin carpetas de build ni node_modules).

```
stridely/  (raíz del repo)
│
├── README.md                          ← documentación completa del proyecto
│
├── server/
│   ├── index.js                       ← todos los endpoints Express (Strava + OpenAI)
│   ├── package.json
│   └── .env                           ← STRAVA_CLIENT_ID/SECRET, OPENAI_API_KEY, PORT
│
└── stridely/  (frontend React + Vite)
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.app.json
    ├── package.json
    ├── vercel.json                    ← config de deploy (SPA rewrites)
    ├── .env.local                     ← VITE_SUPABASE_*, VITE_STRAVA_CLIENT_ID, VITE_API_URL
    │
    └── src/
        │
        ├── App.tsx                    ← Router principal, importa todas las páginas
        ├── App.css                    ← reset mínimo del contenedor raíz
        ├── main.tsx                   ← entry point React
        │
        ├── types/
        │   └── index.ts               ← User, Workout, ActivityDetail (tipos compartidos)
        │
        ├── styles/
        │   ├── _tokens.scss           ← colores, espaciados, radios, sombras, tipografía
        │   ├── _mixins.scss           ← mobile-only, tablet-up, desktop-up, btn-base, btn-primary
        │   └── globals.scss           ← reset CSS, fuentes, variables globales
        │
        ├── context/
        │   └── AuthContext.tsx        ← Provee { user, loading } vía React Context (Supabase Auth)
        │
        ├── hooks/
        │   ├── index.ts
        │   ├── useAuth.ts             ← login, register, logout, estado de sesión
        │   └── useStrava.ts           ← isConnected, activities, athleteData, fetchActivities()
        │
        ├── services/
        │   ├── index.ts
        │   ├── strava/
        │   │   └── client.ts          ← stravaClient: helpers para llamar al servidor proxy
        │   ├── supabase/
        │   │   └── client.ts          ← instancia de supabase (createClient)
        │   └── storage/               ← (vacío, localStorage se usa directamente en pages)
        │
        ├── utils/
        │   ├── index.ts
        │   └── formatters.ts          ← formatPace(), formatDistance(), formatDuration()
        │
        ├── constants/
        │   └── index.ts               ← constantes globales (tipos de actividad, etc.)
        │
        ├── components/
        │   ├── common/
        │   │   ├── index.ts
        │   │   ├── AppSidebar.tsx     ← sidebar desktop + bottom nav móvil (compartido por todas las páginas)
        │   │   ├── AppSidebar.scss
        │   │   ├── ProtectedRoute.tsx ← wrapper que redirige a /login si no hay sesión
        │   │   ├── LoadingSpinner.tsx ← spinner de carga genérico
        │   │   └── LoadingSpinner.css
        │   │
        │   └── features/
        │       └── training/
        │           ├── TrainingPlan.tsx   ← plan completo + widget dashboard + lógica de comparación
        │           ├── TrainingPlan.scss
        │           ├── MiniCalendar.tsx   ← calendario semanal dentro del plan
        │           └── MiniCalendar.scss
        │
        └── pages/
            ├── Home.tsx / Home.css        ← landing (redirige a /login)
            ├── Login.tsx / Login.css      ← formulario de acceso
            ├── Register.tsx               ← registro de cuenta
            ├── Auth.scss                  ← estilos compartidos login/register
            ├── AuthCallback.tsx           ← callback OAuth de Strava
            ├── Dashboard.tsx              ← resumen semanal, última salida, Coach IA, sesión de hoy
            ├── Dashboard.scss
            ├── ActivitiesPage.tsx         ← grid de todas las actividades
            ├── ActivitiesPage.scss
            ├── ActivityDetail.tsx         ← detalle completo de una actividad
            ├── ActivityDetail.scss
            ├── TrainingPlanPage.tsx       ← wrapper que renderiza <TrainingPlan fullPage />
            ├── TrainingPlanPage.scss
            ├── SessionDetailPage.tsx      ← detalle de sesión + análisis IA pre/post
            ├── SessionDetailPage.scss
            ├── StatsPage.tsx              ← estadísticas: KPIs, barras, récords, gráfico de ritmo
            ├── StatsPage.scss
            ├── ProfilePage.tsx            ← perfil de usuario + gestión Strava
            └── ProfilePage.scss
```

---

## Convenciones de código

- **BEM estricto**: `.bloque__elemento--modificador` en todos los SCSS
- **Un SCSS por página/componente**: importado directamente en el `.tsx`
- **`@use '../styles/tokens' as *`**: todos los SCSS importan tokens y mixins al inicio
- **No hay librerías de componentes**: UI 100% propio con SCSS
- **No hay librerías de gráficos**: SVG nativo en StatsPage, divs/CSS para barras
- **localStorage para cachés de IA**: claves `sdp-intro-{planId}-w{week}-d{day}` y `sdp-review-{planId}-w{week}-d{day}`
- **Tokens de diseño centralizados**:
  - Colores: `$color-primary (#5BBFBA)`, `$color-navy-dark`, `$color-bg`, `$color-white`, `$color-border`, `$color-gray-400/600/800/900`
  - Spacing: `$space-1` (0.25rem) … `$space-16` (4rem) — no existe `$space-7`
  - Radios: `$radius-sm/md/lg/xl/full`
  - Sombras: `$shadow-sm/md/xl`