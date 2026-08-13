// Talks to the native AppUsage plugin.
//
// The app ships as plain files with no bundler, so instead of importing
// @capacitor/core we use the `Capacitor` global that the native WebView
// injects. When that global is missing we are running in a desktop browser,
// and a mock takes over so the UI can be built and reviewed without a phone.

const native = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
  ? window.Capacitor.registerPlugin('AppUsage')
  : null;

export const isNative = native !== null;

// ---------------------------------------------------------------------------
// Browser mock
// ---------------------------------------------------------------------------

const MOCK_APPS = [
  ['com.instagram.android', 'Instagram', 74],
  ['com.zhiliaoapp.musically', 'TikTok', 52],
  ['com.google.android.youtube', 'YouTube', 41],
  ['com.whatsapp', 'WhatsApp', 23],
  ['com.reddit.frontpage', 'Reddit', 19],
  ['com.spotify.music', 'Spotify', 16],
  ['com.google.android.gm', 'Gmail', 7],
  ['com.android.chrome', 'Chrome', 12],
  ['com.slack', 'Slack', 5],
  ['net.greatsouls.ryft', 'Ryft', 9],
];

// Deterministic per-day jitter, so a reload does not reshuffle the numbers but
// the mock still looks alive across days.
function mockMinutes(base, seed) {
  const day = Math.floor(Date.now() / 86_400_000);
  const n = Math.sin(day * 97 + seed * 31) * 10_000;
  const wobble = (n - Math.floor(n)) * 0.7 + 0.65;
  return Math.round(base * wobble);
}

const mock = {
  granted: true,
  async hasPermission() {
    return { granted: mock.granted };
  },
  async openPermissionSettings() {
    mock.granted = true;
  },
  async getUsage() {
    const start = startOfToday();
    const apps = MOCK_APPS
      .map(([packageName, appName, base], i) => ({
        packageName,
        appName,
        totalMs: mockMinutes(base, i) * 60_000,
        lastUsedAt: Date.now() - i * 11 * 60_000,
      }))
      .filter((a) => a.totalMs > 0)
      .sort((a, b) => b.totalMs - a.totalMs);
    return {
      start,
      end: Date.now(),
      totalMs: apps.reduce((sum, a) => sum + a.totalMs, 0),
      apps,
    };
  },
  async getInstalledApps() {
    return {
      apps: MOCK_APPS
        .map(([packageName, appName]) => ({ packageName, appName }))
        .sort((a, b) => a.appName.localeCompare(b.appName)),
    };
  },
  async getIcons() {
    return { icons: {} };
  },
  async syncLimits() {},
  async checkNotificationPermission() {
    return { granted: true };
  },
  async requestNotificationPermission() {
    return { granted: true };
  },
};

const plugin = native ?? mock;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const AppUsage = {
  hasPermission: () => plugin.hasPermission(),
  openPermissionSettings: () => plugin.openPermissionSettings(),
  getUsage: (options = {}) => plugin.getUsage(options),
  getInstalledApps: () => plugin.getInstalledApps(),
  getIcons: (packages) => plugin.getIcons({ packages }),
  syncLimits: (limits, alertsEnabled) => plugin.syncLimits({ limits, alertsEnabled }),
  checkNotificationPermission: () => plugin.checkNotificationPermission(),
  requestNotificationPermission: () => plugin.requestNotificationPermission(),
};

/** Fires when the app returns to the foreground, so the view can re-query. */
export function onResume(handler) {
  if (window.Capacitor?.Plugins?.App?.addListener) {
    window.Capacitor.Plugins.App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) handler();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) handler();
  });
}
