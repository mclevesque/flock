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

/* ── The story ──────────────────────────────────────────────────────────────
   Rosters top and bottom, the fight between them. The same shape as the draft
   table on purpose: it is the same information at the same moment of the game
   and nobody should have to learn a second layout for it. */
.dm-st {
  position: fixed; inset: 0; z-index: 100;
  display: grid; grid-template-rows: auto auto 1fr auto;
  background: #08080a;
  cursor: pointer; user-select: none;
}

/* The board's landscape, held behind the whole screen. Dimmed hard: it is the
   ground the fight is on, not something anybody should be reading. */
.dm-st-ground {
  position: absolute; inset: 0; z-index: 0; overflow: hidden;
  pointer-events: none;
}
.dm-st-scene {
  width: 100%; height: 100%;
  object-fit: cover;
  opacity: .5;
}
.dm-st-ground::after {
  content: ""; position: absolute; inset: 0;
  background:
    radial-gradient(120% 70% at 50% 42%, rgba(6,6,8,.62) 0%, rgba(6,6,8,.9) 68%),
    linear-gradient(180deg, rgba(6,6,8,.85) 0%, rgba(6,6,8,.4) 26%,
      rgba(6,6,8,.4) 74%, rgba(6,6,8,.85) 100%);
}
/* Grid items default to min-width:auto, which means a row of portraits wider
   than the phone pushes the whole column out with it -- the story, the top
   bar and all. Nothing here is allowed to be wider than the screen. */
.dm-st > *:not(.dm-st-ground) { position: relative; z-index: 1; min-width: 0; }

.dm-st-top {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; cursor: default;
}
.dm-st-where {
  font-family: var(--dm-display); font-size: 11.5px; letter-spacing: .18em;
  text-transform: uppercase; color: rgb(var(--dm-glow) / .6);
}
.dm-st-where em {
  font-style: normal; margin-left: 10px; letter-spacing: .06em;
  text-transform: none; color: rgba(240,230,210,.4);
}
.dm-st-controls { display: flex; gap: 6px; }

/* ── A bench ──────────────────────────────────────────────────────────────── */
.dm-st-bench { padding: 6px 16px; }
.dm-st-bench[data-align="top"] { border-bottom: 1px solid rgb(var(--dm-glow) / .12); }
.dm-st-bench[data-align="bottom"] { border-top: 1px solid rgb(var(--dm-glow) / .12); }
.dm-st-who {
  display: flex; align-items: baseline; gap: 8px; margin-bottom: 5px;
  font-family: var(--dm-display); font-size: 11px; letter-spacing: .16em;
  text-transform: uppercase; color: rgba(240,230,210,.45);
}
.dm-st-who b { color: var(--dm-gold); letter-spacing: 0; font-size: 12.5px; }

