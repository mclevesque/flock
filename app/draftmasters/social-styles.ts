/**
 * Friends, chat, voice and invites.
 *
 * Kept out of styles.ts for two reasons. The provider that renders the sheet,
 * the toasts and the call pill lives in the layout, above pages that each
 * inject their own copy of STYLES — so this has to arrive with the provider,
 * not with a page. And styles.ts is one long template literal that half the
 * game edits; the social layer does not need to be in the way of that.
 *
 * Same house as styles.ts: dark, brass, one accent spent on what is live —
 * here that is green for a voice that is speaking and red for a mic that is
 * off. Mobile first; 16px inputs so iOS does not zoom; 44px targets.
 * (No backticks in this file: the sheet is one template literal.)
 */

export const SOCIAL_STYLES = `
/* The tokens, for the pieces that render outside a .dm page root. */
.dm-social {
  --dm-glow: 217 178 106;
  --dm-bg: #08080a;
  --dm-panel: #100e0b;
  --dm-panel-2: #17140f;
  --dm-line: rgb(var(--dm-glow) / .17);
  --dm-line-hot: rgb(var(--dm-glow) / .42);
  --dm-gold: #d4af5f;
  --dm-gold-hot: #f2dfa4;
  --dm-gold-deep: #8a6a24;
  --dm-green: #5bbd8a;
  --dm-red: #cf4d3f;
  --dm-text: #f0ece4;
  --dm-dim: #8f8f8f;
  --dm-mute: #616161;
  --dm-display: "Cinzel", "Trajan Pro", Georgia, serif;
  --dm-ui: "Archivo", var(--font-sans), system-ui, -apple-system, "Segoe UI", sans-serif;
  font-family: var(--dm-ui);
  color: var(--dm-text);
}
.dm-social *, .dm-social *::before, .dm-social *::after { box-sizing: border-box; }

@keyframes dm-fd-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dm-fd-up { from { transform: translateY(36px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes dm-fd-in { from { transform: translateX(36px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes dm-toast-in { from { transform: translateY(-10px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes dm-vp-pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(91,189,138,.28), 0 0 16px rgba(91,189,138,.5); }
  50% { box-shadow: 0 0 0 5px rgba(91,189,138,.16), 0 0 26px rgba(91,189,138,.38); }
}
@keyframes dm-spin { to { transform: rotate(360deg); } }

/* ── The game in progress: the back gesture ───────────────────────────────
   A horizontal overscroll at the edge of the page is what turns into Back in
   Chrome on Android and on trackpads. Switched off only while a room or a
   draft is on screen (the class comes and goes with it). */
html.dm-guarded, html.dm-guarded body { overscroll-behavior-x: none; }
.dm[data-guard="1"] { overscroll-behavior-x: none; }

/* ── Tabs and rail: Friends is a button now ───────────────────────────── */
button.dm-tab, button.dm-rail-item {
  border: 0; background: none; font-family: inherit; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.dm-tabs { grid-template-columns: repeat(3, 1fr); }
.dm-tab { min-height: 48px; }
.dm-tab-icon { position: relative; display: inline-grid; place-items: center; }
.dm-tab-badge {
  position: absolute; top: -7px; right: -11px;
  min-width: 17px; height: 17px; padding: 0 4px; border-radius: 999px;
  display: grid; place-items: center;
  font-size: 10px; font-weight: 800; letter-spacing: 0; line-height: 1;
  color: #1a1408; background: linear-gradient(180deg, #f2dfa4, #d4af5f);
  box-shadow: 0 0 0 2px #0a0f0d, 0 0 10px rgb(217 178 106 / .5);
}
@media (min-width: 900px) {
  .dm-rail-item .dm-tab-icon {
    position: relative; width: auto; height: auto; overflow: visible; clip-path: none;
  }
  .dm-rail-item .dm-tab-badge {
    position: absolute; width: auto; height: 17px; overflow: visible; clip-path: none;
  }
}

/* ── The friends sheet ────────────────────────────────────────────────────
   A sheet from the bottom on a phone, lifted by the keyboard (--dm-kb comes
   from the visual viewport), and a slide-over from the right on a wide
   screen. */
.dm-fd-scrim {
  position: fixed; inset: 0; z-index: 95;
  background: rgba(4,4,5,.56); backdrop-filter: blur(2px);
  animation: dm-fd-fade .18s ease-out;
}
.dm-fd {
  position: absolute; left: 0; right: 0; bottom: var(--dm-kb, 0px);
  height: min(88dvh, calc(100dvh - var(--dm-kb, 0px) - 10px));
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #1c1812, #100e0b 40%);
  border: 1px solid rgb(217 178 106 / .42); border-bottom: 0;
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -24px 70px rgba(0,0,0,.72);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  color: var(--dm-text); font-family: var(--dm-ui);
  animation: dm-fd-up .26s cubic-bezier(.2,.8,.25,1);
  transition: transform .16s ease;
}
.dm-fd-grip {
  flex: 0 0 auto; height: 24px; display: grid; place-items: center;
  touch-action: none; cursor: grab;
}
.dm-fd-grip::before {
  content: ""; width: 42px; height: 4px; border-radius: 999px; background: var(--dm-line-hot);
}
@media (min-width: 900px) {
  .dm-fd-scrim { background: rgba(4,4,5,.34); }
  .dm-fd {
    left: auto; top: 0; right: 0; bottom: 0; height: auto;
    width: min(410px, 100vw);
    border: 1px solid rgb(217 178 106 / .42); border-right: 0;
    border-radius: 22px 0 0 22px;
    box-shadow: -24px 0 70px rgba(0,0,0,.66);
    padding-bottom: 0;
    animation-name: dm-fd-in;
  }
  .dm-fd-grip { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .dm-fd, .dm-fd-scrim, .dm-toast, .dm-voicepill { animation: none; }
}

.dm-fd-view { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; padding: 0 14px 12px; }
.dm-fd-view[data-page="1"] { padding: 0; }

.dm-fd-head { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; padding: 2px 0 12px; }
@media (min-width: 900px) { .dm-fd-head { padding-top: 16px; } }
.dm-fd-view[data-chat="1"] .dm-fd-head {
  margin: 0 -14px; padding-left: 14px; padding-right: 14px;
  border-bottom: 1px solid var(--dm-line);
}
.dm-fd-title { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dm-fd-title b {
  font-family: var(--dm-display); font-size: 20px; font-weight: 700; color: #f0e6d2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dm-fd-view[data-chat="1"] .dm-fd-title b { font-size: 17px; }
.dm-fd-title em {
  font-style: normal; font-size: 12.5px; color: rgba(240,230,210,.5);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dm-fd-x, .dm-fd-back {
  flex: 0 0 auto; width: 44px; height: 44px; border-radius: 50%;
  display: grid; place-items: center; cursor: pointer;
  border: 1px solid var(--dm-line); background: var(--dm-panel-2); color: var(--dm-dim);
  transition: color .15s ease, border-color .15s ease;
}
.dm-fd-back svg { transform: scaleX(-1); }
.dm-fd-x:hover, .dm-fd-back:hover { color: var(--dm-text); border-color: var(--dm-line-hot); }

.dm-fd-add { flex: 0 0 auto; display: flex; gap: 8px; }
.dm-fd-add .dm-input, .dm-fd-compose .dm-input, .dm-chat-form .dm-input {
  flex: 1 1 auto; min-width: 0; min-height: 44px; font-size: 16px;
}
.dm-fd-add .dm-btn, .dm-fd-compose .dm-btn { min-height: 44px; }
.dm-fd-note { flex: 0 0 auto; margin: 8px 2px 0; font-size: 13px; line-height: 1.45; color: var(--dm-dim); }
.dm-fd-note[data-bad="1"] { color: #f0a6a3; }

.dm-fd-scroll {
  flex: 1 1 auto; min-height: 0; overflow-y: auto;
  margin: 8px -14px 0; padding: 0 14px 8px;
  overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
}
.dm-fd-view[data-page="1"] .dm-fd-scroll { overflow: visible; margin: 8px 0 0; padding: 0; }

.dm-fd-eyebrow {
  margin: 14px 2px 4px;
  font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
  color: rgb(217 178 106 / .62);
}

.dm-fd-row {
  width: 100%; min-height: 62px; margin-top: 6px; padding: 9px 12px;
  display: flex; align-items: center; gap: 12px;
  border-radius: 14px; border: 1px solid var(--dm-line);
  background: linear-gradient(180deg, #1a1710, #100e0b);
  color: inherit; font: inherit; text-align: left;
  transition: border-color .15s ease, background .15s ease, transform .1s ease;
  -webkit-tap-highlight-color: transparent;
}
button.dm-fd-row { cursor: pointer; }
button.dm-fd-row:hover { border-color: var(--dm-line-hot); background: linear-gradient(180deg, #221d14, #131009); }
button.dm-fd-row:active { transform: scale(.99); }
.dm-fd-row[data-kind="pending"] { border-style: dashed; border-color: var(--dm-line-hot); }

.dm-fd-face { position: relative; flex: 0 0 auto; width: 42px; height: 42px; border-radius: 50%; }
.dm-fd-face img {
  display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
  border: 1px solid rgb(217 178 106 / .35); background: #0e0d0b;
}
.dm-fd-face[data-presence="online"]::after,
.dm-fd-face[data-presence="draft"]::after {
  content: ""; position: absolute; right: -1px; bottom: -1px;
  width: 12px; height: 12px; border-radius: 50%; border: 2px solid #0e0d0b;
  background: var(--dm-green);
}
.dm-fd-face[data-presence="draft"]::after { background: var(--dm-gold); box-shadow: 0 0 8px rgb(217 178 106 / .7); }

.dm-fd-who { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dm-fd-who b {
  font-family: var(--dm-display); font-size: 15px; font-weight: 700; color: #f0e6d2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dm-fd-who em {
  font-style: normal; font-size: 12.5px; color: rgba(240,230,210,.5);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dm-fd-side { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; }
.dm-fd-unread {
  min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px;
  display: grid; place-items: center; font-size: 12px; font-weight: 800;
  color: #1a1408; background: linear-gradient(180deg, #f2dfa4, #d4af5f);
  box-shadow: 0 0 12px rgb(217 178 106 / .45);
}
.dm-fd-status { font-size: 11px; font-weight: 700; letter-spacing: .03em; color: var(--dm-mute); }
.dm-fd-status[data-presence="online"] { color: var(--dm-green); }
.dm-fd-status[data-presence="draft"] { color: var(--dm-gold); }
.dm-fd-invoice { color: var(--dm-green); }
.dm-fd-small { min-height: 44px; padding: 8px 12px; flex: 0 0 auto; }
.dm-fd-empty { margin: 16px 4px; font-size: 14px; line-height: 1.6; color: var(--dm-dim); }
.dm-fd-empty b { color: var(--dm-gold); }
.dm-fd-foot {
  flex: 0 0 auto; margin: 10px 2px 0; display: flex; align-items: center; gap: 6px;
  font-size: 12.5px; line-height: 1.4; color: var(--dm-mute);
}
.dm-fd-foot b { color: var(--dm-dim); }
.dm-fd-view[data-page="1"] .dm-fd-foot { margin-top: 20px; }

/* ── A conversation ───────────────────────────────────────────────────── */
.dm-fd-log {
  flex: 1 1 auto; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
  margin: 0 -14px; padding: 12px 14px;
  overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
}
.dm-bubble {
  max-width: 82%; align-self: flex-start;
  padding: 8px 12px 6px; border-radius: 16px 16px 16px 5px;
  border: 1px solid var(--dm-line); background: var(--dm-panel-2);
  font-size: 15px; line-height: 1.4; overflow-wrap: anywhere;
}
.dm-bubble[data-mine="1"] {
  align-self: flex-end; border-radius: 16px 16px 5px 16px;
  border-color: rgb(217 178 106 / .4);
  background: linear-gradient(180deg, rgb(217 178 106 / .22), rgb(217 178 106 / .1));
}
.dm-bubble[data-pending="1"] { opacity: .6; }
.dm-bubble time { display: block; margin-top: 2px; font-size: 10.5px; text-align: right; color: rgba(240,230,210,.38); }

.dm-invite-card {
  max-width: 94%; align-self: flex-start;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 10px 10px 12px; border-radius: 16px;
  border: 1px solid rgb(217 178 106 / .55);
  background:
    radial-gradient(120% 140% at 0% 0%, rgb(217 178 106 / .2), rgba(0,0,0,0) 60%),
    linear-gradient(180deg, #221c11, #110e09);
  box-shadow: 0 10px 30px rgba(0,0,0,.35), inset 0 0 0 1px rgb(217 178 106 / .08);
}
.dm-invite-card[data-mine="1"] { align-self: flex-end; }
.dm-invite-mark {
  flex: 0 0 auto; width: 40px; height: 40px; border-radius: 12px;
  display: grid; place-items: center; color: var(--dm-gold-hot);
  background: rgb(217 178 106 / .14); border: 1px solid rgb(217 178 106 / .35);
}
.dm-invite-who { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dm-invite-who b { font-size: 14px; line-height: 1.3; color: #f0e6d2; }
.dm-invite-who em { font-style: normal; font-size: 12px; letter-spacing: .05em; color: var(--dm-gold); }
.dm-invite-card .dm-btn { flex: 0 0 auto; min-height: 44px; }

.dm-fd-compose {
  flex: 0 0 auto; display: flex; gap: 8px;
  margin: 0 -14px; padding: 10px 14px 0; border-top: 1px solid var(--dm-line);
}
.dm-fd-send { width: 48px; min-width: 48px; padding: 0; display: grid; place-items: center; }

/* ── Voice in a chat ──────────────────────────────────────────────────── */
.dm-cv {
  flex: 0 0 auto; margin-top: 10px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 8px;
  border-radius: 16px; border: 1px solid var(--dm-line);
  background: linear-gradient(180deg, rgba(26,22,14,.9), rgba(12,11,9,.9));
}
.dm-cv[data-on="1"] { border-color: rgba(91,189,138,.32); }
.dm-cv[data-on="0"] { flex-direction: row; align-items: center; gap: 12px; }
.dm-cv-join { flex: 0 0 auto; min-height: 44px; }
.dm-cv-note { font-size: 12px; line-height: 1.45; color: var(--dm-mute); }
.dm-cv-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dm-cv-status {
  flex: 1 1 auto; min-width: 0;
  display: flex; flex-wrap: wrap; align-items: center; gap: 1px 7px;
  font-size: 13px; font-weight: 650; color: var(--dm-dim);
}
.dm-cv-status i { width: 8px; height: 8px; border-radius: 50%; background: var(--dm-mute); }
.dm-cv-status[data-live="1"] { color: var(--dm-text); }
.dm-cv-status[data-live="1"] i { background: var(--dm-green); box-shadow: 0 0 0 4px rgba(91,189,138,.16); }
.dm-cv-status small { flex-basis: 100%; font-size: 11px; font-weight: 500; color: var(--dm-mute); }
.dm-cv-leave { flex: 0 0 auto; min-height: 44px; padding: 8px 12px; }

/* ── A face you tap ───────────────────────────────────────────────────────
   The ring is the state. Brass at rest, green and breathing while they
   speak, red when their own mic is off, grey and dimmed when you have muted
   them. The badge says which of those two mutes it is, because "they cannot
   hear me" and "I cannot hear them" are very different problems. */
.dm-vp {
  --vp: 44px;
  position: relative; flex: 0 0 auto;
  display: inline-flex; flex-direction: column; align-items: center; gap: 4px;
  min-width: 44px; min-height: 44px; padding: 0;
  border: 0; background: none; color: inherit; font: inherit; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.dm-vp-face {
  position: relative; display: block;
  width: var(--vp); height: var(--vp); padding: 2px; border-radius: 50%;
  background: rgb(217 178 106 / .34);
  transition: background .15s ease, box-shadow .15s ease, opacity .2s ease, filter .2s ease, transform .1s ease;
}
.dm-vp-face img {
  display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
  border: 1.5px solid #0b0a08; background: #0e0d0b;
}
.dm-vp:hover .dm-vp-face { box-shadow: 0 0 0 2px rgb(217 178 106 / .45); }
.dm-vp:active .dm-vp-face { transform: scale(.94); }
.dm-vp:focus-visible { outline: none; }
.dm-vp:focus-visible .dm-vp-face { box-shadow: 0 0 0 3px var(--dm-gold-hot); }
.dm-vp[data-speaking="1"] .dm-vp-face {
  background: linear-gradient(135deg, #b8f0cf, var(--dm-green));
  animation: dm-vp-pulse 1.1s ease-in-out infinite;
}
.dm-vp[data-muted="self"] .dm-vp-face,
.dm-vp[data-muted="off"] .dm-vp-face { background: rgba(207,77,63,.7); }
.dm-vp[data-muted="you"] .dm-vp-face { background: rgba(110,110,110,.7); }
.dm-vp[data-muted="you"] .dm-vp-face img { filter: grayscale(.9) brightness(.62); }
.dm-vp[data-away="1"] .dm-vp-face { opacity: .45; filter: saturate(.25); }
.dm-vp-badge {
  position: absolute; top: calc(var(--vp) - 17px); right: -4px;
  width: 20px; height: 20px; border-radius: 50%;
  display: grid; place-items: center;
  border: 2px solid #0c0b09; color: #fff; pointer-events: none;
}
.dm-vp-badge[data-kind="self"], .dm-vp-badge[data-kind="off"] { background: var(--dm-red); }
.dm-vp-badge[data-kind="you"] { left: -4px; right: auto; background: #505050; color: #efe9dd; }
.dm-vp-name {
  max-width: calc(var(--vp) + 26px);
  font-size: 11px; font-weight: 700; color: var(--dm-dim);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dm-vp[data-me="1"] .dm-vp-name { color: var(--dm-gold); }
@media (prefers-reduced-motion: reduce) { .dm-vp[data-speaking="1"] .dm-vp-face { animation: none; } }

/* ── Which microphone ─────────────────────────────────────────────────── */
.dm-mic-pick {
  position: relative; display: inline-flex; align-items: center; gap: 6px;
  min-height: 44px; max-width: 100%; padding: 0 10px;
  border-radius: 12px; border: 1px solid var(--dm-line-hot);
  background: var(--dm-panel-2); color: var(--dm-gold); cursor: pointer;
}
.dm-mic-pick:focus-within { border-color: var(--dm-gold); }
.dm-mic-pick select {
  -webkit-appearance: none; appearance: none;
  flex: 1 1 auto; min-width: 0; max-width: 280px; height: 42px; padding: 0 2px 0 0;
  border: 0; background: transparent; color: var(--dm-text);
  font-family: inherit; font-size: 16px; text-overflow: ellipsis; cursor: pointer;
}
.dm-mic-pick[data-compact="1"] select { max-width: 210px; }
.dm-mic-pick select:focus { outline: none; }
.dm-mic-pick select option { background: #16130e; color: #f0ece4; }
.dm-mic-pick > svg:last-child { flex: 0 0 auto; color: var(--dm-dim); pointer-events: none; }

.dm-voice-hint {
  margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px;
  font-size: 12.5px; line-height: 1.45; color: var(--dm-dim);
}
.dm-voice-hint[data-bad="1"] { color: #f0a6a3; }
.dm-voice-go { min-height: 44px; }
.dm-linkish {
  min-height: 36px; padding: 6px 4px; border: 0; background: none;
  color: var(--dm-gold); font: inherit; font-weight: 700; text-decoration: underline; cursor: pointer;
}
.dm-voice-audio { display: none; }
.dm-voice-unlock {
  position: fixed; left: 50%; top: max(12px, env(safe-area-inset-top)); z-index: 97;
  transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 8px;
  min-height: 44px; padding: 10px 16px; border-radius: 999px;
  border: 1px solid var(--dm-gold); background: rgba(16,14,11,.96);
  color: var(--dm-gold-hot); font-family: var(--dm-ui); font-size: 14px; font-weight: 750;
  box-shadow: 0 10px 30px rgba(0,0,0,.6); cursor: pointer;
}

/* ── A call with the sheet shut ───────────────────────────────────────── */
.dm-voicepill {
  position: fixed; z-index: 70; right: 12px;
  bottom: calc(86px + env(safe-area-inset-bottom, 0px));
  display: flex; align-items: center; gap: 6px;
  padding: 5px 5px 5px 8px; border-radius: 999px;
  border: 1px solid rgba(91,189,138,.45); background: rgba(14,12,9,.95);
  backdrop-filter: blur(10px); box-shadow: 0 14px 40px rgba(0,0,0,.6);
  animation: dm-fd-up .24s cubic-bezier(.2,.8,.25,1);
}
@media (min-width: 900px) { .dm-voicepill { right: 22px; bottom: 22px; } }
.dm-voicepill-open {
  min-height: 44px; max-width: 120px; padding: 0 6px; border: 0; background: none;
  color: var(--dm-text); font-family: inherit; font-size: 13px; font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;
}
.dm-voicepill-x {
  width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
  border: 1px solid var(--dm-line); background: var(--dm-panel-2); color: var(--dm-dim); cursor: pointer;
}

/* ── Toasts ───────────────────────────────────────────────────────────── */
.dm-toasts {
  position: fixed; z-index: 96; left: 10px; right: 10px; top: max(10px, env(safe-area-inset-top));
  display: flex; flex-direction: column; gap: 8px; pointer-events: none;
}
@media (min-width: 900px) { .dm-toasts { left: auto; right: 22px; top: 22px; width: 370px; } }
.dm-toast {
  pointer-events: auto; display: flex; align-items: center; gap: 10px;
  padding: 8px 6px 8px 10px; border-radius: 16px;
  border: 1px solid rgb(217 178 106 / .4); background: rgba(18,15,11,.97);
  backdrop-filter: blur(10px); box-shadow: 0 18px 50px rgba(0,0,0,.66);
  animation: dm-toast-in .26s cubic-bezier(.2,.8,.25,1);
}
.dm-toast[data-kind="invite"] {
  border-color: var(--dm-gold);
  background: radial-gradient(120% 160% at 0% 0%, rgb(217 178 106 / .2), rgba(0,0,0,0) 60%), rgba(20,16,10,.97);
}
.dm-toast[data-kind="voice"] { border-color: rgba(91,189,138,.55); }
.dm-toast-face { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgb(217 178 106 / .4); }
.dm-toast-body {
  flex: 1 1 auto; min-width: 0; min-height: 44px; padding: 0;
  display: flex; flex-direction: column; justify-content: center; gap: 1px;
  border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.dm-toast-body b { font-size: 14px; color: #f0e6d2; }
.dm-toast-body span { font-size: 13px; color: var(--dm-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dm-toast-go { flex: 0 0 auto; min-height: 44px; }
.dm-toast-x {
  flex: 0 0 auto; width: 36px; height: 44px; display: grid; place-items: center;
  border: 0; background: none; color: var(--dm-mute); cursor: pointer;
}

/* ── Voice and chat in a room ─────────────────────────────────────────── */
.dm-roomvoice { display: flex; flex-direction: column; gap: 10px; }
.dm-roomvoice .dm-chat { margin-top: 0; }
.dm-rv-faces { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px 14px; }
.dm-rv-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.dm-rv-tip { font-size: 12px; line-height: 1.4; color: var(--dm-mute); }
.dm-rv-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.dm-rv-head .dm-eyebrow { margin: 0; }
.dm-rv-invite { min-height: 44px; padding: 8px 12px; }
.dm-chat-form { flex-wrap: nowrap; }
.dm-chat-form .dm-btn { min-height: 44px; flex: 0 0 auto; }
.dm-chat-line[data-system="1"] { color: var(--dm-dim); }

/* Faces where the lobby, the ready check and the verdict used to put a letter. */
.dm-seat-face { overflow: hidden; }
.dm-seat-face img { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.dm-ready-face {
  width: 54px; height: 54px; margin: 0 auto; border-radius: 50%; overflow: hidden;
  display: grid; place-items: center; color: var(--dm-gold);
  border: 2px solid rgb(217 178 106 / .38);
  background: radial-gradient(circle at 50% 32%, #2b2620, #0e0d0b);
}
.dm-ready-face img { width: 100%; height: 100%; object-fit: cover; }
.dm-ready-face[data-empty="1"] { border-style: dashed; color: var(--dm-mute); }

/* ── The dock ─────────────────────────────────────────────────────────────
   Faces down the left edge, mid-height: the one strip of a draft with no
   control in it. Bid buttons live at the bottom and the lot title at the
   top, so the dock takes neither. The chat card opens beside it on a wide
   screen and from the top on a phone, where the keyboard cannot reach it. */
.dm-dock {
  position: fixed; z-index: 55;
  left: max(6px, env(safe-area-inset-left)); top: 50%; transform: translateY(-50%);
  display: flex; align-items: center; gap: 8px; pointer-events: none;
}
.dm-dock > * { pointer-events: auto; }
.dm-dock-rail {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 7px 4px 2px; border-radius: 999px;
  border: 1px solid rgb(217 178 106 / .3); background: rgba(12,11,9,.84);
  backdrop-filter: blur(10px); box-shadow: 0 12px 34px rgba(0,0,0,.55);
}
.dm-dock .dm-rv-faces { flex-direction: column; flex-wrap: nowrap; gap: 5px; }
.dm-dock-chat {
  position: relative; width: 44px; height: 44px; border-radius: 50%;
  display: grid; place-items: center; cursor: pointer;
  border: 1px solid var(--dm-line-hot); background: var(--dm-panel-2); color: var(--dm-gold);
}
.dm-dock[data-open="1"] .dm-dock-chat { border-color: var(--dm-gold); background: rgb(217 178 106 / .2); color: var(--dm-gold-hot); }
.dm-dock-badge {
  position: absolute; top: -4px; right: -4px;
  min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px;
  display: grid; place-items: center; font-size: 10.5px; font-weight: 800;
  color: #1a1408; background: linear-gradient(180deg, #f2dfa4, #d4af5f);
  box-shadow: 0 0 0 2px #0c0b09;
}
.dm-dock-tuck {
  width: 44px; height: 32px; display: grid; place-items: center;
  border: 0; background: none; color: var(--dm-mute); cursor: pointer;
}
.dm-dock-tuck svg { transform: rotate(180deg); transition: transform .15s ease; }
.dm-dock[data-tucked="1"] .dm-dock-tuck svg { transform: none; }
.dm-dock-peek {
  max-width: min(250px, calc(100vw - 90px)); padding: 9px 12px;
  border-radius: 14px 14px 14px 4px; border: 1px solid rgb(217 178 106 / .4);
  background: rgba(18,15,11,.96); color: var(--dm-text);
  font-family: var(--dm-ui); font-size: 13.5px; line-height: 1.35; text-align: left; cursor: pointer;
  box-shadow: 0 12px 30px rgba(0,0,0,.55); animation: dm-toast-in .22s ease-out;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.dm-dock-peek b { margin-right: 5px; color: var(--dm-gold); }
.dm-dock-card {
  width: min(340px, calc(100vw - 80px)); max-height: min(62dvh, 460px);
  display: flex; flex-direction: column; gap: 8px; padding: 10px;
  border-radius: 18px; border: 1px solid rgb(217 178 106 / .42);
  background: rgba(16,14,11,.97); backdrop-filter: blur(12px);
  box-shadow: 0 20px 60px rgba(0,0,0,.72);
}
.dm-dock-card-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dm-dock-card-head b { flex: 1 1 auto; font-family: var(--dm-display); font-size: 15px; color: #f0e6d2; white-space: nowrap; }
.dm-dock-card-head .dm-mic-pick select { max-width: 130px; }
.dm-dock-x {
  flex: 0 0 auto; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
  border: 1px solid var(--dm-line); background: var(--dm-panel-2); color: var(--dm-dim); cursor: pointer;
}
.dm-dock-card .dm-chat { flex: 1 1 auto; min-height: 0; margin-top: 0; }
.dm-dock-card .dm-chat-log { flex: 1 1 auto; min-height: 70px; max-height: none; }
@media (max-width: 899px) {
  .dm-dock-card {
    position: fixed; left: 8px; right: 8px; top: max(8px, env(safe-area-inset-top));
    width: auto; max-height: 42dvh;
  }
}

/* A tall screen's stage has a rail with voice and chat already in it. */
@media (min-height: 860px) {
  .dm:has(.dm-stage .dm-roomvoice) .dm-dock { display: none; }
}

/* ── Invite sheet ─────────────────────────────────────────────────────── */
.dm-invite-sheet { display: flex; flex-direction: column; gap: 10px; }
.dm-invite-x { width: 44px; height: 44px; display: grid; place-items: center; }
.dm-invite-link-row { display: flex; gap: 8px; }
.dm-invite-link-row .dm-btn { min-height: 48px; }
.dm-invite-link-row .dm-btn-primary { flex: 1 1 auto; }
.dm-invite-code { font-family: var(--dm-display); letter-spacing: .16em; color: var(--dm-gold); }
.dm-invite-list { display: flex; flex-direction: column; }
.dm-invite-send[data-sent="1"] {
  background: rgba(91,189,138,.14); border-color: rgba(91,189,138,.5); color: var(--dm-green); opacity: 1;
}

/* ── Leave the game? ──────────────────────────────────────────────────── */
.dm-leave-scrim {
  position: fixed; inset: 0; z-index: 100; padding: 20px;
  display: grid; place-items: center;
  background: rgba(4,4,5,.74); backdrop-filter: blur(4px);
  animation: dm-fd-fade .15s ease-out;
}
.dm-leave {
  width: min(380px, 100%); padding: 22px 20px 18px; text-align: center;
  border-radius: 20px; border: 1px solid var(--dm-line-hot);
  background: linear-gradient(180deg, #1d1913, #100e0b);
  box-shadow: 0 30px 80px rgba(0,0,0,.76);
  animation: dm-fd-up .22s cubic-bezier(.2,.8,.25,1);
}
.dm-leave h2 { margin: 0 0 8px; font-family: var(--dm-display); font-size: 22px; color: #f0e6d2; }
.dm-leave p { margin: 0 0 18px; font-size: 14px; line-height: 1.5; color: var(--dm-dim); }
.dm-leave-actions { display: flex; flex-direction: column; gap: 8px; }
.dm-leave-actions .dm-btn { width: 100%; min-height: 48px; }
@media (min-width: 480px) {
  .dm-leave-actions { flex-direction: row-reverse; }
  .dm-leave-actions .dm-btn { flex: 1 1 0; }
}

/* ── Back to your game, and rooms that cannot be joined ───────────────── */
.dm-rejoin {
  display: flex; align-items: center; gap: 12px;
  margin: 0 auto 18px; max-width: 760px; padding: 12px 8px 12px 14px;
  border-radius: 16px; border: 1px solid var(--dm-gold);
  background:
    radial-gradient(130% 160% at 0% 0%, rgb(217 178 106 / .22), rgba(0,0,0,0) 60%),
    linear-gradient(180deg, #211b10, #110e09);
  box-shadow: 0 0 30px rgb(217 178 106 / .12);
}
.dm-rejoin[data-kind="notice"] { border-color: var(--dm-line-hot); background: var(--dm-panel); box-shadow: none; }
.dm-rejoin-mark {
  flex: 0 0 auto; width: 42px; height: 42px; border-radius: 12px;
  display: grid; place-items: center; color: var(--dm-gold-hot); background: rgb(217 178 106 / .16);
}
.dm-rejoin-who { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dm-rejoin-who b { font-family: var(--dm-display); font-size: 16px; color: #f0e6d2; }
.dm-rejoin-who em { font-style: normal; font-size: 12.5px; line-height: 1.4; color: rgba(240,230,210,.56); }
.dm-rejoin .dm-btn { flex: 0 0 auto; min-height: 44px; }
.dm-rejoin-x {
  flex: 0 0 auto; width: 40px; height: 44px; display: grid; place-items: center;
  border: 0; background: none; color: var(--dm-mute); cursor: pointer;
}
.dm-spin {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2.5px solid rgb(217 178 106 / .22); border-top-color: var(--dm-gold);
  animation: dm-spin .8s linear infinite;
}

/* ── Your face ────────────────────────────────────────────────────────── */
.dm-avatar-pick { margin: 6px 0 26px; }
.dm-avatar-now { display: flex; align-items: center; gap: 16px; }
.dm-avatar-now > img {
  flex: 0 0 auto; width: 92px; height: 92px; border-radius: 50%;
  border: 2px solid rgb(217 178 106 / .6); background: #0e0d0b;
  box-shadow: 0 0 32px rgb(217 178 106 / .2);
}
.dm-avatar-now-who { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.dm-avatar-now-who b { font-family: var(--dm-display); font-size: 17px; color: #f0e6d2; }
.dm-avatar-now-who em { font-style: normal; font-size: 12.5px; color: rgba(240,230,210,.5); }
.dm-avatar-upload { position: relative; margin-top: 6px; min-height: 44px; cursor: pointer; overflow: hidden; }
.dm-avatar-upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; font-size: 16px; }
.dm-avatar-upload[data-busy="1"] { opacity: .6; pointer-events: none; }
.dm-avatar-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 12px 10px; margin-top: 10px;
}
.dm-avatar-opt {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  min-height: 44px; padding: 0; border: 0; background: none; color: var(--dm-dim);
  font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.dm-avatar-opt img {
  display: block; width: 100%; max-width: 76px; aspect-ratio: 1; border-radius: 50%;
  border: 2px solid transparent; transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease;
}
.dm-avatar-opt span { font-size: 10.5px; font-weight: 700; letter-spacing: .02em; text-align: center; line-height: 1.2; }
.dm-avatar-opt:hover img { transform: translateY(-2px); }
.dm-avatar-opt[aria-pressed="true"] { color: var(--dm-gold-hot); }
.dm-avatar-opt[aria-pressed="true"] img {
  border-color: var(--dm-gold-hot);
  box-shadow: 0 0 0 3px rgb(217 178 106 / .25), 0 0 20px rgb(217 178 106 / .45);
}
.dm-avatar-opt:disabled { cursor: progress; }
.dm-crop {
  margin-top: 16px; padding: 16px 14px; border-radius: 16px;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  border: 1px solid var(--dm-line-hot); background: var(--dm-panel);
}
.dm-crop canvas {
  width: 200px; height: 200px; border-radius: 50%; touch-action: none; cursor: grab;
  border: 2px solid var(--dm-gold); background: #000;
}
.dm-crop canvas:active { cursor: grabbing; }
.dm-crop-zoom { display: flex; align-items: center; gap: 10px; width: min(280px, 100%); font-size: 12px; color: var(--dm-dim); }
.dm-crop-zoom input { flex: 1 1 auto; height: 44px; accent-color: var(--dm-gold); }
.dm-crop .dm-note { margin: 0; }
.dm-crop-actions { display: flex; gap: 8px; }
.dm-crop-actions .dm-btn { min-height: 44px; }
/* GIF picker: a card above whichever chat opened it. Fixed, so it clears the
   friends sheet, the room dock and a phone keyboard alike. */
.dm-gif-btn { min-height: 44px; min-width: 52px; padding: 0 10px; flex: 0 0 auto; font-weight: 700; letter-spacing: .08em; }
.dm-gif {
  position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 2147483000;
  width: min(420px, calc(100vw - 20px)); max-height: min(60vh, 520px);
  display: flex; flex-direction: column; gap: 8px; padding: 10px;
  background: #15120d; border: 1px solid rgba(212,175,95,.45); border-radius: 16px;
  box-shadow: 0 18px 60px rgba(0,0,0,.7);
}
.dm-gif-head { display: flex; gap: 8px; align-items: center; }
.dm-gif-head .dm-input { flex: 1 1 auto; min-height: 44px; font-size: 16px; }
.dm-gif-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; overflow-y: auto; min-height: 0; }
.dm-gif-pick { padding: 0; border: 1px solid transparent; border-radius: 8px; overflow: hidden; background: #0c0b09; cursor: pointer; aspect-ratio: 1; }
.dm-gif-pick:hover, .dm-gif-pick:focus-visible { border-color: var(--dm-gold); outline: none; }
.dm-gif-pick img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dm-gif-empty { margin: 6px 0; text-align: center; font-size: 13px; color: var(--dm-dim); }
.dm-gif-credit { margin: 0; text-align: right; font-size: 10px; color: var(--dm-dim); }
.dm-chat-gif { display: block; max-width: min(220px, 100%); max-height: 140px; border-radius: 8px; margin-top: 4px; }
`;
