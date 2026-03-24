# Guía de Estructura del Proyecto Stridely

## 📁 Organización de Carpetas

```
src/
├── components/              # Componentes React
│   ├── common/             # Componentes reutilizables (LoadingSpinner, Button, etc)
│   ├── layout/             # Componentes de layout (Header, Footer, Sidebar)
│   └── features/           # Características agrupadas por dominio
│       ├── strava/         # Integración con Strava
│       ├── analytics/      # Análisis y gráficas
│       └── recommendations/# Recomendaciones de IA
│
├── pages/                  # Páginas/Rutas principales
│   ├── Home.tsx
│   ├── Dashboard.tsx
│   ├── TrainingPlans.tsx
│   └── Recommendations.tsx
│
├── services/               # Lógica de negocio y APIs
│   ├── api/               # Cliente HTTP genérico
│   ├── strava/            # Integración con Strava API
│   ├── ai/                # Integración con IA (futuro)
│   └── storage/           # Persistencia de datos
│
├── hooks/                  # Custom React Hooks
│   ├── useAuth.ts         # Autenticación
│   ├── useFetch.ts        # Fetch genérico
│   └── useWorkouts.ts     # Gestión de entrenamientos
│
├── context/               # React Context (estado global)
│   └── AuthContext.tsx    # Contexto de autenticación
│
├── types/                 # Definiciones TypeScript
│   └── index.ts          # Tipos principales
│
├── constants/             # Constantes globales
│   └── index.ts
│
├── utils/                 # Funciones utilitarias
│   ├── formatters.ts     # Formateo de datos
│   ├── validators.ts     # Validaciones
│   └── dates.ts          # Utilidades de fechas
│
└── styles/                # Estilos globales
    ├── globals.css
    ├── variables.css
    └── theme.css
```

## 🔧 Capas de Trabajo

### 1. **Presentación (Components)**
- Componentes reutilizables en `common/`
- Características agrupadas en `features/`
- Páginas en la raíz de `pages/`

### 2. **Lógica de Negocio (Services)**
- `api/client.ts` - Cliente HTTP centralizado
- `strava/client.ts` - Integración con Strava API
- `storage/` - Persistencia local

### 3. **Estado (Context + Hooks)**
- `AuthContext.tsx` - Estado de autenticación global
- Hooks personalizados para lógica reutilizable

### 4. **Tipos y Constantes**
- Todos los tipos TypeScript centralizados
- Constantes de configuración

## 🚀 Flujo de Datos

```
User Interaction
      ↓
Components (UI)
      ↓
Hooks (useAuth, useFetch, etc)
      ↓
Context (Global State)
      ↓
Services (API Calls, Business Logic)
      ↓
External APIs (Strava, AI Service)
```

## 📝 Convenciones

### Nombres de Archivos
- Componentes: `PascalCase.tsx` (ej: `LoadingSpinner.tsx`)
- Servicios: `camelCase.ts` (ej: `apiClient.ts`)
- Hooks: `camelCase.ts` empezando con "use" (ej: `useAuth.ts`)
- Tipos: `index.ts` en carpeta types

### Estructura de Archivos
```typescript
// Orden típico en un archivo
1. Comentario de descripción
2. Imports
3. Types/Interfaces
4. Componente/Función principal
5. Exports
```

## 🔐 Variables de Entorno

Ver archivo `.env.example` para configuración requerida.

## 🎯 Próximos Pasos

1. Completar componentes en `features/`
2. Implementar navegación/router
3. Conectar con Strava OAuth
4. Crear hooks adicionales (useFetch, useWorkouts)
5. Integrar servicio de IA
