import { AppUsage, isNative, onResume, startOfToday } from './bridge.js';
import {
  cachedIcon,
  ensureIcons,
  getLimit,
  getLimits,
  getSettings,
  hasIcon,
  pushToNative,
  setAlertsEnabled,
  setLimit,
} from './store.js';

const PRESETS = [15, 30, 45, 60, 90, 120, 180, 240];
const REFRESH_MS = 60_000;
// Icons are base64 PNGs, so the full installed-app list is fetched a screenful
// at a time as the user scrolls or searches rather than all at once.
const ICON_BATCH = 30;

const el = (id) => document.getElementById(id);

const state = {
  tab: 'today',
  usage: [],          // [{ packageName, appName, totalMs, lastUsedAt }]
  totalMs: 0,
  installed: [],      // [{ packageName, appName }]
  search: '',
  sheetPkg: null,
  timer: null,
  iconFetchInFlight: false,
};

// ---------------------------------------------------------------------------
// formatting
// ---------------------------------------------------------------------------

function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return ms > 0 ? '<1m' : '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatBudget(minutes) {
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function initial(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

// ---------------------------------------------------------------------------
// permission gate
// ---------------------------------------------------------------------------

async function checkPermission() {
  try {
    const { granted } = await AppUsage.hasPermission();
    return !!granted;
  } catch {
    return false;
  }
}

async function showGate() {
  el('gate').hidden = false;
  el('main').hidden = true;
  stopAutoRefresh();
}

async function showMain() {
  el('gate').hidden = true;
  el('main').hidden = false;
  el('header-date').textContent = todayLabel();
  el('footer-note').textContent = isNative
    ? 'Times come from Android usage access. Stored on this device only.'
    : 'Preview mode — sample data. Install the APK for real usage.';
  await pushToNative();
  await refresh();
  startAutoRefresh();
}

async function boot() {
  el('alerts-toggle').checked = getSettings().alertsEnabled;
  wireEvents();

  if (await checkPermission()) {
    await showMain();
  } else {
    await showGate();
  }
}

// ---------------------------------------------------------------------------
// data
// ---------------------------------------------------------------------------

async function refresh() {
  try {
    const result = await AppUsage.getUsage({ start: startOfToday() });
    state.usage = result.apps ?? [];
    state.totalMs = result.totalMs ?? 0;
  } catch (err) {
    // The user can revoke usage access at any time; drop back to the gate
    // rather than showing a frozen, silently stale screen.
    if (String(err?.message ?? err).includes('USAGE_ACCESS_DENIED')) {
      await showGate();
      return;
    }
    throw err;
  }

  if (state.installed.length === 0) {
    try {
      const { apps } = await AppUsage.getInstalledApps();
      state.installed = apps ?? [];
    } catch {
      // Fall back to just the apps we have usage for.
      state.installed = state.usage.map(({ packageName, appName }) => ({ packageName, appName }));
    }
  }

  const packages = [...new Set([
    ...state.usage.map((a) => a.packageName),
    ...Object.keys(getLimits()),
  ])];
  await ensureIcons(packages);

  render();
}

function startAutoRefresh() {
  stopAutoRefresh();
  state.timer = setInterval(() => {
    if (!document.hidden) refresh().catch(() => {});
  }, REFRESH_MS);
}

function stopAutoRefresh() {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------

function render() {
  renderHeader();
  renderToday();
  renderLimits();
}

function renderHeader() {
  el('header-total').textContent = formatDuration(state.totalMs);

  const over = state.usage.filter((app) => {
    const limit = getLimit(app.packageName);
    return limit && app.totalMs >= limit * 60_000;
  });

  const sub = el('header-sub');
  if (over.length === 0) {
    const limited = Object.keys(getLimits()).length;
    sub.classList.remove('is-over');
    sub.textContent = limited === 0
      ? 'Set a daily limit on an app to start.'
      : `${limited} app${limited === 1 ? '' : 's'} on a budget, all within it.`;
  } else {
    sub.classList.add('is-over');
    sub.textContent = over.length === 1
      ? `${over[0].appName} is over its limit.`
      : `${over.length} apps are over their limits.`;
  }
}

/** Icon element, falling back to a letter tile when we have no bitmap. */
function iconNode(pkg, name) {
  const src = cachedIcon(pkg);
  if (src) {
    const img = document.createElement('img');
    img.className = 'app-icon';
    img.src = src;
    img.alt = '';
    return img;
  }
  const div = document.createElement('div');
  div.className = 'app-icon-fallback';
  div.setAttribute('aria-hidden', 'true');
  div.textContent = initial(name);
  return div;
}

function appRow({ packageName, appName, totalMs }) {
  const limit = getLimit(packageName);
  const budgetMs = limit ? limit * 60_000 : 0;
  const isOver = !!limit && totalMs >= budgetMs;

  const li = document.createElement('li');
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'app-row';
  row.addEventListener('click', () => openSheet(packageName, appName, totalMs));

  row.appendChild(iconNode(packageName, appName));

  const name = document.createElement('span');
  name.className = 'app-name';
  name.textContent = appName;
  row.appendChild(name);

  const time = document.createElement('span');
  time.className = `app-time${isOver ? ' is-over' : ''}`;
  time.textContent = formatDuration(totalMs);
  row.appendChild(time);

  const meta = document.createElement('span');
  meta.className = 'app-meta';

  if (limit) {
    const ratio = Math.min(totalMs / budgetMs, 1);
    const bar = document.createElement('span');
    bar.className = 'bar';
    const fill = document.createElement('span');
    fill.className = 'bar-fill';
    if (isOver) fill.classList.add('is-over');
    else if (ratio >= 0.8) fill.classList.add('is-warn');
    fill.style.width = `${ratio * 100}%`;
    bar.appendChild(fill);
    meta.appendChild(bar);

    const sub = document.createElement('span');
    sub.className = `app-sub${isOver ? ' is-over' : ''}`;
    sub.textContent = isOver
      ? `${formatDuration(totalMs - budgetMs)} over your ${formatBudget(limit)} limit`
      : `${formatDuration(budgetMs - totalMs)} left of ${formatBudget(limit)}`;
    meta.appendChild(sub);
  } else {
    const sub = document.createElement('span');
    sub.className = 'app-sub';
    const cta = document.createElement('span');
    cta.className = 'set-limit';
    cta.textContent = 'Set a daily limit';
    sub.appendChild(cta);
    meta.appendChild(sub);
  }

  row.appendChild(meta);
  li.appendChild(row);
  return li;
}

function renderToday() {
  const list = el('today-list');
  list.replaceChildren();
  const apps = state.usage;
  el('today-empty').hidden = apps.length > 0;
  for (const app of apps) list.appendChild(appRow(app));
}

function renderLimits() {
  const list = el('limits-list');
  list.replaceChildren();

  const usageByPkg = new Map(state.usage.map((a) => [a.packageName, a.totalMs]));
  const limits = getLimits();
  const query = state.search.trim().toLowerCase();

  const rows = state.installed
    .filter((a) => !query || a.appName.toLowerCase().includes(query))
    .map((a) => ({
      packageName: a.packageName,
      appName: a.appName,
      totalMs: usageByPkg.get(a.packageName) ?? 0,
    }))
    // Apps you have already budgeted float to the top; everything else is
    // alphabetical so it reads like a settings list rather than a leaderboard.
    .sort((a, b) => {
      const aLimited = a.packageName in limits;
      const bLimited = b.packageName in limits;
      if (aLimited !== bLimited) return aLimited ? -1 : 1;
      return a.appName.localeCompare(b.appName);
    });

  el('limits-empty').hidden = rows.length > 0;
  for (const row of rows) list.appendChild(appRow(row));

  loadMissingIcons(rows.map((r) => r.packageName));
}

/**
 * Fills in icons a batch at a time, repainting after each one, until every
 * listed app is cached. The repaint calls back into here, so the in-flight
 * guard is what keeps that from firing overlapping requests.
 */
function loadMissingIcons(packages) {
  if (state.iconFetchInFlight) return;
  const missing = packages.filter((pkg) => !hasIcon(pkg)).slice(0, ICON_BATCH);
  if (missing.length === 0) return;

  state.iconFetchInFlight = true;
  ensureIcons(missing)
    .catch(() => {})
    .then(() => {
      state.iconFetchInFlight = false;
      if (state.tab === 'limits') renderLimits();
    });
}

// ---------------------------------------------------------------------------
// budget sheet
// ---------------------------------------------------------------------------

function openSheet(pkg, name, totalMs) {
  state.sheetPkg = pkg;
  const current = getLimit(pkg);

  el('sheet-title').textContent = name;
  el('sheet-sub').textContent = current
    ? `${formatDuration(totalMs)} used today of a ${formatBudget(current)} budget.`
    : `${formatDuration(totalMs)} used today. No limit set.`;

  const grid = el('preset-grid');
  grid.replaceChildren();
  for (const minutes of PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `preset${current === minutes ? ' is-active' : ''}`;
    btn.textContent = formatBudget(minutes);
    btn.addEventListener('click', () => applyLimit(minutes));
    grid.appendChild(btn);
  }

  el('custom-minutes').value = current ?? '';
  el('sheet-clear').hidden = !current;
  el('sheet').hidden = false;
}

function closeSheet() {
  el('sheet').hidden = true;
  state.sheetPkg = null;
}

async function applyLimit(minutes) {
  const pkg = state.sheetPkg;
  if (!pkg) return;
  closeSheet();
  await setLimit(pkg, minutes);
  if (minutes && getSettings().alertsEnabled) await ensureNotificationPermission();
  render();
}

/**
 * Asked for lazily: a limit is useful on its own, so we only prompt once the
 * user actually has something to be notified about.
 */
async function ensureNotificationPermission() {
  try {
    const { granted } = await AppUsage.checkNotificationPermission();
    if (!granted) await AppUsage.requestNotificationPermission();
  } catch {
    // Not fatal — limits still show live in the app.
  }
}

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------

function wireEvents() {
  el('gate-grant').addEventListener('click', async () => {
    el('gate-error').hidden = true;
    try {
      await AppUsage.openPermissionSettings();
    } catch {
      el('gate-error').textContent =
        'Could not open settings. Find it under Settings > Apps > Special app access > Usage access.';
      el('gate-error').hidden = false;
    }
  });

  el('gate-recheck').addEventListener('click', async () => {
    if (await checkPermission()) {
      await showMain();
    } else {
      el('gate-error').textContent = 'Usage access still looks off. Toggle Presence on, then come back.';
      el('gate-error').hidden = false;
    }
  });

  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      state.tab = tab.dataset.tab;
      for (const t of document.querySelectorAll('.tab')) {
        t.classList.toggle('is-active', t === tab);
      }
      el('panel-today').hidden = state.tab !== 'today';
      el('panel-limits').hidden = state.tab !== 'limits';
    });
  }

  el('limit-search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderLimits();
  });

  el('alerts-toggle').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await setAlertsEnabled(enabled);
    if (enabled) await ensureNotificationPermission();
  });

  el('sheet-cancel').addEventListener('click', closeSheet);
  el('sheet-clear').addEventListener('click', () => applyLimit(null));
  el('custom-apply').addEventListener('click', () => {
    const minutes = parseInt(el('custom-minutes').value, 10);
    if (Number.isFinite(minutes) && minutes > 0) applyLimit(minutes);
  });
  el('sheet').addEventListener('click', (e) => {
    if (e.target === el('sheet')) closeSheet();
  });

  // Coming back from another app is exactly when the numbers have changed.
  onResume(() => {
    checkPermission().then(async (granted) => {
      if (!granted) return showGate();
      if (el('main').hidden) return showMain();
      return refresh().catch(() => {});
    });
  });
}

boot();
