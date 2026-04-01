import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stridely.app',
  appName: 'Stridely',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
