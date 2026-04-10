import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet') || id.includes('node_modules/@mapbox')) return 'vendor-leaflet';
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
          if (id.includes('node_modules/lucide-react')) return 'vendor-ui';
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
