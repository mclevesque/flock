import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.flock.social',
  appName: 'Flock',
  // Points to the deployed web app — no local build needed
  server: {
    url: 'https://flock-two.vercel.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0d0f14',
  },
};

export default config;
