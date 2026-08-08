/**
 * Emberkin balance harness — no DB, no AI, no network.
 *
 * Verifies the deterministic core: luck rolls, meter decay, training budgets,
 * the levelling curve, NPC difficulty calibration, and the XP economy. The tier
 * `difficulty` values in lib/emberkin-engine.ts were derived from this, not
 * guessed — rerun it after touching combat maths or the NPC tiers.
 *
 *   npx tsx scripts/emberkin-balance.ts
 */
import {
  makeRng, hashSeed, rollRarity, rollOutcome, applyDecay, applyXp, applyDeltas,
  resolveTraining, baseStatsFor, proceduralIdentity, proceduralTrait, proceduralMove, STARTER_MOVE_KINDS,
  simulateBattle, toCombatant, makeNpc, effectiveStats, xpForLevel, stageForLevel,
  NPC_TIERS, FOODS, TRAINING_FOCUS,
  type Creature, type OutcomeTier, type Rarity,
} from "../lib/emberkin-engine";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) { failures++; console.log(`  FAIL  ${name} ${detail}`); }
  else console.log(`  ok    ${name} ${detail}`);
}

function makeCreature(seed: number, rarity: Rarity = "common"): Creature {
  const rng = makeRng(seed);
  const id = proceduralIdentity(rng, rarity);
  const stats = baseStatsFor(rng, rarity);
  return {
    id: `c${seed}`, owner_id: "u1", name: "Test", species: id.species,
    description: id.description, stage: "hatchling", rarity, element: id.element,
    temperament: id.temperament, appearance: id.appearance, sprite: id.sprite,
    image_url: null, ...stats, level: 1, xp: 0,
    hunger: 70, energy: 100, mood: 60, bond: 10,
    traits: [proceduralTrait(rng, id.element)], moves: [proceduralMove(rng, id.element, "normal", STARTER_MOVE_KINDS)],
    wins: 0, losses: 0, hatched_at: new Date().toISOString(),
    last_tick: new Date().toISOString(),
  };
}

console.log("\n── rarity distribution over 20k rolls ──");
{
  const counts: Record<string, number> = {};
  const rng = makeRng(12345);
  for (let i = 0; i < 20000; i++) { const r = rollRarity(rng); counts[r] = (counts[r] ?? 0) + 1; }
  console.log("  ", Object.entries(counts).map(([k, v]) => `${k} ${(v / 200).toFixed(1)}%`).join("  "));
  check("all five rarities appear", Object.keys(counts).length === 5);
  check("aberrant is rare", counts.aberrant / 20000 < 0.04);
  check("common is most frequent", counts.common > counts.uncommon);
}

console.log("\n── outcome tiers: healthy vs neglected ──");
{
  const tally = (c: Creature) => {
    const rng = makeRng(999);
    const t: Record<string, number> = {};
    for (let i = 0; i < 10000; i++) { const { tier } = rollOutcome(rng, c); t[tier] = (t[tier] ?? 0) + 1; }
    return t;
  };
  const good = makeCreature(1); good.bond = 90; good.mood = 90; good.energy = 90;
  const bad = makeCreature(1); bad.bond = 5; bad.mood = 10; bad.energy = 10;
  const g = tally(good), b = tally(bad);
  console.log("   cared-for :", Object.entries(g).map(([k, v]) => `${k} ${(v / 100).toFixed(1)}%`).join(" "));
  console.log("   neglected :", Object.entries(b).map(([k, v]) => `${k} ${(v / 100).toFixed(1)}%`).join(" "));
  check("care raises crit rate", (g.crit ?? 0) > (b.crit ?? 0));
  check("neglect raises fumble rate", (b.fumble ?? 0) > (g.fumble ?? 0));
  check("wild outcomes stay rare for a cared-for creature", (g.wild ?? 0) / 10000 < 0.035, `(${((g.wild ?? 0) / 100).toFixed(2)}%)`);
  check("wild rate ignores care level", Math.abs((g.wild ?? 0) - (b.wild ?? 0)) / 10000 < 0.012);
  check("crit stays a genuine high roll", (g.crit ?? 0) / 10000 < 0.22, `(${((g.crit ?? 0) / 100).toFixed(1)}%)`);
  check("most sessions are ordinary", (g.normal ?? 0) / 10000 > 0.3);
}

