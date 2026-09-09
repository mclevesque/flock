/**
 * DraftMasters — the verdict, read off the fight.
 *
 * This used to be a language model's opinion. You handed it two rosters and it
 * came back with a winner, a score, an MVP and a bust, all of it free text and
 * none of it checkable — which is how a Sheik once came back marked BUST at
 * 8/10 contribution in the same paragraph, and how a legendary transformation
 * came back scored as "flavour".
 *
 * The fight decides now. Every number below is read off a battle that actually
 * happened under rules the player can see on the cards, so the verdict cannot
 * contradict itself and cannot contradict the board.
 *
 * The model's job is what it was always good at: describing. That is optional,
 * it happens after the result exists, and it cannot change a single figure.
 */

import type { BattleResult, Contribution } from "./battle";

export interface VerdictPick {
  name: string;
  /** 0-12, where 10 is "carried this" and 12 is absurd. */
  contribution: number;
  /**
   * Never reached the front.
   *
   * Flagged rather than scored, because a card that was not needed did not
   * fail — and a captain the line never ran out in front of is the aura doing
   * its job. The screen shows a dash instead of a number.
   */
  benched?: boolean;
}

export interface VerdictSide {
  sideId: string;
  score: number;
  mvp: string;
  bust: string;
  note: string;
  picks: VerdictPick[];
}

export interface ReadVerdict {
  winnerId: string;
  headline: string;
  reasoning: string;
  sides: [VerdictSide, VerdictSide];
}

/**
 * What one card's work was worth, before it is scaled against the board.
 *
 * Damage is the spine of it. Kills count for more than the damage that caused
 * them because taking a card off the board is worth more than wounding two.
 * Breakthrough counts most per point, because that is the only damage that
 * actually moves the result. Absorbing counts a little: a card that stood in
 * front of a dragon for three rounds did a job even though the log is all
 * about the dragon.
 */
function weight(c: Contribution): number {
  return c.damage + c.kills * 6 + c.breakthrough * 2 + c.absorbed * 0.4;
}

/**
 * Scale the board so the best card lands near 10.
 *
 * Absolute damage is meaningless across boards — a Pokémon fight and a Marvel
 * fight run at different numbers — so contribution is always relative to the
 * best performance in THIS fight. That also means the scale reads the same to
 * a player whatever they drafted.
 */
function contributions(all: Contribution[]): Map<string, number> {
  const top = Math.max(1, ...all.map(weight));
  const out = new Map<string, number>();
  for (const c of all) {
    // A captain who never had to fight is not a bust. They are marked with the
    // aura's value rather than scored against people who were on the field.
    if (c.benched) { out.set(c.name, 5); continue; }
    const raw = (weight(c) / top) * 10;
    // Standing to the end is worth something the damage numbers miss.
    const bonus = c.survived ? 1 : 0;
    // Ten, because the screen prints this as "/10" and an 11/10 is a bug
    // report rather than a compliment.
    out.set(c.name, Math.max(0, Math.min(10, Math.round(raw + bonus))));
  }
  return out;
}

/**
 * A score out of 100, from three things a player can check on the screen.
 *
 * Health left is the biggest share because health left is how you win. Cards
 * removed is next. The damage share is a tiebreak that keeps a narrow loss
 * from reading like a rout.
 */
function score(
  myLeft: number,
  myPrinted: number,
  theirDead: number,
  theirTotal: number,
  myDamage: number,
  theirDamage: number
): number {
  // How much of the line you brought is still on its feet. This used to read
  // a player health bar; there is no player in the fight any more, so it reads
  // the line -- which is what it was really measuring all along.
  const health = Math.min(1, Math.max(0, myLeft) / Math.max(1, myPrinted)) * 52;
  const removed = Math.min(1, theirDead / Math.max(1, theirTotal)) * 30;
  const pressure = (myDamage / Math.max(1, myDamage + theirDamage)) * 18;
  return Math.max(0, Math.min(100, Math.round(health + removed + pressure)));
}

const nameOnly = (label: string) => label.replace(/\s*\(.*?\)\s*$/, "");

/**
 * Read a fought battle as a verdict.
 *
 * `sideIds` maps the resolver's 0/1 onto the game's own side ids, since the
 * resolver deliberately knows nothing about players.
 */
