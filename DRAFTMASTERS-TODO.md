# DraftMasters — open list

Running list of things to fix, newest requests appended. Not deployed until
the code word.

---

## 1. The gold ambience has a hard edge

**Wrong:** on the shelf, the gold ambient light stops at a visible rectangular
boundary — there is a hard line where the glow ends and flat black begins. It
reads as a lit box sitting on a dark page.

**Right:** the login screen. The ambience covers the whole screen and falls off
into nothing without ever showing an edge.

The particle field (`Motes.tsx`) is already full-viewport and fixed. The edge is
coming from something else painting a bounded glow underneath it — most likely
the `radial-gradient` on `.dm` itself, or a container with a background and a
max-width. Find what is drawing the boundary rather than layering more glow on
top of it.

Files: `app/draftmasters/styles.ts` (the `.dm` background), `app/draftmasters/Motes.tsx`.

---

## 2. CW portraits are missing or wrong

Several CW cards resolve to press photos rather than the character. Macy
Vaughn currently comes back as a Comic-Con panel shot with three people on a
stage holding microphones and a Collider banner behind them.

The board was portrait-filled by giving each card its own show's wiki, and
that clearly is not enough on its own: the CW board spans a dozen series, and
a Fandom search that misses falls through to something that is nominally about
the right person and useless as a card face.

Also still missing outright: Clark Kent, Barry Allen, Oliver Queen, Damien
Darhk. Barry Allen shows a letter B in the screenshot, so he is failing all
the way through to the initial fallback.

Worth checking whether the fallback should be the board's drawn scene rather
than a wrong photograph — a silhouette that is obviously art beats a stranger
at a convention.

---

## Still open from earlier

- **The mind mechanic** — Freddy, genjutsu, domain expansion. Designed, not
  built. Resolves on the user's action so rushdown beats it (Goku's 7 against
  Itachi's 4 means the genjutsu is never cast); rolls `d6 + mind` against
  `d6 + will`; a win costs the target their swing rather than killing them; the
  mindless are immune. `willOf` and `hasMind` already exist in `rush.ts` — the
  resolver hook does not.
- **Pokémon captains** — 48 written of a naive 108 target. The 48 cover the
  recognisable cards; the rest of that board is filler and probably should stay
  on generic roles.
- **Portraits** — 4 CW cards still missing (Clark Kent, Barry Allen, Oliver
  Queen, Damien Darhk).
- **Orphaned routes** — `/api/draftmasters/judge`, `/battle` and `/topic` have
  no caller since the fight became local.
