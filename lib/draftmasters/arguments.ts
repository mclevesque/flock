/**
 * DraftMasters — the pre-battle argument.
 *
 * Between the last lot and the verdict, each player gets one chance to argue
 * their roster. The panel reads both cases, accepts the points that actually
 * hold up and throws out the ones that don't, and the surviving points are
 * handed to the judge as evidence.
 *
 * Two rules make it a game rather than a "type anything and win" box:
 *
 *   1. Nobody sees the other side's case while writing. Arguments are sealed
 *      and revealed together with the ruling, so you're arguing your roster,
 *      not rebutting theirs.
 *   2. A claim has to be TRUE about what was actually drafted. The panel is
 *      told to reject anything that misdescribes a pick, and a rejected claim
 *      is worth nothing — bluffing costs you the slot you spent on it.
 */

/** One point the player made, and what the panel did with it. */
export interface ArgumentClaim {
  /** The claim as the panel understood it — short, in the panel's words */
  text: string;
  accepted: boolean;
  /** Why it landed, or why it was thrown out */
  reason: string;
  /** 0-10. How much an accepted claim moves the verdict; 0 when rejected. */
  sway: number;
}

export interface ArgumentRuling {
  sideId: string;
  /** What the player actually wrote, revealed once the ruling is in */
  argument: string;
  claims: ArgumentClaim[];
  /** Sum of the accepted claims' sway, 0-20 */
  totalSway: number;
  /** One line from the panel on the case as a whole */
  summary: string;
}

/** Longest argument we'll accept. Enough for a real case, short enough to read. */
export const ARGUMENT_MAX = 500;

export function cleanArgument(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, ARGUMENT_MAX);
}

const clampSway = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
};

/** Clamp whatever the model returned into rulings the rest of the app can trust. */
export function sanitizeRulings(raw: unknown, validSideIds: string[]): ArgumentRuling[] {
  const rows = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  const seen = new Set<string>();
  const out: ArgumentRuling[] = [];

  for (const r of rows) {
    const sideId = String(r?.sideId ?? "").trim();
    if (!validSideIds.includes(sideId) || seen.has(sideId)) continue;
    seen.add(sideId);

    const claims: ArgumentClaim[] = (Array.isArray(r?.claims) ? (r.claims as Record<string, unknown>[]) : [])
      .map((c) => {
        const accepted = c?.accepted === true;
        return {
          text: String(c?.text ?? "").trim().slice(0, 160),
          accepted,
          reason: String(c?.reason ?? "").trim().slice(0, 200),
          // A rejected claim is worth nothing, whatever number the model put
          // on it — otherwise a thrown-out point still quietly scores.
          sway: accepted ? clampSway(c?.sway) : 0,
        };
      })
      .filter((c) => c.text)
      .slice(0, 5);

    const totalSway = Math.min(
      20,
      claims.reduce((sum, c) => sum + c.sway, 0)
    );

    out.push({
      sideId,
      argument: cleanArgument(r?.argument),
      claims,
      totalSway,
      summary: String(r?.summary ?? "").trim().slice(0, 220),
    });
  }
  return out;
}

/**
 * Render the accepted points back into prompt text for the judge.
 *
 * Only the accepted ones travel. A claim the panel threw out must not reach
 * the judge at all, or a rejected argument would still colour the verdict
 * through the back door.
 */
export function argumentBriefing(
  rulings: ArgumentRuling[],
  nameFor: (sideId: string) => string
): string {
  const blocks = rulings
    .map((r) => {
      const kept = r.claims.filter((c) => c.accepted);
      if (!kept.length) {
        return `  ${nameFor(r.sideId)}: argued their case, but the panel accepted none of it. Give it no weight.`;
      }
      const points = kept.map((c) => `      - ${c.text} (worth ${c.sway}/10)`).join("\n");
      return `  ${nameFor(r.sideId)} — accepted points, total weight ${r.totalSway}:\n${points}`;
    })
    .filter(Boolean);

  if (!blocks.length) return "";

  return (
    `THE PLAYERS ARGUED THEIR CASES AND THE PANEL HAS ALREADY RULED.\n` +
    `These points were ACCEPTED and are now evidence you must weigh. A side ` +
    `with more accepted weight has genuinely strengthened its case — let it ` +
    `move your reasoning and your scores, and say so in your reasoning. It is ` +
    `not an automatic win: a strong argument over a weak roster still loses to ` +
    `an overwhelming one, but a close call should go the way of the better case.\n` +
    `${blocks.join("\n")}\n`
  );
}
