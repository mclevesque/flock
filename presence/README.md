# Presence

A screen-time monitor for Android. Instead of counting how many *times* you
opened an app, every app gets one number — **time used today** — measured
against a **daily budget you set** (Instagram: 1h, TikTok: 30m, and so on).

Standalone: its own app, its own APK, no Ryft account, no server. The UI ships
inside the APK and the data never leaves the phone.

---

## What it does

- **Today** — every app you've used, longest first, with live foreground time.
- **Limits** — every installed app, searchable; tap one to give it a daily budget.
- **Progress** — each budgeted app gets a bar that runs green → amber at 80% → red once you're over.
- **Alerts** — a background check (about every 15 minutes) posts a notification the first time an app passes its budget each day.
- Budgets reset at local midnight. One alert per app per day, so it nudges rather than nags.

---

## Building the APK

You need Android Studio and a JDK. Everything runs from this directory.

```bash
cd presence
npm install          # also links the local native plugin
npx cap add android  # creates android/ (gitignored, regenerate any time)
npx cap sync android # copies www/ + wires up the AppUsage plugin
npx cap open android # opens Android Studio
```

In Android Studio: **Build → Generate Signed Bundle / APK → APK**, create a
keystore the first time, and the result lands at
`android/app/release/app-release.apk`. Sideload it (Settings → Install unknown
apps).

After editing anything in `www/`, re-run `npx cap sync android`.

### First launch

Android gates app-usage data behind a settings switch rather than a permission
dialog, so the app opens on a short explainer with a button that jumps to
**Settings → Apps → Special app access → Usage access**. Flip Presence on, come
back, tap "I've turned it on". On Android 13+ it also asks for notification
permission the first time you set a limit.

---

## Previewing without a phone

```bash
cd presence
npm run serve   # http://localhost:4173
```

`www/bridge.js` detects that the native `Capacitor` global is missing and swaps
in mock usage data, so the whole UI is reviewable in a desktop browser. The
footer says "Preview mode" whenever the mock is active.

---

## Layout

```
presence/
  capacitor.config.ts        # appId net.greatsouls.presence, webDir: www
  serve.js                   # desktop preview server
  www/
    index.html               # shell: gate, today, limits, budget sheet
    styles.css
    app.js                   # rendering + interaction
    bridge.js                # native plugin access + browser mock
    store.js                 # localStorage limits/settings/icon cache
  plugins/app-usage/         # local Capacitor plugin (npm file: dependency)
    android/src/main/java/net/greatsouls/presence/appusage/
      AppUsagePlugin.kt      # the JS-facing bridge
      UsageReader.kt         # queryEvents -> per-app foreground time
      LimitStore.kt          # limits mirrored into SharedPreferences
      LimitWorker.kt         # periodic over-budget check + notification
```

### How the time is actually measured

`UsageReader` uses `UsageStatsManager.queryEvents()` and folds
`ACTIVITY_RESUMED` → `ACTIVITY_PAUSED` transitions into a per-package total.
It deliberately avoids `queryUsageStats()`, whose daily buckets are rounded and
drift badly across a partial day.

Screen-off and lock-screen events close any still-open session — without that, a
phone left face-up on a lock screen bills hours to whatever app was last in
front.

### Why the limits are stored twice

The UI's copy lives in `localStorage`. The background worker runs with no
WebView alive, so `syncLimits()` mirrors the same map into `SharedPreferences`.
JS is the only writer; the worker only reads.

---

## Known limits

- **Android only.** iOS exposes nothing equivalent — Screen Time is a private API, and the closest public option (the DeviceActivity framework) can't report per-app totals back to your own code.
- **Alerts lag by up to 15 minutes.** That's WorkManager's floor for periodic work. The in-app numbers are always live; only the notification is coarse.
- **It reports, it doesn't block.** Nothing stops you opening an app past its budget.
- **Android keeps only ~7 days of raw events**, so history beyond today would have to be accumulated by the app itself.
- **`QUERY_ALL_PACKAGES`** is declared to enumerate installed apps. Fine for a sideloaded APK; a Play Store listing would need the screen-time declaration.
