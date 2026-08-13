// On-device storage. No account, no server — the limits live in localStorage
// and are mirrored into SharedPreferences so the background worker can read
// them while the WebView is dead.

import { AppUsage } from './bridge.js';

const LIMITS_KEY = 'presence.limits.v1';
const SETTINGS_KEY = 'presence.settings.v1';
const ICONS_KEY = 'presence.icons.v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private-mode failure. The native mirror is the copy that
    // actually drives alerts, so a failed cache write is not fatal.
  }
}

// --- limits: package name -> budget in minutes -----------------------------

let limits = read(LIMITS_KEY, {});
let settings = { alertsEnabled: true, ...read(SETTINGS_KEY, {}) };

export function getLimits() {
  return { ...limits };
}

export function getLimit(pkg) {
  return limits[pkg] ?? null;
}

/** Pass minutes = null (or 0) to clear the limit for an app. */
export function setLimit(pkg, minutes) {
  if (!minutes || minutes <= 0) {
    delete limits[pkg];
  } else {
    limits[pkg] = Math.round(minutes);
  }
  write(LIMITS_KEY, limits);
  return pushToNative();
}

export function getSettings() {
  return { ...settings };
}

export function setAlertsEnabled(enabled) {
  settings = { ...settings, alertsEnabled: !!enabled };
  write(SETTINGS_KEY, settings);
  return pushToNative();
}

/** Re-sends the current state to the native side. Safe to call on startup. */
export function pushToNative() {
  return AppUsage.syncLimits(limits, settings.alertsEnabled).catch(() => {
    // Native side unavailable (browser preview). The UI still works.
  });
}

// --- icon cache ------------------------------------------------------------
//
// Icons come back as base64 PNGs, which are expensive to re-encode on every
// launch, so they are cached and only fetched for packages we have not seen.

let icons = read(ICONS_KEY, {});

export function cachedIcon(pkg) {
  return icons[pkg] ?? null;
}

/**
 * True once we have asked about this package, whether or not an icon came
 * back. Callers use it to avoid re-requesting icons that do not exist.
 */
export function hasIcon(pkg) {
  return pkg in icons;
}

export async function ensureIcons(packages) {
  const missing = packages.filter((pkg) => !(pkg in icons));
  if (missing.length === 0) return icons;
  try {
    const { icons: fetched } = await AppUsage.getIcons(missing);
    // Record a miss as an empty string so we do not re-request an icon the
    // package manager could not give us.
    for (const pkg of missing) icons[pkg] = fetched?.[pkg] ?? '';
    write(ICONS_KEY, icons);
  } catch {
    // Leave the cache untouched; the UI falls back to letter tiles.
  }
  return icons;
}