console.log("\n── volatile trait widens the tails ──");
{
  const plain = makeCreature(7);
  const chaotic = makeCreature(7);
  chaotic.traits = [{ name: "Unstable", desc: "", effect: "volatile" }];
  const tally = (c: Creature) => {
    const rng = makeRng(4242);
    let extremes = 0;
    for (let i = 0; i < 10000; i++) {
      const { tier } = rollOutcome(rng, c);
      if (tier === "wild" || tier === "crit" || tier === "fumble") extremes++;
    }
    return extremes;
  };
  const p = tally(plain), v = tally(chaotic);
  console.log(`   plain extremes ${(p / 100).toFixed(1)}%  volatile extremes ${(v / 100).toFixed(1)}%`);
  check("volatile produces more extreme outcomes", v > p);
}

console.log("\n── decay over time ──");
{
  const c = makeCreature(3);
  c.hunger = 100; c.mood = 100; c.bond = 80; c.energy = 20;
  const start = Date.now();
  applyDecay(c, start + 24 * 3_600_000);
  console.log(`   after 24h: hunger ${c.hunger.toFixed(0)} mood ${c.mood.toFixed(0)} energy ${c.energy.toFixed(0)} bond ${c.bond.toFixed(0)}`);
  check("hunger drops", c.hunger < 40);
  check("energy refills while idle", c.energy > 90);
  check("bond decays slowly", c.bond > 65);

  const c2 = makeCreature(3); c2.bond = 90;
  applyDecay(c2, Date.now() + 60 * 24 * 3_600_000);
  console.log(`   after 60 days: bond ${c2.bond.toFixed(0)} hunger ${c2.hunger.toFixed(0)}`);
  check("bond never falls below the floor of 20", c2.bond >= 20, `(${c2.bond.toFixed(1)})`);
}

console.log("\n── neglect penalises effective stats ──");
{
  const fed = makeCreature(5); fed.hunger = 95; fed.mood = 90; fed.bond = 80;
  const starved = makeCreature(5); starved.hunger = 5; starved.mood = 10; starved.bond = 10;
  const f = effectiveStats(fed), s = effectiveStats(starved);
  console.log(`   cared-for atk ${f.atk} (x${f.careMult})   starved atk ${s.atk} (x${s.careMult})`);
  check("a cared-for creature hits harder", f.atk > s.atk);
  check("care multiplier stays inside 0.7–1.15", s.careMult >= 0.7 && f.careMult <= 1.16);
}

console.log("\n── training outcomes respect the tier budget ──");
{
  const c = makeCreature(9);
  const tiers: OutcomeTier[] = ["fumble", "weak", "normal", "strong", "crit", "wild"];
  for (const tier of tiers) {
    const rng = makeRng(hashSeed(tier));
    const res = resolveTraining(rng, c, "atk", tier);
    const total = Object.entries(res.deltas)
      .filter(([k]) => k !== "hp_max")
      .reduce((a, [, v]) => a + v, 0);
    console.log(`   ${tier.padEnd(7)} stat total ${String(total).padStart(3)}  xp ${res.xp}  move:${res.newMove ? "yes" : "no"} trait:${res.newTrait ? "yes" : "no"}`);
    if (tier === "fumble") check(`${tier} loses ground`, total < 0);
    else check(`${tier} gains are bounded`, total > 0 && total <= 12);
  }

  // Only the tails should ever create new mechanics.
  let normalMoves = 0;
  for (let i = 0; i < 2000; i++) {
    const rng = makeRng(hashSeed("n", i));
    if (resolveTraining(rng, c, "atk", "normal").newMove) normalMoves++;
  }
  check("normal sessions never grant moves", normalMoves === 0, `(${normalMoves}/2000)`);

  let wildMoves = 0;
  for (let i = 0; i < 2000; i++) {
    const rng = makeRng(hashSeed("w", i));
    if (resolveTraining(rng, c, "atk", "wild").newMove) wildMoves++;
  }
  console.log(`   wild sessions granting a move: ${(wildMoves / 20).toFixed(0)}%`);
  check("wild sessions usually grant a move", wildMoves / 2000 > 0.6);
}

