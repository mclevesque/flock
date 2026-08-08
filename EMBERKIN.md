# Emberkin — creature raising game

Route: `/emberkin` · Portal: Great Souls (hub section **SOULBOUND**) · Added on branch `claude/greatsouls-netlify-app-slatwm`

A Tamagotchi/Neopets-shaped game. You hatch an egg, raise what comes out, and
fight it against NPCs and other keepers' creatures. Every creature is generated
from the player's "whisper" plus a hidden rarity roll, so no two are alike.

**Opening cinematic.** The game opens on a large centred egg in the dark, one
line of prompt, and one button: *Stoke the flames*. Three stokes; the flames
grow, the fire audio rises and crackles faster, the egg starts shaking. Then
*Speak to it* — a single text field, whose contents become the whisper. Then the
hatch: "Your great soul is hatching!" → "Behold, your Emberkin emerges!" → white
flash → the creature. You name it after you can see it.

---

## Run it

```bash
git checkout claude/greatsouls-netlify-app-slatwm   # or main, once merged
npm install --legacy-peer-deps
npm run dev
```

→ http://localhost:3000/emberkin (sign in first; reachable from `/greatsouls/hub`)

Needs `DATABASE_URL` in `.env.local`. `GROQ_API_KEY` is optional — without it the
game plays identically using procedural text instead of model output.

Tables create themselves on the first API call via `ensureEmberkinTables()`.
There is no migration step.

```bash
npx tsx scripts/emberkin-balance.ts   # 40+ engine checks + NPC win-rate simulation
npx tsc --noEmit                      # must pass clean
```

---

## The one rule that matters

**The engine owns every mechanic. The AI owns only flavour.**

`lib/emberkin-engine.ts` decides all outcomes from a seeded roll — stat deltas,
whether a mutation fires, who wins a battle. `lib/emberkin-ai.ts` is handed an
*already-resolved* outcome and writes the scene around it. It never picks a
number that touches game state.

This is why a hallucinating or offline model can produce a strange sentence but
never a broken creature. Every AI helper has a procedural fallback and returns
it on a missing key, a 429, a timeout, or malformed JSON.

**If you change one thing, keep this split.** Moving a mechanical decision into a
prompt is the failure mode this design exists to prevent.

Model output is also sanitised before it touches state (`str`, `emoji`,
`traitEffect` in `emberkin-ai.ts`) — trait effects are snapped to a closed set,
move power/cost stay engine-owned, and the model only supplies names and prose.

---

## Files

| File | What it does |
|---|---|
| `lib/emberkin-engine.ts` | Deterministic core. Zero AI, zero DB, zero network. Rolls, decay, stats, training resolution, battle sim, NPC generation, procedural fallbacks. |
| `lib/emberkin-ai.ts` | GROQ (LLaMA 3.3 70B) flavour layer. Six helpers, each with a fallback and an `ai` flag to force the fallback. |
| `lib/emberkin-state.ts` | DB row ⇄ engine `Creature` adapters, plus the client-facing projection. Validates loose JSONB before the engine sees it. |
| `lib/emberkin-progress.ts` | `runEvolution()`. Separate file because both routes trigger it and Next route modules may only export HTTP handlers. |
| `lib/db.ts` | `ensureEmberkinTables()` + queries, appended at end of file. |
| `app/api/emberkin/route.ts` | GET state; POST `lay` / `stoke` / `hatch` / `feed` / `play` / `rest` / `train` / `speak` / `rename` / `release`. |
| `app/api/emberkin/battle/route.ts` | GET opponents; POST fight (NPC or async rival duel). |
| `app/emberkin/EmberkinClient.tsx` | The keeper screen. Server-authoritative — posts an action, re-renders from the response. |
| `app/emberkin/HatchScene.tsx` | The opening cinematic: stoke → speak → hatch → name. Owns everything before the keeper screen. |
| `app/emberkin/useFireSound.ts` | Procedural fire audio (Web Audio API). No sound files — noise bed + synthesised crackle, driven by intensity. |
| `lib/emberkin-image.ts` | Creature portraits: HuggingFace FLUX → Pollinations fallback → R2. |
| `app/api/emberkin/portrait/route.ts` | Generates a portrait on demand. Never called inline with a hatch. |
| `scripts/emberkin-balance.ts` | Balance harness. The tier difficulty numbers came from this. |

---

## Data model

Three tables, all created by `ensureEmberkinTables()`:

- **`emberkin_creatures`** — one live creature per user (`released = false`).
  Stats, meters, `traits`/`moves` as JSONB, `whisper` and `seed` from the egg.
- **`emberkin_events`** — the journal. Each row has `text` (shown to the player)
  and `summary` (compact "keeper did X", fed to evolution as history).
- **`emberkin_battles`** — result + replayable beat log per fight.

Released creatures are kept as tombstones rather than deleted.

---

## Mechanics reference

**Luck.** `rollOutcome()` draws `wild` first as an independent event (1.5%, or 5%
with the `volatile` trait), then rolls d100 shifted by bond (±7), mood (±5),
low energy (−12) and the `lucky` trait (+8). Bands: fumble <9, weak <33,
normal <74, strong <93, crit ≥93.

Wild deliberately ignores bond and mood. Folding it into the top of the modified
roll made a well-loved creature mutate on ~11% of sessions.

**Tier budgets** (`TIER_BUDGET`) cap how many stat points a training session may
move: fumble −2, weak 1, normal 3, strong 6, crit 10, wild 8. Only crit and wild
can grant new moves or traits — normal sessions never do.

