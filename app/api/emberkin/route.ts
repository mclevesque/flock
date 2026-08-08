import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getEmberkinByOwner, createEmberkinEgg, saveEmberkin, releaseEmberkin,
  addEmberkinEvent, getEmberkinEvents, countEmberkinAiActions, lastEmberkinEventAt,
  listEmberkinRivals, getEmberkinLeaderboard,
} from "@/lib/db";
import { moderateFields } from "@/lib/moderation";
import {
  FOODS, TRAINING_FOCUS, NPC_TIERS,
  makeRng, hashSeed, randomSeed, rollRarity, rollOutcome, applyDecay, applyXp,
  applyDeltas, resolveTraining, baseStatsFor, proceduralTrait, clamp,
} from "@/lib/emberkin-engine";
import { hatchIdentity, narrateTraining, speakTo, narrateFeeding } from "@/lib/emberkin-ai";
import { runEvolution } from "@/lib/emberkin-progress";
import { asCreature, publicCreature, toSaveShape, type EmberkinRow } from "@/lib/emberkin-state";

/** Bond a freshly laid egg needs before it will hatch. */
const HATCH_BOND = 25;

/**
 * Ceiling on GROQ-backed actions per creature per rolling hour. Past it the
 * game keeps working — actions resolve identically, they just get the engine's
 * procedural narration instead of a model call. This is what keeps a keeper who
 * sits and grinds all afternoon from burning through the free tier.
 */
const AI_ACTIONS_PER_HOUR = 40;

/** Minutes between naps, so fight → rest → fight can't loop without limit. */
const REST_COOLDOWN_MIN = 20;

async function aiAllowed(creatureId: string): Promise<boolean> {
  const used = await countEmberkinAiActions(creatureId, 60).catch(() => 0);
  return used < AI_ACTIONS_PER_HOUR;
}

// ── GET: full game state for the current keeper ──────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  const { searchParams } = new URL(req.url);
  const wantBoard = searchParams.get("leaderboard") === "1";

  if (!userId) {
    return NextResponse.json({
      creature: null,
      authed: false,
      leaderboard: wantBoard ? await getEmberkinLeaderboard().catch(() => []) : [],
    });
  }

  const row = await getEmberkinByOwner(userId).catch(() => null);
  if (!row) {
    return NextResponse.json({
      creature: null, authed: true, events: [], rivals: [],
      leaderboard: await getEmberkinLeaderboard().catch(() => []),
      catalog: { foods: FOODS, training: TRAINING_FOCUS, npcTiers: NPC_TIERS },
    });
  }

  const c = asCreature(row as EmberkinRow);

  // Meters decay in real time — persist the tick so it isn't recomputed twice.
  if (c.stage !== "egg") {
    const hours = applyDecay(c);
    if (hours >= 0.05) await saveEmberkin(toSaveShape(c)).catch(() => {});
  }

  const [events, rivals, leaderboard] = await Promise.all([
    getEmberkinEvents(c.id, 40).catch(() => []),
    listEmberkinRivals(userId, 12).catch(() => []),
    getEmberkinLeaderboard().catch(() => []),
  ]);

  return NextResponse.json({
    authed: true,
    creature: c.stage === "egg"
      ? {
          id: c.id, name: c.name, stage: "egg", sprite: "🥚",
          bond: Math.round(c.bond), hatchBond: HATCH_BOND,
          canHatch: c.bond >= HATCH_BOND,
        }
      : publicCreature(c),
    events,
    rivals: rivals.map(r => {
      const rc = asCreature(r as EmberkinRow);
      return {
        id: rc.id, name: rc.name, species: rc.species, sprite: rc.sprite,
        level: rc.level, stage: rc.stage, rarity: rc.rarity,
        ownerName: rc.owner_name ?? "someone", wins: rc.wins, losses: rc.losses,
      };
    }),
    leaderboard,
    catalog: { foods: FOODS, training: TRAINING_FOCUS, npcTiers: NPC_TIERS },
  });
}

