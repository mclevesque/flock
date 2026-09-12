/**
 * DraftMasters stylesheet.
 *
 * THE HOUSE. DraftMasters is an auction house that deals in the impossible,
 * and the whole design follows from taking that literally. The room is dark
 * and the lot is lit, because that is what a saleroom looks like. The surfaces
 * are green-black — baize in shadow — rather than the neutral grey a dark UI
 * defaults to. The fittings are brass, cooler and deeper than Great Souls'
 * gold, so the two sites are relatives rather than the same site twice. And
 * one colour, hammer red, is spent exclusively on the live bid and the fall of
 * the gavel: the only two moments that are actually urgent.
 *
 * The type is carved: Cinzel for the wordmark and the lot
 * names — the auction house's own letterform — against Archivo for everything
 * you operate, with tabular figures so money lines up in a column.
 *
 * Mobile-first: base rules are the phone layout, media queries widen it.
 * Inputs are 16px so iOS doesn't zoom on focus; every control is >=44px.
 */

export const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Archivo:wght@400;500;600;700;800&display=swap');

.dm {
  /* The ground the collector's case sits on: black, barely warm, so the brass
     is the only colour in the room and reads as metal rather than as yellow. */
  /* The glow, as an unquoted triple so rules can set their own alpha. */
  --dm-glow: 217 178 106;

  --dm-bg: #08080a;
  /* Warm, not neutral. A flat grey card next to the case reads as a different
     product's furniture; a panel with the same faint brass bias in it reads as
     the same room with the lights lower. */
  --dm-panel: #100e0b;
  --dm-panel-2: #17140f;
  --dm-line: rgb(var(--dm-glow) / .17);
  --dm-line-hot: rgb(var(--dm-glow) / .42);

  /* The fittings. Brighter and lighter than the old dull gold — this is the
     brass off the case frame, and it has to survive being a thin 1px edge. */
  --dm-gold: #d4af5f;
  --dm-gold-hot: #f2dfa4;
  --dm-gold-deep: #8a6a24;

  /* Spent only where it means something: the standing bid, and the hammer. */
  --dm-hammer: #d9522b;
  --dm-ember: #d9522b;

  --dm-green: #5bbd8a;
  --dm-red: #cf4d3f;

  /* Catalogue paper, with the green bias taken out of the greys. */
  --dm-text: #f0ece4;
  --dm-dim: #8f8f8f;
  --dm-mute: #616161;
  --dm-radius: 16px;

  /* Cinzel: carved rather than printed. Bodoni was a magazine face and read
     as an auction catalogue; this reads as something stamped into metal. */
  --dm-display: "Cinzel", "Trajan Pro", Georgia, serif;
  --dm-ui: "Archivo", var(--font-sans), system-ui, -apple-system, "Segoe UI", sans-serif;

  position: relative;
  min-height: 100dvh;
  /* The spotlight over the block. */
  background:
    radial-gradient(105% 62% at 50% -8%, rgb(var(--dm-glow) / .13) 0%, rgba(8,8,10,0) 62%),
    var(--dm-bg);
  color: var(--dm-text);
  font-family: var(--dm-ui);
  font-feature-settings: "tnum" 1;
  -webkit-font-smoothing: antialiased;
  padding: 16px 14px 32px;
  overflow-x: hidden;
}

.dm *, .dm *::before, .dm *::after { box-sizing: border-box; }

/* ── Type ─────────────────────────────────────────────────────────────── */

/* The h1 is now just a box for the mark — the gradient and the sizing live on
   the component so it looks the same everywhere it appears. */
.dm-wordmark { margin: 0; line-height: 1; }

.dm-logo {
  display: block; width: auto;
  /* Knocks the source's black ground out against any dark surface. Requires
     that no ancestor between here and the page background makes a stacking
     context. */
  mix-blend-mode: screen;
}
.dm-tagline {
  margin: 8px 0 0;
  color: var(--dm-dim);
  font-size: 15px;
  line-height: 1.5;
}
/* Every small caps label in the game. Cinzel and brass, like the case, so a
   section heading looks stamped rather than typed. */
.dm-eyebrow {
  font-family: var(--dm-display);
  font-size: 11.5px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgb(var(--dm-glow) / .72);
  font-weight: 600;
  margin: 0 0 10px;
}
.dm-h2 {
  font-family: var(--dm-display);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.005em;
  margin: 0 0 12px;
}
.dm-money {
  font-family: var(--dm-ui);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

/* ── Shell ────────────────────────────────────────────────────────────── */

.dm-shell { max-width: 1180px; margin: 0 auto; }
.dm-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; margin-bottom: 26px;
  flex-wrap: wrap;
}
.dm-head-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; min-width: 0; }
.dm-head-actions .dm-btn { min-width: 0; }

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
  background: linear-gradient(180deg, rgb(var(--dm-glow) / .12), rgb(var(--dm-glow) / .03));
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
.dm-seg-item[data-on="1"] { border-color: var(--dm-gold); background: rgb(var(--dm-glow) / .1); }
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
  height: 6px; border-radius: 999px; background: var(--dm-line);
  overflow: hidden; margin-top: 22px;
  position: relative;
}
.dm-progress-fill {
  height: 100%; background: linear-gradient(90deg, var(--dm-gold), var(--dm-gold-hot));
  /* linear, not ease: the width is updated every 120ms during the board phase
     and once per batch after it, so an easing curve restarts on each update
     and the bar stutters. Linear over slightly longer than the update interval
     joins those steps into one continuous movement. */
  transition: width .5s linear;
  position: relative;
}
/* A highlight travelling along the filled part, so the bar reads as working
   even in the seconds where its width genuinely should not change. */
.dm-progress-fill::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent);
  background-size: 50% 100%;
  background-repeat: no-repeat;
  animation: dm-progress-sheen 1.6s ease-in-out infinite;
}
@keyframes dm-progress-sheen {
  from { background-position: -60% 0; }
  to   { background-position: 160% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .dm-progress-fill::after { animation: none; }
}
/* The one real number on the prep screen. */
.dm-prep-count {
  color: var(--dm-gold);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
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
.dm-ready-card[data-ready="1"] { border-color: var(--dm-gold); background: rgb(var(--dm-glow) / .09); }
.dm-ready-card[data-ready="1"] .dm-ready-state { color: var(--dm-gold); }
.dm-ready-state { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; font-weight: 700; margin-top: 8px; }

/* ── Auction stage ────────────────────────────────────────────────────── */

/* minmax(0,…) not 1fr: a grid item defaults to min-width:auto, so the widest
   unbreakable thing in the bid controls was forcing this track to 400px and
   pushing the Pass button off a 375px screen. */
.dm-stage { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.dm-stage > * { min-width: 0; }
/* Landscape-gated, because width alone lies about shape.
   An Android phone with "Desktop site" on reports a 980px viewport and a 2080px
   height — so it cleared this breakpoint, got the lot on the left and the
   budgets on the right, and left two thirds of the screen empty underneath.
   Two columns are for a screen that is actually wider than it is tall. */
@media (min-width: 900px) and (orientation: landscape) {
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
  box-shadow: 0 24px 60px rgba(0,0,0,.6), 0 0 0 1px rgb(var(--dm-glow) / .12) inset;
}
@media (min-width: 900px) and (orientation: landscape) { .dm-portrait-wrap { height: min(52dvh, 430px); } }

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
  font-size: 76px; font-weight: 800; color: rgb(var(--dm-glow) / .34);
  background: radial-gradient(70% 70% at 50% 35%, #2b2b33, #131316);
}
.dm-portrait-vignette {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.86) 100%);
}
.dm-portrait-caption { position: absolute; left: 0; right: 0; bottom: 0; padding: 16px; }
.dm-lot-name {
  font-family: var(--dm-display);
  letter-spacing: -0.005em;
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
  color: var(--dm-hammer);
  font-size: clamp(32px, 9vw, 42px); font-weight: 800; line-height: 1;
  color: var(--dm-gold); letter-spacing: -0.02em;
}
.dm-bid-holder { margin-top: 6px; font-size: 13.5px; color: var(--dm-dim); }
.dm-bid-holder strong { color: var(--dm-text); }
.dm-bid-open { font-size: 14px; color: var(--dm-dim); }

/* Bid controls */
.dm-controls { margin: 14px auto 0; width: 100%; max-width: 400px; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
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
.dm-score[data-turn="1"] { border-color: var(--dm-gold); background: rgb(var(--dm-glow) / .08); }
.dm-score[data-high="1"] { border-color: var(--dm-green); }
.dm-score-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dm-avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  object-fit: cover; border: 2px solid var(--dm-line-hot); background: var(--dm-panel-2);
  display: grid; place-items: center; font-size: 14px; font-weight: 800; color: var(--dm-gold);
}
.dm-avatar[data-speaking="1"] {
  border-color: var(--dm-green);
  box-shadow: 0 0 0 3px rgb(var(--dm-glow) / .3);
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

/* Seat — the block that holds one player's identity, money and (later) feed.
   Inert on narrow screens: a plain wrapper in normal flow, and the feed slot
   is display:contents so the avatar keeps its original inline position.
   Both come alive in the desktop arena block at the bottom of this sheet. */
.dm-seat-feed { display: contents; }
.dm-lot-card { display: contents; }
.dm-lot-actions { display: contents; }
.dm-roster-tag { display: none; }

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
.dm-slot-initial { font-size: 15px; font-weight: 800; color: rgb(var(--dm-glow) / .4); }
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
.dm-tile[data-speaking="1"] { border-color: var(--dm-gold); box-shadow: 0 0 0 2px rgb(var(--dm-glow) / .26); }
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

/* ── The cases, and what the battle did with them ──────────────────────────
   Their own words with the ruling underneath: the interesting half of making
   a case is how it was answered. */
.dm-cases { margin-top: 20px; text-align: left; }
.dm-cases-tag {
  display: block; margin-bottom: 8px;
  font-family: var(--dm-display); font-size: 10px; letter-spacing: .2em;
  text-transform: uppercase; color: rgb(var(--dm-glow) / .6);
}
/* dm-ruling, NOT dm-case: that name belongs to the collector's-case cards on
   the shelf (aspect-ratio 3/4, no border, no background), and sharing it made
   every case a 600px-tall unstyled box that pushed Play again off the screen. */
.dm-ruling {
  margin-bottom: 10px; padding: 11px 13px; border-radius: 12px;
  border: 1px solid rgb(var(--dm-glow) / .18);
  background: linear-gradient(180deg, rgba(28,24,18,.7), rgba(12,11,9,.7));
}
.dm-case-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  margin-bottom: 7px;
}
.dm-case-head strong { font-family: var(--dm-display); font-size: 15px; color: #f0e6d2; }
.dm-case-weight {
  font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
  padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  border: 1px solid rgb(var(--dm-glow) / .3); color: rgba(240,230,210,.6);
}
/* Louder the more it counted: a case that decided a fight should look like it. */
.dm-ruling[data-weight="2"] .dm-case-weight { color: var(--dm-gold); border-color: rgb(var(--dm-glow) / .55); }
.dm-ruling[data-weight="3"] .dm-case-weight {
  color: #17130a; background: var(--dm-gold); border-color: var(--dm-gold); font-weight: 700;
}
.dm-ruling[data-weight="0"] { opacity: .78; }
.dm-case-said {
  margin: 0 0 7px; padding-left: 10px;
  border-left: 2px solid rgb(var(--dm-glow) / .35);
  font-size: 13.5px; line-height: 1.5; color: rgba(240,230,210,.72);
}
.dm-case-note { margin: 0; font-size: 13.5px; line-height: 1.55; color: #e8dcc2; }

/* The one card the battle turned on.
   The only portrait left on this screen, now that both rosters are gone from
   it -- which is what makes it read as a distinction rather than as one more
   row in a list of eight. */
.dm-mvp {
  display: flex; align-items: center; gap: 18px;
  width: fit-content; margin: 24px auto 0; padding: 16px 24px 16px 16px;
  text-align: left; border-radius: 18px;
  border: 1px solid rgb(var(--dm-glow) / .28);
  background: linear-gradient(180deg, rgb(var(--dm-glow) / .1), rgb(var(--dm-glow) / .02));
  max-width: min(540px, 100%);
}
/* A card-shaped portrait at card proportions. The old one was a 58px stamp
   squeezed out of shape, which read as a favicon rather than as the fighter
   who decided the battle. */
.dm-mvp-face {
  flex: none; width: 104px; height: 130px; overflow: hidden;
  border-radius: 13px; border: 1px solid rgb(var(--dm-glow) / .32);
  background: #0c0b09;
}
.dm-mvp-face img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%; }
.dm-mvp-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dm-mvp-tag {
  font-family: var(--dm-display); font-size: 10px; letter-spacing: .2em;
  text-transform: uppercase; color: rgb(var(--dm-glow) / .75);
}
.dm-mvp-name {
  font-size: 22px; font-weight: 800; line-height: 1.2; color: var(--dm-gold);
}
.dm-mvp-note {
  margin: 5px 0 0; font-size: 14px; line-height: 1.5; color: var(--dm-dim);
}
@media (max-width: 560px) {
  /* Stacked on a phone: side by side, the portrait would have to shrink back
     to a stamp to leave the sentence any room. */
  .dm-mvp { flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 16px; }
  .dm-mvp-face { width: 96px; height: 120px; }
  .dm-mvp-text { align-items: center; }
  .dm-mvp-name { font-size: 20px; }
  .dm-mvp-note { font-size: 13.5px; }
}

/* One thing per line, each centred under the last: the winner, the reason,
   the card it turned on, the record, then the two ways out. They used to sit
   in pairs across the screen with nothing lining up. */
/* Your case, before the fight. Deliberately quiet: it is optional, and a box
   shouting for attention would make it feel required. */
.dm-argue {
  max-width: 560px; margin: 18px auto 0; padding: 16px 18px;
  text-align: left; border-radius: 14px;
  border: 1px solid var(--dm-line); background: var(--dm-panel);
}
.dm-argue-box {
  width: 100%; margin-top: 2px; padding: 10px 12px;
  border-radius: 10px; border: 1px solid var(--dm-line);
  background: rgba(0,0,0,.28); color: var(--dm-text);
  font: inherit; font-size: 14.5px; line-height: 1.55; resize: vertical;
}
.dm-argue-box:focus-visible { outline: 2px solid rgb(var(--dm-glow) / .5); outline-offset: 1px; }
.dm-argue-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; margin-top: 8px;
}

/* Checkbox filters under a picked universe. */
.dm-filters {
  margin: 14px 0 4px; padding: 12px 14px; border-radius: 12px;
  border: 1px solid var(--dm-line); background: var(--dm-panel);
  display: grid; gap: 8px; text-align: left;
}
.dm-filters legend { padding: 0 6px; }
.dm-filter {
  display: flex; align-items: flex-start; gap: 12px;
  min-height: 44px; padding: 8px 10px; border-radius: 10px;
  cursor: pointer; border: 1px solid transparent;
}
.dm-filter[data-on="1"] { border-color: rgb(var(--dm-glow) / .45); background: rgb(var(--dm-glow) / .07); }
.dm-filter input {
  width: 20px; height: 20px; margin: 2px 0 0; flex: none;
  accent-color: var(--dm-gold);
}
.dm-filter input:focus-visible { outline: 2px solid rgb(var(--dm-glow) / .6); outline-offset: 2px; }
.dm-filter-text { display: grid; gap: 2px; }
.dm-filter-text b { font-size: 15px; color: var(--dm-text); }
.dm-filter-text em { font-style: normal; font-size: 13px; color: var(--dm-dim); line-height: 1.4; }

.dm-verdict-actions {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  margin-top: 28px;
}
.dm-verdict-actions .dm-btn {
  width: min(340px, 100%); justify-content: center;
}
.dm-verdict-sides { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 26px; text-align: left; }
@media (min-width: 700px) { .dm-verdict-sides { grid-template-columns: 1fr 1fr; } }
.dm-verdict-side {
  padding: 16px; border-radius: 14px;
  border: 1px solid var(--dm-line); background: var(--dm-panel);
}
.dm-verdict-side[data-won="1"] {
  border-color: var(--dm-gold);
  background: linear-gradient(180deg, rgb(var(--dm-glow) / .11), transparent);
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
.dm-tag[data-kind="mvp"] { background: rgb(var(--dm-glow) / .2); color: var(--dm-gold-hot); }
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
  background: rgb(var(--dm-glow) / .18); color: var(--dm-gold); white-space: nowrap;
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

.dm-arena-pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: rgb(var(--dm-glow) / .14); color: var(--dm-gold); border: 1px solid rgb(var(--dm-glow) / .3); white-space: nowrap; }

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
  --dm-g-major:     #3b8fd4;
  --dm-g-legendary: #f0872e;
  --dm-g-exalted:   #d1541f;
  --dm-g-mythic:    #a855f7;
  --dm-g-uber:      #7ef9ff;
}