**Meters** decay in real time from `last_tick`, applied on every read. Hunger
−3.2/hr, mood −1.9/hr, energy **+**5.5/hr (idle rest), bond −0.35/hr with a floor
of 20 once earned. `effectiveStats()` scales combat power by care (0.7×–1.15×),
so neglect is mechanically real, not cosmetic.

**Stages** at level 5 / 12 / 22 (juvenile / adult / ascended). Evolution reads the
creature's whole `summary` history and rewrites species, appearance, sprite and
description from it, then applies a flat stat spike.

**Costs.** Train −22 energy / −10 hunger. Battle −25 energy / −12 hunger. Rest
+38 energy on a 20-minute cooldown.

**The egg.** `lay` takes no arguments — the egg exists before anything is said.
Each `stoke` is a flat +9 bond, so it is always exactly three, and the rhythm is
predictable. The whisper arrives with the `hatch` call. Rarity is rolled at `lay`
from a hidden seed and is independent of the whisper, so it can't be rerolled by
rewording.

**Whisper adherence.** The hatch prompt treats the whisper as a brief, not a
suggestion: carry its imagery into species/appearance/element/temperament, then
twist exactly one thing. The move is named after it and its `kind` chosen to
match. The no-AI path honours it too — `elementFromWhisper`,
`temperamentFromWhisper` and `moveKindFromText` in the engine map keywords onto
real mechanics, so "be fast and cruel" and "be gentle" diverge even with GROQ
down. Training instructions steer new move kinds the same way.

---

## Balance

NPCs scale off the player's **base** stats (not level, not effective stats):

| Tier | difficulty | win XP | measured win rate |
|---|---|---|---|
| Stray | 0.90 | 26 | ~94% |
| Warden | 1.05 | 48 | ~68% |
| Elder | 1.15 | 88 | ~40% |
| Horror | 1.25 | 165 | ~13% |

Measured across 30 random builds × 120 fights at each of levels 3–30. **Re-run
`scripts/emberkin-balance.ts` after touching combat maths or the tiers** — the
mapping from difficulty to win rate is steep and non-obvious.

Four traps the harness caught, all still guarded by assertions:

1. NPCs scaled off level fell behind trained players immediately, then leapt out
   of reach. Base-stat scaling fixed it.
2. Mitigation used a fixed constant (`60/(60+def)`), making the same tier trivial
   early and unwinnable late. It's now scale-relative (`scale/(scale+guard)`).
3. Hatching could roll a **ward-only** kit — 0.6× damage for a trivial heal, near
   unwinnable. `ward` and `chaos` are now mutation-only; `STARTER_MOVE_KINDS` is
   strike/guile/surge.
4. Losing to a Horror paid 58 XP while beating a Warden paid 48, so farming
   losses was optimal. Loss XP is capped at 25.

---

## Portraits

Generated once per form and stored in R2, so they cost nothing to re-display.

Provider chain, mirroring `app/api/generate-image/route.ts`:

1. **HuggingFace FLUX.1-schnell** — needs `HUGGINGFACE_TOKEN`. Better output, but
   HF's free hosted-inference allowance has tightened, so this may start
   returning 402/429 on a free account.
2. **Pollinations** — keyless, free, no quota. Lower fidelity, but it means
   portraits keep working regardless of HF.

If both fail, `generatePortrait()` returns null and the creature keeps its emoji
sprite. **A creature without a portrait is a fully working creature** — nothing
downstream depends on the image.

Generation takes 10–40s, so it is never inline with a hatch. The creature
appears immediately with its emoji, the client then POSTs `/api/emberkin/portrait`,
and the picture swaps in when it lands. Evolution sets `image_url` to null so the
new form gets drawn fresh.

## AI cost control

GROQ free tier only. No paid APIs anywhere in this path.

- One short, `max_tokens`-capped call per action; 9s timeout.
- **40 AI-backed actions per creature per rolling hour** (`AI_ACTIONS_PER_HOUR`,
  defined in both routes). Past the cap, actions resolve *identically* — they
  just get procedural narration. Play is never blocked.
- 20-minute rest cooldown so fight → rest can't loop unbounded.
- Battle narration sends only the last ~6 decisive beats, not the full log.

---

## Verified / not verified

Verified: `npx tsc --noEmit` clean, eslint clean, `npm run build` clean with all
three routes present, and the full balance harness passing.

**Not verified:** the live GROQ path and the live Neon path. The environment this
was built in had neither `GROQ_API_KEY` nor `DATABASE_URL`, so table creation and
real model responses have never actually run. First local run against the real DB
is the genuine smoke test.

---

## Known gaps / next steps

- **Pacing to first evolution is slow.** Level 5 is ~705 XP ≈ 15 Warden wins, and
  the energy budget spreads that over hours. Fine for a Tamagotchi cadence, bad
  for demoing. Options: lower the first threshold, raise early XP, or add a
  dev-only fast-forward gated to non-production.
- **Portrait quality depends on the provider that answered.** If HF is out of
  free quota every portrait comes from Pollinations, which is noticeably rougher.
  There is no UI signal for which one drew it.
- **Rival duels are one-directional.** You fight a snapshot of someone else's
  creature; their record is untouched. No notification to the defender.
- **Stale domain references elsewhere in the repo** (not Emberkin's doing):
  `capacitor.config.ts:8`, `app/profile/edit/page.tsx:773`,
  `app/town/TownClient.tsx:1878` still point at `flocksocial.netlify.app`, and
  `APPS.md:3` at `flock-two.vercel.app`. Production is greatsouls.net.