// ── POST: every keeper action ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in to raise an emberkin." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  // ── lay: create the egg ────────────────────────────────────────────────────
  if (action === "lay") {
    const existing = await getEmberkinByOwner(userId).catch(() => null);
    if (existing) return NextResponse.json({ error: "You already have an emberkin." }, { status: 400 });

    const name = String(body.name ?? "").trim().slice(0, 24);
    const whisper = String(body.whisper ?? "").trim().slice(0, 200);
    if (!name) return NextResponse.json({ error: "Give it a name." }, { status: 400 });

    const mod = moderateFields(name, whisper);
    if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });

    // Rarity is rolled now and kept hidden until the shell opens, so nobody can
    // reroll by re-reading the egg.
    const seed = randomSeed();
    const rarity = rollRarity(makeRng(hashSeed(seed, "rarity")));
    const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

    await createEmberkinEgg(id, userId, name, whisper, seed, rarity);
    await addEmberkinEvent(id, "egg", `You set the egg by the bonfire and whisper: "${whisper || "…nothing"}"`, `laid an egg, whispered "${whisper}"`);

    return NextResponse.json({ ok: true, message: "The egg sits warm in the ash. Keep it close." });
  }

  const row = await getEmberkinByOwner(userId).catch(() => null);
  if (!row) return NextResponse.json({ error: "You have no emberkin." }, { status: 404 });
  const c = asCreature(row as EmberkinRow);

  // ── warm / hatch: the egg stage ────────────────────────────────────────────
  if (c.stage === "egg") {
    if (action === "warm") {
      if (c.bond >= HATCH_BOND) {
        return NextResponse.json({ error: "It's ready. Open it." }, { status: 400 });
      }
      const rng = makeRng(hashSeed(c.id, "warm", Math.floor(c.bond)));
      c.bond = clamp(c.bond + 8 + rng() * 5, 0, 100);
      const lines = [
        "You cup the shell in both hands. Something inside shifts toward the heat.",
        "A slow tick, tick from under the shell. Not quite a heartbeat.",
        "The shell is warmer than the fire now. Hairline cracks spread and stop.",
        "Whatever is in there presses back against your palm.",
      ];
      const line = lines[Math.floor(rng() * lines.length)];
      await saveEmberkin(toSaveShape(c));
      await addEmberkinEvent(c.id, "egg", line);
      return NextResponse.json({
        ok: true, message: line,
        bond: Math.round(c.bond), canHatch: c.bond >= HATCH_BOND,
      });
    }

    if (action === "hatch") {
      if (c.bond < HATCH_BOND) {
        return NextResponse.json({ error: "It isn't ready yet. Keep it warm." }, { status: 400 });
      }

      const seed = row.seed || randomSeed();
      const identity = await hatchIdentity(row.whisper ?? "", c.rarity, seed, await aiAllowed(c.id));
      const stats = baseStatsFor(makeRng(hashSeed(seed, "stats")), c.rarity);

      c.species = identity.species;
      c.description = identity.description;
      c.element = identity.element;
      c.temperament = identity.temperament;
      c.appearance = identity.appearance;
      c.sprite = identity.sprite;
      c.traits = [identity.trait];
      c.moves = [identity.move];
      c.hp_max = stats.hp_max;
      c.atk = stats.atk;
      c.def = stats.def;
      c.spd = stats.spd;
      c.focus = stats.focus;
      c.stage = "hatchling";
      c.hunger = 55;
      c.energy = 80;
      c.mood = 70;
      c.hatched_at = new Date().toISOString();
      c.last_tick = new Date().toISOString();

      await saveEmberkin(toSaveShape(c));
      await addEmberkinEvent(
        c.id, "hatch",
        `The shell splits. ${identity.description}`,
        `hatched as a ${c.rarity} ${identity.species}`,
      );

      return NextResponse.json({
        ok: true, hatched: true, creature: publicCreature(c),
        message: `The shell splits. ${identity.description}`,
      });
    }

    return NextResponse.json({ error: "It hasn't hatched yet." }, { status: 400 });
  }

  // Everything below acts on a hatched creature, so decay applies first.
  applyDecay(c);

  const rng = makeRng(hashSeed(c.id, action, Date.now()));
  let message = "";
  let evolution: { narration: string; species: string; sprite: string } | null = null;
  const gains: string[] = [];

  switch (action) {
    // ── feed ─────────────────────────────────────────────────────────────────
    case "feed": {
      const food = FOODS.find(f => f.id === String(body.foodId));
      if (!food) return NextResponse.json({ error: "No such food." }, { status: 400 });
      if (c.hunger > 92) return NextResponse.json({ error: `${c.name} won't take another bite.` }, { status: 400 });

      c.hunger = clamp(c.hunger + food.hunger, 0, 100);
      c.mood = clamp(c.mood + food.mood, 0, 100);
      c.energy = clamp(c.energy + food.energy, 0, 100);
      c.bond = clamp(c.bond + 2, 0, 100);

      // Strange food is the cheap route to a mutation — and the risky one.
      const mutated = rng() < food.mutationChance && c.traits.length < 5;
      if (mutated) {
        const t = proceduralTrait(rng, c.element);
        c.traits = [...c.traits, t];
        gains.push(`New trait: ${t.name}`);
      }

      message = await narrateFeeding(c, food.label, mutated, await aiAllowed(c.id));
      await addEmberkinEvent(c.id, "feed", message, `fed it ${food.label}${mutated ? " and it mutated" : ""}`);
      break;
    }

    // ── play ─────────────────────────────────────────────────────────────────
    case "play": {
      if (c.energy < 15) return NextResponse.json({ error: `${c.name} is too tired to play.` }, { status: 400 });
      const { tier } = rollOutcome(rng, c);
      const good = tier !== "fumble" && tier !== "weak";

      c.energy = clamp(c.energy - 12, 0, 100);
      c.hunger = clamp(c.hunger - 5, 0, 100);
      c.mood = clamp(c.mood + (good ? 16 : 4), 0, 100);
      c.bond = clamp(c.bond + (good ? 7 : 2), 0, 100);

      message = good
        ? `${c.name} throws itself into the game, and for a while nothing else exists.`
        : `${c.name} humours you for a few minutes, then wanders off.`;
      await addEmberkinEvent(c.id, "play", message, "played with it");
      break;
    }

    // ── rest ─────────────────────────────────────────────────────────────────
    case "rest": {
      const lastRest = await lastEmberkinEventAt(c.id, "rest").catch(() => null);
      if (lastRest && Date.now() - lastRest.getTime() < REST_COOLDOWN_MIN * 60_000) {
        const mins = Math.ceil((REST_COOLDOWN_MIN * 60_000 - (Date.now() - lastRest.getTime())) / 60_000);
        return NextResponse.json(
          { error: `${c.name} has only just woken up. Try again in ${mins} min.` },
          { status: 400 },
        );
      }
      c.energy = clamp(c.energy + 38, 0, 100);
      c.hunger = clamp(c.hunger - 6, 0, 100);
      c.mood = clamp(c.mood + 4, 0, 100);
      message = `${c.name} folds up beside the fire and sleeps like something with no enemies.`;
      await addEmberkinEvent(c.id, "rest", message, "let it rest");
      break;
    }

    // ── train ────────────────────────────────────────────────────────────────
    case "train": {
      if (c.energy < 25) return NextResponse.json({ error: `${c.name} is too spent to train.` }, { status: 400 });
      if (c.hunger < 15) return NextResponse.json({ error: `${c.name} is too hungry to train.` }, { status: 400 });

      const focus = TRAINING_FOCUS.find(f => f.id === String(body.focusId)) ?? TRAINING_FOCUS[0];
      const instruction = String(body.instruction ?? "").trim().slice(0, 200);
      if (instruction) {
        const mod = moderateFields(instruction);
        if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });
      }

      const { tier } = rollOutcome(rng, c);
      const res = resolveTraining(rng, c, focus.stat, tier);

      const narrated = await narrateTraining(
        c, instruction, focus.label, tier, res.newMove, res.newTrait, await aiAllowed(c.id),
      );

      applyDeltas(c, res.deltas);
      if (narrated.move) { c.moves = [...c.moves, narrated.move]; gains.push(`New move: ${narrated.move.name}`); }
      if (narrated.trait) { c.traits = [...c.traits, narrated.trait]; gains.push(`New trait: ${narrated.trait.name}`); }

      for (const [k, v] of Object.entries(res.deltas)) {
        if (v) gains.push(`${k === "hp_max" ? "HP" : k.toUpperCase()} ${v > 0 ? "+" : ""}${v}`);
      }

      c.energy = clamp(c.energy - 22, 0, 100);
      c.hunger = clamp(c.hunger - 10, 0, 100);
      c.mood = clamp(c.mood + (tier === "fumble" ? -8 : 3), 0, 100);
      c.bond = clamp(c.bond + 3, 0, 100);

      const levelled = applyXp(c, res.xp);
      message = narrated.narration;

      await addEmberkinEvent(
        c.id, "train", message,
        `trained ${focus.label}${instruction ? ` — "${instruction}"` : ""} (${tier})`,
      );

      if (levelled.evolvedTo) evolution = await runEvolution(c, levelled.evolvedTo, rng);
      if (levelled.levels) gains.push(`Level ${c.level}`);
      break;
    }

    // ── speak ────────────────────────────────────────────────────────────────
    case "speak": {
      const text = String(body.message ?? "").trim().slice(0, 300);
      if (!text) return NextResponse.json({ error: "Say something." }, { status: 400 });
      if (c.energy < 5) return NextResponse.json({ error: `${c.name} is past listening.` }, { status: 400 });

      const mod = moderateFields(text);
      if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });

      const recent = (await getEmberkinEvents(c.id, 6).catch(() => []))
        .filter(e => e.kind === "speak")
        .map(e => e.text);

      message = await speakTo(c, text, recent, await aiAllowed(c.id));

      c.energy = clamp(c.energy - 2, 0, 100);
      c.bond = clamp(c.bond + 3, 0, 100);
      c.mood = clamp(c.mood + 2, 0, 100);

      await addEmberkinEvent(c.id, "speak", message, `said "${text}"`);
      break;
    }

    // ── rename ───────────────────────────────────────────────────────────────
    case "rename": {
      const name = String(body.name ?? "").trim().slice(0, 24);
      if (!name) return NextResponse.json({ error: "Names can't be empty." }, { status: 400 });
      const mod = moderateFields(name);
      if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });
      c.name = name;
      message = `It answers to ${name} now.`;
      break;
    }

    // ── release ──────────────────────────────────────────────────────────────
    case "release": {
      await releaseEmberkin(c.id, userId);
      return NextResponse.json({
        ok: true, released: true,
        message: `${c.name} goes back into the dark. It doesn't look back — they never do.`,
      });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  await saveEmberkin(toSaveShape(c));

  return NextResponse.json({
    ok: true, message, gains, evolution,
    creature: publicCreature(c),
  });
}
