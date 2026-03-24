# Stridely ??

App personal para analizar tus datos de entrenamiento de Strava con recomendaciones de IA.

## Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express (proxy para Strava API)
- **Auth**: Strava OAuth 2.0

## Estructura

`
stridely/          ? Frontend (React + Vite)
server/            ? Backend (Express proxy)
`

## Desarrollo local

Necesitas dos terminales:

`ash
# Terminal 1 - Backend
cd server
npm start          # http://localhost:3001

# Terminal 2 - Frontend
cd stridely
npm run dev        # http://localhost:5173
`

## Variables de entorno

**stridely/.env.local**
```
VITE_STRAVA_CLIENT_ID=tu_client_id
```

**server/.env**
```
STRAVA_CLIENT_ID=tu_client_id
STRAVA_CLIENT_SECRET=tu_client_secret
```

## Funcionalidades actuales

- Autenticación con Strava OAuth
- Visualización de las últimas 30 actividades
- Datos: distancia, tiempo, ritmo, elevación

## Roadmap

- [ ] Estadísticas mensuales y anuales
- [ ] Gráficas de progreso
- [ ] Filtros por tipo de actividad
- [ ] Plan de entrenamiento con IA
- [ ] Recomendaciones personalizadas