export function readVerdict(
  battle: BattleResult,
  sideIds: [string, string],
  startHp: number
): ReadVerdict {
  const scale = contributions(battle.contributions);

  const build = (sd: 0 | 1): VerdictSide => {
    const mine = battle.contributions.filter((c) => c.side === sd);
    const theirs = battle.contributions.filter((c) => c.side !== sd);
    const picks = mine
      .map((c) => ({
        name: nameOnly(c.name),
        contribution: scale.get(c.name) ?? 0,
        benched: c.benched || undefined,
      }))
      .sort((a, b) => b.contribution - a.contribution);

    const fought = mine.filter((c) => !c.benched);
    const worst = fought.length
      ? fought
          .map((c) => ({ n: nameOnly(c.name), v: scale.get(c.name) ?? 0 }))
          .sort((a, b) => a.v - b.v)[0]
      : null;

    const sum = (rows: Contribution[]) => rows.reduce((n, c) => n + c.damage + c.breakthrough, 0);
    // What this side has left, against what it was printed with.
    const printed = mine.reduce((n, c) => n + Math.max(1, c.printedDef), 0);
    const left = mine.reduce((n, c) => n + c.leftHp, 0);
    const s = score(
      left,
      printed,
      theirs.filter((c) => !c.survived).length,
      theirs.length,
      sum(mine),
      sum(theirs)
    );

    return {
      sideId: sideIds[sd],
      score: s,
      mvp: picks[0]?.name ?? "",
      // Only call something a bust if it genuinely did almost nothing. A team
      // where everyone pulled their weight should not be made to nominate a
      // scapegoat, which is exactly what the free-text version used to do.
      bust: worst && worst.v <= 2 ? worst.n : "",
      note: sideNote(battle, sd),
      picks,
    };
  };

  const sides: [VerdictSide, VerdictSide] = [build(0), build(1)];

  // A true draw still has to name somebody, because the room needs a result to
  // report. Defaulting to side 0 made the scorecard contradict itself whenever
  // side 1 had scored higher, so the better card takes it.
  const drawWinner = sides[1].score > sides[0].score ? 1 : 0;
  const winner = sideIds[battle.winner ?? drawWinner];

  // The fight is the source of truth and this is a summary of it. If the
  // summary came out the other way round -- a close one where the loser led on
  // damage share -- the summary is what is wrong.
  if (battle.winner !== null) {
    const won = sides[battle.winner];
    const lost = sides[battle.winner === 0 ? 1 : 0];
    if (lost.score >= won.score) lost.score = Math.max(0, won.score - 1);
  }

  return {
    winnerId: winner,
    headline: battle.headline,
    reasoning: reasoning(battle),
    sides,
  };
}

/** One line per side, from what actually happened to them. */
function sideNote(battle: BattleResult, sd: 0 | 1): string {
  const me = battle.sides[sd];
  const mine = battle.contributions.filter((c) => c.side === sd);
  const standing = mine.filter((c) => c.survived).length;
  const best = [...mine].sort((a, b) => weight(b) - weight(a))[0];

  if (me.hp <= 0 && standing > 0) {
    return `The line held, but it was not enough — killed with ${standing} still on their feet.`;
  }
  if (me.hp <= 0) return "Wiped out, and then there was nothing in the way.";
  if (standing === mine.length) return "Did not lose anybody.";
  return `${nameOnly(best?.name ?? "Nobody")} carried it; ${mine.length - standing} did not come back.`;
}

/** The long version, for players who tap through. Facts, in order. */
function reasoning(battle: BattleResult): string {
  const lines: string[] = [];
  const terrain = battle.log.find((e) => e.kind === "terrain");
  if (terrain) lines.push(terrain.text);

  for (const e of battle.log) {
    if (e.kind === "captain" || e.kind === "swap" || e.kind === "prep" || e.kind === "ascend") {
      lines.push(e.text);
    }
  }

  const turns = battle.log.filter((e) => e.kind === "death").length;
  lines.push(
    `${turns} card${turns === 1 ? "" : "s"} went down across ${battle.rounds} rounds. ${battle.headline}`
  );
  return lines.join(" ");
}