.dm-st-cards {
  display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;
  align-items: flex-start;
}
.dm-st-card {
  position: relative; margin: 0; width: clamp(72px, 9vw, 104px);
  transition: opacity .5s ease, filter .5s ease;
}
.dm-st-art {
  position: relative; display: block; overflow: hidden;
  aspect-ratio: 4 / 5; border-radius: 9px; background: #0c0b09;
  border: 1px solid rgb(var(--dm-glow) / .22);
}
.dm-st-art img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 20%; }
.dm-st-initial {
  display: grid; place-items: center; width: 100%; height: 100%;
  font-family: var(--dm-display); font-size: 26px; color: rgb(var(--dm-glow) / .45);
}
.dm-st-ord, .dm-st-cap {
  position: absolute; left: 3px; top: 3px;
  min-width: 14px; height: 14px; padding: 0 3px;
  display: grid; place-items: center; border-radius: 4px;
  background: rgba(8,8,10,.85); border: 1px solid rgb(var(--dm-glow) / .3);
  font-family: var(--dm-display); font-size: 9px; color: rgb(var(--dm-glow) / .8);
}
.dm-st-cap { background: linear-gradient(180deg, #f6e3ae, #c9a558); color: #17130a; border-color: #b08c37; }
.dm-st-card figcaption {
  margin-top: 4px; text-align: center; font-size: 10.5px; line-height: 1.25;
  color: rgba(240,230,210,.82);
  /* Two lines' worth of room whether the name needs it or not, so the row
     lines up and the story keeps the space. */
  height: 2.5em;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
/* The condition it was drafted in — the thing that actually reaches the fight. */
.dm-st-cond {
  text-align: center; margin-top: 2px;
  font-size: 9.5px; line-height: 1.3; color: rgb(var(--dm-glow) / .6);
  height: 1.3em;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
}

/* Struck out the moment the story kills them. Grey ALONE reads as "not this
   one yet" -- it is the word stamped across the face that reads as gone, so
   the portrait desaturates and the stamp stays in full colour on top of it. */
.dm-st-card[data-dead="1"] { opacity: .62; }
.dm-st-card[data-dead="1"] .dm-st-art { border-color: rgba(224,64,42,.4); }
.dm-st-card[data-dead="1"] .dm-st-art img,
.dm-st-card[data-dead="1"] .dm-st-initial { filter: grayscale(1) brightness(.5); }
.dm-st-card[data-dead="1"] figcaption {
  color: rgba(240,230,210,.42); text-decoration: line-through;
}
.dm-st-card[data-dead="1"] .dm-st-cond { opacity: .3; }
.dm-st-down {
  position: absolute; left: -8%; right: -8%; top: 50%; z-index: 2;
  transform: translateY(-50%) rotate(-11deg);
  padding: 2px 0; text-align: center;
  font-family: var(--dm-display); font-weight: 700;
  font-size: clamp(10px, 1.25vw, 15px); letter-spacing: .2em;
  color: #ff4f3c; background: rgba(12,4,3,.46);
  border-top: 2px solid #e0402a; border-bottom: 2px solid #e0402a;
  text-shadow: 0 1px 6px rgba(0,0,0,.95);
  animation: dm-st-stamp .4s cubic-bezier(.2,1.6,.4,1) both;
}
@keyframes dm-st-stamp {
  from { opacity: 0; transform: translateY(-50%) rotate(-11deg) scale(2); }
  to   { opacity: 1; transform: translateY(-50%) rotate(-11deg) scale(1); }
}
@media (prefers-reduced-motion: reduce) { .dm-st-down { animation: none; } }

/* ── The crawl ──────────────────────────────────────────────────────────────
   One piece of prose climbing the screen at reading pace. Not a stack of
   paragraphs arriving one at a time: those make the reader start over on
   every one of them, and this is a thing to settle into and listen to.

   Locked while it runs -- the frame loop owns scrollTop and would fight a
   reader for it -- and released the moment it ends, because the first thing
   anybody does is go back to the bit where their card died. */
.dm-st-page {
  position: relative;
  overflow: hidden;
  overscroll-behavior: contain;
  /* Lines rise out of the bottom edge and dissolve off the top rather than
     being sliced by either of them. */
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 16%, #000 80%, transparent 100%);
          mask-image: linear-gradient(180deg, transparent 0%, #000 16%, #000 80%, transparent 100%);
}
.dm-st-page[data-done="1"] {
  overflow-y: auto;
  -webkit-mask-image: none; mask-image: none;
  scrollbar-width: thin;
  scrollbar-color: rgb(var(--dm-glow) / .3) transparent;
}

.dm-st-reel {
  position: relative;          /* offsetParent for the read-line arithmetic */
  display: flex; flex-direction: column; align-items: center;
  gap: 11px; padding: 0 16px;
  transition: opacity 1s ease .15s;
  /* The crawl moves this with a transform rather than the container's
     scrollTop, because scrollTop rounds to whole device pixels and a third of
     a pixel a frame turns into a visible stutter on a phone. Promoted so the
     compositor owns the motion. */
  will-change: transform;
  backface-visibility: hidden;
}
/* Laid out, measurable, and unreadable: the crawl needs the reel's real
   geometry from the first frame, but the opening beats must not sit behind
   the invocation. It fades up as the rite fades down. */
.dm-st-reel[data-hold="1"] { opacity: 0; transition-delay: 0s; }
/* Room to climb into at both ends: the first line starts low on the screen,
   and the last one reaches the middle instead of stopping at the foot. */
.dm-st-gap { flex: none; width: 1px; height: 46%; min-height: 140px; }
.dm-st-gap[data-tail="1"] { height: 0; min-height: 0; }

.dm-st-beat {
  margin: 0; width: 100%; max-width: 52ch;
  font-family: var(--dm-display);
  font-size: clamp(16px, 1.7vw, 21px); line-height: 1.62;
  /* Centred and level. The tilt is the one part of the crawl we do not want:
     it costs legibility and this text is the whole event. */
  text-align: center; text-wrap: pretty;
  color: #f4ecdc;
  /* Over a painting, so the words carry their own darkness with them. */
  text-shadow: 0 2px 14px rgba(0,0,0,.9), 0 0 34px rgba(0,0,0,.7);
}
/* A killing beat gets a faint warmth behind it -- enough to feel, not enough
   to fight the name that is about to be picked out in red. Tinting the whole
   paragraph was the old way, and it made the one word that matters harder to
   find rather than easier. */
.dm-st-beat[data-kill="1"] {
  text-shadow: 0 2px 14px rgba(0,0,0,.9), 0 0 40px rgba(224,90,60,.22);
}

/* Whoever went down, by name. Read against #f4ecdc on near-black, so it is a
   warm red rather than a signal red: legible at this size, and it does not
   glow at the reader from three paragraphs away. */
.dm-st-fell {
  font-style: normal; font-weight: 600;
  color: #ff7a63;
  text-shadow: 0 2px 12px rgba(0,0,0,.95), 0 0 26px rgba(224,64,42,.4);
}

/* ── The opening rite ──────────────────────────────────────────
   The wait before the story lands, spent as the announcer settling the room.
   Held over the page rather than in the reel so the beats can arrive behind
   it, and faded out on handover so the last line dissolves into the crawl
   instead of being cut off by it. */
.dm-st-rite {
  position: absolute; inset: 0; z-index: 2;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 0 24px; text-align: center;
  pointer-events: none;
  transition: opacity .9s ease, transform .9s ease;
}
.dm-st-rite[data-out="1"] { opacity: 0; transform: translateY(-14px); }

.dm-st-rite-line {
  margin: 0; max-width: 40ch;
  font-family: var(--dm-display);
  font-size: clamp(19px, 2.5vw, 31px); line-height: 1.42;
  letter-spacing: .012em; text-wrap: balance;
  color: #f6efe0;
  text-shadow: 0 2px 18px rgba(0,0,0,.92), 0 0 44px rgba(0,0,0,.7);
  animation: dm-st-rite-in 1.5s cubic-bezier(.2,.7,.25,1) both;
}
/* The closing line is the quiet one, and it keeps breathing while it waits. */
.dm-st-rite-line[data-last="1"] {
  font-size: clamp(20px, 2.7vw, 34px);
  color: var(--dm-gold);
  animation: dm-st-rite-in 2.2s cubic-bezier(.2,.7,.25,1) both,
             dm-st-rite-hold 5.5s ease-in-out 2.2s infinite;
}
@keyframes dm-st-rite-in {
  from { opacity: 0; transform: translateY(12px); filter: blur(7px); letter-spacing: .12em; }
  to   { opacity: 1; transform: none; filter: blur(0); letter-spacing: .012em; }
}
@keyframes dm-st-rite-hold {
  0%, 100% { opacity: 1; }
  50%      { opacity: .62; }
}

/* Three lights under the closing line, and only once it has been said: any
   earlier and the rite reads as a spinner sitting on top of a poem. */
.dm-st-rite-wait { display: flex; gap: 8px; margin-top: 4px; animation: dm-st-rite-in 1.4s ease both; }
.dm-st-rite-wait i {
  width: 5px; height: 5px; border-radius: 50%;
  background: rgb(var(--dm-glow) / .6);
  animation: dm-st-breathe 1.5s ease-in-out infinite;
}
.dm-st-rite-wait i:nth-child(2) { animation-delay: .22s; }
.dm-st-rite-wait i:nth-child(3) { animation-delay: .44s; }
@keyframes dm-st-breathe {
  0%, 100% { opacity: .18; transform: scale(.75); }
  50%      { opacity: 1;   transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .dm-st-rite-line, .dm-st-rite-wait, .dm-st-rite-wait i { animation: none; }
  .dm-st-rite-line[data-last="1"] { opacity: 1; }
}

/* ── How it ends ────────────────────────────────────────────────────────────
   The last thing in the reel rather than a curtain dropped over it. An
   overlay cuts the story off mid-breath -- which is exactly what it felt
   like -- where this is simply what the prose arrives at, and the reader can
   scroll back up through the fight afterwards without dismissing anything. */
.dm-st-fin {
  display: flex; flex-direction: column; align-items: center; gap: 7px;
  text-align: center; padding: 14px 8px 10px; max-width: 60ch;
}
.dm-st-win-crown { color: var(--dm-gold); }
.dm-st-win-name {
  margin: 0;
  font-family: var(--dm-display);
  font-size: clamp(25px, 3.6vw, 44px); line-height: 1.05; font-weight: 700;
  letter-spacing: .01em;
  background: linear-gradient(180deg, #fdf3d4 0%, var(--dm-gold) 52%, #9d7a2c 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  /* The glow has to be a shadow on the element, not on the clipped text. */
  filter: drop-shadow(0 4px 30px rgb(var(--dm-glow) / .4));
  text-wrap: balance;
}
.dm-st-win-left {
  margin: 0; max-width: 46ch;
  font-size: 13.5px; line-height: 1.55; color: rgba(240,236,228,.62);
}
/* Why they won, in plain words -- the storyteller's voice is finished by
   here, so this is set apart from the prose rather than continuing it. */
.dm-st-why {
  margin: 2px 0 4px; max-width: 52ch;
  padding: 11px 15px; border-radius: 12px;
  background: rgba(10,9,7,.55);
  border: 1px solid rgb(var(--dm-glow) / .16);
  font-size: 14.5px; line-height: 1.62; color: rgba(244,236,220,.9);
  text-shadow: 0 1px 8px rgba(0,0,0,.8);
}

.dm-st-hint {
  text-align: center; padding-bottom: 10px;
  font-size: 11.5px; color: rgba(240,230,210,.28);
}

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
/* ── The story on a phone ───────────────────────────────────────────────────
   Two benches and a wall of text do not fit a handset at desktop sizes, and
   the text is the thing anybody is actually here for. So the rosters give up
   their room first: smaller portraits, one line of name, no variant line, and
   a single row that never wraps -- one card breaking onto a second row was
   costing the story a whole band of the screen. */
@media (max-width: 640px) {
  .dm-st-bench { padding: 5px 8px; }
  .dm-st-who { margin-bottom: 3px; font-size: 10px; }
  .dm-st-cards {
    gap: 5px; flex-wrap: nowrap;
    /* Clipped rather than scrolled: a scrollbar here would fight the crawl. */
    overflow: hidden;
  }
  .dm-st-card { width: auto; flex: 1 1 0; min-width: 0; max-width: 72px; }
  .dm-st-card figcaption {
    height: 1.25em; -webkit-line-clamp: 1; font-size: 9.5px;
  }
  .dm-st-cond { display: none; }
  .dm-st-down { font-size: 9px; letter-spacing: .12em; border-width: 1.5px; }

  .dm-st-beat { font-size: 16px; line-height: 1.58; max-width: none; }
  .dm-st-reel { gap: 10px; padding: 0 14px; }
  .dm-st-gap { height: 42%; min-height: 110px; }
  /* One tight strip. The board name wrapping to three lines, with oversized
     controls beside it, was costing the story a fifth of a phone screen. */
  .dm-st-top { padding: 6px 9px; gap: 8px; align-items: center; }
  .dm-st-where {
    min-width: 0; flex: 1 1 auto; font-size: 10px; letter-spacing: .12em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .dm-st-where em { margin-left: 6px; }
  .dm-st-controls { flex: none; gap: 4px; }
  .dm-st-controls .dm-btn { padding: 4px 8px; font-size: 9.5px; letter-spacing: .08em; }
  .dm-st-hint { font-size: 10px; padding-bottom: 6px; }
  .dm-st-fin { padding: 12px 4px 10px; gap: 6px; }
  .dm-st-rite { gap: 11px; padding: 0 18px; }
  .dm-st-rite-line { font-size: 19px; max-width: none; }
  .dm-st-rite-line[data-last="1"] { font-size: 20px; }
}

`;