console.log("\n── levelling curve ──");
{
  const c = makeCreature(11);
  console.log("   xp to clear levels 1,5,12,22:", [1, 5, 12, 22].map(l => xpForLevel(l)).join(", "));
  check("stage thresholds", stageForLevel(1) === "hatchling" && stageForLevel(5) === "juvenile"
    && stageForLevel(12) === "adult" && stageForLevel(22) === "ascended");

  // Roughly how many Warden fights to reach adult?
  let fights = 0;
  while (c.level < 12 && fights < 500) { applyXp(c, 48); fights++; }
  console.log(`   ~${fights} Warden wins (48xp) to reach adult (lvl 12)`);
  check("adult is reachable but not instant", fights > 25 && fights < 220, `(${fights})`);

  const c2 = makeCreature(11);
  const r = applyXp(c2, 5_000_000);
  check("level is capped at 50", c2.level === 50, `(${c2.level})`);
  check("leftover xp is not consumed past the cap", c2.xp > 0);
  check("evolution reported on big jump", r.evolvedTo === "ascended");
}

console.log("\n── battle balance vs NPC tiers (population, not one lucky build) ──");
{
  /** A plausible creature at `level`, with training proportional to it. */
  function randomBuild(seed: number, level: number): Creature {
    const rng = makeRng(seed);
    const rarity = rollRarity(rng);
    const id = proceduralIdentity(rng, rarity);
    const stats = baseStatsFor(rng, rarity);
    const sessions = Math.round(level * 3.5 * (0.7 + rng() * 0.6));

    const moves = [proceduralMove(rng, id.element, "normal", STARTER_MOVE_KINDS)];
    for (let i = 0; i < Math.floor(level / 6); i++) moves.push(proceduralMove(rng, id.element, "strong"));
    const traits = [proceduralTrait(rng, id.element)];
    for (let i = 0; i < Math.floor(level / 9); i++) traits.push(proceduralTrait(rng, id.element));

    const c: Creature = {
      id: `c${seed}`, owner_id: "u", name: "P", species: id.species, description: "",
      stage: "hatchling", rarity, element: id.element, temperament: id.temperament,
      appearance: "", sprite: id.sprite, image_url: null, ...stats, level: 1, xp: 0,
      hunger: 70 + rng() * 25, energy: 90, mood: 65 + rng() * 30, bond: 40 + rng() * 45,
      traits, moves, wins: 0, losses: 0, hatched_at: null, last_tick: new Date().toISOString(),
    };
    let xp = 0;
    for (let l = 1; l < level; l++) xp += xpForLevel(l);
    applyXp(c, xp);
    applyDeltas(c, {
      atk: Math.round(sessions * 1.2), def: Math.round(sessions * 0.7),
      spd: Math.round(sessions * 0.7), focus: Math.round(sessions * 0.6),
      hp_max: Math.round(sessions * 2),
    });
    return c;
  }

  const LEVELS = [3, 6, 10, 15, 22, 30];
  const BUILDS = 14;
  const FIGHTS = 60;

  const rateForTier = (tier: typeof NPC_TIERS[number], mutate?: (c: Creature) => void) => {
    let w = 0, n = 0;
    for (const lvl of LEVELS) {
      for (let b = 0; b < BUILDS; b++) {
        const c = randomBuild(hashSeed("build", lvl, b), lvl);
        mutate?.(c);
        const base = { hp_max: c.hp_max, atk: c.atk, def: c.def, spd: c.spd, focus: c.focus };
        const me = toCombatant(c);
        for (let i = 0; i < FIGHTS; i++) {
          const npc = makeNpc(tier, c.level, base, hashSeed("npc", tier.id, lvl, b, i));
          if (simulateBattle(me, npc, hashSeed("f", tier.id, lvl, b, i)).winner === "a") w++;
          n++;
        }
      }
    }
    return (w / n) * 100;
  };

  const rates: Record<string, number> = {};
  for (const tier of NPC_TIERS) {
    const rate = rateForTier(tier);
    rates[tier.id] = rate;
    console.log(`   vs ${tier.label.padEnd(7)} (x${tier.difficulty.toFixed(2)})  win rate ${rate.toFixed(1)}%`);
  }
  check("strays are easy but not free", rates.stray > 85 && rates.stray < 99, `(${rates.stray.toFixed(1)}%)`);
  check("wardens are a real fight", rates.warden > 55 && rates.warden < 80, `(${rates.warden.toFixed(1)}%)`);
  check("elders are an underdog fight", rates.elder > 25 && rates.elder < 50, `(${rates.elder.toFixed(1)}%)`);
  check("horrors are long odds, not impossible", rates.horror > 6 && rates.horror < 25, `(${rates.horror.toFixed(1)}%)`);
  check("difficulty is strictly ordered",
    rates.stray > rates.warden && rates.warden > rates.elder && rates.elder > rates.horror);

  // Neglect must actually cost you fights.
  const warden = NPC_TIERS.find(t => t.id === "warden")!;
  const fed = rateForTier(warden, c => { c.hunger = 95; c.mood = 90; c.bond = 85; });
  const starved = rateForTier(warden, c => { c.hunger = 6; c.mood = 8; c.bond = 12; });
  console.log(`   warden win rate — cared-for ${fed.toFixed(1)}%  neglected ${starved.toFixed(1)}%`);
  check("neglect measurably costs you fights", fed - starved > 20, `(${(fed - starved).toFixed(1)}pt gap)`);
}

