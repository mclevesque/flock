/**
 * Battle cinematic styles.
 *
 * Kept apart from the main sheet because it's a self-contained mode: a fixed
 * full-screen stage with its own layout at both sizes. Desktop puts the two
 * rosters in side rails flanking the clash; under 820px they become horizontal
 * strips top and bottom so the fight itself keeps the middle of the screen.
 */

export const BATTLE_STYLES = `
/* The Battle button — the main event, and now the only button on that screen,
   so it can be loud in the game's own metal instead of in the hub's orange. */
.dm-btn-battle {
  background: linear-gradient(180deg, #f7e2ac, var(--dm-gold));
  border-color: #b08c37;
  color: #17130a;
  font-family: var(--dm-display);
  font-weight: 700;
  letter-spacing: .12em;
  min-width: 240px;
  box-shadow: 0 0 34px rgb(var(--dm-glow) / .3), 0 2px 0 rgba(0,0,0,.35);
  text-shadow: none;
}
.dm-btn-battle:hover:not(:disabled) {
  background: linear-gradient(180deg, #fdf0cd, var(--dm-gold-hot));
  border-color: var(--dm-gold);
  box-shadow: 0 0 48px rgb(var(--dm-glow) / .45), 0 2px 0 rgba(0,0,0,.35);
}

/* ── The two slots ──────────────────────────────────────────────────────────
   One card each side and a gap between them. Fixed positions: the pair on
   screen is the pair the rules are resolving, and it should not move around
   as the narrator changes who it is talking about. */
/* ── The rail ───────────────────────────────────────────────────────────── */

/* Where this card stands in the line. The single most useful thing the rail
   can say once a fight is under way. */
.dm-bt-ord {
  position: absolute; left: 4px; top: 4px; z-index: 2;
  min-width: 15px; height: 15px; padding: 0 3px;
  display: grid; place-items: center; border-radius: 4px;
  background: rgba(8,8,10,.82); border: 1px solid rgb(var(--dm-glow) / .3);
  font-family: var(--dm-display); font-size: 9.5px; font-weight: 700;
  color: rgb(var(--dm-glow) / .85);
}

/* Whoever is in the slot right now. Lit rather than moved, so the rail never
   reorders itself under the player's eye. */
.dm-bt-card[data-now="1"] {
  border-color: var(--dm-gold);
  box-shadow: 0 0 0 1px rgb(var(--dm-glow) / .45), 0 0 20px rgb(var(--dm-glow) / .28);
}
.dm-bt-card[data-now="1"] .dm-bt-card-name { color: var(--dm-gold); }

/* The captain, set apart from the line they are standing behind. */
.dm-bt-rail-cap {
  margin-top: 10px; padding-top: 9px;
  border-top: 1px dashed rgb(var(--dm-glow) / .22);
}
.dm-bt-rail-label {
  display: block; margin-bottom: 5px;
  font-family: var(--dm-display); font-size: 9px; letter-spacing: .2em;
  text-transform: uppercase; color: rgb(var(--dm-glow) / .55);
}

.dm-bt-slots {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  justify-items: center;
  gap: clamp(12px, 4vw, 48px);
  width: 100%;
  position: relative;
}

.dm-bt-slot {
  position: relative;
  margin: 0;
  width: clamp(132px, 22vw, 208px);
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  padding: 7px 7px 30px;
  border: 1px solid rgb(var(--dm-glow) / .3);
  background: linear-gradient(180deg, #1a1710, #0c0b09);
  box-shadow: 0 14px 34px rgba(0,0,0,.6);
  transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease, opacity .3s ease;
}
.dm-bt-slot[data-empty="1"] { visibility: hidden; }
/* Whoever is swinging leans in. Small, because a card that jumps is a card
   you have to re-find every beat. */
.dm-bt-slot[data-acting="1"] {
  border-color: var(--dm-gold);
  box-shadow: 0 0 0 1px rgb(var(--dm-glow) / .4), 0 18px 44px rgb(var(--dm-glow) / .22);
  transform: translateY(-6px) scale(1.03);
}
.dm-bt-slot[data-side="left"][data-acting="1"] { transform: translateY(-6px) translateX(8px) scale(1.03); }
.dm-bt-slot[data-side="right"][data-acting="1"] { transform: translateY(-6px) translateX(-8px) scale(1.03); }
.dm-bt-slot[data-dead="1"] { opacity: .42; filter: grayscale(.85); }

.dm-bt-art {
  position: relative; display: block; overflow: hidden;
  border-radius: 10px; aspect-ratio: 4 / 5; background: #000;
}
.dm-bt-art img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; }
.dm-bt-art-fb {
  display: grid; place-items: center; width: 100%; height: 100%;
  font-family: var(--dm-display); font-size: 44px; color: rgb(var(--dm-glow) / .5);
}

.dm-bt-name {
  margin-top: 7px; text-align: center;
  font-family: var(--dm-display); font-size: 13.5px; line-height: 1.2;
  color: #f0e6d2; text-wrap: balance;
}
/* The condition, kept to one line. It is worth knowing and it is not worth
   three lines of the only card on screen. */
.dm-bt-name em {
  display: block; margin-top: 2px;
  font-family: var(--dm-ui); font-style: normal; font-size: 10.5px;
  color: rgba(240,230,210,.5);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Health: a bar for the glance, a number for the detail. */
.dm-bt-hp {
  position: relative; display: block; height: 15px; margin-top: 7px;
  border-radius: 999px; overflow: hidden;
  background: rgba(255,255,255,.07);
}
.dm-bt-hp i {
  position: absolute; inset: 0 auto 0 0; display: block;
  border-radius: 999px; transition: width .3s ease, background .3s ease;
}
.dm-bt-hp b {
  position: relative; display: flex; align-items: center; justify-content: center; gap: 5px;
  font-size: 10.5px; font-weight: 800; line-height: 15px;
  font-variant-numeric: tabular-nums; color: #100d08;
}
.dm-bt-hp b s {
  text-decoration: none; font-size: 8px; letter-spacing: .14em; opacity: .62;
}
.dm-bt-hp[data-health="ok"]    i { background: linear-gradient(90deg, #b7902f, var(--dm-gold)); }
.dm-bt-hp[data-health="hurt"]  i { background: linear-gradient(90deg, #c07524, #e8973a); }
.dm-bt-hp[data-health="dying"] i { background: linear-gradient(90deg, #a32718, #e0402a); }
.dm-bt-hp[data-health="dying"] b { color: #fff; }

/* Bottom right, like every card game anybody has played. */
.dm-bt-stats {
  position: absolute; right: 8px; bottom: 6px;
  display: flex; align-items: baseline; gap: 2px;
  padding: 2px 9px; border-radius: 8px;
  background: linear-gradient(180deg, #241f16, #100e0a);
  border: 1px solid rgb(var(--dm-glow) / .38);
  font-family: var(--dm-display); font-variant-numeric: tabular-nums;
}
.dm-bt-stats b { font-size: 17px; font-weight: 700; color: #f4e9d0; }
.dm-bt-stats i { font-style: normal; font-size: 13px; color: rgba(240,230,210,.4); }
/* The one green in the product. It means somebody is helping. */
.dm-bt-stats b[data-boost="1"] { color: #5fd08a; text-shadow: 0 0 12px rgba(95,208,138,.5); }

/* Damage floating off whoever took it. */
.dm-bt-hit, .dm-bt-dmg {
  font-family: var(--dm-display); font-weight: 700;
  color: #ff6a4d; text-shadow: 0 2px 10px rgba(0,0,0,.8);
}
.dm-bt-hit {
  position: absolute; left: 50%; top: 38%; translate: -50% 0;
  font-size: clamp(26px, 5vw, 44px);
  animation: dm-bt-float .9s cubic-bezier(.2,.8,.3,1) forwards;
}
@keyframes dm-bt-float {
  from { opacity: 0; transform: translateY(10px) scale(.7); }
  35%  { opacity: 1; transform: translateY(-6px) scale(1.1); }
  to   { opacity: 0; transform: translateY(-38px) scale(1); }
}

.dm-bt-versus { display: grid; place-items: center; min-width: 44px; min-height: 44px; }
.dm-bt-versus i {
  display: block; width: 10px; height: 10px; rotate: 45deg;
  border: 1px solid rgb(var(--dm-glow) / .35);
}
.dm-bt-dmg { font-size: clamp(22px, 4vw, 34px); animation: dm-bt-float 1.1s ease-out forwards; }

@media (prefers-reduced-motion: reduce) {
  .dm-bt-hit, .dm-bt-dmg { animation: none; opacity: 1; }
  .dm-bt-slot { transition: none; }
}

/* ── The technical log ──────────────────────────────────────────────────────
   The story is on the stage; this is the receipt. Deliberately plain and
   deliberately small: a player who wants it will read it, and a player who
   does not will never notice it is there. */
.dm-bt-log {
  flex: 0 0 auto;
  margin: 0 auto;
  width: min(760px, 94vw);
  padding: 8px 12px 10px;
  border-top: 1px solid rgb(var(--dm-glow) / .16);
}
.dm-bt-log-head {
  margin: 0 0 4px;
  font-family: var(--dm-display); font-size: 10px; letter-spacing: .2em;
  text-transform: uppercase; color: rgb(var(--dm-glow) / .5);
}
.dm-bt-log-lines {
  max-height: 92px; overflow-y: auto; scrollbar-width: thin;
  display: flex; flex-direction: column; gap: 2px;
}
.dm-bt-log-lines p {
  margin: 0; font-size: 12.5px; line-height: 1.45;
  color: rgba(240,236,228,.42);
  font-variant-numeric: tabular-nums;
}
.dm-bt-log-lines p[data-now="1"] { color: rgba(240,236,228,.95); }
.dm-bt-log-lines p[data-kind="kill"] { color: #e08878; }
.dm-bt-log-lines p[data-kind="kill"][data-now="1"] { color: #ff8f79; }

@media (max-width: 820px) {
  .dm-bt-log-lines { max-height: 62px; }
  .dm-bt-slot { padding-bottom: 26px; }
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
  border: 1px solid transparent;
  transition: opacity .5s ease, filter .5s ease, transform .5s ease,
              border-color .3s ease, box-shadow .3s ease;
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

@keyframes dm-bt-stamp {
  from { transform: translate(-50%, -50%) rotate(-11deg) scale(1.7); opacity: 0; }
  to   { transform: translate(-50%, -50%) rotate(-11deg) scale(1); opacity: 1; }
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

.dm-bt-actor-shot { position: relative; display: block; line-height: 0; }
.dm-bt-dead {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-11deg);
  font-size: clamp(20px, 4.2vw, 34px); font-weight: 900; letter-spacing: .08em;
  color: #ff5f57; border: 4px solid currentColor; border-radius: 8px;
  padding: 2px 14px; background: rgba(8,8,10,.72); line-height: 1.1;
  animation: dm-bt-stamp .4s cubic-bezier(.2,1.5,.4,1);
  pointer-events: none; white-space: nowrap;
}
.dm-bt-actor[data-dead="1"] .dm-bt-actor-shot img { filter: grayscale(.9) brightness(.55); }

.dm-bt-topic { display: inline-flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.dm-bt-format {
  font-style: normal; font-size: 11px; font-weight: 800;
  letter-spacing: .1em; text-transform: uppercase;
  color: var(--dm-gold); opacity: .85;
}
`;
