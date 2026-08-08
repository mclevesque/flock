import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getEmberkinByOwner, getEmberkinById, saveEmberkin,
  addEmberkinEvent, recordEmberkinBattle, listEmberkinRivals, countEmberkinAiActions,
} from "@/lib/db";
import {
  type Combatant,
  NPC_TIERS, makeNpc, simulateBattle, toCombatant,
  makeRng, hashSeed, randomSeed, applyDecay, applyXp, clamp,
} from "@/lib/emberkin-engine";
import { narrateBattle } from "@/lib/emberkin-ai";
import { runEvolution } from "@/lib/emberkin-progress";
import { asCreature, publicCreature, toSaveShape, type EmberkinRow } from "@/lib/emberkin-state";

const ENERGY_COST = 25;

/** Mirrors the care route's cap — see AI_ACTIONS_PER_HOUR there. */
const AI_ACTIONS_PER_HOUR = 40;

// ── GET: who you can fight ───────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ npcTiers: NPC_TIERS, rivals: [] });

  const rivals = await listEmberkinRivals(userId, 12).catch(() => []);
  return NextResponse.json({
    npcTiers: NPC_TIERS,
    rivals: rivals.map(r => {
      const rc = asCreature(r as EmberkinRow);
      return {
        id: rc.id, name: rc.name, species: rc.species, sprite: rc.sprite,
        level: rc.level, rarity: rc.rarity, ownerName: rc.owner_name ?? "someone",
        wins: rc.wins, losses: rc.losses,
      };
    }),
  });
}

// ── POST: fight ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "rival" ? "rival" : "npc";

  const row = await getEmberkinByOwner(userId).catch(() => null);
  if (!row) return NextResponse.json({ error: "You have no emberkin." }, { status: 404 });

  const c = asCreature(row as EmberkinRow);
  if (c.stage === "egg") return NextResponse.json({ error: "It hasn't hatched yet." }, { status: 400 });

  applyDecay(c);
  if (c.energy < ENERGY_COST) {
    return NextResponse.json({ error: `${c.name} is too spent to fight. Let it rest.` }, { status: 400 });
  }
  if (c.hunger < 15) {
    return NextResponse.json({ error: `${c.name} is starving. Feed it first.` }, { status: 400 });
  }

  const seed = randomSeed();
  const mine = toCombatant(c);

  let foe: Combatant;
  let baseXp: number;
  let opponentId: string | null = null;
  let opponentLabel: string;

  if (mode === "rival") {
    const rivalRow = await getEmberkinById(String(body.rivalId ?? "")).catch(() => null);
    if (!rivalRow || rivalRow.owner_id === userId) {
      return NextResponse.json({ error: "No such rival." }, { status: 400 });
    }
    const rival = asCreature(rivalRow as EmberkinRow);
    if (rival.stage === "egg") return NextResponse.json({ error: "That one hasn't hatched." }, { status: 400 });

    // Rival duels are asynchronous: we fight a snapshot of their creature. Their
    // own record is never touched, so nobody loses progress while offline.
    foe = toCombatant(rival);
    opponentId = rival.id;
    opponentLabel = `${rival.name} (${rival.owner_name ?? "someone"})`;
    baseXp = Math.round(55 + Math.max(0, rival.level - c.level) * 14);
  } else {
    const tier = NPC_TIERS.find(t => t.id === String(body.tierId)) ?? NPC_TIERS[0];
    foe = makeNpc(
      tier, c.level,
      { hp_max: c.hp_max, atk: c.atk, def: c.def, spd: c.spd, focus: c.focus },
      hashSeed(seed, tier.id),
    );
    opponentLabel = `${foe.name}, ${tier.label}`;
    baseXp = tier.xp;
  }

  const result = simulateBattle(mine, foe, seed);
  const won = result.winner === "a";
  const aiOk = (await countEmberkinAiActions(c.id, 60).catch(() => 0)) < AI_ACTIONS_PER_HOUR;
  const narration = await narrateBattle(mine, foe, result, true, aiOk);

  // Costs and consequences
  c.energy = clamp(c.energy - ENERGY_COST, 0, 100);
  c.hunger = clamp(c.hunger - 12, 0, 100);
  c.mood = clamp(c.mood + (won ? 14 : -10), 0, 100);
  c.bond = clamp(c.bond + (won ? 4 : 2), 0, 100);
  if (won) c.wins += 1; else c.losses += 1;

  // Losing still teaches it something — just far less, and capped. Without the
  // cap, throwing yourself at Horrors and losing would out-earn winning against
  // anything else.
  const xpGained = won ? baseXp : Math.min(Math.round(baseXp * 0.2), 25);
  const levelled = applyXp(c, xpGained);

  let evolution: Awaited<ReturnType<typeof runEvolution>> | null = null;
  if (levelled.evolvedTo) {
    evolution = await runEvolution(c, levelled.evolvedTo, makeRng(hashSeed(c.id, "evo", c.level)), aiOk);
  }

  await saveEmberkin(toSaveShape(c));

  const battleId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  await recordEmberkinBattle(
    battleId, c.id, opponentId, foe.name, mode, won, xpGained,
    { beats: result.beats, rounds: result.rounds },
  ).catch(() => {});

  await addEmberkinEvent(
    c.id, "battle",
    `${narration.opening}\n\n${narration.closing}`,
    `${won ? "beat" : "lost to"} ${opponentLabel}`,
  );

  return NextResponse.json({
    ok: true,
    won,
    xpGained,
    levels: levelled.levels,
    evolution,
    narration,
    opponent: {
      name: foe.name, species: foe.species, sprite: foe.sprite,
      level: foe.level, hp: foe.hp, label: opponentLabel,
    },
    battle: {
      beats: result.beats,
      rounds: result.rounds,
      myMaxHp: mine.hp,
      foeMaxHp: foe.hp,
      finalHpMine: result.finalHpA,
      finalHpFoe: result.finalHpB,
    },
    creature: publicCreature(c),
  });
}
