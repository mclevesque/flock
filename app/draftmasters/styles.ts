/**
 * DraftMasters stylesheet.
 *
 * Standalone look — an auction house under a spotlight — but built on the
 * Great Souls palette (gold on near-black) so linking in from the hub doesn't
 * feel like leaving the site.
 *
 * Mobile-first: base rules are the phone layout, media queries widen it.
 * Inputs are 16px so iOS doesn't zoom on focus; every control is >=44px.
 */

export const STYLES = `
.dm {
  --dm-bg: #0a0a0b;
  --dm-panel: #141416;
  --dm-panel-2: #1c1c20;
  --dm-line: #2a2a30;
  --dm-line-hot: #3d3d46;
  --dm-gold: #d4a942;
  --dm-gold-hot: #f0c860;
  --dm-ember: #c4531a;
  --dm-green: #4caf7d;
  --dm-red: #d9534f;
  --dm-text: #ece4d6;
  --dm-dim: #9a8f7d;
  --dm-mute: #5f5a52;
  --dm-radius: 16px;

  position: relative;
  min-height: 100dvh;
  background:
    radial-gradient(120% 80% at 50% -10%, #26221a 0%, rgba(10,10,11,0) 60%),
    var(--dm-bg);
  color: var(--dm-text);
  font-family: var(--font-sans), system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  padding: 16px 14px 32px;
  overflow-x: hidden;
}

.dm *, .dm *::before, .dm *::after { box-sizing: border-box; }

/* ── Type ─────────────────────────────────────────────────────────────── */

.dm-wordmark {
  font-size: clamp(30px, 9vw, 54px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 0;
  background: linear-gradient(180deg, #f6e3ab 0%, var(--dm-gold) 55%, #9c7822 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.dm-tagline {
  margin: 8px 0 0;
  color: var(--dm-dim);
  font-size: 15px;
  line-height: 1.5;
}
.dm-eyebrow {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dm-mute);
  font-weight: 700;
  margin: 0 0 10px;
}
.dm-h2 {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 12px;
}
.dm-money {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

/* ── Shell ────────────────────────────────────────────────────────────── */

.dm-shell { max-width: 1180px; margin: 0 auto; }
.dm-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; margin-bottom: 26px;
}
.dm-head-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }

.dm-panel {
  background: var(--dm-panel);
  border: 1px solid var(--dm-line);
  border-radius: var(--dm-radius);
  padding: 18px;
}

/* ── Buttons ──────────────────────────────────────────────────────────── */

.dm-btn {
  appearance: none;
  min-height: 44px;
  padding: 11px 18px;
  border-radius: 11px;
  border: 1px solid var(--dm-line-hot);
  background: var(--dm-panel-2);
  color: var(--dm-text);
  font-size: 15px;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease, transform .08s ease, opacity .15s ease;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
}
.dm-btn:hover:not(:disabled) { background: #26262c; border-color: #4a4a55; }
.dm-btn:active:not(:disabled) { transform: translateY(1px); }
.dm-btn:disabled { opacity: .38; cursor: not-allowed; }

.dm-btn-primary {
  background: linear-gradient(180deg, var(--dm-gold-hot), var(--dm-gold));
  border-color: #a8842f;
  color: #1a1508;
  font-weight: 800;
}
.dm-btn-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #fbd97a, #e0b74f);
  border-color: #c49a37;
}
.dm-btn-ghost { background: transparent; border-color: var(--dm-line); color: var(--dm-dim); }
.dm-btn-ghost:hover:not(:disabled) { color: var(--dm-text); background: var(--dm-panel-2); }
.dm-btn-lg { min-height: 54px; font-size: 17px; padding: 14px 28px; }
.dm-btn-block { width: 100%; }
.dm-btn-icon { min-width: 44px; padding: 10px; }

/* ── Setup: topic grid ────────────────────────────────────────────────── */

.dm-topics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.dm-topic {
  position: relative;
  text-align: left;
  padding: 14px;
  min-height: 92px;
  border-radius: 13px;
  border: 1px solid var(--dm-line);
  background: var(--dm-panel);
  color: var(--dm-text);
  cursor: pointer;
  font-family: inherit;
  transition: border-color .15s ease, background .15s ease, transform .1s ease;
  display: flex; flex-direction: column; gap: 4px;
}
.dm-topic:hover { border-color: var(--dm-line-hot); background: var(--dm-panel-2); transform: translateY(-2px); }
.dm-topic[data-on="1"] {
  border-color: var(--dm-gold);
  background: linear-gradient(180deg, rgba(212,169,66,.12), rgba(212,169,66,.03));
}
.dm-topic-emoji { font-size: 24px; line-height: 1; }
.dm-topic-name { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; }
.dm-topic-blurb { font-size: 12px; color: var(--dm-mute); line-height: 1.4; }

.dm-custom { display: flex; gap: 8px; flex-wrap: wrap; }
.dm-input {
  flex: 1 1 220px;
  min-height: 48px;
  padding: 12px 15px;
  border-radius: 11px;
  border: 1px solid var(--dm-line-hot);
  background: var(--dm-bg);
  color: var(--dm-text);
  font-size: 16px; /* iOS: anything smaller triggers zoom-on-focus */
  font-family: inherit;
  outline: none;
  transition: border-color .15s ease;
}
.dm-input:focus { border-color: var(--dm-gold); }
.dm-input::placeholder { color: var(--dm-mute); }

.dm-examples { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.dm-chip {
  padding: 7px 12px; min-height: 34px;
  border-radius: 999px; border: 1px solid var(--dm-line);
  background: transparent; color: var(--dm-dim);
  font-size: 12.5px; font-family: inherit; cursor: pointer;
  transition: all .15s ease;
}
.dm-chip:hover { color: var(--dm-gold); border-color: var(--dm-gold); }

/* ── Segmented options ────────────────────────────────────────────────── */

.dm-seg { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
.dm-seg-item {
  padding: 12px 14px; min-height: 60px;
  border-radius: 11px; border: 1px solid var(--dm-line);
  background: var(--dm-panel); color: var(--dm-text);
  cursor: pointer; font-family: inherit; text-align: left;
  transition: all .15s ease;
  display: flex; flex-direction: column; gap: 3px; justify-content: center;
}
.dm-seg-item:hover { border-color: var(--dm-line-hot); }
.dm-seg-item[data-on="1"] { border-color: var(--dm-gold); background: rgba(212,169,66,.1); }
.dm-seg-label { font-weight: 700; font-size: 14.5px; }
.dm-seg-note { font-size: 11.5px; color: var(--dm-mute); }

/* ── Prep screen ──────────────────────────────────────────────────────── */

.dm-prep { max-width: 520px; margin: 8vh auto 0; text-align: center; }
.dm-prep-steps { display: flex; flex-direction: column; gap: 12px; margin-top: 28px; text-align: left; }
.dm-step {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border-radius: 12px;
  border: 1px solid var(--dm-line); background: var(--dm-panel);
  font-size: 14.5px; color: var(--dm-mute);
  transition: all .25s ease;
}
.dm-step[data-state="active"] { border-color: var(--dm-gold); color: var(--dm-text); }
.dm-step[data-state="done"] { color: var(--dm-dim); border-color: #2f3a2f; }
.dm-step-dot {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid currentColor; display: grid; place-items: center; font-size: 11px;
}
.dm-step[data-state="active"] .dm-step-dot {
  border-color: var(--dm-gold);
  border-top-color: transparent;
  animation: dm-spin .7s linear infinite;
}
.dm-step[data-state="done"] .dm-step-dot { border-color: var(--dm-green); color: var(--dm-green); }
@keyframes dm-spin { to { transform: rotate(360deg); } }

.dm-progress {
  height: 4px; border-radius: 999px; background: var(--dm-line);
  overflow: hidden; margin-top: 22px;
}
.dm-progress-fill {
  height: 100%; background: linear-gradient(90deg, var(--dm-gold), var(--dm-gold-hot));
  transition: width .4s ease;
}

/* ── Ready check ──────────────────────────────────────────────────────── */

.dm-ready-grid {
  display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 20px;
}
@media (min-width: 640px) { .dm-ready-grid { grid-template-columns: 1fr 1fr; } }

.dm-ready-card {
  padding: 22px 18px; border-radius: 14px; text-align: center;
  border: 1px solid var(--dm-line); background: var(--dm-panel);
  transition: all .2s ease;
}
.dm-ready-card[data-ready="1"] { border-color: var(--dm-green); background: rgba(76,175,125,.07); }
.dm-ready-state { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; font-weight: 700; margin-top: 8px; }

/* ── Auction stage ────────────────────────────────────────────────────── */

.dm-stage { display: grid; grid-template-columns: 1fr; gap: 14px; }
@media (min-width: 900px) {
  .dm-stage { grid-template-columns: 1fr minmax(320px, 380px); align-items: start; }
}

.dm-block { position: relative; }

.dm-lotbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; margin-bottom: 12px; font-size: 12.5px; color: var(--dm-mute);
}
.dm-lotbar strong { color: var(--dm-dim); font-weight: 650; }

/* Portrait */
.dm-portrait-wrap {
  position: relative;
  aspect-ratio: 4 / 5;
  /* Height drives the box and aspect-ratio derives the width. Setting width
     first and capping height instead lets a short viewport squash the card
     into a landscape rectangle, which is not the shape of a portrait. */
  height: min(46dvh, 420px);
  width: auto;
  max-width: min(340px, 86vw);
  margin: 0 auto;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--dm-line-hot);
  background: linear-gradient(160deg, #23232a, #131316);
  box-shadow: 0 24px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(212,169,66,.12) inset;
}
@media (min-width: 900px) { .dm-portrait-wrap { height: min(52dvh, 430px); } }

.dm-portrait-wrap[data-in="1"] { animation: dm-lot-in .45s cubic-bezier(.2,.8,.25,1); }
@keyframes dm-lot-in {
  from { opacity: 0; transform: translateY(14px) scale(.96); }
  to   { opacity: 1; transform: none; }
}

.dm-portrait {
  position: relative;
  width: 100%; height: 100%; display: block;
  object-fit: cover;
  /* Heads live in the top third of most photos — a centred crop beheads them. */
  object-position: 50% 22%;
}
.dm-portrait[data-fit="contain"] { object-fit: contain; object-position: 50% 45%; }

/* Blurred copy behind letterboxed images so odd shapes still fill the card. */
.dm-portrait-blur {
  position: absolute; inset: -8%;
  width: 116%; height: 116%;
  object-fit: cover;
  filter: blur(26px) saturate(.7) brightness(.42);
  transform: scale(1.06);
}
.dm-portrait-fallback {
  width: 100%; height: 100%; display: grid; place-items: center;
  font-size: 76px; font-weight: 800; color: rgba(212,169,66,.34);
  background: radial-gradient(70% 70% at 50% 35%, #2b2b33, #131316);
}
.dm-portrait-vignette {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.86) 100%);
}
.dm-portrait-caption { position: absolute; left: 0; right: 0; bottom: 0; padding: 16px; }
.dm-lot-name {
  font-size: clamp(21px, 5.4vw, 27px); font-weight: 800;
  letter-spacing: -0.02em; line-height: 1.12; margin: 0;
  text-shadow: 0 2px 12px rgba(0,0,0,.8);
}
.dm-lot-variant {
  display: inline-block; margin-top: 7px; padding: 4px 11px;
  border-radius: 999px; font-size: 12.5px; font-weight: 700;
  background: rgba(196,83,26,.9); color: #fff;
  box-shadow: 0 2px 10px rgba(0,0,0,.5);
}

.dm-sold-stamp {
  position: absolute; inset: 0; display: grid; place-items: center;
  background: rgba(8,8,10,.62); backdrop-filter: blur(2px);
  animation: dm-stamp .3s cubic-bezier(.2,1.4,.4,1);
}
@keyframes dm-stamp { from { opacity: 0; transform: scale(1.25); } to { opacity: 1; transform: none; } }
.dm-sold-text {
  font-size: clamp(28px, 8vw, 42px); font-weight: 900; letter-spacing: .04em;
  border: 4px solid currentColor; border-radius: 10px; padding: 8px 20px;
  transform: rotate(-7deg); text-transform: uppercase;
}
.dm-sold-text[data-kind="sold"] { color: var(--dm-green); }
.dm-sold-text[data-kind="passed"] { color: var(--dm-mute); }
.dm-sold-sub { margin-top: 14px; font-size: 15px; color: var(--dm-text); text-align: center; }

/* Timer */
.dm-timer { margin: 14px auto 0; max-width: 340px; }
.dm-timer-track {
  height: 6px; border-radius: 999px; background: var(--dm-line); overflow: hidden;
}
.dm-timer-fill {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--dm-gold), var(--dm-gold-hot));
  transition: width .18s linear;
}
.dm-timer-fill[data-urgent="1"] {
  background: linear-gradient(90deg, var(--dm-ember), #e8703a);
  animation: dm-pulse .6s ease-in-out infinite;
}
@keyframes dm-pulse { 50% { opacity: .55; } }
.dm-timer-label {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-top: 7px; font-size: 12.5px; color: var(--dm-mute);
}

/* Bid readout */
.dm-bidbar {
  margin: 16px auto 0; max-width: 340px; text-align: center;
  padding: 14px; border-radius: 13px;
  border: 1px solid var(--dm-line); background: var(--dm-panel);
}
.dm-bid-amount {
  font-size: clamp(32px, 9vw, 42px); font-weight: 800; line-height: 1;
  color: var(--dm-gold); letter-spacing: -0.02em;
}
.dm-bid-holder { margin-top: 6px; font-size: 13.5px; color: var(--dm-dim); }
.dm-bid-holder strong { color: var(--dm-text); }
.dm-bid-open { font-size: 14px; color: var(--dm-dim); }

/* Bid controls */
.dm-controls { margin: 14px auto 0; max-width: 400px; display: flex; flex-direction: column; gap: 8px; }
.dm-quickbids { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.dm-quickbid {
  min-height: 52px; border-radius: 12px; cursor: pointer;
  border: 1px solid var(--dm-line-hot); background: var(--dm-panel-2);
  color: var(--dm-text); font-family: inherit;
  font-size: 17px; font-weight: 750; font-variant-numeric: tabular-nums;
  transition: all .13s ease;
}
.dm-quickbid:hover:not(:disabled) { border-color: var(--dm-gold); color: var(--dm-gold-hot); }
.dm-quickbid:active:not(:disabled) { transform: translateY(1px); }
.dm-quickbid:disabled { opacity: .3; cursor: not-allowed; }
.dm-quickbid small { display: block; font-size: 10.5px; font-weight: 600; color: var(--dm-mute); margin-top: 2px; }

.dm-waiting {
  text-align: center; padding: 16px; font-size: 14px; color: var(--dm-mute);
  border: 1px dashed var(--dm-line); border-radius: 12px;
}

/* ── Scoreboard ───────────────────────────────────────────────────────── */

.dm-scores { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.dm-score {
  padding: 12px; border-radius: 13px;
  border: 1px solid var(--dm-line); background: var(--dm-panel);
  transition: border-color .2s ease, background .2s ease;
}
.dm-score[data-turn="1"] { border-color: var(--dm-gold); background: rgba(212,169,66,.08); }
.dm-score[data-high="1"] { border-color: var(--dm-green); }
.dm-score-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dm-avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  object-fit: cover; border: 2px solid var(--dm-line-hot); background: var(--dm-panel-2);
  display: grid; place-items: center; font-size: 14px; font-weight: 800; color: var(--dm-gold);
}
.dm-avatar[data-speaking="1"] {
  border-color: var(--dm-green);
  box-shadow: 0 0 0 3px rgba(76,175,125,.24);
}
.dm-score-name {
  font-weight: 700; font-size: 14px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.dm-score-budget {
  font-size: 25px; font-weight: 800; color: var(--dm-gold);
  margin-top: 8px; line-height: 1;
}
.dm-score-meta { font-size: 11.5px; color: var(--dm-mute); margin-top: 4px; }

/* Roster shelf */
.dm-roster { display: flex; gap: 5px; margin-top: 10px; }
.dm-slot {
  flex: 1; aspect-ratio: 3 / 4; border-radius: 7px; overflow: hidden;
  background: var(--dm-panel-2); border: 1px dashed var(--dm-line);
  position: relative; display: grid; place-items: center;
}
.dm-slot[data-filled="1"] { border-style: solid; border-color: var(--dm-line-hot); }
.dm-slot[data-new="1"] { animation: dm-slot-pop .5s cubic-bezier(.2,1.5,.4,1); }
@keyframes dm-slot-pop { from { transform: scale(.5); opacity: 0; } to { transform: none; opacity: 1; } }
.dm-slot img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 20%; }
.dm-slot-initial { font-size: 15px; font-weight: 800; color: rgba(212,169,66,.4); }
.dm-slot-price {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,.82); color: var(--dm-gold);
  font-size: 10px; font-weight: 800; text-align: center; padding: 2px 0;
}

/* ── Ticker ───────────────────────────────────────────────────────────── */

.dm-ticker {
  margin-top: 12px; padding: 12px; border-radius: 13px;
  border: 1px solid var(--dm-line); background: var(--dm-panel);
  max-height: 168px; overflow-y: auto;
  display: flex; flex-direction: column-reverse; gap: 6px;
  scrollbar-width: thin;
}
.dm-ticker-line { font-size: 12.5px; line-height: 1.45; color: var(--dm-dim); }
.dm-ticker-line[data-kind="sold"] { color: var(--dm-green); font-weight: 650; }
.dm-ticker-line[data-kind="passed"] { color: var(--dm-mute); font-style: italic; }
.dm-ticker-line[data-kind="bid"] { color: var(--dm-text); }
.dm-ticker-line[data-kind="system"] { color: var(--dm-gold); }

/* ── Media rail ───────────────────────────────────────────────────────── */

.dm-media { margin-top: 12px; }
.dm-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.dm-tile {
  position: relative; aspect-ratio: 4 / 3; border-radius: 12px; overflow: hidden;
  background: var(--dm-panel-2); border: 1px solid var(--dm-line);
  display: grid; place-items: center;
}
.dm-tile[data-speaking="1"] { border-color: var(--dm-green); box-shadow: 0 0 0 2px rgba(76,175,125,.2); }
.dm-tile video { width: 100%; height: 100%; object-fit: cover; }
.dm-tile-name {
  position: absolute; bottom: 5px; left: 6px; right: 6px;
  font-size: 11px; font-weight: 650; color: #fff;
  text-shadow: 0 1px 5px rgba(0,0,0,.9);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dm-tile-badge { position: absolute; top: 5px; right: 6px; font-size: 13px; }
.dm-media-controls { display: flex; gap: 8px; margin-top: 8px; }

/* ── Chat ─────────────────────────────────────────────────────────────── */

.dm-chat { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.dm-chat-log {
  max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px;
  font-size: 13px; line-height: 1.45;
}
.dm-chat-line strong { color: var(--dm-gold); font-weight: 650; }

/* ── Verdict ──────────────────────────────────────────────────────────── */

.dm-verdict { max-width: 760px; margin: 0 auto; text-align: center; }
.dm-verdict-crown { font-size: 46px; line-height: 1; animation: dm-drop .55s cubic-bezier(.2,1.4,.4,1); }
@keyframes dm-drop { from { transform: translateY(-24px) scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
.dm-verdict-headline {
  font-size: clamp(25px, 6.5vw, 38px); font-weight: 850; letter-spacing: -0.025em;
  margin: 12px 0 6px; line-height: 1.14;
  background: linear-gradient(180deg, #f6e3ab, var(--dm-gold));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.dm-verdict-winner { font-size: 17px; color: var(--dm-text); font-weight: 700; }
.dm-verdict-reasoning {
  margin: 18px auto 0; max-width: 560px;
  font-size: 15px; line-height: 1.65; color: var(--dm-dim);
}
.dm-verdict-sides { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 26px; text-align: left; }
@media (min-width: 700px) { .dm-verdict-sides { grid-template-columns: 1fr 1fr; } }
.dm-verdict-side {
  padding: 16px; border-radius: 14px;
  border: 1px solid var(--dm-line); background: var(--dm-panel);
}
.dm-verdict-side[data-won="1"] {
  border-color: var(--dm-gold);
  background: linear-gradient(180deg, rgba(212,169,66,.11), transparent);
}
.dm-verdict-score {
  font-size: 30px; font-weight: 800; color: var(--dm-gold); line-height: 1;
  font-variant-numeric: tabular-nums;
}
.dm-verdict-note { font-size: 13.5px; color: var(--dm-dim); line-height: 1.55; margin-top: 8px; }
.dm-verdict-picks { display: flex; flex-direction: column; gap: 5px; margin-top: 12px; }
.dm-verdict-pick {
  display: flex; align-items: center; gap: 9px;
  font-size: 13px; padding: 6px; border-radius: 9px; background: var(--dm-panel-2);
}
.dm-verdict-pick img { width: 30px; height: 34px; border-radius: 5px; object-fit: cover; object-position: 50% 20%; flex-shrink: 0; }
.dm-verdict-pick-name { flex: 1; min-width: 0; }
.dm-verdict-pick-name span { display: block; font-size: 11px; color: var(--dm-mute); }
.dm-verdict-pick-price { color: var(--dm-gold); font-weight: 750; font-variant-numeric: tabular-nums; }
.dm-tag {
  display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: .08em;
  text-transform: uppercase; padding: 2px 7px; border-radius: 5px; margin-left: 6px;
}
.dm-tag[data-kind="mvp"] { background: rgba(76,175,125,.2); color: var(--dm-green); }
.dm-tag[data-kind="bust"] { background: rgba(217,83,79,.18); color: var(--dm-red); }

/* ── Misc ─────────────────────────────────────────────────────────────── */

.dm-error {
  padding: 12px 14px; border-radius: 11px; font-size: 14px; line-height: 1.5;
  border: 1px solid rgba(217,83,79,.4); background: rgba(217,83,79,.1); color: #f0a6a3;
}
.dm-note { font-size: 12.5px; color: var(--dm-mute); line-height: 1.55; }
.dm-room-code {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 27px; font-weight: 800; letter-spacing: .22em;
  color: var(--dm-gold); text-align: center; padding: 14px;
  border: 1px dashed var(--dm-line-hot); border-radius: 12px; background: var(--dm-bg);
}
.dm-section { margin-bottom: 26px; }
.dm-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dm-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .dm *, .dm *::before, .dm *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}

/* ── Dice ─────────────────────────────────────────────────────────────── */

.dm-sold-stamp[data-dice="1"] { background: rgba(8,8,10,.78); }
.dm-dice-row {
  display: flex; align-items: center; justify-content: center; gap: 18px;
  margin: 12px 0 6px;
  animation: dm-dice-in .45s cubic-bezier(.2,1.4,.4,1);
}
@keyframes dm-dice-in { from { transform: scale(.6) rotate(-12deg); opacity: 0; } to { transform: none; opacity: 1; } }
.dm-die { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.dm-die-face { font-size: clamp(56px, 16vw, 84px); line-height: 1; color: var(--dm-gold-hot); filter: drop-shadow(0 6px 14px rgba(0,0,0,.7)); }
.dm-die-name { font-size: 12.5px; font-weight: 700; color: var(--dm-dim); }
.dm-die-vs { font-size: 13px; color: var(--dm-mute); font-weight: 700; letter-spacing: .1em; }

.dm-turn-pill {
  margin-left: auto; font-size: 10px; font-weight: 800; letter-spacing: .08em;
  text-transform: uppercase; padding: 3px 7px; border-radius: 6px;
  background: rgba(212,169,66,.18); color: var(--dm-gold); white-space: nowrap;
}

/* ── Connection + records ─────────────────────────────────────────────── */

.dm-conn {
  position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 50;
  padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 700;
  background: rgba(196,83,26,.95); color: #fff; box-shadow: 0 6px 20px rgba(0,0,0,.5);
  animation: dm-pulse 1s ease-in-out infinite;
}
.dm-record { display: flex; gap: 16px; flex-wrap: wrap; align-items: baseline; font-size: 13.5px; color: var(--dm-dim); }
.dm-record strong { color: var(--dm-gold); font-size: 19px; font-variant-numeric: tabular-nums; }
.dm-lb { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
.dm-lb-row {
  display: grid; grid-template-columns: 26px 1fr auto auto; gap: 10px; align-items: center;
  padding: 8px 10px; border-radius: 9px; background: var(--dm-panel-2); font-size: 13.5px;
}
.dm-lb-row[data-me="1"] { outline: 1px solid var(--dm-gold); }
.dm-lb-rank { color: var(--dm-mute); font-weight: 800; font-variant-numeric: tabular-nums; }
.dm-lb-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 650; }
.dm-lb-rating { color: var(--dm-gold); font-weight: 800; font-variant-numeric: tabular-nums; }
.dm-lb-wl { color: var(--dm-mute); font-variant-numeric: tabular-nums; font-size: 12.5px; }

/* ── Contribution scale (verdict) ─────────────────────────────────────── */

.dm-contrib { display: flex; align-items: center; gap: 6px; flex-shrink: 0; min-width: 88px; }
.dm-contrib-bar { flex: 1; height: 5px; border-radius: 999px; background: var(--dm-line); overflow: hidden; min-width: 44px; }
.dm-contrib-bar i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--dm-gold-dim, #8a6d2b), var(--dm-gold-hot)); }
.dm-contrib-n { font-size: 11.5px; font-weight: 800; color: var(--dm-gold); font-variant-numeric: tabular-nums; width: 30px; text-align: right; }

.dm-textarea { resize: vertical; min-height: 58px; line-height: 1.45; width: 100%; }

.dm-verdict-thumb { width: 30px; height: 34px; border-radius: 5px; overflow: hidden; flex-shrink: 0; display: grid; place-items: center; background: var(--dm-panel); }
.dm-verdict-thumb img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 20%; display: block; }
.dm-verdict-thumb .dm-slot-initial { font-size: 13px; }
.dm-lot-variant { max-width: 100%; white-space: normal; line-height: 1.3; text-align: left; }

/* ── Photo feedback ───────────────────────────────────────────────────── */

.dm-photo-fb { display: flex; gap: 6px; justify-content: center; margin: 8px auto 0; max-width: 340px; }
.dm-photo-fb .dm-btn { min-height: 34px; padding: 6px 12px; font-size: 12.5px; }
.dm-photo-note { text-align: center; font-size: 12px; color: var(--dm-dim); margin-top: 6px; }

.dm-arena-pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: rgba(212,169,66,.14); color: var(--dm-gold); border: 1px solid rgba(212,169,66,.3); white-space: nowrap; }

.dm-portrait-wrap[data-uploadable="1"] { cursor: pointer; border-style: dashed; border-color: var(--dm-line-hot); }
.dm-portrait-wrap[data-uploadable="1"]:hover { border-color: var(--dm-gold); }
.dm-portrait-upload {
  position: absolute; left: 50%; bottom: 18%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 10px 16px; border-radius: 12px; text-align: center;
  background: rgba(8,8,10,.72); border: 1px solid var(--dm-line-hot);
  pointer-events: none; max-width: 88%;
}
.dm-portrait-upload strong { font-size: 14px; color: var(--dm-gold); font-weight: 750; white-space: nowrap; }
.dm-portrait-upload small { font-size: 11.5px; color: var(--dm-dim); line-height: 1.3; }
.dm-portrait-wrap[data-uploadable="1"]:hover .dm-portrait-upload { border-color: var(--dm-gold); }

/* ── Variant grades ───────────────────────────────────────────────────────
   The colour is a promise about what the condition does, so it has to be
   readable at a glance and consistent everywhere a variant is shown. */

.dm {
  --dm-g-crippling: #d0342c;
  --dm-g-weakening: #e8918c;
  --dm-g-neutral:   #8d8778;
  --dm-g-boon:      #4caf7d;
  --dm-g-major:     #f0872e;
  --dm-g-mythic:    #d9a3ff;
}

.dm-lot-variant[data-grade] {
  display: inline-flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  border: 1px solid currentColor;
}
.dm-lot-variant[data-grade="crippling"] { background: rgba(208,52,44,.94);  color: #fff; }
.dm-lot-variant[data-grade="weakening"] { background: rgba(232,145,140,.9); color: #2a0e0d; }
.dm-lot-variant[data-grade="neutral"]   { background: rgba(141,135,120,.85); color: #14130f; }
.dm-lot-variant[data-grade="boon"]      { background: rgba(76,175,125,.92); color: #05170f; }
.dm-lot-variant[data-grade="major"]     { background: rgba(240,135,46,.95); color: #1d0d02; }
.dm-lot-variant[data-grade="mythic"] {
  background: linear-gradient(100deg, #7a3bd6 0%, #c05bff 40%, #f0c860 100%);
  color: #17061f;
  border-color: #ffe9a8;
  box-shadow: 0 0 0 1px rgba(255,233,168,.5), 0 4px 22px rgba(192,91,255,.45);
  animation: dm-mythic 2.6s ease-in-out infinite;
}
@keyframes dm-mythic {
  0%, 100% { filter: saturate(1) brightness(1); }
  50%      { filter: saturate(1.35) brightness(1.15); }
}
@media (prefers-reduced-motion: reduce) {
  .dm-lot-variant[data-grade="mythic"] { animation: none; }
}

.dm-grade-tag {
  font-style: normal; font-size: 10px; font-weight: 800;
  letter-spacing: .1em; text-transform: uppercase; opacity: .82;
}

.dm-grade-swatch {
  display: inline-block; padding: 1px 7px; border-radius: 999px;
  font-size: 11px; font-weight: 800; color: #14130f;
}
.dm-grade-swatch[data-grade="crippling"] { background: var(--dm-g-crippling); color: #fff; }
.dm-grade-swatch[data-grade="mythic"] {
  background: linear-gradient(100deg, #c05bff, #f0c860); color: #17061f;
}

/* ── Custom bid ───────────────────────────────────────────────────────────
   Sits under the quick steps. 16px input so iOS doesn't zoom on focus. */

.dm-custombid {
  display: flex; align-items: stretch; gap: 8px; margin-top: 10px;
}
.dm-custombid-sign {
  display: grid; place-items: center; width: 34px; flex: none;
  border-radius: 12px; border: 1px solid var(--dm-line);
  background: var(--dm-panel-2); color: var(--dm-dim);
  font-weight: 800; font-size: 16px;
}
.dm-custombid-input {
  flex: 1 1 auto; min-width: 0; min-height: 46px;
  padding: 10px 12px; border-radius: 12px;
  border: 1px solid var(--dm-line); background: var(--dm-panel-2);
  color: var(--dm-text); font-size: 16px; font-weight: 800;
  letter-spacing: .02em; text-align: center;
}
.dm-custombid-input:focus { outline: none; border-color: var(--dm-gold); }
.dm-custombid-input::placeholder { color: var(--dm-mute); font-weight: 600; letter-spacing: 0; }
.dm-custombid-go { flex: 0 0 auto; min-height: 46px; padding: 0 16px; white-space: nowrap; }
.dm-custombid-go:disabled { opacity: .4; }

/* ── Variant dials ────────────────────────────────────────────────────── */

.dm-dials {
  margin-top: 16px; padding: 14px;
  border: 1px solid var(--dm-line); border-radius: var(--dm-radius);
  background: var(--dm-panel);
  display: grid; gap: 16px;
}
.dm-dial { display: grid; gap: 7px; }
.dm-dial-head {
  display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
  font-size: 13.5px; font-weight: 700; color: var(--dm-text);
}
.dm-dial-value { color: var(--dm-gold); font-variant-numeric: tabular-nums; font-size: 13px; }
.dm-dial-word { font-size: 12.5px; color: var(--dm-dim); }

.dm-range {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 44px; background: transparent; cursor: pointer;
}
.dm-range::-webkit-slider-runnable-track {
  height: 6px; border-radius: 999px;
  background: linear-gradient(90deg, var(--dm-line-hot), var(--dm-gold));
}
.dm-range::-moz-range-track {
  height: 6px; border-radius: 999px;
  background: linear-gradient(90deg, var(--dm-line-hot), var(--dm-gold));
}
.dm-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 26px; height: 26px; margin-top: -10px; border-radius: 50%;
  background: var(--dm-gold-hot); border: 2px solid #1a1712;
  box-shadow: 0 2px 10px rgba(0,0,0,.6);
}
.dm-range::-moz-range-thumb {
  width: 26px; height: 26px; border-radius: 50%;
  background: var(--dm-gold-hot); border: 2px solid #1a1712;
}
.dm-range:focus-visible { outline: 2px solid var(--dm-gold); outline-offset: 4px; }

/* ── Staging bar ──────────────────────────────────────────────────────── */

.dm-staging {
  margin: 22px auto 0; max-width: 460px; padding: 16px;
  border: 1px solid var(--dm-line); border-radius: var(--dm-radius);
  background: var(--dm-panel); text-align: left;
}
.dm-staging-head {
  display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
  font-size: 13.5px; font-weight: 800; color: var(--dm-text);
}
.dm-staging-pct { color: var(--dm-gold); font-variant-numeric: tabular-nums; }
.dm-staging-track {
  margin-top: 10px; height: 8px; border-radius: 999px;
  background: var(--dm-panel-2); border: 1px solid var(--dm-line); overflow: hidden;
}
.dm-staging-track i {
  display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--dm-ember), var(--dm-gold-hot));
  transition: width .24s linear;
}
.dm-staging-line {
  margin: 10px 0 0; font-size: 13px; color: var(--dm-dim); line-height: 1.45;
  animation: dm-fadein .35s ease;
}
@keyframes dm-fadein { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .dm-staging-line { animation: none; } }

/* ── The judge's working ──────────────────────────────────────────────── */

.dm-plan {
  margin: 20px auto 0; max-width: 620px; padding: 16px;
  border: 1px solid var(--dm-line); border-radius: var(--dm-radius);
  background: var(--dm-panel); text-align: left;
}
.dm-plan-format { color: var(--dm-gold); }
.dm-plan-how { margin: 8px 0 0; font-size: 14px; line-height: 1.55; color: var(--dm-text); }
.dm-plan-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.dm-plan-tag {
  padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700;
  background: var(--dm-panel-2); border: 1px solid var(--dm-line); color: var(--dm-dim);
}
.dm-plan-block { margin-top: 16px; }
.dm-plan-block h4 {
  margin: 0 0 6px; font-size: 11px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase; color: var(--dm-mute);
}
.dm-plan-block ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.dm-plan-block li { font-size: 13.5px; line-height: 1.5; color: var(--dm-dim); }
.dm-plan-block li strong { color: var(--dm-text); }
.dm-plan-block[data-twist="1"] h4 { color: var(--dm-gold); }
.dm-plan-block[data-twist="1"] li { color: var(--dm-gold-hot); }

/* Grade carried through to the rosters, so a mythic sitting on the bench is
   as legible as one under the spotlight. */
.dm-variant-note[data-grade="crippling"] { color: var(--dm-g-crippling); }
.dm-variant-note[data-grade="weakening"] { color: var(--dm-g-weakening); }
.dm-variant-note[data-grade="neutral"]   { color: var(--dm-g-neutral); }
.dm-variant-note[data-grade="boon"]      { color: var(--dm-g-boon); }
.dm-variant-note[data-grade="major"]     { color: var(--dm-g-major); font-weight: 700; }
.dm-variant-note[data-grade="mythic"] {
  color: var(--dm-g-mythic); font-weight: 800; letter-spacing: .01em;
  text-shadow: 0 0 12px rgba(192,91,255,.5);
}

.dm-slot[data-grade="crippling"] { box-shadow: inset 0 0 0 2px var(--dm-g-crippling); }
.dm-slot[data-grade="weakening"] { box-shadow: inset 0 0 0 2px var(--dm-g-weakening); }
.dm-slot[data-grade="boon"]      { box-shadow: inset 0 0 0 2px var(--dm-g-boon); }
.dm-slot[data-grade="major"]     { box-shadow: inset 0 0 0 2px var(--dm-g-major); }
.dm-slot[data-grade="mythic"] {
  box-shadow: inset 0 0 0 2px #f0c860, 0 0 16px rgba(192,91,255,.55);
}
`;