.dm-lot-variant[data-grade] {
  display: inline-flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  border: 1px solid currentColor;
}
.dm-lot-variant[data-grade="crippling"] { background: rgba(208,52,44,.94);  color: #fff; }
.dm-lot-variant[data-grade="weakening"] { background: rgba(232,145,140,.9); color: #2a0e0d; }
.dm-lot-variant[data-grade="neutral"]   { background: rgba(141,135,120,.85); color: #14130f; }
.dm-lot-variant[data-grade="boon"]      { background: rgba(76,175,125,.92); color: #05170f; }
.dm-lot-variant[data-grade="major"]     { background: rgba(59,143,212,.95);  color: #02101d; }
.dm-lot-variant[data-grade="legendary"] { background: rgba(240,135,46,.95);  color: #1d0d02; }
.dm-lot-variant[data-grade="exalted"] {
  background: rgba(209,84,31,.97); color: #fff5ee;
  border-color: #ffb98a;
  box-shadow: 0 0 0 1px rgba(255,185,138,.45), 0 3px 16px rgba(209,84,31,.4);
}
/* Polished platinum, with the light travelling across it.
   Every other grade on the ladder is a colour, so the top of it is deliberately
   NOT one — it is a metal. A rainbow reads as one more hue in a row of hues; a
   silver bar with a specular sweep reads as a different class of object, which
   is what an uber is. The sweep is a second layer over a fixed gradient rather
   than a moving background, so the metal stays put and only the highlight
   moves — a scrolling gradient looks like a loading bar, not like shine. */
.dm-lot-variant[data-grade="uber"] {
  position: relative;
  overflow: hidden;
  background: linear-gradient(103deg,
      #6d7688 0%, #aab4c4 14%, #f2f5fa 30%, #ffffff 38%,
      #c8d0dc 50%, #8f99ab 62%, #e6ebf3 78%, #b6c0cf 90%, #7c8698 100%);
  color: #14171c;
  border-color: #f4f7fb;
  text-shadow: 0 1px 0 rgba(255,255,255,.55);
  box-shadow:
    0 0 0 1px rgba(255,255,255,.75),
    0 2px 0 rgba(255,255,255,.35) inset,
    0 -2px 6px rgba(20,23,28,.25) inset,
    0 6px 28px rgba(198,214,236,.5);
}
/* The travelling highlight. */
.dm-lot-variant[data-grade="uber"]::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(103deg,
    transparent 38%, rgba(255,255,255,.15) 46%, rgba(255,255,255,.85) 50%,
    rgba(255,255,255,.15) 54%, transparent 62%);
  background-size: 260% 100%;
  animation: dm-uber-shine 3.6s ease-in-out infinite;
  pointer-events: none;
}
@keyframes dm-uber-shine {
  0%      { background-position: 150% 0; }
  55%,100%{ background-position: -60% 0; }
}
.dm-lot-variant[data-grade="uber"] .dm-grade-tag { opacity: .95; }

.dm-lot-variant[data-grade="mythic"] {
  background: linear-gradient(100deg, #6d28d9 0%, #a855f7 55%, #d8b4fe 100%);
  color: #fdf6ff;
  border-color: #e9d5ff;
  box-shadow: 0 0 0 1px rgba(233,213,255,.55), 0 4px 22px rgba(168,85,247,.5);
  animation: dm-mythic 2.6s ease-in-out infinite;
}
@keyframes dm-mythic {
  0%, 100% { filter: saturate(1) brightness(1); }
  50%      { filter: saturate(1.35) brightness(1.15); }
}
/* This block used to re-declare the whole uber rule, animation included, so
   "reduce motion" switched the animation back ON. It only turns things off. */
@media (prefers-reduced-motion: reduce) {
  .dm-lot-variant[data-grade="uber"]::after { animation: none; background-position: 50% 0; }
  .dm-lot-variant[data-grade="mythic"] { animation: none; }
  .dm-portrait-wrap[data-grade="uber"]::before { animation: none; }
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
.dm-grade-swatch[data-grade="exalted"]   { background: var(--dm-g-exalted);   color: #fff5ee; }
.dm-grade-swatch[data-grade="uber"] {
  background: linear-gradient(100deg, #ffd76f, #7ef9ff, #9b7bff); color: #0a0a0b;
}
.dm-grade-swatch[data-grade="mythic"] {
  background: linear-gradient(100deg, #a855f7, #d8b4fe); color: #2a0442;
}

/* ── Custom bid ───────────────────────────────────────────────────────────
   Sits under the quick steps. 16px input so iOS doesn't zoom on focus. */

.dm-custombid {
  display: flex; align-items: stretch; gap: 8px; margin-top: 10px;
  min-width: 0;
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
.dm-variant-note[data-grade="legendary"] { color: var(--dm-g-legendary); font-weight: 700; }
.dm-variant-note[data-grade="exalted"]   { color: var(--dm-g-exalted); font-weight: 800; }
.dm-variant-note[data-grade="uber"] { color: var(--dm-g-uber); font-weight: 800; letter-spacing: .02em; }
.dm-variant-note[data-grade="mythic"] {
  color: var(--dm-g-mythic); font-weight: 800; letter-spacing: .01em;
  text-shadow: 0 0 12px rgba(192,91,255,.5);
}

.dm-slot[data-grade="crippling"] { box-shadow: inset 0 0 0 2px var(--dm-g-crippling); }
.dm-slot[data-grade="weakening"] { box-shadow: inset 0 0 0 2px var(--dm-g-weakening); }
.dm-slot[data-grade="boon"]      { box-shadow: inset 0 0 0 2px var(--dm-g-boon); }
.dm-slot[data-grade="major"]     { box-shadow: inset 0 0 0 2px var(--dm-g-major); }
.dm-slot[data-grade="legendary"] { box-shadow: inset 0 0 0 2px var(--dm-g-legendary); }
.dm-slot[data-grade="exalted"]   { box-shadow: inset 0 0 0 2px var(--dm-g-exalted); }
.dm-slot[data-grade="uber"] { box-shadow: inset 0 0 0 2px var(--dm-g-uber), 0 0 18px rgba(126,249,255,.4); }
.dm-slot[data-grade="mythic"] {
  box-shadow: inset 0 0 0 2px #f0c860, 0 0 16px rgba(192,91,255,.55);
}

/* ── Pre-battle arguments ─────────────────────────────────────────────────
   Written blind, so this screen never renders the opponent's text until the
   ruling arrives and both are opened together. */

.dm-args { max-width: 720px; margin: 0 auto; }
.dm-args-roster {
  font-size: 13px; color: var(--dm-dim); margin: 12px 0 0;
  padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--dm-line); background: var(--dm-panel-2);
}
.dm-args-input {
  width: 100%; margin-top: 12px; padding: 12px 14px;
  border-radius: 12px; border: 1px solid var(--dm-line-hot);
  background: var(--dm-bg); color: var(--dm-text);
  font-size: 16px; /* iOS: anything smaller zooms on focus */
  font-family: inherit; line-height: 1.5; resize: vertical; outline: none;
}
.dm-args-input:focus { border-color: var(--dm-gold); }
.dm-args-actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.dm-args-count { font-size: 12px; color: var(--dm-mute); margin-right: auto; font-variant-numeric: tabular-nums; }
.dm-args-count[data-low="1"] { color: var(--dm-ember); }
.dm-args-sealed {
  margin-top: 14px; padding: 14px; border-radius: 12px; text-align: center;
  border: 1px solid var(--dm-gold); background: rgb(var(--dm-glow) / .08);
}
.dm-args-status { list-style: none; padding: 0; margin: 14px 0 0; display: flex; gap: 8px; flex-wrap: wrap; }
.dm-args-status li {
  font-size: 12px; padding: 5px 10px; border-radius: 999px;
  border: 1px solid var(--dm-line); color: var(--dm-mute);
}
.dm-args-status li[data-in="1"] { border-color: var(--dm-green); color: var(--dm-green); }

.dm-args-rulings { display: flex; flex-direction: column; gap: 12px; margin: 14px 0 18px; }
.dm-args-ruling {
  padding: 14px; border-radius: 13px;
  border: 1px solid var(--dm-line); background: var(--dm-panel-2);
}
.dm-args-ruling[data-me="1"] { border-color: var(--dm-gold); }
.dm-args-ruling-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.dm-args-sway { font-size: 12px; font-weight: 800; color: var(--dm-green); }
.dm-args-sway[data-zero="1"] { color: var(--dm-mute); }
.dm-args-quote {
  margin: 10px 0; padding-left: 12px; border-left: 2px solid var(--dm-line-hot);
  font-size: 14px; line-height: 1.5; color: var(--dm-text); font-style: italic;
}
.dm-args-claims { list-style: none; padding: 0; margin: 10px 0 0; display: flex; flex-direction: column; gap: 8px; }
.dm-args-claims li {
  display: grid; gap: 2px; padding: 9px 11px; border-radius: 10px;
  border-left: 3px solid var(--dm-g-neutral); background: var(--dm-panel);
}
.dm-args-claims li[data-ok="1"] { border-left-color: var(--dm-g-boon); }
.dm-args-claims li[data-ok="0"] { border-left-color: var(--dm-g-crippling); }
.dm-args-verdict {
  font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
  color: var(--dm-mute);
}
.dm-args-claims li[data-ok="1"] .dm-args-verdict { color: var(--dm-g-boon); }
.dm-args-claims li[data-ok="0"] .dm-args-verdict { color: var(--dm-g-crippling); }
.dm-args-claim { font-size: 14px; font-weight: 650; }
.dm-args-reason { font-size: 12.5px; color: var(--dm-dim); line-height: 1.45; }

/* A mode switch, not another option chip — it changes the shape of the game,
   so it gets a state dot and its own weight instead of sitting quietly at the
   bottom of the topic section where it was being missed entirely. */
.dm-contrib[data-immeasurable="1"] .dm-contrib-n {
  color: var(--dm-g-uber); font-weight: 800; letter-spacing: .02em;
}
.dm-contrib[data-immeasurable="1"] .dm-contrib-bar > i {
  background: linear-gradient(90deg, #ffd76f, #7ef9ff, #9b7bff);
}

.dm-toggle {
  width: 100%; margin-top: 14px; text-align: left;
  display: grid; grid-template-columns: auto 1fr; column-gap: 12px; align-items: center;
  padding: 14px 16px;
}
.dm-toggle::before {
  content: ""; grid-row: 1 / 3;
  width: 42px; height: 24px; border-radius: 999px;
  border: 1px solid var(--dm-line-hot); background: var(--dm-panel-2);
  position: relative; transition: background .18s ease, border-color .18s ease;
}
.dm-toggle::after {
  content: ""; position: absolute; margin-left: 5px;
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--dm-mute); transition: transform .18s ease, background .18s ease;
}
.dm-toggle[data-on="1"]::before { background: rgb(var(--dm-glow) / .22); border-color: var(--dm-gold); }
.dm-toggle[data-on="1"]::after { transform: translateX(18px); background: var(--dm-gold); }
.dm-toggle .dm-seg-label { grid-column: 2; }
.dm-toggle .dm-seg-note { grid-column: 2; }

/* ── Live auction: no title bar ───────────────────────────────────────────
   The wordmark is a title card. Once the draft is running you know what game
   you are in, and the bar was spending a full band of height — the widest
   thing on the screen — to tell you again. The two controls that did earn
   their place (mute, and the way out) lift out of the flow into the corner,
   which hands that whole band back to the table.

   Scoped with :has(.dm-stage), so the setup and prep screens keep the title. */

.dm:has(.dm-stage) .dm-wordmark,
.dm:has(.dm-stage) .dm-tagline { display: none; }
.dm:has(.dm-stage) .dm-head {
  position: absolute; top: 10px; right: 14px; z-index: 6;
  width: auto; margin: 0; gap: 6px;
  /* Only enough to clear the face, which is absolute at right: 24px. The
     shelf's 360px reserves room for the universe selector; this screen has
     no selector, and inheriting it pushed these two buttons over the top of
     the opponent's picks. */
  padding-right: 52px;
}
/* Lifting the controls out of the flow means nothing reserves their space, so
   the lot bar ran underneath them. This is the band they now occupy — ~50px
   against the ~120px the full title bar was taking. */
.dm:has(.dm-stage) { padding-top: 50px; }
.dm:has(.dm-stage) .dm-head-actions .dm-btn {
  min-height: 34px; padding: 6px 11px; font-size: 12.5px;
}
.dm:has(.dm-stage) .dm-head-actions .dm-btn-icon { min-width: 34px; padding: 6px; }

/* ── The stage header on a handset ──────────────────────────────────────────
   A phone has no corner to lift controls into. The mute button, the way out,
   the player's face and the lot's own title all landed inside the same 50px
   band above the table and printed over each other.

   So on a narrow screen the header stops being a header. The face and the way
   out are not controls for a draft that is RUNNING -- they are places to leave
   it -- and neither earns space over the auction. What is left is the one
   thing worth reading (which board, and where the fight happens) and the one
   control worth reaching for mid-bid. */
@media (max-width: 700px) {
  .dm:has(.dm-stage) { padding-top: 6px; }
  .dm:has(.dm-stage) .dm-head {
    position: absolute; top: 4px; right: 10px; z-index: 6;
    width: auto; margin: 0; padding: 0; gap: 4px;
  }
  /* The wordmark, the face, and the way out. All of them are exits. */
  .dm:has(.dm-stage) .dm-head > a:not(.dm-btn),
  .dm:has(.dm-stage) .dm-head-me,
  .dm:has(.dm-stage) .dm-head-actions .dm-btn:not(.dm-btn-icon) { display: none; }

  /* The board and the arena become the header, on their own two lines, with
     just enough room kept clear on the right for the mute. */
  .dm-lotbar {
    flex-wrap: wrap; row-gap: 4px; align-items: flex-start;
    padding-right: 44px; margin-bottom: 10px;
  }
  .dm-lotbar > span {
    min-width: 0; display: flex; flex-direction: column; align-items: flex-start;
    gap: 4px;
  }
  .dm-lotbar strong { font-size: 13.5px; }
  .dm-arena-pill {
    margin-left: 0 !important; max-width: 100%;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
}

/* min-height:100dvh measures the whole screen, but .dm starts below the site
   nav — so it reserved a screenful of empty scroll under the table. Let the
   content set the height at every width; the table is meant to be seen in one
   glance, and dead scroll under it invites you to go looking for more. */
.dm:has(.dm-stage) { min-height: 0; }
main.min-h-screen:has(.dm-stage) { min-height: 0; }

/* ── The other seat ───────────────────────────────────────────────────── */
.dm-seat-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 12px;
  border: 1px dashed var(--dm-line-hot); background: rgba(255,255,255,.02);
}
.dm-seat-card[data-filled="1"] {
  border-style: solid; border-color: rgba(212,175,95,.6); background: rgb(var(--dm-glow) / .08);
}
.dm-seat-face {
  flex: 0 0 38px; width: 38px; height: 38px; border-radius: 50%;
  display: grid; place-items: center;
  font-family: var(--dm-display); font-size: 15px; font-weight: 700; color: var(--dm-mute);
  border: 1px dashed var(--dm-line-hot); background: transparent;
}
.dm-seat-card[data-filled="1"] .dm-seat-face {
  border-style: solid; border-color: rgba(212,175,95,.5); color: var(--dm-gold);
  background: radial-gradient(circle at 50% 32%, #2b2b2b, #0e0e0e);
}
.dm-seat-who { flex: 1; min-width: 0; }
.dm-seat-who b { display: block; font-size: 14px; }
.dm-seat-who em { display: block; font-style: normal; font-size: 11.5px; color: var(--dm-mute); margin-top: 2px; }
.dm-seat-empty {
  font-size: 9.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
  color: var(--dm-mute);
}
.dm-seat-dot {
  width: 9px; height: 9px; border-radius: 50%; background: var(--dm-green); flex-shrink: 0;
  box-shadow: 0 0 0 4px rgba(91,189,138,.16);
}

/* ── Who writes it up ─────────────────────────────────────────────────── */
.dm-flavour {
  display: flex; align-items: flex-start; gap: 12px; margin-top: 14px;
  padding: 12px 14px; border-radius: 12px;
  border: 1px solid var(--dm-line); background: var(--dm-panel-2);
}
.dm-flavour-switch {
  flex: 0 0 42px; width: 42px; height: 24px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--dm-line-hot); background: rgba(255,255,255,.05);
  position: relative; padding: 0; transition: background .18s ease, border-color .18s ease;
}
.dm-flavour-switch[aria-checked="true"] {
  background: rgb(var(--dm-glow) / .28); border-color: rgba(212,175,95,.7);
}
.dm-flavour-knob {
  position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--dm-mute); transition: transform .18s cubic-bezier(.2,.8,.25,1), background .18s ease;
}
.dm-flavour-switch[aria-checked="true"] .dm-flavour-knob {
  transform: translateX(18px); background: var(--dm-gold-hot);
}
.dm-flavour-text { font-size: 11.5px; line-height: 1.55; color: var(--dm-mute); }
.dm-flavour-text b { display: block; font-size: 13px; color: var(--dm-text); margin-bottom: 3px; }

/* ── The universe, settled ────────────────────────────────────────────────
   Same shape as the seat card above it, because they are the two facts the
   host is waiting on: who is coming, and what they are drafting. */
.dm-room-board {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px; border-radius: 14px;
  border: 1px solid rgb(var(--dm-glow) / .22);
  background: linear-gradient(180deg, rgba(24,20,12,.7), rgba(10,10,10,.7));
  color: var(--dm-gold);
}
.dm-room-board-who { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 auto; }
.dm-room-board-who b {
  font-family: var(--dm-display); font-size: 17px; letter-spacing: .01em;
  color: #f0e6d2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dm-room-board-who em { font-style: normal; font-size: 12.5px; color: rgba(240,230,210,.5); }

/* ── The small pages ──────────────────────────────────────────────────────
   Friends, the ladder and your record. One column, generous rows, and no
   controls that are not doing something -- these are pages you glance at on
   the way back to a draft, not places to spend time. */
.dm-small-page { max-width: 640px; margin: 0 auto; }
.dm-sub { margin-top: 22px; }

.dm-add-row { display: flex; gap: 8px; margin-bottom: 6px; }
.dm-add-row .dm-input { flex: 1 1 auto; }
.dm-add-note { margin: 0 0 14px; }
.dm-empty { margin-top: 18px; line-height: 1.6; }
.dm-empty a { color: var(--dm-gold); }

.dm-friend, .dm-rank {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 13px; margin-top: 8px; border-radius: 13px;
  border: 1px solid var(--dm-line);
  background: linear-gradient(180deg, #1a1710, var(--dm-panel));
}
.dm-friend-face {
  position: relative; flex: 0 0 auto; overflow: hidden;
  width: 38px; height: 38px; border-radius: 50%;
  display: grid; place-items: center;
  border: 1px solid rgb(var(--dm-glow) / .35);
  background: radial-gradient(circle at 50% 32%, #2b2620, #0e0d0b);
  font-family: var(--dm-display); color: var(--dm-gold); font-size: 15px;
}
.dm-friend-face img { width: 100%; height: 100%; object-fit: cover; }
/* A dot rather than a word: online is a state, not an announcement. */
.dm-friend-face[data-online="1"]::after {
  content: ""; position: absolute; right: -1px; bottom: -1px;
  width: 11px; height: 11px; border-radius: 50%;
  background: var(--dm-green); border: 2px solid #0e0d0b;
}
.dm-friend-who, .dm-rank-who { display: flex; flex-direction: column; gap: 2px; flex: 1 1 auto; min-width: 0; }
.dm-friend-who b, .dm-rank-who b {
  font-family: var(--dm-display); font-size: 15px; color: #f0e6d2;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dm-friend-who em, .dm-rank-who em {
  font-style: normal; font-size: 12.5px; color: rgba(240,230,210,.48);
  font-variant-numeric: tabular-nums;
}

.dm-rank[data-me="1"] { border-color: rgb(var(--dm-glow) / .45); background: linear-gradient(180deg, #241f14, #12100c); }
.dm-rank-n {
  flex: 0 0 34px; text-align: center;
  font-family: var(--dm-display); font-size: 15px; color: rgb(var(--dm-glow) / .6);
  font-variant-numeric: tabular-nums;
}
.dm-rank-rating {
  flex: 0 0 auto; font-family: var(--dm-display); font-size: 19px;
  color: var(--dm-gold); font-variant-numeric: tabular-nums;
}

.dm-you-rating { text-align: center; margin: 18px 0 4px; }
.dm-you-rating b {
  display: block; font-family: var(--dm-display); font-size: 56px; line-height: 1;
  color: var(--dm-gold); font-variant-numeric: tabular-nums;
}
.dm-you-rating em {
  font-style: normal; font-size: 11px; letter-spacing: .2em; text-transform: uppercase;
  color: rgba(240,230,210,.4);
}
.dm-you-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 22px;
}
.dm-you-grid span {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 14px 6px; border-radius: 12px;
  border: 1px solid var(--dm-line);
  background: linear-gradient(180deg, #1a1710, var(--dm-panel));
}
.dm-you-grid b {
  font-family: var(--dm-display); font-size: 24px; color: #f0e6d2;
  font-variant-numeric: tabular-nums;
}
.dm-you-grid em {
  font-style: normal; font-size: 10.5px; letter-spacing: .12em;
  text-transform: uppercase; color: rgba(240,230,210,.4);
}
.dm-you-links { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 26px; }

/* ── The face in the corner ───────────────────────────────────────────── */
.dm-head-me {
  flex: 0 0 auto; margin-left: auto; display: grid; place-items: center; overflow: hidden;
  width: 38px; height: 38px; border-radius: 50%; text-decoration: none;
  border: 1px solid rgba(212,175,95,.5);
  background: radial-gradient(circle at 50% 32%, #2b2b2b, #0e0e0e);
  color: var(--dm-gold); font-family: var(--dm-display); font-size: 15px; font-weight: 700;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.dm-head-me:hover { border-color: var(--dm-gold); box-shadow: 0 0 18px rgb(var(--dm-glow) / .35); }
.dm-head-me img { width: 100%; height: 100%; object-fit: cover; }

/* On a wide screen the universe selector joins it in the top bar, which is
   where the design puts it — the shelf below is then nothing but the case. */
@media (min-width: 900px) {
  /* Both pinned to the corner so they sit in a fixed order — selector, then
     face — instead of floating wherever the header's flexbox leaves them. */
  .dm-shelf-head { position: absolute; top: 20px; right: 82px; z-index: 25; margin: 0; }
  .dm-head-me { position: absolute; top: 20px; right: 24px; z-index: 26; }
  .dm-head { padding-right: 360px; }
}

/* ── The shelf's foot ─────────────────────────────────────────────────────
   One case at a time means nothing peeks at the edge, so nothing says a second
   case exists. These do. */

.dm-carousel {
  display: flex; align-items: center; justify-content: center; gap: 18px;
  margin-top: 6px;
}
/* Bare chevrons. A ring around each one made two more objects competing with
   the case, which is the only thing on this screen worth looking at. */
.dm-carousel-arrow {
  display: grid; place-items: center; width: 32px; height: 32px;
  border: 0; background: none; padding: 0;
  color: var(--dm-mute); cursor: pointer;
  transition: color .15s ease, transform .15s ease;
}
.dm-carousel-arrow:hover { color: var(--dm-gold-hot); }
.dm-carousel-arrow[data-dir="back"]:hover { transform: translateX(-2px); }
.dm-carousel-arrow[data-dir="next"]:hover { transform: translateX(2px); }
.dm-carousel-arrow[data-dir="back"] svg { transform: rotate(90deg); }
.dm-carousel-arrow[data-dir="next"] svg { transform: rotate(-90deg); }

.dm-carousel-dots {
  display: flex; align-items: center; gap: 7px;
  max-width: min(340px, 52vw); overflow-x: auto; scrollbar-width: none; padding: 6px 2px;
}
.dm-carousel-dots::-webkit-scrollbar { display: none; }
.dm-carousel-dot {
  flex: 0 0 auto; width: 6px; height: 6px; padding: 0; border: 0; border-radius: 50%;
  background: rgba(255,255,255,.2); cursor: pointer;
  transition: background .2s ease, transform .2s ease, box-shadow .2s ease;
}
.dm-carousel-dot:hover { background: rgba(255,255,255,.4); }
.dm-carousel-dot[aria-selected="true"] {
  background: var(--dm-gold); transform: scale(1.45);
  box-shadow: 0 0 10px rgb(var(--dm-glow) / .7);
}

.dm-shelf-count {
  margin: 10px 0 0; text-align: center;
  font-size: 12px; letter-spacing: .04em; color: var(--dm-mute);
}

/* ── The rail ─────────────────────────────────────────────────────────────
   The desktop half of the same three destinations. A wide screen has room
   going spare down the sides and nothing to put there, and using it keeps the
   middle clear for the case — which is the only thing on this screen that is
   supposed to be looked at. */

.dm-rail { display: none; }

@media (min-width: 900px) {
  .dm-rail {
    /* Tall on purpose: a short pill floating in a full-height column reads as
       something that came loose. It runs most of the window and the support
       link sits at the foot of it, set apart by a spacer that grows. */
    position: fixed; left: 18px; top: 50%; transform: translateY(-50%); z-index: 30;
    height: min(78vh, 620px);
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 16px 9px; border-radius: 22px;
    border: 1px solid var(--dm-line); background: rgba(18,18,20,.82);
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 44px rgba(0,0,0,.55);
  }
  .dm-rail-gap { flex: 1 1 auto; }
  /* A hairline above the last item, so support reads as separate from the
     places you can go rather than a fifth one. */
  .dm-rail-gap::after {
    content: ""; display: block; height: 1px; margin: 0 6px;
    background: var(--dm-line);
    position: relative; top: 100%;
  }
  .dm-rail-item {
    display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px;
    color: var(--dm-mute); text-decoration: none;
    transition: color .15s ease, background .15s ease;
  }
  .dm-rail-item:hover { color: var(--dm-gold-hot); background: rgb(var(--dm-glow) / .1); }
  .dm-rail-item[data-on="1"] { color: var(--dm-gold-hot); background: rgb(var(--dm-glow) / .14); }
  /* The label only exists for a screen reader and a hover title — the rail is
     four icons wide and a caption under each would double its width. */
  .dm-rail-item span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

  /* The rail takes the left margin, so the page stops fighting it. */
  .dm:has(.dm-rail) { padding-left: 96px; }
}

/* ── The custom sheet, and the bottom bar ──────────────────────────────────
   Picking the Custom case opens a sheet: up to five franchises, dealt into one
   pool. There is no text box any more — arenas are declared per board and
   rolled per game, so a typed sentence never changed what a board did. */

.dm-sheet-scrim {
  position: fixed; inset: 0; z-index: 80;
  display: grid; place-items: end center;
  background: rgba(4,4,5,.72); backdrop-filter: blur(3px);
  padding: 0;
}
@media (min-width: 720px) { .dm-sheet-scrim { place-items: center; padding: 24px; } }

.dm-cusheet {
  width: min(560px, 100%); max-height: min(86dvh, 760px);
  display: flex; flex-direction: column; gap: 12px;
  padding: 16px 16px 18px;
  background: var(--dm-panel); border: 1px solid var(--dm-line);
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -18px 60px rgba(0,0,0,.7);
}
@media (min-width: 720px) { .dm-cusheet { border-radius: 18px; } }

.dm-cusheet-head { display: flex; align-items: center; justify-content: space-between; }
.dm-cusheet-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.dm-cuchip {
  display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
  padding: 6px 11px; border-radius: 999px; font: inherit; font-size: 12px; font-weight: 700;
  border: 1px solid rgba(212,175,95,.55); background: rgb(var(--dm-glow) / .1);
  color: var(--dm-gold-hot);
}
.dm-cuchip svg { opacity: .7; }
.dm-cuchip:hover { border-color: var(--dm-gold); }

.dm-usel-search {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 13px; border-radius: 12px;
  border: 1px solid var(--dm-line); background: var(--dm-panel-2);
}
.dm-usel-search svg { color: var(--dm-mute); flex-shrink: 0; }
.dm-usel-search input {
  flex: 1; min-width: 0; border: 0; background: none; outline: none;
  color: var(--dm-text); font: inherit; font-size: 14px;
}
.dm-usel-search input::placeholder { color: var(--dm-mute); }

.dm-cusheet-list {
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 2px;
  margin: 0 -4px; padding: 0 4px;
}
.dm-usel-row {
  display: flex; align-items: center; gap: 11px; width: 100%;
  padding: 8px 10px; border-radius: 11px; cursor: pointer;
  border: 1px solid transparent; background: none; color: inherit; font: inherit;
  text-align: left; transition: background .15s ease, border-color .15s ease;
}
.dm-usel-row:hover { background: rgba(255,255,255,.04); }
.dm-usel-row[data-on="1"] { background: rgb(var(--dm-glow) / .1); border-color: rgba(212,175,95,.5); }
/* At the cap, the ones you have not chosen stop inviting a tap. */
.dm-usel-row[data-off="1"] { opacity: .38; cursor: not-allowed; }
.dm-usel-chip {
  position: relative; width: 34px; height: 43px; border-radius: 6px; overflow: hidden;
  flex-shrink: 0; border: 1px solid rgba(212,175,95,.4); background: #08070a;
}
.dm-usel-chip svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.dm-usel-text { flex: 1; min-width: 0; }
.dm-usel-text b { display: block; font-size: 14px; font-weight: 650; }
.dm-usel-text em {
  display: block; font-style: normal; font-size: 11.5px; color: var(--dm-mute); margin-top: 2px;
}
.dm-usel-add {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
  display: grid; place-items: center; font-size: 13px; line-height: 1;
  border: 1px solid var(--dm-line-hot); color: var(--dm-mute);
}
.dm-usel-row[data-on="1"] .dm-usel-add { border-color: rgba(212,175,95,.6); color: var(--dm-gold-hot); }

.dm-cusheet-foot { margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--dm-mute); }
.dm-cusheet-go { width: 100%; }
.dm-sheet-x {
  display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid var(--dm-line); background: none; color: var(--dm-mute); cursor: pointer;
}
.dm-sheet-x:hover { color: var(--dm-text); border-color: var(--dm-line-hot); }

/* ── The bottom bar ───────────────────────────────────────────────────────
   Three, not four. A "Packs" tab would point at the screen you are already
   on, which is a button that does nothing. */
/* Phones only. On a wide screen these three live in the left rail. */
@media (min-width: 900px) { .dm-tabs { display: none !important; } }

.dm-tabs {
  position: sticky; bottom: 0; z-index: 20;
  display: grid; grid-template-columns: repeat(3, 1fr);
  margin: 26px -14px 0; padding: 9px 6px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--dm-line); background: rgba(8,8,10,.94);
  backdrop-filter: blur(8px);
}
.dm-tab {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
  color: var(--dm-mute); text-decoration: none; padding: 4px 0;
  transition: color .15s ease;
}
.dm-tab:hover { color: var(--dm-gold-hot); }
@media (min-width: 720px) { .dm-tabs { margin-left: 0; margin-right: 0; border-radius: 14px 14px 0 0; } }

/* ── The line-up ───────────────────────────────────────────────────────────
   Between the draft and the fight. The row is the order they fight in; the
   captain sits below and behind it, because that is literally where they
   stand. More picks is more squares and nothing else changes. */

.dm-lineup { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 4px 0 28px; }
.dm-lineup-top {
  width: 100%; display: flex; align-items: flex-start; justify-content: space-between;
  gap: 18px; flex-wrap: wrap;
}
.dm-blind {
  display: flex; align-items: flex-start; gap: 10px; flex: 1 1 260px;
  padding: 11px 13px; border-radius: 11px;
  border: 1px dashed var(--dm-line-hot); background: rgba(255,255,255,.02);
}
.dm-blind svg { width: 16px; height: 16px; flex: 0 0 16px; color: var(--dm-mute); margin-top: 1px; }
.dm-blind span { font-size: 11.5px; line-height: 1.55; color: var(--dm-mute); }
.dm-blind b { color: var(--dm-dim); }

.dm-lineup-clock { display: flex; align-items: center; gap: 11px; }
.dm-ring { position: relative; width: 46px; height: 46px; flex-shrink: 0; }
.dm-ring svg { transform: rotate(-90deg); }
.dm-ring .bg { stroke: rgba(255,255,255,.09); }
.dm-ring .fg { stroke: var(--dm-gold); stroke-linecap: round; transition: stroke-dasharray 1s linear; }
.dm-ring b {
  position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 13px; font-weight: 800; color: var(--dm-gold-hot);
}
.dm-lineup-clock p { margin: 0; font-size: 11px; line-height: 1.5; color: var(--dm-mute); max-width: 30ch; }
.dm-lineup-clock p b { display: block; color: var(--dm-dim); font-weight: 700; }
.dm-lineup-label { margin: 4px 0 0; }

/* ── the cards ─────────────────────────────────────────────────────────── */
.dm-row4 { display: flex; gap: 16px; justify-content: center; align-items: flex-end;
  flex-wrap: wrap; touch-action: none; }

/* Same 4:5 as the lot card, so a card is a card everywhere in this game. */
.dm-lc {
  --notch: 12px;
  position: relative; width: clamp(112px, 21vw, 152px); aspect-ratio: 4 / 5;
  padding: 1.5px; cursor: grab; touch-action: none;
  transition: transform .26s cubic-bezier(.2,.9,.25,1), filter .2s ease;
}
/* The brass frame is a layer, not the element. Clipping the element itself
   also clipped the order medallion and the crown, both of which are supposed
   to hang off the edge. */
.dm-lc::before {
  content: ""; position: absolute; inset: 0; z-index: 0;
  clip-path: polygon(var(--notch) 0, calc(100% - var(--notch)) 0, 100% var(--notch),
    100% calc(100% - var(--notch)), calc(100% - var(--notch)) 100%, var(--notch) 100%,
    0 calc(100% - var(--notch)), 0 var(--notch));
  background: linear-gradient(150deg, #c9a558, #7a5a24 34%, #e8cd82 58%, #7a5a24 82%, #c9a558);
}
.dm-lc:hover { transform: translateY(-5px); filter: brightness(1.08); }
/* No rotation on a card you are holding — a tilt reads as a glitch, not
   as weight. Lift and light instead. */
.dm-lc[data-held="1"] {
  cursor: grabbing; transform: translateY(-12px) scale(1.04);
  filter: brightness(1.2);
  box-shadow: 0 0 0 2px rgba(240,220,160,.55), 0 0 44px rgb(var(--dm-glow) / .55);
}
.dm-lc-in {
  --notch: 11px; position: absolute; inset: 1.5px; z-index: 1; overflow: hidden; background: #08070a;
  clip-path: polygon(var(--notch) 0, calc(100% - var(--notch)) 0, 100% var(--notch),
    100% calc(100% - var(--notch)), calc(100% - var(--notch)) 100%, var(--notch) 100%,
    0 calc(100% - var(--notch)), 0 var(--notch));
}
.dm-lc-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; }
.dm-lc-veil {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(6,5,8,.06) 42%, rgba(6,5,8,.66) 70%, rgba(6,5,8,.97));
}
/* Bottom padding clears the order medallion, which rides half-off the edge. */
.dm-lc-txt { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 8px 19px; text-align: center; }
.dm-lc-txt b { display: block; font-size: 12px; font-weight: 700; line-height: 1.2; text-wrap: balance; }
.dm-lc-txt i {
  display: block; font-style: normal; font-size: 12px; color: var(--dm-gold-hot);
  margin-top: 3px; font-weight: 800;
}
.dm-lc-txt s {
  display: block; text-decoration: none; font-size: 8.5px; color: var(--dm-mute);
  margin-top: 2px; letter-spacing: .12em; text-transform: uppercase; font-weight: 800;
}
/* The order number rides the bottom edge, half on the card and half off it, so
   the row reads as a sequence before you have read a single name. */
.dm-lc-pos {
  position: absolute; left: 50%; bottom: -13px; translate: -50% 0; z-index: 3;
  width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
  font-family: var(--dm-display); font-size: 13px; font-weight: 700; color: #1a1207;
  background: linear-gradient(180deg, #f6e3ae, #d0a95a 60%, #a17f2e);
  box-shadow: 0 3px 10px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,250,230,.7);
}
.dm-lc-promote {
  position: absolute; left: 50%; top: -11px; translate: -50% 0; z-index: 4;
  padding: 4px 10px; border-radius: 999px; cursor: pointer;
  border: 1px solid rgba(212,175,95,.5); background: rgba(10,9,8,.92);
  color: var(--dm-gold); font-family: inherit; font-size: 9px; font-weight: 800;
  letter-spacing: .08em; text-transform: uppercase;
  opacity: 0; transition: opacity .18s ease;
}
.dm-lc:hover .dm-lc-promote, .dm-lc:focus-within .dm-lc-promote { opacity: 1; }

/* The bracket that says the captain is standing BEHIND the line. */
.dm-behind { position: relative; width: min(100%, 520px); height: 26px; }
.dm-behind::before {
  content: ""; position: absolute; left: 12%; right: 12%; top: 0; height: 26px;
  border: 1px solid rgba(212,175,95,.28); border-top: 0; border-radius: 0 0 14px 14px;
}
.dm-behind span {
  position: absolute; left: 50%; top: 50%; translate: -50% -50%; padding: 2px 10px;
  background: var(--dm-bg); font-size: 8.5px; font-weight: 800; letter-spacing: .18em;
  text-transform: uppercase; color: var(--dm-gold); opacity: .85;
}

/* margin-top clears the "behind the line" bracket, which the crown rides into. */
.dm-capwrap { display: flex; flex-direction: column; align-items: center; gap: 11px; margin-top: 14px; }
.dm-lc-cap {
  --notch: 15px; width: clamp(148px, 26vw, 190px); cursor: default;
  background: linear-gradient(150deg, #fbf0c8, #d9b26a 22%, #8a6a24 42%, #fbf0c8 60%, #8a6a24 80%, #e5c473);
}
.dm-lc-cap:hover { transform: none; }
.dm-lc-cap::before {
  content: ""; position: absolute; left: 50%; top: 52%; translate: -50% -50%;
  width: 150%; aspect-ratio: 1; z-index: -1; filter: blur(20px); clip-path: none;
  background: radial-gradient(circle, rgb(var(--dm-glow) / .34), rgba(5,5,5,0) 66%);
}
.dm-lc-crown {
  position: absolute; left: 50%; top: -14px; translate: -50% 0; z-index: 3;
  width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: #1a1207;
  background: linear-gradient(180deg, #f6e3ae, #d0a95a 60%, #a17f2e);
  box-shadow: 0 3px 12px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,250,230,.7);
}
.dm-cmdbar {
  max-width: 460px; text-align: center; padding: 10px 14px; border-radius: 11px;
  background: rgba(255,255,255,.03); border: 1px solid var(--dm-line);
  font-size: 11.5px; line-height: 1.55; color: var(--dm-dim);
}
/* A captain with a COMMAND ability is doing something the others cannot, so it
   is not painted in the same colour as a default aura. */
.dm-cmdbar[data-command="1"] {
  background: rgba(168,148,255,.09); border-color: rgba(168,148,255,.26); color: #c9bcff;
}
.dm-cmdbar b {
  display: block; font-weight: 800; letter-spacing: .04em; margin-bottom: 3px;
  font-family: var(--dm-display); font-size: 13px; color: var(--dm-text);
}
.dm-cmdbar[data-command="1"] b { color: #e2dcff; }

.dm-lineup-them {
  margin: 6px 0 0; font-size: 10px; font-weight: 800; letter-spacing: .16em;
  text-transform: uppercase; color: var(--dm-mute); text-align: center;
}
.dm-hidden-team { display: flex; gap: 6px; margin-top: 8px; justify-content: center; }
.dm-hidden-team i {
  width: 34px; aspect-ratio: 4 / 5; border-radius: 6px; display: grid; place-items: center;
  border: 1px dashed rgba(255,255,255,.14); color: var(--dm-mute); font-size: 13px; font-style: normal;
  background: repeating-linear-gradient(-45deg, rgba(255,255,255,.02) 0 5px, transparent 5px 10px);
}
.dm-lineup-go { width: min(320px, 100%); margin-top: 6px; }

/* ── The case ──────────────────────────────────────────────────────────────
   A board, as an object you would own. Replaces the foil pouch.

   Everything inside .dm-case-face is on the turned plane because the face is
   turned and they are its children — so the cover photo simply fills it, the
   title sets normally, and the octagon is cut once and reused by every layer,
   which is why none of it needs aligning by hand. */

/* One slot per case, each a full screen wide, centring what it holds. This is
   what keeps exactly one case visible at any width — putting the flex-basis on
   the case itself made the case a screen wide instead.

   Named dm-case-slot, not dm-slot: that one has been the auction roster's pick
   slot since long before this, and it carries aspect-ratio 3/4 — which turned
   a 1180px-wide shelf into a 1573px-tall one. */
.dm-case-slot {
  flex: 0 0 100%;
  display: grid; place-items: center;
  scroll-snap-align: center;
}

.dm-case {
  --notch: 26px;          /* the 45deg corner cut */
  --depth: 22px;          /* how thick the box is */
  --frame: 2.5px;         /* the brass edge */
  position: relative;
  flex: none;
  width: var(--case-w);
  aspect-ratio: 3 / 4;
  perspective: 1100px;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* The light behind it. A radial gradient has no edges to give away — a
   drop-shadow traces the bounding box and reads as a rectangle on hover. */
/* A tight rim, and only a rim. Anything wider is clipped square by the deck's
   scroll container, which is what put a hard line across the page. The wide
   ambience is on the canvas now -- see Motes.tsx. */
.dm-case::before {
  content: "";
  position: absolute; z-index: 0;
  left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 118%; height: 113%;
  background:
    radial-gradient(closest-side, rgb(var(--dm-glow) / .38) 0%, rgb(var(--dm-glow) / .1) 52%, rgba(5,5,5,0) 80%),
    radial-gradient(52% 26% at 50% 88%, rgba(0,0,0,.9) 0%, rgba(0,0,0,0) 76%);
  filter: blur(15px);
  opacity: 1;
  transition: opacity .35s ease, transform .35s ease;
}

/* Dust in the light. Two drifting layers of specks, offset in size, speed and
   direction so they never read as a repeating tile — the case is lit, and lit
   things have something floating in front of them. */
/* The ambient field. Fixed to the viewport, behind everything, and drawn by
   Motes.tsx rather than by a stack of gradients — see the note in that file
   for why the CSS version had to go. */
.dm-motes-field {
  position: fixed; inset: 0; z-index: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}
/* Above the field. The rail and the tab bar are position:fixed already, so
   they take the z-index and MUST NOT be given a position of their own --
   setting them to relative drops both into flow and pushes the page down the
   screen. (No backticks in this file: the sheet is one template literal and a
   backtick in a comment still closes it.) */
/* NO z-index. A stacking context here seals the wordmark's screen blend off
   from the page background and the mark renders as a black box -- see
   Wordmark.tsx. Ordering is fine without one: the canvas is the first child,
   so everything after it paints above it anyway. */
.dm-shell { position: relative; }
.dm-tabs, .dm-rail { z-index: 30; }

.dm-case[data-on="1"]::before,
.dm-case:hover::before { transform: translate(-50%, -50%) scale(1.06); }

.dm-case-3d {
  position: absolute; inset: 0;
  transform-style: preserve-3d;
  transform: rotateY(-13deg) rotateX(2deg);
  transition: transform .45s cubic-bezier(.2,.8,.25,1);
}
/* Chosen shows in the light, not the size — a case that grows when you pick
   it makes the shelf jump every time you swipe. */
.dm-case[data-on="1"] .dm-case-3d { transform: rotateY(-13deg) rotateX(2deg); }

/* One octagon, reused, so the layers cannot disagree about the shape. */
.dm-case-face, .dm-case-plate, .dm-case-rule {
  clip-path: polygon(
    var(--notch) 0, calc(100% - var(--notch)) 0,
    100% var(--notch), 100% calc(100% - var(--notch)),
    calc(100% - var(--notch)) 100%, var(--notch) 100%,
    0 calc(100% - var(--notch)), 0 var(--notch));
}

/* The brass edge IS the face; the plate sits on top inset by the frame width,
   which leaves a metal rim of exactly that thickness. */
.dm-case-face {
  position: absolute; inset: 0;
  box-shadow: 0 0 26px rgb(var(--dm-glow) / .45), 0 22px 50px rgba(0,0,0,.75);
  background: linear-gradient(146deg,
    #f6e3ae 0%, #d9b26a 15%, #7a5a24 30%, #d9b26a 45%,
    #fbf0c8 57%, #d9b26a 70%, #7a5a24 86%, #e5c473 100%);
}
.dm-case-plate {
  position: absolute; inset: var(--frame);
  --notch: 18px;
  overflow: hidden;
  background: radial-gradient(120% 92% at 50% 116%, #17120b 0%, #08070a 58%), #08070a;
}
/* A portrait under a soft scrim comes out milky. Pushed harder: most of the
   colour out, the brass put back through sepia, and the whole thing dropped
   and hardened so it reads as artwork on a dark plate rather than a photo
   somebody faded. */
/* The cover is a DRAWN scene, not a photograph.
   It was carrying a photo treatment — grayscale, sepia, brightness .5 — which
   is right for a bright press shot and ruinous for artwork already drawn in
   near-black and brass. It crushed the throne, the skyline and every other
   scene into a flat dark rectangle, which is why the art looked missing. The
   scenes ship in the palette already; they need showing, not correcting. */
.dm-case-cover {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  opacity: 1;
}
/* Dark at the top so the title reads, clear at the bottom so the art does. */
/* Dark at the top so the title reads, open across the middle so the art
   does, and a floor at the bottom so DRAFT is sitting on something. A vignette
   pulls the corners in — without it the plate's edges glow and the octagon
   stops looking cut. */
.dm-case-scrim {
  position: absolute; inset: 0;
  background:
    linear-gradient(180deg,
      rgba(6,5,8,.88) 0%, rgba(6,5,8,.62) 26%,
      rgba(6,5,8,.06) 52%, rgba(6,5,8,.34) 82%, rgba(6,5,8,.72) 100%),
    radial-gradient(84% 66% at 50% 46%, transparent 52%, rgba(6,5,8,.5) 100%),
    radial-gradient(60% 34% at 50% 24%, rgb(var(--dm-glow) / .16), transparent 70%);
}
.dm-case-rule {
  position: absolute; inset: 12px; --notch: 16px;
  border: 1px solid rgb(var(--dm-glow) / .34);
  pointer-events: none;
}

/* The side and the lid: what make it a box rather than a card. */
.dm-case-side {
  position: absolute; top: var(--notch); right: 0; bottom: var(--notch);
  width: var(--depth);
  transform-origin: right center; transform: rotateY(90deg);
  background: linear-gradient(90deg, #6b5423 0%, #2a2114 34%, #120d08 72%, #0a0705 100%);
  box-shadow: inset 2px 0 0 rgba(240,220,160,.75), inset -2px 0 0 rgba(122,90,36,.7);
}
.dm-case-top {
  position: absolute; top: 0; left: var(--notch); right: var(--notch);
  height: var(--depth);
  transform-origin: center top; transform: rotateX(-90deg);
  background: linear-gradient(180deg, #7d6229 0%, #3a2f1c 38%, #16110a 78%, #0b0805 100%);
  box-shadow: inset 0 2px 0 rgba(240,220,160,.7);
}

/* Content lays out normally, because the plane is already turned. */
.dm-case-body {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center;
  padding: 11% 10% 0; text-align: center;
}
.dm-case-crest { color: rgb(var(--dm-glow) / .95); margin-bottom: 12px; flex-shrink: 0; }
.dm-case-name {
  margin: 0; font-family: var(--dm-display); font-weight: 700;
  font-size: clamp(21px, 5.4vw, 30px); line-height: 1.04; letter-spacing: .04em;
  text-transform: uppercase; color: #f8efd8; text-wrap: balance;
  text-shadow: 0 0 22px rgb(var(--dm-glow) / .5), 0 2px 8px rgba(0,0,0,.9);
}
.dm-case-blurb {
  margin: 12px 0 0; font-size: 12.5px; line-height: 1.5;
  color: rgba(246,242,234,.9); max-width: 24ch; text-wrap: balance;
  text-shadow: 0 2px 8px rgba(0,0,0,.95);
}
/* DRAFT is on the object. Choosing a universe and starting a game are the
   same gesture, which is the whole point of the redesign. */
.dm-case-draft {
  margin-top: auto; margin-bottom: 11%;
  padding: 12px 34px; border-radius: 999px;
  border: 2px solid #e8cd82;
  background: linear-gradient(180deg, #8a6c20 0%, #4a390f 55%, #2c2109 100%);
  color: #ffeec2; font-family: var(--dm-display);
  font-size: 13px; font-weight: 700; letter-spacing: .3em; text-indent: .3em;
  box-shadow: 0 0 20px rgb(var(--dm-glow) / .5), inset 0 1px 0 rgba(255,244,205,.45);
  text-shadow: 0 1px 3px rgba(0,0,0,.7);
  cursor: pointer; transition: box-shadow .22s ease, border-color .22s ease;
}
.dm-case-draft:hover {
  border-color: #fff3cb;
  box-shadow: 0 0 34px rgb(var(--dm-glow) / .75), inset 0 1px 0 rgba(255,244,205,.6);
}

/* Custom has no cover art, because its contents do not exist yet. */
.dm-case-multiverse {
  position: absolute; inset: 0;
  background:
    radial-gradient(42% 34% at 32% 30%, rgba(120,90,220,.5), transparent 70%),
    radial-gradient(38% 30% at 70% 62%, rgba(40,150,190,.45), transparent 72%),
    radial-gradient(50% 40% at 50% 90%, rgb(var(--dm-glow) / .3), transparent 72%),
    #0a0812;
}



/* ── Arena layout (desktop only) ───────────────────────────────────────────
   A poker table. The two players face each other across the middle, each
   one's drafted picks laid out on the edge in front of them, and the auction
   itself — lot, price, controls, ticker — in the centre.

       ┌───────────── their picks ─────────────┐
       │  your  │   the lot + the bids   │ their │
       │  seat  │       the ticker       │ seat  │
       └───────────── your picks ──────────────┘

   Everything here is additive and lives behind min-width: 1024px, so the
   phone layout above is untouched. It works by collapsing the rail wrappers
   with display:contents, which promotes each side's seat and roster to
   direct grid items of .dm-stage — no second DOM tree, no JS breakpoint.

   Gated on data-arena="1" (exactly two sides) because the named areas can
   only seat two; any other count falls back to the stacked rail. */

@media (min-width: 1024px) and (orientation: landscape) {
  .dm-stage[data-arena="1"] {
    grid-template-columns: minmax(196px, 248px) minmax(420px, 1fr) minmax(196px, 248px);
    grid-template-areas:
      "roster-top    roster-top    roster-top"
      "seat-left     center        seat-right"
      "roster-bottom roster-bottom roster-bottom";
    gap: 16px 26px;
    align-items: start;
  }

  .dm-stage[data-arena="1"] > .dm-stage-main { grid-area: center; min-width: 0; }

  /* Unwrap the rail so its parts can take their seats at the table. */
  .dm-stage[data-arena="1"] .dm-stage-rail,
  .dm-stage[data-arena="1"] .dm-scores,
  .dm-stage[data-arena="1"] .dm-score { display: contents; }

  .dm-stage[data-arena="1"] .dm-score[data-seat="me"]   > .dm-seat   { grid-area: seat-left; }
  .dm-stage[data-arena="1"] .dm-score[data-seat="me"]   > .dm-roster { grid-area: roster-bottom; }
  .dm-stage[data-arena="1"] .dm-score[data-seat="them"] > .dm-seat   { grid-area: seat-right; }
  .dm-stage[data-arena="1"] .dm-score[data-seat="them"] > .dm-roster { grid-area: roster-top; }
  /* The ticker sat between the table and the bench as a wide, usually-empty
     bar. Every event it carries is already announced on the lot itself, so it
     was spending a whole band to repeat things. */
  .dm-stage[data-arena="1"] .dm-stage-rail > .dm-ticker { display: none; }

  /* The centre is the lot beside the bidding, in two EQUAL columns.

     The original put a narrow card left and wide controls right at different
     heights, which left an L-shaped hole under the buttons — that is what
     read as lopsided. Stacking them instead fixed the symmetry but doubled
     the centre to 712px and pushed your own bench off the bottom of the
     screen, which is worse.

     Equal columns, both stretched to the same height, fix both at once: the
     halves mirror each other so there is no corner left over, and the centre
     stays about as tall as its tallest single element instead of the sum. */
  .dm-stage[data-arena="1"] .dm-stage-main {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      "lotbar lotbar"
      "card   actions";
    column-gap: 20px; row-gap: 10px;
    align-items: stretch;
  }
  .dm-stage[data-arena="1"] .dm-stage-main > .dm-lotbar {
    grid-area: lotbar; width: 100%; margin: 0;
  }
  .dm-stage[data-arena="1"] .dm-stage-main > .dm-lot-card {
    grid-area: card;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    min-width: 0; gap: 9px;
  }
  /* Centred against the card's mass rather than pinned to the top, so the two
     halves read as a matched pair however tall the portrait comes out. */
  .dm-stage[data-arena="1"] .dm-stage-main > .dm-lot-actions {
    grid-area: actions;
    display: flex; flex-direction: column; justify-content: center; gap: 10px;
    min-width: 0;
  }
  /* Height-driven so the card keeps its portrait shape and the column width
     stops mattering — a width-driven card in a flexible track gets taller as
     the window widens and shoves the buttons off the bottom of the screen. */
  .dm-stage[data-arena="1"] .dm-lot-card > .dm-portrait-wrap {
    width: auto; height: min(30vh, 268px); max-width: 100%; margin: 0;
  }
  .dm-stage[data-arena="1"] .dm-lot-card > .dm-photo-fb {
    max-width: none; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 0;
  }
  .dm-stage[data-arena="1"] .dm-lot-card > .dm-photo-fb .dm-btn {
    padding: 5px 10px; font-size: 12px; min-height: 30px;
  }
  .dm-stage[data-arena="1"] .dm-lot-actions > .dm-bidbar { margin: 0; max-width: none; }
  .dm-stage[data-arena="1"] .dm-lot-actions > .dm-controls { margin: 0; max-width: none; }
  .dm-stage[data-arena="1"] .dm-lot-actions > .dm-waiting { margin: 0 !important; }

  /* ── Seats ─────────────────────────────────────────────────────────── */

  .dm-stage[data-arena="1"] .dm-seat {
    align-self: center;
    padding: 14px;
    border-radius: var(--dm-radius);
    border: 1px solid var(--dm-line);
    background: var(--dm-panel);
    transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
  }
  .dm-stage[data-arena="1"] .dm-seat[data-turn="1"] {
    border-color: var(--dm-gold);
    background: rgb(var(--dm-glow) / .08);
    box-shadow: 0 0 32px rgb(var(--dm-glow) / .13);
  }
  .dm-stage[data-arena="1"] .dm-seat[data-high="1"] { border-color: var(--dm-green); }

  /* The feed slot. Fixed 4:3 box, sized and framed for a webcam tile — the
     avatar fills it today, a <video> can be dropped in beside it later and
     will land in exactly the same frame with no layout change. */
  .dm-stage[data-arena="1"] .dm-seat-feed {
    display: block; position: relative; width: 100%;
    aspect-ratio: 4 / 3; margin-bottom: 11px;
    border-radius: 13px; overflow: hidden;
    border: 1px solid var(--dm-line-hot);
    background: radial-gradient(70% 70% at 50% 35%, var(--dm-panel-2), var(--dm-bg));
  }
  .dm-stage[data-arena="1"] .dm-seat-feed > .dm-avatar,
  .dm-stage[data-arena="1"] .dm-seat-feed > video {
    width: 100%; height: 100%; border: 0; border-radius: 0;
    object-fit: cover; font-size: clamp(30px, 3.2vw, 46px);
  }
  .dm-stage[data-arena="1"] .dm-seat-feed > .dm-avatar[data-speaking="1"] {
    box-shadow: inset 0 0 0 3px var(--dm-green);
  }

  /* A seat is a face and a number. The line under the money repeated the
     roster count that the bench below already shows and the max bid that the
     budget above already implies, so it went — leaving the feed as the thing
     the eye lands on, which is what it needs to be once a camera is in it. */
  .dm-stage[data-arena="1"] .dm-seat .dm-score-top { display: block; text-align: center; }
  .dm-stage[data-arena="1"] .dm-seat .dm-score-name { font-size: 15px; }
  .dm-stage[data-arena="1"] .dm-seat .dm-turn-pill {
    display: inline-block; margin: 7px 0 0;
  }
  .dm-stage[data-arena="1"] .dm-seat .dm-score-budget {
    text-align: center; font-size: 32px; margin-top: 10px;
  }
  .dm-stage[data-arena="1"] .dm-seat .dm-score-meta { display: none; }

  /* ── Edge strips ───────────────────────────────────────────────────── */

  /* The bench cards are the point of the top and bottom bands — they are what
     you actually study while deciding what to bid. At 68px they were chips in
     a mostly-empty panel; at this size they read as a hand of cards and the
     band stops looking like padding. */
  .dm-stage[data-arena="1"] .dm-roster {
    position: relative;
    margin: 0; padding: 13px 18px;
    justify-content: center; align-items: center; gap: 12px;
    border: 1px solid var(--dm-line); border-radius: 16px;
    background: var(--dm-panel);
    transition: border-color .2s ease;
  }
  .dm-stage[data-arena="1"] .dm-roster[data-turn="1"] { border-color: rgb(var(--dm-glow) / .45); }
  /* Sized off viewport HEIGHT, not width. These are 3:4 cards, so a width
     clamp sets the height too — on a short window two benches at 200px each
     plus the table simply will not fit, and your own bench slides off the
     bottom. Tying them to vh keeps all three bands on screen. */
  .dm-stage[data-arena="1"] .dm-roster > .dm-slot {
    flex: 0 0 clamp(74px, 13vh, 128px);
    border-radius: 11px;
  }
  /* Your own bench sits nearest the reader, so it reads a size larger. */
  .dm-stage[data-arena="1"] .dm-score[data-seat="me"] > .dm-roster > .dm-slot {
    flex: 0 0 clamp(82px, 14.5vh, 142px);
  }
  .dm-stage[data-arena="1"] .dm-slot-initial { font-size: 30px; }
  .dm-stage[data-arena="1"] .dm-slot-price { font-size: 13px; padding: 4px 0; }

  .dm-stage[data-arena="1"] .dm-roster-tag {
    display: block; position: absolute; left: 20px; top: 50%;
    transform: translateY(-50%);
    max-width: 15%; overflow: hidden; text-overflow: ellipsis;
    font-size: 11px; font-weight: 800; letter-spacing: .14em;
    text-transform: uppercase; color: var(--dm-mute); white-space: nowrap;
  }
}

/* ── Laptop: the table on a short screen ───────────────────────────────────
   A 1440x800 laptop has 150px less height than a desktop monitor, which is
   more than the three bands can absorb — your own bench ends up 20px under
   the fold, and a bench you cannot see is the same as no bench. Everything
   here just tightens; nothing is removed. */

@media (min-width: 1024px) and (orientation: landscape) and (max-height: 880px) {
  .dm-stage[data-arena="1"] { gap: 12px 22px; }
  .dm-stage[data-arena="1"] .dm-roster { padding: 9px 16px; gap: 10px; }
  .dm-stage[data-arena="1"] .dm-roster > .dm-slot { flex: 0 0 clamp(70px, 11.2vh, 104px); }
  .dm-stage[data-arena="1"] .dm-score[data-seat="me"] > .dm-roster > .dm-slot {
    flex: 0 0 clamp(76px, 12.4vh, 116px);
  }
  .dm-stage[data-arena="1"] .dm-lot-card > .dm-portrait-wrap { height: min(25vh, 210px); }
  .dm-stage[data-arena="1"] .dm-seat { padding: 11px; }
  .dm-stage[data-arena="1"] .dm-seat-feed { margin-bottom: 9px; }
  .dm-stage[data-arena="1"] .dm-seat .dm-score-budget { font-size: 26px; margin-top: 7px; }
}

/* ── Phone: fit the live auction in one screen ─────────────────────────────
   A phone viewport is 812px, but the site nav takes 69 off the top and the
   fixed bottom nav takes another 65, leaving ~678 for the whole auction. The
   stage came to 985, so the bid controls and both budgets sat below the fold
   and you had to scroll away from the lot to bid on it.

   Scoped with :has(.dm-stage) so only the live auction tightens — the setup
   and prep screens keep the full-size wordmark and their breathing room. */

@media (max-width: 1023px) {
  /* min-height:100dvh measures the whole screen, but .dm starts below the site
     nav and ends above the fixed bottom nav — so it reserved ~117px of empty
     space that scrolled. Let the content set the height, then pad the bottom
     enough that the last row clears the fixed nav instead of hiding under it. */
  /* body already carries bottom padding to clear the fixed nav, so this only
     needs a normal gap — 72px here double-counted it and reintroduced scroll. */
  .dm:has(.dm-stage) { min-height: 0; padding-bottom: 10px; }
  /* The app shell's <main> is min-height:100vh, which measures the full screen
     while .dm actually starts below the site nav — so the page kept 117px of
     empty scroll under the content. Only relaxed for the live auction; this
     stylesheet is injected by DraftMastersClient, so no other page sees it. */
  main.min-h-screen:has(.dm-stage) { min-height: 0; }

  /* The art is the fun part, and the slimmed title bar hands it back, so the
     height comes out of the chrome rather than out of the card. */
  .dm:has(.dm-stage) .dm-portrait-wrap { height: min(33dvh, 266px); }
  .dm:has(.dm-stage) .dm-portrait-caption { padding: 10px; }

  /* Was wrapping to two lines and costing ~35px. */
  .dm:has(.dm-stage) .dm-lotbar { font-size: 11.5px; gap: 6px; }
  .dm:has(.dm-stage) .dm-lotbar > * { min-width: 0; }
  .dm:has(.dm-stage) .dm-arena-pill { font-size: 11px; padding: 2px 8px; }

  .dm:has(.dm-stage) .dm-bidbar { padding: 9px 12px; }
  .dm:has(.dm-stage) .dm-bidbar[data-plain="1"] { display: none; }

  /* The prompt shrank with the card; let it wrap instead of clipping. */
  .dm:has(.dm-stage) .dm-portrait-upload { padding: 7px 10px; max-width: 94%; bottom: 14%; }
  .dm:has(.dm-stage) .dm-portrait-upload strong { font-size: 12px; white-space: normal; }
  .dm:has(.dm-stage) .dm-portrait-upload small { font-size: 10px; }
  /* The card itself stays tappable to upload, so this row was a second way to
     do the same thing — and on a phone the height is worth more than the
     duplicate. "Search again" goes with it; the search runs automatically. */
  .dm:has(.dm-stage) .dm-photo-fb { display: none; }

  .dm:has(.dm-stage) .dm-lotbar { margin-bottom: 8px; }
  .dm:has(.dm-stage) .dm-bidbar { margin-top: 8px; }
  .dm:has(.dm-stage) .dm-controls { margin-top: 10px; gap: 6px; }
  .dm:has(.dm-stage) .dm-custombid { margin-top: 6px; }

  /* 46px keeps every bid target above the 44px minimum. */
  .dm:has(.dm-stage) .dm-quickbid { min-height: 46px; }
  .dm:has(.dm-stage) .dm-custombid-sign,
  .dm:has(.dm-stage) .dm-custombid-input,
  .dm:has(.dm-stage) .dm-custombid-go { min-height: 46px; }

  .dm:has(.dm-stage) .dm-scores { gap: 8px; margin-bottom: 8px; }
  .dm:has(.dm-stage) .dm-score { padding: 8px; }
  .dm:has(.dm-stage) .dm-score-budget { font-size: 20px; }
  .dm:has(.dm-stage) .dm-score-meta { font-size: 10.5px; }
  .dm:has(.dm-stage) .dm-avatar { width: 28px; height: 28px; }
  .dm:has(.dm-stage) .dm-roster > .dm-slot { height: 30px; }

  /* The ticker is a scrolling log of things that already happened — on a phone
     it sat as an near-empty bar between the budgets and the nav, spending
     height on history nobody acts on. The sale result is already announced on
     the lot itself. */
  .dm:has(.dm-stage) .dm-ticker { display: none; }
}

/* ── Standalone: the game owns the screen ─────────────────────────────────
   DraftMasters is heading for its own site, and the Great Souls shell around
   it was never free. On a 812px phone the sticky site header takes 69px and
   the fixed bottom nav another 65 — 134px, a sixth of the screen, spent on
   controls that belong to a different app while the lot portrait was squeezed
   to 266px to make room. The floating voice, party and invite pills sat on
   top of the bid buttons on the way past.

   Marked on the game root rather than inferred from .dm, because the portrait
   studio shares that class and IS a Great Souls page — it keeps its nav.

   Everything hidden here is the shell's own chrome; the game keeps its mute
   button and its way out in the corner. */

body:has(.dm[data-standalone="1"]) [data-site-chrome],
body:has(.dm[data-standalone="1"]) .mobile-bottom-nav { display: none !important; }
/* The shell reserves room for the bottom nav that no longer exists. */
body:has(.dm[data-standalone="1"]) { padding-bottom: 0 !important; }
/* With the header gone the game starts at the top of the viewport, so it can
   finally be the full height it always claimed to be. */
main.min-h-screen:has(.dm[data-standalone="1"]) { min-height: 100dvh; }
.dm[data-standalone="1"] {
  min-height: 100dvh;
  padding-top: max(14px, env(safe-area-inset-top));
  padding-left: max(14px, env(safe-area-inset-left));
  padding-right: max(14px, env(safe-area-inset-right));
  padding-bottom: max(18px, env(safe-area-inset-bottom));
}
/* The floated mute/exit controls need their band back at the top of the
   screen now that no site header is sitting above them. */
.dm[data-standalone="1"]:has(.dm-stage) {
  padding-top: calc(46px + env(safe-area-inset-top));
}
.dm[data-standalone="1"]:has(.dm-stage) .dm-head {
  top: max(8px, env(safe-area-inset-top));
  right: max(12px, env(safe-area-inset-right));
}

/* ── Phone, upright ───────────────────────────────────────────────────────
   The 134px the chrome gave back goes almost entirely to the art, which is
   the thing you are actually being asked to value. The rest comes out of the
   bid readout: it is one short line of text that was styled like a heading. */

@media (max-width: 1023px) {
  .dm:has(.dm-stage) { padding-bottom: max(14px, env(safe-area-inset-bottom)); }

  /* Was min(33dvh, 266px) with a site nav overhead.

     The max-height gives back the home indicator's strip on a notched phone.
     Below 860px tall nothing in the rail flexes, so the layout is a fixed
     stack that has to fit exactly — and on an iPhone 14 in Safari (390x745
     with the URL bar showing) the safe-area inset grows the bottom padding by
     16px against about 14px of slack. Taking the inset out of the art instead
     is the one adjustment that cannot push anything off the bottom. */
  .dm[data-standalone="1"]:has(.dm-stage) .dm-portrait-wrap {
    height: min(48dvh, 420px);
    max-height: calc(48dvh - env(safe-area-inset-bottom, 0px));
    max-width: min(360px, 92vw);
  }

  /* The lot bar is context, not action — one small line. */
  .dm:has(.dm-stage) .dm-lotbar { font-size: 11px; margin-bottom: 6px; }

  /* This bar carries at most a standing price and whose turn it is. It does
     not need heading-sized type or a 14px cushion to say so. */
  .dm:has(.dm-stage) .dm-bidbar { padding: 8px 12px; margin-top: 10px; max-width: 380px; }
  .dm:has(.dm-stage) .dm-bid-open { font-size: 12.5px; line-height: 1.35; }
  .dm:has(.dm-stage) .dm-bid-amount { font-size: 26px; }
  .dm:has(.dm-stage) .dm-bid-holder { font-size: 12px; margin-top: 3px; }
  .dm:has(.dm-stage) .dm-waiting { font-size: 12.5px; padding: 9px 12px; }

  /* The buttons stay full size — they are what you touch. */
  .dm:has(.dm-stage) .dm-controls { margin-top: 10px; gap: 7px; max-width: 420px; }
  .dm:has(.dm-stage) .dm-quickbid { min-height: 50px; }

  /* Both benches, side by side under the controls, sized so a pick reads as a
     picture rather than a swatch. */
  .dm:has(.dm-stage) .dm-scores { gap: 8px; margin-bottom: 0; margin-top: 10px; }
  .dm:has(.dm-stage) .dm-roster > .dm-slot { height: 34px; }
}

/* ── Phone, on its side ───────────────────────────────────────────────────
   A landscape phone is ~844x390. It cleared the 900px two-column breakpoint
   on some handsets and missed it on others, so the same phone got a different
   layout depending on which way it was turned — and in the stacked one the
   portrait, capped by dvh, shrank to a stamp with a field of empty panel
   beside it.

   Orientation decides the layout here instead of width. Height is the scarce
   axis when a phone is sideways, so the lot takes the whole of it in one
   column and everything you read or touch stacks in the other:

       ┌──────────┬──────────────────────┐
       │          │  price · your call   │
       │   lot    │  bid · bid · pass    │
       │          │  your bench  theirs  │
       └──────────┴──────────────────────┘

   Both rail wrappers collapse with display:contents so the four real blocks
   become grid items directly — the same trick the desktop arena uses, with
   two areas instead of five. Written with the [data-arena] prefix so it beats
   the desktop arena's own placement on a short, wide window. */

@media (max-width: 1199px) and (orientation: landscape) and (max-height: 560px) {
  .dm-stage,
  .dm-stage[data-arena="1"] {
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
    grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas:
      "lot bar"
      "lot actions"
      "lot scores";
    align-items: start;
    gap: 10px 14px;
  }
  .dm-stage .dm-stage-main,
  .dm-stage .dm-stage-rail,
  .dm-stage[data-arena="1"] .dm-stage-main,
  .dm-stage[data-arena="1"] .dm-stage-rail { display: contents; }

  /* display:block, not just an area: .dm-lot-card is display:contents by
     default, which would promote the portrait and the photo row to separate
     grid items and scatter them into whatever cells were free. */
  .dm-stage .dm-lot-card,
  .dm-stage[data-arena="1"] .dm-lot-card { grid-area: lot; display: block; }
  .dm-stage .dm-lot-actions,
  .dm-stage[data-arena="1"] .dm-lot-actions { grid-area: actions; display: block; }
  .dm-stage .dm-scores,
  .dm-stage[data-arena="1"] .dm-scores { grid-area: scores; display: grid; grid-template-columns: 1fr 1fr; }
  /* Board name and lots-remaining ride above the controls rather than above
     the card, so the lot column is nothing but art. */
  .dm-stage[data-arena="1"] .dm-lotbar,
  .dm-stage .dm-lotbar { grid-area: bar; align-self: start; }
  /* The desktop arena seats and the ticker have nowhere to go at this height. */
  .dm-stage[data-arena="1"] > .dm-seat,
  .dm-stage .dm-ticker { display: none; }

  /* Written with the same [data-standalone] specificity as the upright rule
     above, which would otherwise win here and hand a sideways phone a
     420px-tall card on a 390px-tall screen. */
  .dm[data-standalone="1"]:has(.dm-stage) .dm-portrait-wrap,
  .dm:has(.dm-stage) .dm-portrait-wrap {
    height: calc(100dvh - 78px);
    max-height: 420px;
    max-width: min(300px, 34vw);
    margin-top: 26px;
  }
  .dm[data-standalone="1"]:has(.dm-stage) { padding-top: 38px; padding-bottom: 8px; }
  .dm:has(.dm-stage) .dm-lotbar { font-size: 10.5px; margin-bottom: 0; }
  .dm:has(.dm-stage) .dm-bidbar { margin: 0 auto; padding: 7px 10px; max-width: none; }
  .dm:has(.dm-stage) .dm-bid-amount { font-size: 22px; }
  .dm:has(.dm-stage) .dm-controls { margin-top: 8px; max-width: none; }
  .dm:has(.dm-stage) .dm-quickbid { min-height: 44px; font-size: 15px; }
  .dm:has(.dm-stage) .dm-scores { gap: 8px; margin: 0; }
  .dm:has(.dm-stage) .dm-score { padding: 7px; }
  .dm:has(.dm-stage) .dm-score-budget { font-size: 17px; }
  .dm:has(.dm-stage) .dm-roster > .dm-slot { height: 26px; }
  .dm:has(.dm-stage) .dm-portrait-upload { display: none; }
}

/* ── Short upright phones (iPhone SE and friends) ─────────────────────────
   Still one column; the art just takes the difference. Restated after the
   landscape block so it cannot be overridden by it — the two never both
   match, since one requires landscape and this one does not. */

@media (max-width: 1023px) and (orientation: portrait) and (max-height: 700px) {
  .dm[data-standalone="1"]:has(.dm-stage) .dm-portrait-wrap { height: min(36dvh, 260px); }
  .dm:has(.dm-stage) .dm-bidbar { padding: 6px 10px; margin-top: 7px; }
  .dm:has(.dm-stage) .dm-bid-amount { font-size: 22px; }
  .dm:has(.dm-stage) .dm-quickbid { min-height: 46px; }
  .dm:has(.dm-stage) .dm-score { padding: 6px; }
  .dm:has(.dm-stage) .dm-score-budget { font-size: 18px; }
  .dm:has(.dm-stage) .dm-roster > .dm-slot { height: 28px; }
  .dm:has(.dm-stage) .dm-portrait-upload { display: none; }
}
/* ── Shiny ────────────────────────────────────────────────────────────────
   A shiny is worth nothing in points and everything in the moment, so it is
   paid for entirely in presentation: the card's frame catches the light and
   the star in the variant text does the rest. Nothing here touches layout, so
   a shiny card is the same size as any other. */

.dm-portrait-wrap[data-shiny="1"] {
  border-color: rgba(240, 200, 96, .75);
  box-shadow:
    0 24px 60px rgba(0,0,0,.6),
    0 0 0 1px rgba(240,200,96,.35) inset,
    0 0 28px rgba(240,200,96,.28);
}
.dm-portrait-wrap[data-shiny="1"]::after {
  content: "";
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(115deg,
    transparent 35%, rgba(255,255,255,.16) 48%,
    rgba(240,200,96,.22) 52%, transparent 66%);
  background-size: 280% 280%;
  animation: dm-shine 3.4s ease-in-out infinite;
}
@keyframes dm-shine {
  0%, 70% { background-position: 120% 0; }
  100%    { background-position: -40% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .dm-portrait-wrap[data-shiny="1"]::after { animation: none; }
}
/* ── Upright: one column, and it fills the screen ─────────────────────────
   Everything above is about which layout to use. This is about the layout
   not stopping halfway down the phone.

   The auction used to be a stack of auto-height blocks inside a page that was
   merely tall ENOUGH, so on a long screen the table finished around the
   halfway mark and the rest was black. Now the shell is a full-height flex
   column, the table takes what it needs, and the rail underneath it — the
   feed in a solo game, the cameras and chat in a PvP one — takes everything
   left over. There is no leftover space to look at any more, because the part
   of the screen you would have been looking at is doing something. */

/* min-height guards the landscape split defined above: a sideways phone is
   844x390, which clears max-width:1023 and would otherwise be turned back into
   a single column by this block and scroll. Anything actually upright, or wide
   with room to stack, lands here. */
@media (max-width: 1023px) and (min-height: 561px), (orientation: portrait) {
  .dm[data-standalone="1"]:has(.dm-stage) { display: flex; flex-direction: column; }
  /* width:100% because .dm is now a flex column, and .dm-shell centres itself
     with an auto inline margin — which makes a flex item shrink to its content
     instead of filling, collapsing the whole table to 433px in the middle of a
     980px screen. */
  .dm:has(.dm-stage) .dm-shell {
    display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; width: 100%;
  }

  .dm-stage,
  .dm-stage[data-arena="1"] {
    display: flex; flex-direction: column;
    grid-template-columns: none; grid-template-areas: none;
    flex: 1 1 auto; min-height: 0; gap: 12px;
  }
  .dm-stage > * { min-width: 0; }

  /* The desktop arena and the landscape split both re-parent these with
     display:contents. One column wants them back as ordinary blocks. */
  .dm-stage[data-arena="1"] .dm-stage-main,
  .dm-stage[data-arena="1"] .dm-lot-card,
  .dm-stage[data-arena="1"] .dm-lot-actions,
  .dm-stage[data-arena="1"] .dm-lotbar { display: block; grid-area: auto; }
  .dm-stage[data-arena="1"] .dm-lotbar { display: flex; }
  .dm-stage[data-arena="1"] > .dm-seat { display: none; }
  .dm-stage[data-arena="1"] .dm-scores,
  .dm-stage .dm-scores { display: grid; grid-template-columns: 1fr 1fr; grid-area: auto; }

  /* The rail is the part that grows. */
  .dm-stage .dm-stage-rail,
  .dm-stage[data-arena="1"] .dm-stage-rail {
    display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; grid-area: auto;
  }

  /* Bidding gets the width it is given rather than a phone-sized ribbon down
     the middle of a 980px screen. */
  .dm:has(.dm-stage) .dm-bidbar { max-width: min(560px, 100%); }
  .dm:has(.dm-stage) .dm-controls { max-width: min(560px, 100%); }
  .dm[data-standalone="1"]:has(.dm-stage) .dm-portrait-wrap { max-width: min(420px, 88vw); }
}

/* ── The rail's filler ────────────────────────────────────────────────────
   Only on a screen with room to spare. A 375x812 phone finishes its table
   about 50px above the bottom, and a feed squeezed into 50px is worse than no
   feed — so below this height the rail stays exactly as it was. */

@media (max-width: 1023px) and (min-height: 860px), (orientation: portrait) and (min-height: 860px) {
  /* A tall screen can afford a bigger card and a bench you can actually read
     the faces on, before any of it goes to the feed. The art is the thing
     being valued; it should not stay phone-sized on a screen twice a phone. */
  .dm[data-standalone="1"]:has(.dm-stage) .dm-portrait-wrap {
    height: min(42dvh, 560px);
    max-width: min(460px, 88vw);
  }
  .dm:has(.dm-stage) .dm-roster > .dm-slot { height: clamp(34px, 5.2vh, 60px); }
  .dm:has(.dm-stage) .dm-score { padding: 12px; }
  .dm:has(.dm-stage) .dm-score-budget { font-size: 24px; }

  /* In a solo game there are no cameras and nobody to chat to, so the running
     feed of bids and sales takes the space instead — the one thing on this
     screen that is genuinely a live document. */
  .dm:has(.dm-stage) .dm-ticker {
    display: flex; flex: 1 1 auto;
    min-height: 140px; max-height: none;
    margin-top: 0;
  }
  .dm:has(.dm-stage) .dm-ticker-line { font-size: 13.5px; }
}

/* ── Cameras and chat, filling the rail ───────────────────────────────────
   A PvP room has something better to put there than the feed. The tiles keep
   their shape at the top and the chat log absorbs the rest, so the message
   box sits at the bottom of the screen where a message box belongs. */

/* min-height guards the landscape split defined above: a sideways phone is
   844x390, which clears max-width:1023 and would otherwise be turned back into
   a single column by this block and scroll. Anything actually upright, or wide
   with room to stack, lands here. */
@media (max-width: 1023px) and (min-height: 561px), (orientation: portrait) {
  .dm:has(.dm-stage) .dm-media {
    display: flex; flex-direction: column;
    flex: 1 1 auto; min-height: 0; margin-top: 0;
  }
  .dm:has(.dm-stage) .dm-media .dm-tiles { flex: 0 0 auto; }
  .dm:has(.dm-stage) .dm-chat { flex: 1 1 auto; min-height: 0; }
  .dm:has(.dm-stage) .dm-chat-log { flex: 1 1 auto; min-height: 84px; max-height: none; }
  /* With cameras present the feed would be a third thing competing for the
     same space, and it is the least of the three. */
  .dm:has(.dm-stage) .dm-stage-rail:has(.dm-media) .dm-ticker { display: none; }
}
/* ── Arena note ───────────────────────────────────────────────────────────
   What the pin says when you tap it. A grey card rather than a modal: it
   belongs to the lot bar it drops out of, it does not stop the auction, and
   it goes away with one tap on the ✕ or on the pin again. */

.dm-arena-pill { cursor: pointer; font: inherit; }
.dm-arena-pill[data-open="1"] {
  border-color: var(--dm-gold); color: var(--dm-gold-hot);
}
.dm-arena-note {
  position: relative;
  margin: 0 0 10px;
  padding: 12px 34px 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--dm-line-hot);
  background: var(--dm-panel-2);
  animation: dm-arena-in .16s ease-out;
}
.dm-arena-note strong { display: block; font-size: 13px; color: var(--dm-gold); margin-bottom: 5px; }
.dm-arena-note p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--dm-text); }
.dm-arena-note .dm-arena-note-scenario {
  margin-top: 8px; padding-top: 8px;
  border-top: 1px solid var(--dm-line);
  color: var(--dm-dim); font-size: 12.5px;
}
.dm-arena-note-x {
  position: absolute; top: 7px; right: 8px;
  width: 26px; height: 26px; border-radius: 8px;
  border: 1px solid var(--dm-line);
  background: var(--dm-panel);
  color: var(--dm-dim); font-size: 12px; cursor: pointer;
  display: grid; place-items: center;
}
.dm-arena-note-x:hover { color: var(--dm-text); border-color: var(--dm-line-hot); }
@keyframes dm-arena-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) { .dm-arena-note { animation: none; } }

/* The note is in the flow, not floating over the card — it reads as part of
   the lot bar it drops out of, and it survives all three layouts without
   needing a positioned ancestor. The cost is its height, so the art lends it:
   while the note is open the card gives back rather more than the note takes,
   which keeps the one-screen fit that the whole phone layout is built on. */
@media (max-width: 1023px), (orientation: portrait) {
  .dm[data-standalone="1"]:has(.dm-arena-note) .dm-portrait-wrap {
    height: min(30dvh, 240px);
  }
  .dm-arena-note { padding: 10px 32px 10px 12px; }
  .dm-arena-note p { font-size: 12.5px; }
  /* On a phone the arena is the answer to "what does this change"; the board
     scenario is background the player already read on the prep screen. */
  .dm-arena-note .dm-arena-note-scenario { display: none; }
}
/* ── Phones: voice yes, camera and chat no ────────────────────────────────
   Mic stays, because arguing about the picks is the reason you play a friend
   and it costs no screen. The camera tiles and the chat box go, for three
   reasons that all bite hardest on the smallest screen:

   THE KEYBOARD. Tapping a chat box raises the software keyboard, which shrinks
   the visual viewport on Android and scrolls the document on iOS. This layout
   fits the auction into the screen exactly; either behaviour pushes the bid
   buttons out of reach at the moment you need them.

   THE SPACE. A 375x812 phone finishes the table about 50px from the bottom.
   Two video tiles and a scrolling log do not go in 50px, and taking it out of
   the lot card means bidding on a thumbnail.

   THE POINT. The mic is already open. Typing at someone you can hear is the
   worse half of the feature, and holding a phone steady enough to be a
   webcam while bidding on it is not a thing anyone does twice.

   Above this height there IS room — a tablet, a desktop, or a phone in
   desktop-site mode at 980x2080 — so the full rail comes back untouched. */

/* The header's mic reads as live rather than as just another grey icon —
   at a glance, from across the room, is my mic open. */
.dm-head-actions .dm-btn[data-live="1"] {
  border-color: var(--dm-green);
  box-shadow: 0 0 0 1px rgba(76,175,125,.25), 0 0 12px rgba(76,175,125,.2);
}
.dm-head-actions .dm-btn[data-live="0"] { opacity: .75; }

@media (max-height: 859px) {
  /* The whole rail goes, controls included — the mic toggle it used to carry
     now lives in the floating header, where it is on screen for the entire
     draft instead of below the fold. Voice is unaffected: it is running
     whether or not anything is drawn for it. */
  .dm:has(.dm-stage) .dm-media { display: none; }
}
/* ── An uber lot, as an object ────────────────────────────────────────────
   About one lot in five hundred. Most players will never be dealt one, so the
   card itself changes, not just the chip on it: a platinum frame, a cold
   highlight instead of the warm gold every other card uses, and a slow sweep
   across the whole face. Deliberately silver where the shiny treatment is
   gold, so the two rarities never read as the same event. */

.dm-portrait-wrap[data-grade="uber"] {
  border-color: rgba(226,234,245,.9);
  box-shadow:
    0 24px 60px rgba(0,0,0,.6),
    0 0 0 1px rgba(255,255,255,.55) inset,
    0 0 34px rgba(198,214,236,.42);
}
.dm-portrait-wrap[data-grade="uber"]::before {
  content: "";
  position: absolute; inset: 0; z-index: 3;
  pointer-events: none;
  background: linear-gradient(103deg,
    transparent 34%, rgba(255,255,255,.10) 44%, rgba(255,255,255,.42) 50%,
    rgba(214,228,246,.14) 56%, transparent 66%);
  background-size: 240% 100%;
  animation: dm-uber-sweep 4.6s ease-in-out infinite;
}
@keyframes dm-uber-sweep {
  0%       { background-position: 140% 0; }
  60%,100% { background-position: -50% 0; }
}
/* The name plate goes silver to match, so the card reads as one object. */
.dm-portrait-wrap[data-grade="uber"] .dm-lot-name {
  background: linear-gradient(103deg, #ffffff 0%, #cfd7e4 45%, #ffffff 70%, #aab4c4 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
/* ── The shelf ────────────────────────────────────────────────────────────
   Each universe is a sealed foil pack, not a card with a photo on it. The
   pack is a real photograph — black foil, crimped brass ends — and everything
   else is composited onto its face: the house mark at the crimp, the board's
   own character in a lit window, a brass band, and the name.

   That is the difference between a picker and a shelf. You are not reading
   twenty options, you are looking at twenty things you could open. */

.dm-deck-wrap { margin: 0 -14px; }

.dm-deck {
  /* ONE case, and nothing else. Each slot is the full width of the scroller,
     so there is no sliver of the next one pulling the eye sideways off the
     only object on the screen. The next is a swipe away, not a peek away. */
  --case-w: clamp(250px, 74vw, 340px);
  display: flex;
  gap: 0;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 46px 0 54px;
  perspective: 1400px;
}
.dm-deck::-webkit-scrollbar { display: none; }

/* The foil-pouch styles lived here. A board is a case now — see .dm-case
   above. Removed rather than left behind: dead CSS that still matches a
   class name somebody might reuse is worse than no CSS. */

.dm-deck-compose { padding: 0 14px; margin-top: 4px; }
.dm-deck-compose .dm-textarea { width: 100%; }

@media (min-width: 900px) {
  .dm-deck-wrap { margin: 0; }
  .dm-deck { --case-w: clamp(300px, 24vw, 360px); }
  .dm-deck-compose { padding: 0; }
}

/* ── Shelf head: the mark, and the way to skip the swipe ──────────────── */

/* Only one control lives above the shelf, so it sits at the end of the row
   on its own rather than balancing a heading that no longer exists. */
.dm-shelf-head {
  display: flex; align-items: center; justify-content: flex-start;
  gap: 12px; margin-bottom: 12px;
}
.dm-shelf-head[data-hide="1"] { display: none; }

/* The way back to the shelf, on the settings page. */
.dm-back {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 40px; padding: 6px 12px 6px 8px; margin-bottom: 6px;
  border: 0; border-radius: 10px;
  background: transparent; color: var(--dm-dim);
  font: inherit; font-size: 14px; font-weight: 650; cursor: pointer;
}
.dm-back:hover { color: var(--dm-gold-hot); background: rgba(255,255,255,.04); }

/* Setup wants nothing above the shelf. The mute and the exit are controls for
   a draft in progress; they float into the corner once one starts. */
.dm-head-actions[data-hide="1"] { display: none; }

.dm-usel { position: relative; flex-shrink: 0; }

/* Not a pill. A bordered chip made the picker read as a minor setting sitting
   beside the shelf; it is the only control on the screen, so it is set as a
   heading you can open — the mark, the name, the chevron, and nothing drawn
   around them. */
.dm-usel-trigger {
  display: inline-flex; align-items: center; gap: 9px;
  min-height: 44px; padding: 4px 2px 4px 6px;
  border: 0; border-radius: 10px;
  background: transparent;
  color: var(--dm-text);
  font: inherit; font-size: 17px; font-weight: 700; letter-spacing: -0.005em;
  cursor: pointer;
  transition: color .15s ease, opacity .15s ease;
}
.dm-usel-trigger:hover { color: var(--dm-gold-hot); }
.dm-usel-trigger:active { opacity: .75; }
/* The mark gets the ring Triumph's category icon has. */
.dm-usel-mark {
  display: grid; place-items: center;
  width: 26px; height: 26px; flex-shrink: 0;
  border-radius: 50%;
  font-size: 14px; line-height: 1;
  background: rgb(var(--dm-glow) / .14);
  box-shadow: inset 0 0 0 1.5px rgb(var(--dm-glow) / .55);
}
.dm-usel-label { max-width: 54vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-usel-chev {
  width: 17px; height: 17px; flex-shrink: 0;
  color: var(--dm-dim);
  /* An SVG box is centred by the flex row on its own — no nudging needed. */
  transition: transform .18s ease;
}
.dm-usel-chev[data-open="1"] { transform: rotate(180deg); }

/* A full-screen invisible button, so a tap anywhere closes the menu and
   keyboard users still get a focusable escape. */
.dm-usel-scrim {
  position: fixed; inset: 0; z-index: 40;
  border: 0; padding: 0; background: transparent; cursor: default;
}

.dm-usel-menu {
  position: absolute; z-index: 41;
  top: calc(100% + 8px); right: 0;
  width: max(220px, 62vw); max-width: 300px;
  max-height: min(52vh, 420px); overflow-y: auto;
  padding: 6px;
  border-radius: 14px;
  border: 1px solid var(--dm-line-hot);
  background: rgba(16,22,20,.98);
  backdrop-filter: blur(10px);
  box-shadow: 0 18px 44px rgba(0,0,0,.7);
  animation: dm-usel-in .14s ease-out;
}
@keyframes dm-usel-in {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: none; }
}

.dm-usel-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; min-height: 40px; padding: 8px 10px;
  border: 0; border-radius: 9px;
  background: transparent; color: var(--dm-text);
  font: inherit; font-size: 13.5px; text-align: left;
  cursor: pointer;
}
.dm-usel-item .dm-usel-mark { width: 22px; height: 22px; font-size: 12px; }
.dm-usel-item:hover { background: var(--dm-panel-2); }
.dm-usel-item[data-on="1"] { background: rgb(var(--dm-glow) / .16); color: var(--dm-gold-hot); font-weight: 700; }

/* The settings arrive rather than appear — a block of four sections popping
   in under the thumb reads as a layout shift, not as a reveal. */
.dm-after-pick { animation: dm-reveal .3s cubic-bezier(.2,.8,.25,1); }
@keyframes dm-reveal {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .dm-after-pick, .dm-usel-menu { animation: none; }
}

/* ── Controls with weight ─────────────────────────────────────────────────
   The primitives were a dark dashboard: flat fills, one radius everywhere, a
   grey hairline round each. Nothing on the screen looked pressable, and the
   labels were sentence-case body copy, so a button and a paragraph read at
   the same volume.

   Three changes do most of the work. Every control gets a LOWER EDGE — a
   solid dark line beneath it that shortens on press — so it behaves like a
   physical key instead of a rectangle changing colour. Radii get tighter and
   stop being uniform, so a pill, a key and a panel are different objects.
   And the labels get set: uppercase, letterspaced, heavier, at a size that
   says "operate me" rather than "read me". */

.dm-btn {
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 750;
  letter-spacing: .045em;
  text-transform: uppercase;
  background: linear-gradient(180deg, #1b2321, #131a18);
  border-color: #2c3733;
  /* The key's edge. */
  box-shadow: 0 2px 0 #0a0f0e, 0 3px 8px rgba(0,0,0,.45);
  transition: background .14s ease, border-color .14s ease, box-shadow .1s ease,
              transform .1s ease, opacity .15s ease;
}
.dm-btn:hover:not(:disabled) {
  border-color: var(--dm-line-hot);
  background: linear-gradient(180deg, #222c29, #161e1c);
}
.dm-btn:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 0 0 #0a0f0e, 0 1px 3px rgba(0,0,0,.4);
}
.dm-btn:disabled { box-shadow: none; }

.dm-btn-primary {
  background: linear-gradient(180deg, var(--dm-gold-hot) 0%, var(--dm-gold) 62%, #a8801a 100%);
  border-color: #e2c469;
  color: #17110a;
  font-weight: 850;
  letter-spacing: .06em;
  /* Brass sits on a darker brass edge, not on black. */
  box-shadow: 0 2px 0 var(--dm-gold-deep), 0 4px 14px rgb(var(--dm-glow) / .32);
}
.dm-btn-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #f6dc8a 0%, var(--dm-gold-hot) 62%, var(--dm-gold) 100%);
  border-color: #f2dc9a;
}
.dm-btn-primary:active:not(:disabled) { box-shadow: 0 0 0 var(--dm-gold-deep), 0 2px 6px rgb(var(--dm-glow) / .28); }

/* Ghost stays quiet — it is the way out, not the way on. */
.dm-btn-ghost {
  background: transparent;
  border-color: var(--dm-line);
  color: var(--dm-dim);
  box-shadow: none;
}
.dm-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,.04); color: var(--dm-text); }
.dm-btn-icon { text-transform: none; letter-spacing: 0; }

/* Fields are wells cut into the surface, not boxes sitting on it. */
.dm-input, .dm-textarea {
  border-radius: 10px;
  background: #0a0f0d;
  border-color: #232d2a;
  box-shadow: inset 0 2px 5px rgba(0,0,0,.55);
  transition: border-color .15s ease, box-shadow .15s ease;
}
.dm-input::placeholder, .dm-textarea::placeholder {
  color: #5b6560;
}
.dm-input:focus, .dm-textarea:focus {
  border-color: var(--dm-gold);
  box-shadow: inset 0 2px 5px rgba(0,0,0,.55), 0 0 0 3px rgb(var(--dm-glow) / .18);
}

/* Chips are the one genuinely soft thing — they are suggestions. */
.dm-chip {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .02em;
  background: rgba(255,255,255,.03);
}
.dm-chip:hover { border-color: var(--dm-gold); color: var(--dm-gold-hot); }

/* A segment is a choice you can see the state of from across the room. */
.dm-seg-item {
  border-radius: 12px;
  background: linear-gradient(180deg, #1a1710, #100e0b);
  box-shadow: 0 2px 0 #0a0908;
}
.dm-seg-item[data-on="1"] {
  border-color: var(--dm-gold);
  background: linear-gradient(180deg, rgb(var(--dm-glow) / .16), rgb(var(--dm-glow) / .05));
  box-shadow: 0 2px 0 var(--dm-gold-deep), 0 0 0 1px rgb(var(--dm-glow) / .45), 0 6px 18px rgb(var(--dm-glow) / .14);
}
.dm-seg-label {
  font-weight: 750;
  letter-spacing: .01em;
}
.dm-seg-note { color: var(--dm-mute); }
.dm-seg-item[data-on="1"] .dm-seg-note { color: rgba(236,229,216,.62); }

/* Eyebrows are structure, so they read as structure. */
.dm-eyebrow {
  font-size: 10.5px;
  letter-spacing: .2em;
  color: var(--dm-gold);
  opacity: .75;
}

/* Panels are lit from above, matching the spotlight over the block. The top
   stop was #141c1a — a green the hub uses and this game does not. */
.dm-panel {
  background: linear-gradient(180deg, #1a1710, var(--dm-panel));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 8px 22px rgba(0,0,0,.35);
}

/* ── Under the shelf: look inside, or draft ───────────────────────────── */

/* The old shelf foot lived here: a What's-inside button and a Draft Now
   bar. DRAFT is printed on the case itself now, and the contents stay
   sealed on purpose. Replaced by .dm-carousel above. */

/* ── The contents sheet ───────────────────────────────────────────────── */

.dm-sheet-scrim {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(6,5,4,.74);
  backdrop-filter: blur(3px);
  display: flex; align-items: flex-end; justify-content: center;
  animation: dm-fade .16s ease-out;
}
@keyframes dm-fade { from { opacity: 0; } to { opacity: 1; } }

.dm-sheet {
  width: min(560px, 100%);
  max-height: 86dvh; overflow-y: auto;
  padding: 10px 16px calc(20px + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  border: 1px solid var(--dm-line-hot); border-bottom: 0;
  background: linear-gradient(180deg, #1d1913, var(--dm-panel));
  box-shadow: 0 -20px 60px rgba(0,0,0,.7);
  animation: dm-sheet-up .24s cubic-bezier(.2,.8,.25,1);
}
@keyframes dm-sheet-up { from { transform: translateY(16px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .dm-sheet, .dm-sheet-scrim { animation: none; }
}

.dm-sheet-grip {
  width: 38px; height: 4px; margin: 2px auto 10px;
  border-radius: 999px; background: var(--dm-line-hot);
}
.dm-sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.dm-sheet-title {
  margin: 0; font-family: var(--dm-display);
  font-size: 22px; font-weight: 800; letter-spacing: -0.01em;
}
.dm-sheet-x {
  width: 34px; height: 34px; flex-shrink: 0;
  border-radius: 50%; border: 1px solid var(--dm-line);
  background: var(--dm-panel-2); color: var(--dm-dim);
  font-size: 13px; cursor: pointer;
}
.dm-sheet-x:hover { color: var(--dm-text); border-color: var(--dm-line-hot); }

/* Your record, three ways. */
.dm-rec {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 14px;
}
.dm-rec-cell {
  display: flex; flex-direction: column; gap: 3px; align-items: center;
  padding: 10px 6px; border-radius: 12px;
  border: 1px solid var(--dm-line);
  background: linear-gradient(180deg, #1a1710, #100e0b);
}
.dm-rec-k {
  font-size: 9.5px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase;
  color: var(--dm-mute);
}
.dm-rec-v { font-size: 18px; font-weight: 800; color: var(--dm-gold-hot); }

/* The contents themselves. */
.dm-inside-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px; margin-top: 8px;
}
.dm-inside-cell { display: flex; flex-direction: column; gap: 5px; align-items: center; min-width: 0; }
.dm-inside-art {
  position: relative;
  width: 100%; aspect-ratio: 4 / 5;
  border-radius: 9px; overflow: hidden;
  display: grid; place-items: center;
  border: 1px solid var(--dm-line);
  background: var(--dm-panel-2);
  color: var(--dm-mute); font-size: 18px; font-weight: 800;
}
.dm-inside-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 20%; }
.dm-inside-name {
  font-size: 10px; line-height: 1.25; text-align: center; color: var(--dm-dim);
  width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* A sealed slot reads as foil, not as a missing picture. */
.dm-inside-cell[data-sealed="1"] .dm-inside-art {
  border-color: rgb(var(--dm-glow) / .45);
  background:
    repeating-linear-gradient(115deg, rgb(var(--dm-glow) / .10) 0 6px, rgb(var(--dm-glow) / .03) 6px 12px),
    var(--dm-panel-2);
  color: var(--dm-gold);
  box-shadow: inset 0 0 18px rgb(var(--dm-glow) / .16);
}
.dm-inside-cell[data-sealed="1"] .dm-inside-name { color: var(--dm-gold); opacity: .8; }

/* ── Tab bar ──────────────────────────────────────────────────────────── */

.dm-tabs {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
  display: grid; grid-template-columns: repeat(4, 1fr);
  padding: 6px 6px calc(6px + env(safe-area-inset-bottom));
  background: rgba(10,15,13,.94);
  backdrop-filter: blur(14px);
  border-top: 1px solid var(--dm-line);
}
.dm-tab {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 7px 4px; border-radius: 10px;
  font-size: 10px; font-weight: 700; letter-spacing: .04em;
  color: var(--dm-mute); text-decoration: none;
}
.dm-tab-mark { font-size: 18px; line-height: 1; }
.dm-tab[data-on="1"] { color: var(--dm-gold-hot); }
.dm-tab:hover { color: var(--dm-text); }

/* The bar is fixed, so the page needs a floor to scroll to. */
.dm:has(.dm-tabs) { padding-bottom: calc(78px + env(safe-area-inset-bottom)); }
`;
