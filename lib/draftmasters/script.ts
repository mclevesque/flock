/**
 * Turn a fought battle into something you can watch.
 *
 * The old order was backwards: a model decided who won, and a second call
 * wrote a cinematic to justify that decision. The fight was theatre staged
 * around a verdict it could not contradict, which is why a card the verdict
 * called a bust could be seen carrying the round.
 *
 * Now the fight happens first — locally, deterministically, under the planar
 * rules — and both the verdict and the show are read off the same log. They
 * cannot disagree, because they are the same thing said twice.
 */
import type { BattleEvent, BattleResult } from "./battle";
import type { NarratedEvent } from "./flavour";

/** Kept structurally identical to app/draftmasters/types.ts. */
type BeatKind =
  | "entrance" | "clash" | "kill" | "standoff" | "heroic"
  | "comic" | "turn" | "judgment" | "final";

export interface Beat {
  actors: string[];
  sideId: string;
  targetSideId?: string;
  text: string;
  kind: BeatKind;
  intensity: number;
  eliminated?: string[];
  /** Cards put back on their feet by this beat. Un-strikes them on screen. */
  revived?: string[];

  // ── The same beat, as numbers ──────────────────────────────────────────
  /** The card swinging, and the card being swung at. */
  from?: string;
  to?: string;
  /** Health taken off. Zero is a blow that landed and did nothing. */
  damage?: number;
  /** What the target has left afterwards, and what it had before. */
  hpAfter?: number;
  hpMax?: number;
  /** What the attack actually was, and what is printed on the card, so the
   *  screen can show a boost as a boost rather than as a bigger number. */
  atk?: number;
  atkBase?: number;
  /** The line the technical log shows, when it differs from the story. */
  plain?: string;
  /**
   * Whether this beat has anything to SAY.
   *
   * A rushdown roll and a round marker are facts, not moments: they belong in
   * the log and have no business in the big font on the stage.
   */
  story?: boolean;
}

/**
 * How each rules event plays on screen.
 *
 * Intensity drives shake, slashes and the musical accent, so it tracks what
 * actually happened rather than how loud the sentence is: a death is a 3, a
 * blocked swing is a 1, and the round marker is a beat of quiet.
 */
const STAGING: Record<BattleEvent["kind"], { kind: BeatKind; intensity: number }> = {
  round:        { kind: "turn",     intensity: 0 },
  terrain:      { kind: "entrance", intensity: 1 },
  captain:      { kind: "entrance", intensity: 2 },
  swap:         { kind: "turn",     intensity: 1 },
  prep:         { kind: "turn",     intensity: 1 },
  advice:       { kind: "judgment", intensity: 1 },
  strike:       { kind: "clash",    intensity: 1 },
  blocked:      { kind: "standoff", intensity: 1 },
  breakthrough: { kind: "clash",    intensity: 2 },
  exposed:      { kind: "clash",    intensity: 2 },
  direct:       { kind: "clash",    intensity: 2 },
  death:        { kind: "kill",     intensity: 3 },
  ascend:       { kind: "heroic",   intensity: 3 },
  revive:       { kind: "heroic",   intensity: 3 },
  survive:      { kind: "heroic",   intensity: 2 },
  bloodlust:    { kind: "heroic",   intensity: 2 },
  lastStand:    { kind: "heroic",   intensity: 2 },
  regen:        { kind: "heroic",   intensity: 1 },
  mend:         { kind: "heroic",   intensity: 1 },
  end:          { kind: "final",    intensity: 3 },
};

/** Longest names first, so "Jon Snow" is never found inside a longer one. */
function nameFinder(names: string[]) {
  const sorted = [...new Set(names)].sort((a, b) => b.length - a.length);
  return (text: string) => {
    const found: string[] = [];
    let left = text;
    for (const n of sorted) {
      if (!n || !left.includes(n)) continue;
      found.push(n);
      left = left.split(n).join(" ");     // don't match the same words twice
      if (found.length === 2) break;      // a clash is two cards, never five
    }
    return found;
  };
}

/**
 * @param result  the fought battle
 * @param events  `narrate()`'s output, so the prose is used where it exists
 * @param sideIds the two side ids, in the same order as the battle's sides
 */
export function scriptFromFight(
  result: BattleResult,
  events: NarratedEvent[],
  sideIds: [string, string]
): { beats: Beat[]; winnerId: string } {
  const names = result.contributions.map((c) => c.name);
  const find = nameFinder(names);

  const beats: Beat[] = [];
  for (const e of events) {
    if (e.hidden) continue;               // the death line right after says it better
    const stage = STAGING[e.kind] ?? { kind: "turn" as const, intensity: 0 };
    const text = e.said ?? e.text;
    if (!text) continue;

    const actors = find(text);
    const side = e.side ?? 0;
    beats.push({
      actors,
      sideId: sideIds[side],
      targetSideId: sideIds[side === 0 ? 1 : 0],
      text,
      // The rules line always survives, even when prose replaced it on screen:
      // the chatbox shows what happened, the stage shows how it felt.
      plain: e.text,
      story: !!e.said,
      kind: stage.kind,
      intensity: stage.intensity,
      from: e.from,
      to: e.to,
      damage: e.damage,
      hpAfter: e.hpAfter,
      hpMax: e.hpMax,
      atk: e.atk,
      atkBase: e.atkBase,
      // The dead card is whichever name the death line names first.
      // From the event, never from the sentence: `to` is the card that went
      // down. Reading it out of the prose struck out whichever name happened
      // to be longest, which was frequently the winner.
      ...(e.kind === "death" && (e.to || actors.length)
        ? { eliminated: [e.to ?? actors[0]] }
        : {}),
      ...((e.kind === "revive" || e.kind === "survive") && e.to ? { revived: [e.to] } : {}),
    });
  }

  // A fight with nothing to show is a bug upstream, but an empty cinematic is
  // a hang on screen — say the one thing that is always true instead.
  if (!beats.length) {
    beats.push({
      actors: [],
      sideId: sideIds[result.winner === 1 ? 1 : 0],
      text: result.headline,
      kind: "final",
      intensity: 3,
    });
  }

  return { beats, winnerId: sideIds[result.winner === 1 ? 1 : 0] };
}
