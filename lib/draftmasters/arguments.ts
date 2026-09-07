import { counterHits, traitsOf, type Trait } from "./traits";

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
  /**
   * Whether a real panel weighed this or the offline stand-in did.
   *
   * It matters downstream: an AI ruling has actually checked each claim
   * against the roster and priced it, so the offline verdict can lean on it
   * hard. The offline stand-in can only measure how specific the writing was,
   * which is not evidence of anything and must barely count.
   */
  ruled?: "ai" | "offline";
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

// ── Offline claim checking ───────────────────────────────────────────────────

interface Pickish {
  name: string;
  variant?: string | null;
  tier: number;
}

/** Words a player uses to claim a kind of thing rather than a specific name. */
const TRAIT_CLAIMS: { words: string[]; trait: Trait; label: string }[] = [
  { words: ["dragon", "drogon", "wyrm"], trait: "dragon", label: "a dragon" },
  { words: ["giant", "titan", "colossus"], trait: "giant", label: "a giant" },
  { words: ["huge", "massive", "enormous", "monster"], trait: "large", label: "something enormous" },
  { words: ["slow", "sluggish", "lumbering"], trait: "sluggish", label: "something slow" },
  { words: ["fly", "flying", "air", "aerial"], trait: "flying", label: "something airborne" },
];

/**
 * Judge an argument WITHOUT a model, by checking it against the board state.
 *
 * This is the difference between a real offline ruling and the word-count
 * stand-in it replaces. It cannot assess rhetoric, but it can verify the three
 * things players actually argue about: did you draft who you say you drafted,
 * do you have the kind of thing you claim, and does your counter genuinely
 * answer what they brought. Those are facts the game already knows.
 *
 * Claims that are checkably FALSE are rejected outright — naming a pick you
 * never drafted has to fail here exactly as it does with a panel, or the
 * offline path becomes the one where bluffing works.
 */
export function offlineClaims(text: string, mine: Pickish[], theirs: Pickish[]): ArgumentClaim[] {
  const claims: ArgumentClaim[] = [];
  const hay = text.toLowerCase();
  const mineNames = new Set(mine.map((p) => p.name.toLowerCase()));

  /**
   * Split into clauses before looking for ownership.
   *
   * "My scorpion will take Drogon out of the sky" names an enemy pick in a
   * sentence that also contains "my" — checked across the whole text that
   * reads as claiming to own Drogon, and the argument gets rejected for being
   * exactly right. Ownership has to be judged where it is asserted.
   */
  const clauses = hay
    .split(/[.!?;,]|\band\b|\balso\b|\bbut\b|\bwhile\b|\bbefore\b|\bagainst\b|\bvs\b/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const OWNS = /\bmy\b|\bmine\b|\bi have\b|\bi've got\b|\bwe have\b|\bour\b|\bi drafted\b/;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /**
   * Is this name claimed as OWNED, rather than merely mentioned?
   *
   * A possessive binds to the noun right after it. In "my scorpion will take
   * Drogon out of the sky", the "my" owns the scorpion and Drogon is the
   * target — so requiring the name to follow the possessive closely is what
   * separates naming your weapon from claiming their dragon.
   */
  const claimedAsOwned = (name: string) =>
    new RegExp(
      `\\b(?:my|mine|our|i have|i've got|we have|i drafted)\\b(?:\\W+\\w+){0,1}\\W+${esc(name)}`,
      "i"
    ).test(hay);

  /**
   * Trait words, with the opponents' names removed first.
   *
   * "Drogon" is a dragon keyword, so naming the enemy dragon otherwise reads
   * as claiming to have one — punishing the player for correctly identifying
   * what they are up against.
   */
  const withoutTheirNames = theirs.reduce(
    (s, p) => s.replaceAll(p.name.toLowerCase(), " "),
    hay
  );

  // 1. Your own picks, named. Verifiable and yours.
  for (const p of mine) {
    if (!hay.includes(p.name.toLowerCase())) continue;
    claims.push({
      text: `Argued from ${p.name}, who is genuinely on the roster`,
      accepted: true,
      reason: "Checked against the draft — this pick is theirs.",
      sway: Math.min(4, 1 + Math.round(p.tier / 3)),
    });
  }

  // 2. Their picks, claimed as yours — but only in a clause that actually
  //    asserts ownership. Naming an opponent as a target is fair comment.
  for (const p of theirs) {
    const n = p.name.toLowerCase();
    if (mineNames.has(n)) continue;
    if (!hay.includes(n) || !claimedAsOwned(n)) continue;
    claims.push({
      text: `Claimed ${p.name}`,
      accepted: false,
      reason: `${p.name} was drafted by the other side, not this one.`,
      sway: 0,
    });
  }

  // 3. Kinds of thing — "I have a dragon" is true or it is not, and again only
  //    counts as a claim where it is actually claimed.
  for (const tc of TRAIT_CLAIMS) {
    if (!tc.words.some((w) => withoutTheirNames.includes(w))) continue;
    const clause = clauses.find((c) => tc.words.some((w) => c.includes(w))) ?? "";
    const holder = mine.find((p) => traitsOf(p.name, p.variant).includes(tc.trait));
    if (holder) {
      claims.push({
        text: `Claimed ${tc.label} — ${holder.name}`,
        accepted: true,
        reason: `${holder.name} genuinely is ${tc.label}.`,
        sway: tc.trait === "dragon" || tc.trait === "giant" ? 5 : 3,
      });
    } else if (OWNS.test(clause)) {
      claims.push({
        text: `Claimed ${tc.label}`,
        accepted: false,
        reason: `Nothing on this roster is ${tc.label}.`,
        sway: 0,
      });
    }
  }

  // 4. Hard counters — the strongest truthful thing a player can say, and
  //    fully verifiable. Credited ONLY if they actually argued it: the counter
  //    is a fact about the board whether or not it was spotted, and handing
  //    sway to someone who never mentioned it rewards the draft twice over
  //    (the engine already scores the counter itself).
  for (const h of counterHits(mine, theirs)) {
    if (h.effect < 0.5) continue;
    const argued = h.attacker
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3)
      .some((w) => hay.includes(w));
    if (!argued) continue;
    claims.push({
      text: `${h.attacker} hard-counters ${h.target}`,
      accepted: true,
      reason: `${Math.round(h.effect * 100)}% to remove it outright — this is a game rule, not a matter of opinion.`,
      sway: 8,
    });
  }

  return claims.slice(0, 5);
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
