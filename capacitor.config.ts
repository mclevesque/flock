import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.ryft.social',
  appName: 'Ryft',
  // Points to the deployed web app — no local build needed
  server: {
    url: 'https://flocksocial.netlify.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0d0f14',
  },
};

export default config;
