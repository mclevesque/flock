import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.greatsouls.presence',
  appName: 'Presence',
  // Standalone: the UI ships inside the APK, so the app works with no network
  // and no account. Do NOT add a `server.url` here — that would turn this back
  // into a thin wrapper around a website.
  webDir: 'www',
  android: {
    backgroundColor: '#0b0c0e',
    allowMixedContent: false,
  },
};

export default config;