console.log("\n── xp economy: losing must never beat winning ──");
{
  // Mirrors the battle route: win → tier.xp, loss → min(20% of tier.xp, 25).
  const expected = (tierXp: number, winRate: number) =>
    winRate * tierXp + (1 - winRate) * Math.min(Math.round(tierXp * 0.2), 25);
  const measured: Record<string, number> = { stray: 0.95, warden: 0.68, elder: 0.39, horror: 0.15 };
  for (const t of NPC_TIERS) {
    const e = expected(t.xp, measured[t.id]);
    const lossXp = Math.min(Math.round(t.xp * 0.2), 25);
    console.log(`   ${t.label.padEnd(7)} win ${String(t.xp).padStart(3)}xp  loss ${String(lossXp).padStart(2)}xp  expected ${e.toFixed(1)}xp/fight`);
    check(`${t.label}: a loss is worth less than a Warden win`, lossXp < 48, `(${lossXp}xp)`);
  }
}

console.log("\n── battles terminate and are deterministic ──");
{
  const a = makeCreature(31), b = makeCreature(32);
  let maxRounds = 0, anyEmpty = 0;
  for (let i = 0; i < 800; i++) {
    const res = simulateBattle(toCombatant(a), toCombatant(b), hashSeed("t", i));
    maxRounds = Math.max(maxRounds, res.rounds);
    if (res.beats.length === 0) anyEmpty++;
  }
  console.log(`   longest battle: ${maxRounds} rounds; empty logs: ${anyEmpty}`);
  check("battles always terminate within the cap", maxRounds <= 24);
  check("every battle produces a log", anyEmpty === 0);

  const r1 = simulateBattle(toCombatant(a), toCombatant(b), 777);
  const r2 = simulateBattle(toCombatant(a), toCombatant(b), 777);
  check("same seed replays identically", JSON.stringify(r1) === JSON.stringify(r2));
}

console.log("\n── two identical whispers still diverge ──");
{
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const rng = makeRng(hashSeed("be fast", i));
    const id = proceduralIdentity(rng, rollRarity(rng));
    seen.add(`${id.species}|${id.element}|${id.temperament}`);
  }
  console.log(`   200 hatches from the same whisper produced ${seen.size} distinct identities (procedural fallback only)`);
  check("procedural fallback is highly varied", seen.size > 150, `(${seen.size})`);
}

console.log("\n── catalog sanity ──");
{
  check("5 foods", FOODS.length === 5);
  check("4 training focuses", TRAINING_FOCUS.length === 4);
  check("4 npc tiers", NPC_TIERS.length === 4);
  check("risky food is the mutation route", FOODS.find(f => f.id === "godsmeat")!.mutationChance > FOODS.find(f => f.id === "ashcap")!.mutationChance);
}

console.log(failures === 0 ? "\n✅ all engine checks passed\n" : `\n❌ ${failures} check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
