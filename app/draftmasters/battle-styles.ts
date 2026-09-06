/**
 * Battle cinematic styles.
 *
 * Kept apart from the main sheet because it's a self-contained mode: a fixed
 * full-screen stage with its own layout at both sizes. Desktop puts the two
 * rosters in side rails flanking the clash; under 820px they become horizontal
 * strips top and bottom so the fight itself keeps the middle of the screen.
 */

export const BATTLE_STYLES = `
/* The Battle button — the loud one, so it reads as the main event. */
.dm-btn-battle {
  background: linear-gradient(180deg, #e8703a, var(--dm-ember));
  border-color: #a8401a;
  color: #fff;
  font-weight: 850;
  letter-spacing: .03em;
  text-shadow: 0 1px 4px rgba(0,0,0,.35);
}
.dm-btn-battle:hover:not(:disabled) {
  background: linear-gradient(180deg, #f28250, #d05c22);
  border-color: #c05226;
}

.dm-bt {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(120% 70% at 50% 0%, #2a1a12 0%, rgba(8,8,10,0) 55%),
    radial-gradient(90% 60% at 50% 100%, #1a1424 0%, rgba(8,8,10,0) 60%),
    #08080a;
  color: var(--dm-text);
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  animation: dm-bt-in .5s ease;
}
@keyframes dm-bt-in { from { opacity: 0; } to { opacity: 1; } }

/* Impact shake — scaled by beat intensity. */
.dm-bt[data-shake="1"] { animation: dm-bt-in .5s ease, dm-bt-shake .3s ease; }
.dm-bt[data-shake="2"] { animation: dm-bt-in .5s ease, dm-bt-shake .42s cubic-bezier(.36,.07,.19,.97); }
.dm-bt[data-shake="3"] { animation: dm-bt-in .5s ease, dm-bt-shake-hard .55s cubic-bezier(.36,.07,.19,.97); }
@keyframes dm-bt-shake {
  10%, 90% { transform: translate(-2px, 1px); }
  30%, 70% { transform: translate(3px, -2px); }
  50% { transform: translate(-4px, 2px); }
}
@keyframes dm-bt-shake-hard {
  8%  { transform: translate(-8px, 4px) rotate(-.4deg); }
  22% { transform: translate(9px, -5px) rotate(.5deg); }
  38% { transform: translate(-11px, 3px) rotate(-.6deg); }
  55% { transform: translate(8px, -3px) rotate(.4deg); }
  72% { transform: translate(-5px, 2px); }
  88% { transform: translate(3px, -1px); }
}

/* ── Top bar ──────────────────────────────────────────────────────────── */

.dm-bt-top {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 12px 14px; cursor: default; flex-shrink: 0;
}
.dm-bt-topic {
  font-size: 12px; letter-spacing: .16em; text-transform: uppercase;
  color: var(--dm-mute); font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dm-bt-top-actions { display: flex; gap: 8px; flex-shrink: 0; }
.dm-bt-mini { min-height: 36px; padding: 6px 12px; font-size: 12.5px; }

.dm-bt-progress { height: 2px; background: rgba(255,255,255,.07); flex-shrink: 0; }
.dm-bt-progress i {
  display: block; height: 100%;
  background: linear-gradient(90deg, var(--dm-ember), var(--dm-gold-hot));
  transition: width .35s ease;
}

/* ── Arena ────────────────────────────────────────────────────────────── */

.dm-bt-arena {
  flex: 1; min-height: 0;
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(0, 2.4fr) minmax(120px, 1fr);
  gap: 10px; padding: 10px 12px; align-items: stretch;
}

.dm-bt-rail {
  display: flex; flex-direction: column; gap: 8px; min-width: 0;
  padding: 10px; border-radius: 14px;
  border: 1px solid var(--dm-line); background: rgba(20,20,22,.6);
  transition: border-color .3s ease, background .3s ease;
}
.dm-bt-rail[data-acting="1"] {
  border-color: var(--dm-gold);
  background: rgba(212,169,66,.08);
  box-shadow: 0 0 24px rgba(212,169,66,.12);
}
.dm-bt-rail-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.dm-bt-rail-name {
  font-weight: 750; font-size: 14px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.dm-bt-rail-count { font-size: 12px; color: var(--dm-mute); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.dm-bt-rail-cards { display: flex; flex-direction: column; gap: 6px; overflow: hidden; }

.dm-bt-card {
  position: relative; display: flex; align-items: center; gap: 8px;
  padding: 5px; border-radius: 9px; background: var(--dm-panel-2);
  transition: opacity .5s ease, filter .5s ease, transform .5s ease;
  min-width: 0;
}
.dm-bt-card img, .dm-bt-card .dm-bt-initial {
  width: 34px; height: 40px; border-radius: 6px; flex-shrink: 0;
  object-fit: cover; object-position: 50% 20%;
  display: grid; place-items: center;
  background: var(--dm-panel); color: var(--dm-mute); font-weight: 800; font-size: 15px;
}
.dm-bt-card-name {
  font-size: 12px; font-weight: 600; line-height: 1.25;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dm-bt-card[data-dead="1"] {
  opacity: .32; filter: grayscale(1); transform: translateY(3px) rotate(-1.5deg);
}
.dm-bt-card[data-dead="1"]::after {
  content: "✕"; position: absolute; right: 8px;
  color: var(--dm-red); font-weight: 900; font-size: 15px;
}

/* ── Clash stage ──────────────────────────────────────────────────────── */

.dm-bt-center { display: grid; place-items: center; min-width: 0; min-height: 0; }
.dm-bt-clash {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  gap: clamp(8px, 4vw, 40px);
  width: 100%; height: 100%;
}

.dm-bt-actor {
  margin: 0; display: flex; flex-direction: column; align-items: center; gap: 8px;
  min-width: 0;
}
.dm-bt-actor img, .dm-bt-actor .dm-bt-initial {
  width: clamp(90px, 20vw, 190px);
  aspect-ratio: 4 / 5;
  height: auto;
  border-radius: 14px;
  object-fit: cover; object-position: 50% 20%;
  border: 2px solid var(--dm-line-hot);
  box-shadow: 0 18px 44px rgba(0,0,0,.7);
  background: var(--dm-panel);
  display: grid; place-items: center;
  color: rgba(212,169,66,.4); font-weight: 800; font-size: 40px;
}
.dm-bt-actor figcaption {
  font-size: clamp(12px, 2.6vw, 15px); font-weight: 750; text-align: center;
  max-width: 22ch; line-height: 1.25;
  text-shadow: 0 2px 10px rgba(0,0,0,.8);
}
.dm-bt-actor[data-from="left"]  { animation: dm-bt-charge-l .45s cubic-bezier(.2,.9,.3,1.2); }
.dm-bt-actor[data-from="right"] { animation: dm-bt-charge-r .45s cubic-bezier(.2,.9,.3,1.2); }
@keyframes dm-bt-charge-l {
  from { transform: translateX(-42%) scale(.86); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
@keyframes dm-bt-charge-r {
  from { transform: translateX(42%) scale(.86); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
.dm-bt-actor[data-dead="1"] img { filter: grayscale(.85) brightness(.7); border-color: var(--dm-red); }

/* Slash + flash */
.dm-bt-slash {
  position: absolute; left: -10%; top: 50%;
  width: 120%; height: clamp(3px, .6vw, 6px);
  background: linear-gradient(90deg, transparent, #fff 35%, #fff 65%, transparent);
  transform-origin: center;
  animation: dm-bt-slash .42s ease-out forwards;
  pointer-events: none;
  filter: drop-shadow(0 0 10px rgba(255,255,255,.9));
}
.dm-bt-slash[data-second="1"] { animation-delay: .12s; }
@keyframes dm-bt-slash {
  0%   { transform: rotate(-24deg) scaleX(0); opacity: 0; }
  25%  { transform: rotate(-24deg) scaleX(1); opacity: 1; }
  100% { transform: rotate(-24deg) scaleX(1); opacity: 0; }
}
.dm-bt-flash {
  position: absolute; inset: -20%;
  background: radial-gradient(circle at 50% 50%, rgba(255,240,200,.5), transparent 60%);
  animation: dm-bt-flash .32s ease-out forwards;
  pointer-events: none;
}
@keyframes dm-bt-flash { from { opacity: 1; } to { opacity: 0; } }

.dm-bt-stamp {
  position: absolute; top: 12%; left: 50%;
  transform: translateX(-50%) rotate(-9deg);
  font-size: clamp(26px, 7vw, 48px); font-weight: 900; letter-spacing: .06em;
  color: var(--dm-red); border: 4px solid currentColor; border-radius: 10px;
  padding: 4px 16px; background: rgba(8,8,10,.5);
  animation: dm-bt-stamp .4s cubic-bezier(.2,1.5,.4,1);
  pointer-events: none;
}
@keyframes dm-bt-stamp {
  from { transform: translateX(-50%) rotate(-9deg) scale(1.6); opacity: 0; }
  to   { transform: translateX(-50%) rotate(-9deg) scale(1); opacity: 1; }
}

/* ── Caption ──────────────────────────────────────────────────────────── */

.dm-bt-caption {
  flex-shrink: 0;
  margin: 0 auto; padding: 14px clamp(14px, 4vw, 28px) 16px;
  max-width: 900px; width: 100%;
  text-align: center;
}
.dm-bt-caption p {
  margin: 0;
  font-size: clamp(16px, 3.4vw, 25px);
  font-weight: 650; line-height: 1.4;
  text-wrap: balance;
  animation: dm-bt-text .35s ease;
  text-shadow: 0 2px 14px rgba(0,0,0,.9);
}
@keyframes dm-bt-text { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
.dm-bt-caption[data-kind="kill"] p   { color: #ffb3ae; }
.dm-bt-caption[data-kind="comic"] p  { color: var(--dm-dim); font-style: italic; }
.dm-bt-caption[data-kind="turn"] p,
.dm-bt-caption[data-kind="heroic"] p { color: var(--dm-gold-hot); }
.dm-bt-caption[data-kind="final"] p  { color: var(--dm-gold-hot); font-weight: 800; }

.dm-bt-hint {
  flex-shrink: 0; text-align: center; padding-bottom: 12px;
  font-size: 11.5px; color: var(--dm-mute); letter-spacing: .04em;
}

/* ── Ending ───────────────────────────────────────────────────────────── */

.dm-bt-end {
  flex-shrink: 0; text-align: center; padding: 4px 16px 22px; cursor: default;
  animation: dm-bt-text .5s ease;
}
.dm-bt-crown { font-size: 40px; line-height: 1; animation: dm-bt-stamp .6s cubic-bezier(.2,1.4,.4,1); }
.dm-bt-winner {
  font-size: clamp(19px, 4.4vw, 27px); font-weight: 850; margin: 6px 0 14px;
  background: linear-gradient(180deg, #f6e3ab, var(--dm-gold));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* ── Mobile: rails become strips, the fight keeps the middle ──────────── */

@media (max-width: 820px) {
  .dm-bt-arena {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 8px; padding: 8px 10px;
  }
  .dm-bt-rail { padding: 8px 10px; }
  .dm-bt-rail[data-align="right"] { order: 3; }
  .dm-bt-rail-cards { flex-direction: row; overflow-x: auto; gap: 6px; padding-bottom: 2px; scrollbar-width: none; }
  .dm-bt-rail-cards::-webkit-scrollbar { display: none; }
  .dm-bt-card { flex-direction: column; gap: 3px; padding: 4px; width: 60px; flex-shrink: 0; }
  .dm-bt-card img, .dm-bt-card .dm-bt-initial { width: 52px; height: 60px; }
  .dm-bt-card-name { font-size: 9.5px; max-width: 54px; text-align: center; }
  .dm-bt-card[data-dead="1"]::after { top: 2px; right: 4px; font-size: 12px; }
  .dm-bt-caption { padding: 10px 14px 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .dm-bt, .dm-bt-actor, .dm-bt-slash, .dm-bt-flash, .dm-bt-stamp, .dm-bt-caption p, .dm-bt-crown {
    animation: none !important;
  }
  .dm-bt-slash, .dm-bt-flash { display: none; }
}
`;
