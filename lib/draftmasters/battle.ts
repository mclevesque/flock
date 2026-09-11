/**
 * DraftMasters — the offline battle.
 *
 * Until now a draft could only be settled by asking a model who won. That is
 * the best answer when it works, and no answer at all when the model is down,
 * slow, or the player is on a plane. It also means the game has no rules —
 * only opinions — so nothing on a card can promise anything.
 *
 * This is the other path: a deterministic resolver that plays the draft out.
 * Same inputs, same fight, every time, with no network call.
 *
 * ── The shape of a game ────────────────────────────────────────────────────
 *
 * You do not fight. You have 20 health and a team that stands in front of you.
 * The front two trade blows; whoever survives moves up. When a defender falls
 * to a bigger hit than they could absorb, the remainder gets past them and
 * hits YOU. Lose your whole team while you still have health and the enemy
 * survivors simply take turns on you until it is over.
 *
 * That is why this is a good drafting game rather than a good fighting game:
 * every pick is a decision about who is willing to stand in front of you, and
 * a cheap 1/1 is not worthless — it is one round somebody else is not hitting
 * you.
 *
 * ── The three numbers ──────────────────────────────────────────────────────
 *
 *   ATK   what it does to whatever is in front of it
 *   DEF   its health, and how much of an incoming hit it soaks
 *   PLANE which weight class of reality it fights in — see ./planes
 *
 * ATK and DEF are the card's power tier, so there is exactly one economy in
 * the game: what you paid for is what fights. A tier-5 headliner is a 5/5, and
 * a mythic variant on that same card is a 10/10, which is precisely why the
 * purple chip is worth outbidding someone over.
 *
 * ── Breakthrough ───────────────────────────────────────────────────────────
 *
 * The damage that gets past a falling defender is RAW ATTACK minus whatever
 * health that defender had left. Not the planar figure, not the boosted one —
 * the number printed on the card. A 10 that kills an 8 puts 2 on the player,
 * and it does that whether the attacker is a god or a farmhand, because the
 * player is not in the fight and planes describe a fight.
 */

import { effectiveTier, variantGrade, type Entry, type Pack, type Variant } from "./packs";
import { counterOf, hits, traitsOf, type Trait } from "./traits";
import { CAPTAINS } from "./captains";
import { powerOf } from "./power";
import { terrainSwing, type Terrain } from "./terrain";
import { order, rushOf, willOf, hasMind } from "./rush";

/**
 * Health a player starts with.
 *
 * Nothing. There is no player health any more — see the note at the top of
 * this file. Kept as a zero so the few call sites that still hand a number
 * around do not have to be threaded out all at once.
 */
export const PLAYER_HP = 0;

/**
 * A model's read on one card, bounded so it can never decide a fight.
 *
 * `vs` narrows it to a single opponent — "Qyburn's scorpion, but only against
 * the dragon" — which is where most of the interesting ones live.
 */
export interface Adjustment {
  /** Card name, matched loosely against the drafted name and its variant. */
  card: string;
  /** Only when facing this one. Omit for an adjustment that always applies. */
  vs?: string;
  atk?: number;
  def?: number;
  /** Shown to the player. An unexplained adjustment is not applied. */
  why: string;
}

export const ADJUST_LIMITS = { atk: 3, def: 3, count: 8 } as const;

const clampBy = (n: number | undefined, max: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.max(-max, Math.min(max, Math.round(n))) : 0;

/**
 * Take only what is inside the rules.
 *
 * Applied to anything a model returns before it reaches the resolver, so a
 * hallucinated "+40 attack" becomes +2 and a nameless one is dropped. The
 * engine never sees an unclamped number.
 */
export function sanitiseAdjustments(raw: unknown): Adjustment[] {
  if (!Array.isArray(raw)) return [];
  const out: Adjustment[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const card = typeof o.card === "string" ? o.card.trim() : "";
    const why = typeof o.why === "string" ? o.why.trim() : "";
    if (!card || !why) continue;
    const adj: Adjustment = {
      card,
      why: why.slice(0, 180),
      atk: clampBy(o.atk as number, ADJUST_LIMITS.atk),
      def: clampBy(o.def as number, ADJUST_LIMITS.def),

    };
    if (typeof o.vs === "string" && o.vs.trim()) adj.vs = o.vs.trim();
    if (!adj.atk && !adj.def) continue;
    out.push(adj);
    if (out.length >= ADJUST_LIMITS.count) break;
  }
  return out;
}

const mentions = (f: { name: string; variant: string | null }, needle: string) => {
  const hay = `${f.name} ${f.variant ?? ""}`.toLowerCase();
  const n = needle.toLowerCase();
  return hay.includes(n) || n.includes(f.name.toLowerCase());
};

/**
 * How much health a point of defence is worth.
 *
 * Two, so an even matchup takes two exchanges instead of one. At one, nothing
 * in the game ever survived a blow and every fight was a chain of one-shots
 * settled by a single rushdown roll.
 */
export const HP_PER_DEF = 2;

/** Hard stop, so a mutual stalemate can never hang the tab. */
const MAX_ROUNDS = 300;

/**
 * A die that is random-looking and completely reproducible.
 *
 * Prep is the only roll in the game and it still may not make the fight
 * unrepeatable: the offline result gets handed to the AI judge to narrate, and
 * a result that changes when you look at it twice is worthless for that. So
 * the seed comes from the two rosters — same draft, same rolls, forever, while
 * two different drafts get genuinely different luck.
 */
function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeDie(seed: number) {
  let a = seed || 1;
  return (sides: number): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) % sides) + 1;
  };
}

/**
 * What a prep roll buys, on a d6.
 *
 * A 1 is a wasted round and the card comes back exactly as it left, which is
 * the reason this is a gamble rather than a button. Nothing here can carry a
 * card past its own `max`.
 */
const PREP_ROLL: Record<number, { rush: number; atk: number; how: string }> = {
  1: { rush: 0, atk: 0, how: "and it comes to nothing" },
  2: { rush: 1, atk: 0, how: "and finds an angle" },
  3: { rush: 1, atk: 0, how: "and finds an angle" },
  4: { rush: 1, atk: 1, how: "and comes back with something that works" },
  5: { rush: 1, atk: 1, how: "and comes back with something that works" },
  6: { rush: 2, atk: 2, how: "and comes back with exactly the right answer" },
};

// ── Card effects ─────────────────────────────────────────────────────────────

/**
 * What a card does beyond its numbers.
 *
 * Kept to a small vocabulary on purpose. Every one of these has to be
 * explainable in a line on the card, resolvable without a model, and
 * generatable for a board a player invented thirty seconds ago — which rules
 * out anything that needs to know what a character is *like*.
 *
 * `note` is the long version, shown only when a player opens the card's
 * details after the fight. `label` is what fits on the card itself.
 */
export type CardEffect =
  /** Hits a kind of target far harder. The Night King and a dragon. */
  | { k: "superEffective"; vs: Trait[]; mult: number; label: string; note: string }
  /** Takes far less from a kind of target. */
  | { k: "resist"; vs: Trait[]; mult: number; label: string; note: string }
  /** Strikes before the opponent does. If the opponent dies, they never swing. */
  | { k: "first"; label: string; note: string }
  /**
   * Takes a shot instead of trading blows. Against a target with one of these
   * traits it rolls `chance` to kill outright — before the clash if that
   * target is the one opposite, and after it, at anything on the enemy bench,
   * if it survived the round.
   */
  | { k: "snipe"; vs: Trait[]; chance: number; label: string; note: string }
  /**
   * May spend its blow on the enemy CAPTAIN rather than the card in front of
   * it. Still takes the return swing from the card in front of it.
   */
  | { k: "assassin"; label: string; note: string }
  /** Strikes twice per round. */
  | { k: "double"; label: string; note: string }
  /** Reduces every incoming hit by n, after everything else. */
  | { k: "ward"; n: number; label: string; note: string }
  /** Heals n at the end of each round, never above its DEF. */
  | { k: "regen"; n: number; label: string; note: string }
  /** Brings n fallen allies back, at half health, once each. */
  | { k: "revive"; n: number; label: string; note: string }
  /** Heals YOUR player n when it kills something. Rare and small on purpose. */
  | { k: "mend"; n: number; label: string; note: string }
  /**
   * Transforms: a new name, a higher plane, more attack. The one effect that
   * exists because the source material demands it — half these characters have
   * a second form, and a game that ignores that is not about them.
   *
   * Two triggers, because the genre has two. `at` is the health fraction it
   * turns at. `onAllyDeath` is the other one, and the better one: somebody on
   * your side goes down in front of them and that is what does it.
   *
   * A card drafted already wearing the form does not transform into it a
   * second time — Super Saiyan Goku is simply Super Saiyan, and was paid for
   * at auction as such. The transformation belongs to the base card, which is
   * exactly why the base card is worth drafting.
   */
  | {
      k: "ascend";
      at: number;
      onAllyDeath?: boolean;
      /** Defence gained on transforming. Was a plane; a plane was never a number you could see. */
      def: number;
      atk: number;
      as: string;
      label: string;
      note: string;
    }
  /**
   * Withdraws to prepare, then comes back operating higher.
   *
   * The Batman problem, and it needed solving: he is a tier-5 pick every board
   * would fight over and a plane-2 man who cannot scratch anything cosmic. In
   * the comics that is never where the story ends — he leaves, he works, he
   * comes back with the thing that beats you.
   *
   * So a prep card facing something it cannot hurt falls back, once. The cost
   * is real and immediate: a teammate takes that round instead, and if your
   * line is thin that is how you lose it. The payoff is a die roll capped at
   * `max`, which is the whole balance — prep makes Batman dangerous to a god
   * and never makes him one.
   */
  | { k: "prep"; max: number; label: string; note: string }
  /** Survives its first lethal blow on 1 health. Nothing gets past it either. */
  | { k: "undying"; label: string; note: string }
  /** Gains attack with every kill, permanently. */
  | { k: "bloodlust"; n: number; label: string; note: string }
  /** Gains attack the moment it is the last one standing on its side. */
  | { k: "lastStand"; n: number; label: string; note: string }
  /**
   * COMMAND — the only effect that does nothing at all unless this card is
   * named captain.
   *
   * It is printed on the card either way, greyed until you promote them, which
   * is deliberate: half the value of the mechanic is a player looking at Tywin
   * Lannister mid-draft and realising he is worth more standing behind the line
   * than in it. A card with no command still captains perfectly well on the
   * default +1/+1; these are the ones who are actually good at it.
   *
   * `grace` is the strong one and the reason it is captain-only. It shortens
   * the plane gap for the whole line — the captain telling four ordinary people
   * how to fight something they have no business fighting. On anyone else it
   * would break the planar rules outright; on one card, at the cost of that
   * card never throwing a punch, it is the best answer the game has to a god.
   */
  | {
      k: "command";
      atk: number;
      def: number;
      /** Rushdown lent to the whole line. Was `grace`, which shortened a plane gap. */
      grace?: number;
      /**
       * When the captain's own trick fires.
       *
       *   allyDown  a card on their side has just fallen
       *   alone     they are the last one standing and have taken the field
       *   kill      their line has just taken somebody down
       *   round     every round, quietly, for as long as they are captain
       */
      when?: "allyDown" | "alone" | "kill" | "round";
      /** What that trigger does to the captain's own line. */
      then?: { atk?: number; def?: number; heal?: number };
      /** What the captain does to the ENEMY line, once, at the start. */
      doom?: { atk?: number; def?: number };
      /** Fallen cards this captain can put back on their feet, whole battle. */
      raise?: number;
      /**
       * Substitutions this captain may make, whole battle.
       *
       * When the card in front is about to die for nothing — it cannot hurt
       * what it is facing, or the next blow kills it — the captain pulls them
       * and sends in whoever is actually built for this. The pulled card goes
       * to the BACK of the line rather than off it, so a substitution buys the
       * right matchup now and costs you the order later.
       *
       * Strictly better only: a captain never swaps to make things worse, and
       * never spends one on a fight that is already going fine.
       */
      swap?: number;
      lends?: EffectKind;
      label: string;
      note: string;
    };

export type EffectKind = CardEffect["k"];

/**
 * Effects keyed by a fragment of the card's name or variant.
 *
 * Same pattern as the counters in `traits.ts`, and for the same reason: a
 * board the model generated gets the same rules as a hand-written one the
 * moment it names the same character. The variant is checked alongside the
 * name, so a card's mythic form can carry an effect its base form does not.
 *
 * First match of each KIND wins, so a card can pick up several effects from
 * several rows but never two of the same kind.
 */
const EFFECTS_CORE: { match: string; not?: string[]; fx: CardEffect }[] = [
  {
    match: "night king",
    fx: {
      k: "superEffective", vs: ["dragon"], mult: 2,
      label: "Dragonfall",
      note:
        "The Night King put a spear through Viserion at three hundred yards, over " +
        "water, on the first throw — and then walked the thing back out of the lake " +
        "on his side. Dragons are not a problem he solves; they are a resource he " +
        "collects. Any dragon that comes at him takes double.",
    },
  },
  {
    match: "night king",
    fx: {
      k: "revive", n: 1,
      label: "Raise the dead",
      note:
        "Everything that dies in front of him is a recruit. Once per battle, the " +
        "strongest fallen ally on his side stands back up at half health and keeps " +
        "fighting. They do not thank him.",
    },
  },
  {
    match: "white walker",
    fx: {
      k: "resist", vs: ["infantry"], mult: 0.5,
      label: "Cold iron",
      note:
        "Ordinary steel shatters on them. Anyone fighting on foot without dragonglass " +
        "or Valyrian steel does half damage, which is most of any board.",
    },
  },
  {
    match: "scorpion", // Qyburn's, not the ninja — the ninja is caught by name too,
    fx: {              // and being unusually good at shooting dragons suits him fine.
      k: "superEffective", vs: ["dragon", "giant", "large"], mult: 2,
      label: "Anti-air",
      note:
        "Built for one job. Against anything big enough in the sky it is devastating; " +
        "against anyone quick enough to walk out of the firing line it is a heavy " +
        "machine somebody has to crank.",
    },
  },
  {
    match: "wolverine",
    fx: {
      k: "regen", n: 2,
      label: "Healing factor",
      note:
        "Closes two points of damage at the end of every round. It does not make him " +
        "hard to hurt; it makes him impossible to finish, which over a long fight is " +
        "worse for whoever is opposite him.",
    },
  },
  { match: "deadpool", fx: { k: "regen", n: 3, label: "Heals from nearly anything", note: "Regrows faster than anything on the board can take him apart. Three points back every round, indefinitely, while narrating it." } },
  { match: "troll", fx: { k: "regen", n: 1, label: "Knits shut", note: "Wounds close on their own between exchanges. One point back each round." } },
  { match: "hydra", fx: { k: "regen", n: 2, label: "Two more heads", note: "Cutting a piece off is how it gets bigger. Two points back each round." } },
  {
    match: "goku",
    fx: {
      k: "ascend", at: 0.4, onAllyDeath: true, def: 3, atk: 3, as: "Super Saiyan",
      label: "Transformation possible",
      note:
        "Takes the beating first. Every fight he is in has a moment where he has " +
        "clearly lost, and that moment is the setup. He turns at 40% health — or the " +
        "instant somebody on his side goes down in front of him, which is how it has " +
        "actually happened every time that mattered. Three attack and a plane, which " +
        "for most opponents means their damage simply stops arriving.\n\nDraft him " +
        "already Super Saiyan and none of this applies: that card is Super Saiyan, " +
        "full stop, and you paid for it at auction.",
    },
  },
  { match: "hulk", fx: { k: "ascend", at: 0.5, onAllyDeath: true, def: 0, atk: 4, as: "Angrier", label: "Transformation possible", note: "The only character on any board whose attack is a function of how badly he is losing. Four attack at half health, or the moment a teammate goes down in front of him, permanently, for the rest of the battle." } },
  { match: "gohan", fx: { k: "ascend", at: 0.35, onAllyDeath: true, def: 3, atk: 4, as: "and he has had enough", label: "Transformation possible", note: "Does not want to be here and is the most dangerous thing on the board anyway. Turns when a teammate falls in front of him, or at 35% health — four attack and a plane. Every single time, it has taken somebody dying." } },
  { match: "eren", fx: { k: "ascend", at: 0.4, onAllyDeath: true, def: 3, atk: 3, as: "titan form", label: "Transformation possible", note: "Turns at 40% health, or the instant somebody on his side goes down." } },
  { match: "ichigo", fx: { k: "ascend", at: 0.35, onAllyDeath: true, def: 3, atk: 3, as: "Bankai", label: "Transformation possible", note: "Holds it back until holding it back stops being an option — 35% health, or a teammate falling in front of him." } },
  { match: "sailor", fx: { k: "ascend", at: 0.4, onAllyDeath: true, def: 3, atk: 2, as: "fully transformed", label: "Transformation possible", note: "Turns at 40% health, or when a teammate goes down." } },
  { match: "beast boy", fx: { k: "ascend", at: 0.4, onAllyDeath: true, def: 3, atk: 3, as: "something much larger", label: "Transformation possible", note: "Turns at 40% health, or when a teammate goes down, and stops being funny." } },
  { match: "banner", fx: { k: "ascend", at: 0.6, onAllyDeath: true, def: 6, atk: 6, as: "Hulk", label: "Transformation possible", note: "The single biggest swing on any board: a plane-1 scientist who becomes a Cosmic problem the moment the fight goes badly. Six attack and two planes, at 60% health or on a teammate falling." } },
  // ── Assassins ─────────────────────────────────────────────────────────
  // Rare on purpose. Reaching the captain is the strongest thing a small card
  // can do in this game, and it should belong to the handful of people whose
  // entire character is getting to somebody they should not be able to reach.
  { match: "arya", fx: { k: "assassin", label: "A girl has a name", note: "Does not need to beat the person in front of her. Goes round them and puts the knife in the enemy captain instead — and takes the return swing for the privilege." } },
  { match: "jaqen", fx: { k: "assassin", label: "Valar morghulis", note: "Names a man and reaches him, whoever is standing in the way. Strikes the enemy captain instead of the fighter opposite." } },
  { match: "the faceless", fx: { k: "assassin", label: "No one", note: "Strikes the enemy captain rather than the card in front." } },
  { match: "assassin", fx: { k: "assassin", label: "Paid in advance", note: "The whole discipline is reaching the person who thought they were safe. Strikes the enemy captain instead of the fighter opposite." } },
  { match: "michael myers", fx: { k: "assassin", label: "He is already inside", note: "Was not in front of you a moment ago and is not interested in whoever is. Goes for the captain." } },
  { match: "talia al ghul", fx: { k: "assassin", label: "League training", note: "Strikes the enemy captain rather than the card in front." } },

  { match: "flash", fx: { k: "first", label: "Strikes first", note: "The fight is over before the other side has finished deciding to have it. Always lands the first blow — and if that blow kills, nothing comes back." } },
  { match: "quicksilver", fx: { k: "first", label: "Strikes first", note: "Always lands the first blow. If it kills, nothing comes back." } },
  { match: "sonic", fx: { k: "first", label: "Strikes first", note: "Gets there before the exchange starts. If the first hit kills, nothing comes back." } },
  { match: "legolas", fx: { k: "first", label: "Looses first", note: "Three arrows in the air before anyone has closed the distance. Always strikes first." } },
  { match: "aemond", fx: { k: "first", label: "Strikes first", note: "Does not wait, does not warn, and has never once been talked out of it. Always strikes first." } },
  { match: "assassin", fx: { k: "first", label: "Strikes first", note: "The whole discipline is being the one who moves before the other person knows there is a fight." } },
  { match: "gandalf", fx: { k: "ward", n: 2, label: "You shall not pass", note: "Two points come off every hit before it lands. Not a shield so much as a refusal." } },
  { match: "shield", fx: { k: "ward", n: 1, label: "Shielded", note: "One point comes off every incoming hit." } },
  { match: "armour", fx: { k: "ward", n: 1, label: "Armoured", note: "One point comes off every incoming hit." } },
  { match: "armor", fx: { k: "ward", n: 1, label: "Armoured", note: "One point comes off every incoming hit." } },
  {
    match: "melisandre",
    fx: {
      k: "mend", n: 2,
      label: "The Lord's light",
      note:
        "When she takes someone off the board, two points come back to you. She is " +
        "not healing you so much as spending the death on you, which is a distinction " +
        "she has never once been troubled by.",
    },
  },
  { match: "phoenix", fx: { k: "mend", n: 2, label: "Rekindles", note: "Two health back to you each time it takes something down. Rare, and deliberately small." } },
  { match: "cleric", fx: { k: "mend", n: 1, label: "Field blessing", note: "One health back to you each time it takes something down." } },
  { match: "medic", fx: { k: "mend", n: 1, label: "Patches you up", note: "One health back to you each time it takes something down." } },
  { match: "life", fx: { k: "mend", n: 1, label: "Draws life", note: "One health back to you each time it takes something down." } },
  // ── Command — dark on the card until you name them captain ─────────────
  {
    match: "batman",
    fx: {
      k: "command", atk: 1, def: 1, grace: 1, swap: 1,
      label: "Contingency for everyone",
      note:
        "There is a file on every person you are about to fight, and if Batman is running " +
        "the line, everyone on it has read theirs. The whole team fights one plane closer " +
        "to whatever is opposite them — kryptonite in a lead box, a frequency, a weakness " +
        "somebody wrote down years ago. It is the single best answer this game has to a god, " +
        "and it costs you Batman in the fight, which is exactly what it should cost.",
    },
  },
  {
    match: "tywin",
    fx: {
      k: "command", atk: 3, def: 0, swap: 2,
      label: "Fear is a weapon",
      note:
        "Never swung a sword in his life and won more fights than anyone on this board. The " +
        "entire line hits for three more while he is standing behind it. He will not step " +
        "forward until there is nobody left to send forward, and he will be irritated about it.",
    },
  },
  { match: "aragorn", fx: { k: "command", atk: 1, def: 2, lends: "first", label: "Men of the West", note: "The line fights at +1/+2 and moves first, because he has already told each of them where to stand. He does not join it until he is the only one left." } },
  { match: "jon snow", fx: { k: "command", atk: 1, def: 2, label: "The line holds", note: "+1/+2 to everyone in front of him. He is a mediocre commander and an extraordinary reason not to run." } },
  { match: "nick fury", fx: { k: "command", swap: 2, atk: 2, def: 1, label: "Assembled", note: "+2/+1 to the whole line. Fury's entire skill set is making other people fight together, and it is worth more than a gun." } },
  { match: "professor x", fx: { k: "command", swap: 2, atk: 1, def: 1, grace: 1, lends: "first", label: "One mind", note: "The line moves as one and fights a plane closer to anything above it — everybody sees what everybody sees, half a second before it happens." } },
  { match: "captain america", fx: { k: "command", atk: 2, def: 2, label: "On your left", note: "+2/+2 to everyone in front of him. There is a reason the word is in the name." } },
  { match: "melisandre", fx: { k: "command", atk: 1, def: 1, lends: "mend", label: "For the night is dark", note: "The whole line draws life back to you on a kill. Whatever she is doing behind them, it works." } },
  { match: "gandalf", fx: { k: "command", atk: 1, def: 2, lends: "ward", label: "A servant of the Secret Fire", note: "Everyone in front of him takes two less from every blow. He was never here to fight; he was here to make sure they could." } },
  { match: "tyrion", fx: { k: "command", swap: 2, atk: 2, def: 1, label: "Wins the war from a tent", note: "+2/+1 to the line. He is a 1/1 who has never won a fight and he is one of the best captains in the game, which is the joke and also correct." } },
  { match: "cersei", fx: { k: "command", atk: 3, def: -1, label: "No middle ground", note: "+3 attack and −1 health to everyone. Under Cersei the line hits harder and dies faster, and she would tell you that is the same thing." } },
  { match: "griffith", not: ["vincent"], fx: { k: "command", atk: 3, def: 1, label: "The Band of the Hawk", note: "+3/+1 to the entire line. Everybody follows him. It has never once ended well and they follow him anyway." } },
  { match: "shikamaru", fx: { k: "command", swap: 2, atk: 1, def: 1, grace: 1, label: "Two hundred moves ahead", note: "The line fights a plane closer to whatever is above it, because he has already worked out where it is weak." } },
  { match: "ozymandias", fx: { k: "command", swap: 2, atk: 2, def: 1, grace: 1, label: "Already accounted for", note: "The line fights a plane closer and hits harder. He set this up long before the draft." } },
  { match: "lex luthor", fx: { k: "command", swap: 1, atk: 1, def: 1, grace: 1, label: "Man of tomorrow", note: "The line fights a plane closer to whatever is opposite it. Luthor's whole life is the argument that a man with a plan beats a god." } },
  { match: "doctor doom", fx: { k: "command", swap: 1, atk: 2, def: 2, grace: 1, label: "Doom commands", note: "+2/+2 and the line fights a plane closer. Doom does not delegate; he permits." } },
  { match: "zordon", fx: { k: "command", swap: 2, atk: 2, def: 2, label: "It's morphin time", note: "+2/+2 to the whole line. He is a face in a tube and he has never lost." } },
  { match: "splinter", fx: { k: "command", swap: 1, atk: 1, def: 2, lends: "first", label: "My sons", note: "The line moves first and holds at +1/+2. Four of them, one of him, and he trained all four." } },
  { match: "yoda", fx: { k: "command", atk: 1, def: 2, grace: 1, label: "Size matters not", note: "The line fights a plane closer to anything above it, which is the entire lesson and he says it out loud." } },
  { match: "dumbledore", fx: { k: "command", atk: 1, def: 2, lends: "ward", label: "Help will be given", note: "The line takes less from every blow while he is behind it." } },
  { match: "hannibal", fx: { k: "command", atk: 2, def: 1, grace: 1, label: "Knows exactly where you break", note: "The line fights a plane closer. He has been having a conversation with your team the whole time." } },
  { match: "palpatine", fx: { k: "command", atk: 3, def: 0, label: "Everything as I have foreseen", note: "+3 attack to the line. Nobody following him lives long and every one of them fights like it." } },
  { match: "vegeta", fx: { k: "command", atk: 2, def: 0, label: "Fight properly", note: "+2 attack to the line, delivered entirely as insults. It works." } },

  // The schemers. Every one of these is a poor fighter and a superb captain,
  // and that gap is the point — before captains existed, a 1/1 who has never
  // won a fight was simply a bad card, and the game had no way to say that
  // Olenna Tyrell is more dangerous than most of the men on her board.
  { match: "olenna", fx: { k: "command", swap: 1, atk: 3, def: 1, label: "Tell Cersei", note: "+3/+1 to the whole line. She has poisoned a king, outlived four husbands and lost precisely one argument in her life. She will not be joining the fight, and she has never needed to." } },
  { match: "littlefinger", fx: { k: "command", swap: 2, atk: 2, def: 2, grace: 1, label: "Chaos is a ladder", note: "+2/+2 and the line fights a plane closer to whatever is above it. He arranged this. He has arranged everything else too." } },
  { match: "varys", fx: { k: "command", swap: 2, atk: 1, def: 3, label: "Little birds everywhere", note: "+1/+3. He knows what the other side drafted, roughly where they are standing, and what each of them is afraid of." } },
  { match: "davos", fx: { k: "command", swap: 1, atk: 2, def: 1, label: "The Onion Knight", note: "+2/+1. No fingers, no sword worth mentioning, and the only man on the board everyone actually listens to." } },
  { match: "sansa", fx: { k: "command", swap: 1, atk: 2, def: 2, label: "A slow learner with good teachers", note: "+2/+2. She was taught by Cersei, Littlefinger and Ramsay in turn and outlived all three." } },
  { match: "bran stark", fx: { k: "command", swap: 2, atk: 1, def: 2, grace: 1, label: "Sees all of it", note: "The line fights a plane closer, because he has already watched this happen." } },
  { match: "roose bolton", fx: { k: "command", swap: 1, atk: 2, def: 1, label: "A quiet man", note: "+2/+1. Nobody has ever seen him raise his voice or lose." } },
  { match: "hand of the king", fx: { k: "command", atk: 2, def: 1, label: "Hand of the King", note: "+2/+1 to the line." } },
  { match: "batiatus", fx: { k: "command", atk: 2, def: 1, label: "Owns the ludus", note: "+2/+1. He has never fought and he has made a great deal of money on people who have." } },
  { match: "amanda waller", fx: { k: "command", swap: 2, atk: 3, def: 0, label: "The Wall", note: "+3 attack. Nobody on the line has a choice about being there and every one of them fights like it." } },
  { match: "nick fury", fx: { k: "command", atk: 2, def: 1, label: "Assembled", note: "+2/+1 to the whole line. Fury's entire skill set is making other people fight together, and it is worth more than a gun." } },
  { match: "light yagami", fx: { k: "command", swap: 1, atk: 3, def: 0, grace: 1, label: "All according to plan", note: "+3 attack and the line fights a plane closer. He is a schoolboy with no combat ability whatsoever and the most dangerous captain on any anime board." } },
  { match: "lelouch", fx: { k: "command", swap: 2, atk: 3, def: 1, grace: 1, label: "Geass", note: "+3/+1 and the line fights a plane closer. Physically the worst card in his own franchise; strategically the best." } },
  { match: "aizen", fx: { k: "command", swap: 2, atk: 2, def: 2, grace: 1, label: "All of it was planned", note: "+2/+2 and a plane closer. Whatever you thought was happening was the plan." } },
  { match: "thrawn", fx: { k: "command", swap: 3, atk: 2, def: 2, grace: 1, label: "Studies your art", note: "+2/+2 and a plane closer. He has read everything your side has ever written and drawn conclusions from it." } },
  { match: "moriarty", fx: { k: "command", swap: 2, atk: 2, def: 1, grace: 1, label: "The Napoleon of crime", note: "+2/+1 and a plane closer." } },
  { match: "senku", fx: { k: "command", atk: 2, def: 2, label: "Ten billion percent", note: "+2/+2. He will build whatever the line needs out of whatever is on the floor." } },

  // ── Prep ───────────────────────────────────────────────────────────────
  // The ceiling is the design. Batman reaches SUPERHUMAN on a good roll, which
  // is enough to hurt a Titan and never enough to be one.
  {
    match: "batman",
    fx: {
      k: "prep", max: 4,
      label: "Prep time",
      note:
        "Given a round to work, he arrives with the answer rather than the fists. " +
        "Facing anything he cannot hurt, Batman withdraws once and a teammate takes " +
        "that round in his place, which is the actual cost and it has lost fights. He " +
        "comes back somewhere between exactly as he left and two planes up. He does " +
        "not come back a god. He comes back able to reach one.",
    },
  },
  { match: "iron man", fx: { k: "prep", max: 5, label: "Builds the suit for it", note: "There is a Hulkbuster, a Thorbuster and a Celestial-killer, and every one of them was built between fights. Withdraws once, a teammate covers, and he returns operating higher." } },
  { match: "tony stark", fx: { k: "prep", max: 5, label: "Builds the suit for it", note: "Withdraws once, a teammate covers, and he returns with something built for whatever is standing opposite him." } },
  { match: "doctor doom", fx: { k: "prep", max: 6, label: "Doom has prepared", note: "Withdraws once, a teammate covers, and returns having accounted for you. Doom always accounts for you." } },
  { match: "lex luthor", fx: { k: "prep", max: 5, label: "Prepared for you specifically", note: "Has a plan for every single person on this board, filed and funded. Withdraws once, a teammate covers, and comes back with the one written for this fight." } },
  { match: "mister fantastic", fx: { k: "prep", max: 5, label: "Solves it", note: "Given one round the fight stops being a fight and becomes an equation. Withdraws once, a teammate covers." } },
  { match: "ozymandias", fx: { k: "prep", max: 4, label: "Did this thirty-five minutes ago", note: "Withdraws once, a teammate covers, and it emerges that the withdrawal was the plan and had already happened." } },
  { match: "shikamaru", fx: { k: "prep", max: 4, label: "Two hundred moves ahead", note: "Needs one round to think, after which the fight is decided. Withdraws once, a teammate covers." } },
  { match: "kakashi", fx: { k: "prep", max: 4, label: "Copies the technique", note: "One round of watching and he has it. Withdraws once, a teammate covers." } },
  { match: "qyburn", fx: { k: "prep", max: 3, label: "Builds something", note: "Whatever killed the last one, he is already building the thing that kills the next. Withdraws once, a teammate covers." } },
  { match: "sherlock", fx: { k: "prep", max: 3, label: "Deduces it", note: "One round of observation and he knows precisely where this person comes apart. Withdraws once, a teammate covers." } },
  { match: "artificer", fx: { k: "prep", max: 4, label: "Makes the counter", note: "Withdraws once, a teammate covers, and returns with the tool for this specific problem." } },

  // ── Refuses to fall ────────────────────────────────────────────────────
  { match: "the mountain", fx: { k: "undying", label: "Will not go down", note: "The first blow that should finish him leaves him standing on one health instead, and nothing gets past him to you. He has already died once. It did not take." } },
  { match: "gregor clegane", fx: { k: "undying", label: "Will not go down", note: "The first killing blow leaves him on one health instead. It has been tried before, thoroughly." } },
  { match: "michael myers", fx: { k: "undying", label: "Keeps getting up", note: "The first killing blow does not take. It never has, in any of them." } },
  { match: "jason voorhees", fx: { k: "undying", label: "Keeps getting up", note: "The first killing blow does not take. Nobody has ever made one stick." } },
  { match: "terminator", fx: { k: "undying", label: "Absolutely will not stop", note: "The first killing blow leaves it on one health and it keeps walking, which is the point of it." } },
  { match: "immortal", fx: { k: "undying", label: "Comes back", note: "The first killing blow leaves them on one health. It is the whole gimmick and it is a good one." } },

  // ── Gets worse as it goes ──────────────────────────────────────────────
  { match: "guts", fx: { k: "bloodlust", n: 1, label: "Feeds on it", note: "A point of attack with every kill, permanently, for the rest of the battle. The longer a fight runs the less anything opposite him matters, which is also, precisely, his problem." } },
  { match: "zodd", fx: { k: "bloodlust", n: 1, label: "Feeds on it", note: "A point of attack with every kill, permanently." } },
  { match: "doomsday", fx: { k: "bloodlust", n: 2, label: "Adapts", note: "Two points of attack per kill, permanently. Whatever worked once does not work twice." } },
  { match: "kirby", fx: { k: "bloodlust", n: 1, label: "Copies what it eats", note: "A point of attack per kill, permanently, and nobody has ever been entirely comfortable about it." } },
  { match: "cell", fx: { k: "bloodlust", n: 2, label: "Absorbs", note: "Two points of attack per kill, permanently." } },

  // ── Better alone ───────────────────────────────────────────────────────
  { match: "aragorn", fx: { k: "lastStand", n: 3, label: "Holds the gate", note: "Three points of attack the moment he is the last one left. He is at his best when the situation is at its worst, which is the only reason anyone followed him anywhere." } },
  { match: "samwise", fx: { k: "lastStand", n: 4, label: "Carries him anyway", note: "Four points of attack the moment he is the last one standing, which is the only situation in which anybody has ever needed him." } },
  { match: "solid snake", fx: { k: "lastStand", n: 3, label: "One-man infiltration", note: "Three points of attack once he is alone. He was always going to end up alone." } },
  { match: "vegeta", fx: { k: "lastStand", n: 3, label: "Saiyan pride", note: "Three points of attack the moment he is the last one standing, because that is the only time he has ever fought properly." } },
  { match: "the hound", fx: { k: "lastStand", n: 2, label: "Nothing left to lose", note: "Two points of attack once he is the last one left, and no interest whatsoever in the outcome." } },

  { match: "bahamut", fx: { k: "superEffective", vs: ["infantry"], mult: 2, label: "Megaflare", note: "The blast does not distinguish between one soldier and a line of them. Double against anything on foot." } },
  { match: "dragon", fx: { k: "superEffective", vs: ["infantry"], mult: 1.5, label: "Fire from above", note: "Anything on foot in the open takes half again as much. Dragons are not good at fighting other dragons; they are good at fighting people." } },
  { match: "giant", fx: { k: "resist", vs: ["infantry"], mult: 0.6, label: "Too big to stop", note: "A person's whole strength is a bruise at this size. Takes 40% less from anything on foot." } },
];

/**
 * Everything the game can put on a card.
 *
 * The core list above is hand-tuned and comes first, so a board's captain
 * file can name a character that already has an effect here without quietly
 * replacing it — first match of each kind wins.
 */
const EFFECTS: { match: string; not?: string[]; fx: CardEffect }[] = [...EFFECTS_CORE, ...CAPTAINS];


/** Every effect a card carries, from the registry and from its declared counter. */
export function effectsFor(name: string, variant?: string | null): CardEffect[] {
  const hay = `${name} ${variant ?? ""}`.toLowerCase();
  const bare = name.toLowerCase();
  const out: CardEffect[] = [];
  const taken = new Set<EffectKind>();

  for (const row of EFFECTS) {
    // A captaincy is matched against the NAME alone. Anything else may read
    // the variant too, because that is where transformations live.
    const against = row.fx.k === "command" ? bare : hay;
    if (!hits(against, row.match)) continue;
    // Some fragments cannot be made specific enough: the Berserk card is
    // named simply "Griffith", so nothing distinguishes it from Vincent
    // Griffith except saying so.
    if (row.not?.some((n) => bare.includes(n))) continue;
    if (taken.has(row.fx.k)) continue;
    taken.add(row.fx.k);
    out.push(row.fx);
  }

  // A declared counter is already a "super effective against" in everything but
  // name, so it becomes one rather than being a second system that disagrees.
  if (!taken.has("superEffective") && !taken.has("snipe")) {
    const counter = counterOf(name, variant);
    if (counter) {
      // A dragon-killer does not do "more damage" to a dragon. It either puts
      // the bolt through it or it does not, which is the whole reason anybody
      // wheels one onto the walls.
      out.push({
        k: "snipe",
        vs: counter.strongAgainst,
        chance: counter.hitChance,
        label: "Built for this",
        note: counter.note,
      });
    }
  }

  return out;
}

/**
 * What a captain hands the rest of the team.
 *
 * One effect, and only from the short list of ones that read as leadership
 * rather than as a personal trick: a shield you extend over other people, a
 * healer's attention, the habit of moving first. Nobody lends their healing
 * factor or their transformation — those are things that happen to a body.
 */
const LENDABLE: EffectKind[] = ["ward", "mend", "first", "superEffective"];

export interface Aura {
  atk: number;
  def: number;
  /** Rushdown lent to the whole line. Captain-only, always. */
  grace: number;
  /** Substitutions this captain may make during the battle. */
  swap: number;
  lends: CardEffect | null;
  label: string;
  /** The captain's own trick, if they have one written. */
  when?: "allyDown" | "alone" | "kill" | "round";
  then?: { atk?: number; def?: number; heal?: number };
  doom?: { atk?: number; def?: number };
  raise?: number;
}

/**
 * What this card brings if you promote it.
 *
 * Anybody can captain — the default is +1/+1 and whichever of their own tricks
 * is the kind you can extend over other people. A card with a COMMAND effect
 * brings that instead, and command is where the interesting numbers live.
 */
export function captainAura(captain: Card): Aura {
  const cmd = captain.fx.find((f) => f.k === "command");
  if (cmd && cmd.k === "command") {
    const lends = cmd.lends
      ? captain.fx.find((f) => f.k === cmd.lends) ??
        EFFECTS.find((e) => e.fx.k === cmd.lends)?.fx ??
        null
      : captain.fx.find((f) => LENDABLE.includes(f.k)) ?? null;
    return {
      atk: cmd.atk,
      def: cmd.def,
      grace: cmd.grace ?? 0,
      swap: cmd.swap ?? 0,
      lends,
      label: cmd.label,
      when: cmd.when,
      then: cmd.then,
      doom: cmd.doom,
      raise: cmd.raise,
    };
  }
  const lends = captain.fx.find((f) => LENDABLE.includes(f.k)) ?? null;
  return { ...roleFor(captain), lends };
}

/**
 * The captain you are when nobody wrote you one.
 *
 * Read off the card itself, in this order, because the first thing that is
 * true about a card is the most interesting thing about it. A 1/4 schemer is
 * a schemer before they are anything else; a dragon is a dragon.
 */
function roleFor(c: Card): Omit<Aura, "lends"> {
  const big = c.traits.includes("dragon") || c.traits.includes("giant") || c.traits.includes("large");
  const wall = c.def >= c.atk + 3;
  const bruiser = c.atk >= c.def + 3;
  const feeble = c.atk + c.def <= 7;

  // Somebody who cannot fight has had to get good at something else. This is
  // the role that makes Olenna and Varys worth promoting even before anybody
  // writes them an ability.
  if (feeble) {
    return { atk: 1, def: 1, grace: 0, swap: 1, label: "Fights the war from a tent" };
  }
  if (big) {
    return { atk: 1, def: 2, grace: 0, swap: 0, label: "Something enormous behind you" };
  }
  if (c.rush >= 3) {
    return { atk: 1, def: 0, grace: 1, swap: 0, label: "Sets the pace" };
  }
  if (wall) {
    return { atk: 0, def: 3, grace: 0, swap: 0, label: "Holds the line" };
  }
  if (bruiser) {
    return { atk: 2, def: 0, grace: 0, swap: 0, label: "Leads the charge" };
  }
  return { atk: 1, def: 1, grace: 0, swap: 0, label: "Leads from the back" };
}

/** Whether promoting this card unlocks something it cannot do in the line. */
export const hasCommand = (c: Card): boolean => c.fx.some((f) => f.k === "command");

/** One line for the player, on the captain's own card. */
export function captainNote(captain: Card): string {
  const a = captainAura(captain);
  const stat =
    a.atk || a.def
      ? `${a.atk >= 0 ? "+" : ""}${a.atk}/${a.def >= 0 ? "+" : ""}${a.def}`
      : "no change";
  return (
    `${a.label} — the rest of your line fights at ${stat}` +
    (a.swap
      ? `, and ${captain.name} can pull somebody out of a losing matchup and send in ` +
        `a better answer ${a.swap === 1 ? "once" : `${a.swap} times`}`
      : "") +
    (a.grace ? `, and ${a.grace === 1 ? "a plane" : `${a.grace} planes`} of any gap above them stops counting` : "") +
    (a.lends ? `, and shares ${a.lends.label.toLowerCase()}` : "") +
    `. ${captain.name} does not fight until they are the last one left, and takes the field ` +
    `at +2 attack when they do.`
  );
}

/**
 * How reliably a card does what it is told, on a d6. Roll at or under and they
 * go; roll over and they stay exactly where they are.
 *
 * Declared for the ones where it is the character, inferred from traits for
 * everybody else — a board somebody generated ten seconds ago still gets a
 * dragon that ignores you, because a dragon ignoring you is a fact about
 * dragons rather than a fact about that board.
 */
const OBEDIENCE: [string, number][] = [
  // Will not be moved. Two of these are not taking instructions from anyone,
  // and one of them is having a much worse day than the fight in front of him.
  ["the mountain", 0], ["gregor clegane", 0], ["drogon", 0], ["balerion", 0],
  ["vhagar", 0], ["meleys", 0], ["caraxes", 0], ["viserion", 0], ["rhaegal", 0],
  ["smaug", 0], ["ancalagon", 0], ["glaurung", 0], ["hulk", 0], ["doomsday", 0],
  ["godzilla", 0], ["king ghidorah", 0], ["king kong", 0], ["destoroyah", 0],
  ["juggernaut", 0], ["wun wun", 0], ["a wight", 0], ["skullcrawler", 0],
  ["broly", 0], ["berserk", 0], ["the beast", 0],

  // Committed to it. They can hear you.
  ["guts", 1], ["zodd", 1], ["sabretooth", 1], ["wolverine", 2], ["the hound", 1],
  ["sandor clegane", 1], ["khal drogo", 1], ["michael myers", 0], ["jason voorhees", 0],
  ["leatherface", 0], ["kratos", 1], ["vegeta", 1], ["bakugo", 1], ["eren", 1],
  ["omni-man", 1], ["thragg", 1], ["conquest", 0], ["battle beast", 0],
  ["shao kahn", 1], ["akuma", 1], ["lucifer", 1], ["the joker", 0], ["harley", 1],
  ["deadpool", 1], ["tormund", 2], ["gimli", 2], ["boromir", 2],

  // Level-headed. Being told to fall back is not an insult to these people.
  ["jon snow", 6], ["brienne", 6], ["ser davos", 6], ["podrick", 6],
  ["barristan", 6], ["grey worm", 6], ["jorah", 6], ["samwell", 6],
  ["aragorn", 6], ["faramir", 6], ["gandalf", 5], ["legolas", 5],
  ["captain america", 6], ["diggle", 6], ["alex danvers", 6], ["castiel", 5],
  ["darth vader", 6], ["a stormtrooper", 6], ["boba fett", 5], ["cyclops", 6],
  ["colossus", 5], ["bishop", 5], ["nightwing", 6], ["batman", 5],
  ["martian manhunter", 6], ["obi-wan", 6], ["mace windu", 5], ["ahsoka", 5],
  ["splinter", 6], ["leonardo", 6], ["thunder", 5], ["jefferson pierce", 5],
  ["elijah", 5], ["stefan", 5], ["marcel", 5], ["dean winchester", 4],
  ["sam winchester", 5], ["bobby singer", 6], ["jody", 6],
];

/** Middling by trait, for everybody the table does not name. */
function baseObedience(traits: Trait[]): number {
  if (traits.includes("dragon")) return 0;
  if (traits.includes("giant") || traits.includes("large")) return 1;
  if (traits.includes("sluggish")) return 2;
  return 4;
}

/**
 * How well this card takes an order, and one line saying why.
 *
 * Exported because it belongs on the card face: a player choosing a captain
 * with substitutions needs to know that half their line will not move.
 */
export function obedienceOf(name: string, variant: string | null | undefined, traits: Trait[]) {
  const hay = `${name} ${variant ?? ""}`.toLowerCase();
  for (const [frag, n] of OBEDIENCE) {
    if (hay.includes(frag)) return n;
  }
  // A state can override a temperament. Anything enraged stops listening.
  if (/rage|berserk|enraged|humanity|possessed|feral|unleashed|bloodlust|mad|frenzy/.test(hay)) return 1;
  return baseObedience(traits);
}

// ── Cards ────────────────────────────────────────────────────────────────────

export interface Card {
  name: string;
  variant: string | null;
  /** Effective power tier, 1-12 — and therefore the base for both stats. */
  tier: number;
  atk: number;
  def: number;
  /** Haste and first strike in one number. Mostly zero — see ./rush. */
  rush: number;
  /** How hard this card is to get inside. Only rolled against a mind attack. */
  will: number;
  traits: Trait[];
  fx: CardEffect[];
  /** Rolls at or under this on a d6 to obey a captain's order to fall back. */
  obeys: number;
}

export interface PickLike {
  name: string;
  variant?: string | null;
  /** The entry's base tier, if known — lets the grade recompute the real tier. */
  baseTier?: number;
  /** A pre-computed effective tier, if the caller already has one. */
  tier?: number;
  grade?: string | null;
  /**
   * The board this card is really from, when that differs from the board being
   * played — which is every card on a mixed board. Beats `packId`.
   */
  from?: string;
}

/** Build the fighting card for one drafted pick. */
export function cardFor(pick: PickLike, packId?: string): Card {
  const board = pick.from ?? packId;
  const base = pick.baseTier ?? pick.tier ?? 3;
  const tier = pick.tier ?? base;
  const traits = traitsOf(pick.name, pick.variant);
  const { atk, def } = powerOf({
    name: pick.name,
    variant: pick.variant,
    board,
    traits,
    // The variant's SHAPE counts; the tier it produced does not. That number
    // is the auction price and it is not allowed anywhere near a stat line.
    grade: pick.grade,
  });

  return {
    name: pick.name,
    variant: pick.variant ?? null,
    tier,
    atk,
    def,
    rush: rushOf(pick.name, pick.variant, traits),
    will: willOf(pick.name, pick.variant),
    traits,
    fx: effectsFor(pick.name, pick.variant),
    obeys: obedienceOf(pick.name, pick.variant, traits),
  };
}

/** Build the card for a board entry wearing a particular variant. */
export function cardForEntry(entry: Entry, variant: Variant | null, pack: Pack): Card {
  const tier = variant ? effectiveTier(variant, entry.t) : entry.t;
  return cardFor(
    {
      name: entry.n,
      variant: variant?.v ?? null,
      baseTier: entry.t,
      tier,
      grade: variant ? variantGrade(variant, entry.t) : null,
      from: entry.from,
    },
    pack.id
  );
}

// ── Fighting ─────────────────────────────────────────────────────────────────

interface Fighter extends Card {
  hp: number;
  side: 0 | 1;
  /** Ascension is once only, however far the health falls afterwards. */
  ascended: boolean;
  /** Revives left on this card. */
  revives: number;
  dead: boolean;
  /** Set when it comes back, so the log can say so and it cannot be revived twice. */
  revived: boolean;
  /** What this one did. Accumulated as the fight runs. */
  did: { damage: number; kills: number; breakthrough: number; absorbed: number; fought: boolean };
  /** Prep is once per battle, win or lose on the roll. */
  prepped: boolean;
  /** A shot is once per battle. Reloading a scorpion is most of the job. */
  fired: boolean;
  /** Rounds spent holding the slot. Rushdown falls off by one per round. */
  held: number;
  /** The first killing blow has already been shrugged off. */
  survived: boolean;
  /** Its last-stand bonus has already been paid. */
  alone: boolean;
  /** Captains hang back and are paid for it when they finally step in. */
  captain: boolean;
  /** Planes of any gap above this card that its captain taught it to ignore. */
  grace: number;
}

export interface BattleEvent {
  round: number;
  /** Machine-readable so the battle screen can stage it; `text` is the fallback. */
  kind:
    | "round"
    | "strike"
    | "blocked"
    | "death"
    | "breakthrough"
    | "ascend"
    | "revive"
    | "regen"
    | "mend"
    | "exposed"
    | "direct"
    | "prep"
    | "survive"
    | "bloodlust"
    | "lastStand"
    | "captain"
    | "swap"
    | "advice"
    | "terrain"
    | "end";
  side?: 0 | 1;
  text: string;

  // ── The same event, as numbers ──────────────────────────────────────────
  // Optional because plenty of events are not a blow: a round marker, a
  // terrain note, a captain taking the field.
  /** The card swinging. */
  from?: string;
  /** The card being swung at, or the player's name for a blow that got past. */
  to?: string;
  /** Health taken off, after every reduction. */
  damage?: number;
  /** What the target has left once it lands. */
  hpAfter?: number;
  /** What the target started this exchange on, so a bar can be drawn. */
  hpMax?: number;
  /** The attack that was actually used, once auras and terrain are counted. */
  atk?: number;
  /** The attack printed on the card, so the screen can show a boost as a boost. */
  atkBase?: number;
  /** Both fighters went down in the same instant. */
  together?: boolean;
}

export interface BattleSide {
  /** Whatever the caller calls this player. */
  name: string;
  hp: number;
  /** The line, in the order the player arranged it. First one up fights first. */
  cards: Card[];
  /**
   * The captain, who does not fight while anybody else is standing.
   *
   * This is the decision the draft was missing. A captain lends the whole line
   * +1/+1 and one of their own tricks — a ward, a heal, a first strike — for as
   * long as the line holds, and steps onto the field only when they are the
   * last one left, at which point they take the field angry and hit harder for
   * it.
   *
   * Which means naming your best card captain is a real cost, not a free
   * promotion: they will not throw a punch until everyone else has died, and
   * in a game you are winning they may never fight at all. Naming your worst
   * card captain gets your best card fighting immediately and a thin aura to
   * carry. There is no right answer, which is the point.
   */
  captain?: Card;
}

/** What one card did with the time it had. */
export interface Contribution {
  side: 0 | 1;
  name: string;
  /** Damage put into enemy cards. */
  damage: number;
  /** Cards taken off the board. */
  kills: number;
  /** Damage past a falling defender. Wasted now, but still a fact about the card. */
  breakthrough: number;
  /** Defence printed on the card, so the verdict can measure what is left. */
  printedDef: number;
  /** Health remaining. Zero for anybody who fell. */
  leftHp: number;
  /** Damage taken. A card that soaked a great deal did a job too. */
  absorbed: number;
  /** Still standing at the end. */
  survived: boolean;
  /** Never fought — a captain the line never ran out in front of. */
  benched: boolean;
}

export interface BattleResult {
  winner: 0 | 1 | null;
  rounds: number;
  /** Per-card, both sides. The verdict is read off this. */
  contributions: Contribution[];
  sides: [
    { name: string; hp: number; survivors: string[]; fallen: string[] },
    { name: string; hp: number; survivors: string[]; fallen: string[] }
  ];
  log: BattleEvent[];
  /** One line, for the verdict screen. */
  headline: string;
}

interface StrikeOutcome {
  dealt: number;
  raw: number;
  kills: boolean;
  breakthrough: number;
  notes: string[];
}

/** What one fighter does to another, before anything is applied. */
function computeStrike(a: Fighter, d: Fighter, advice: Adjustment[] = []): StrikeOutcome {
  const raw = a.atk;
  const notes: string[] = [];

  // A captain's grace raises the attacker's plane for the purposes of this hit
  // only. It never changes what the card IS — it changes what they were told
  // about the thing in front of them.
  // A "only against the dragon" adjustment is decided here, where both cards
  // are known, rather than being baked into either of them.
  let bonus = 0;
  let planeBonus = 0;
  for (const adj of advice) {
    if (!adj.vs) continue;
    if (!mentions(a, adj.card) || !mentions(d, adj.vs)) continue;
    bonus += adj.atk ?? 0;

    notes.push(`${adj.why}`);
  }

  // No gate. Attack is attack: the card's number, plus whatever the captain,
  // the terrain and its own abilities are worth this exchange.
  let dealt = Math.max(1, raw + bonus);

  // Deterministic phrasing: same matchup, same sentence, every replay.
  // A mismatch is worth saying out loud, and the numbers are the only thing
  // that decides one now.
  let h = 2166136261;
  for (const ch of `${a.name}>${d.name}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  if (a.atk >= d.def * 2.5) {
    notes.push([
      `${a.name} is in a whole different league.`,
      `${d.name} has no answer for something like this.`,
      `It is not close. ${a.name} is simply beyond ${d.name}.`,
    ][h % 3]);
  } else if (d.def >= a.atk * 2.5) {
    notes.push([
      `${d.name} takes it and barely notices.`,
      `${a.name} is out of their depth here.`,
      `Most of that shrugs straight off ${d.name}.`,
    ][h % 3]);
  }

  for (const fx of a.fx) {
    if (fx.k === "superEffective" && fx.vs.some((t) => d.traits.includes(t))) {
      dealt = Math.round(dealt * fx.mult);
      notes.push(`${fx.label}: ${a.name} hits ${d.name} for ${fx.mult}×.`);
    }
  }
  for (const fx of d.fx) {
    if (fx.k === "resist" && fx.vs.some((t) => a.traits.includes(t))) {
      dealt = Math.round(dealt * fx.mult);
      notes.push(`${fx.label}: ${d.name} takes far less from ${a.name}.`);
    }
    if (fx.k === "ward") {
      dealt = Math.max(0, dealt - fx.n);
      notes.push(`${fx.label}: ${fx.n} comes off the hit.`);
    }
  }

  dealt = Math.max(0, Math.round(dealt));
  const kills = dealt >= d.hp && dealt > 0;

  // Raw attack, defender's remaining health. Never the planar figure — the
  // player is not in the fight, so the fight's rules do not apply to them.
  const breakthrough = kills ? Math.max(0, raw - d.hp) : 0;

  return { dealt, raw, kills, breakthrough, notes };
}

const label = (f: { name: string; variant: string | null }) =>
  f.variant ? `${f.name} (${f.variant})` : f.name;

/**
 * Play the draft out.
 *
 * Deterministic: no randomness anywhere, so the same two teams always produce
 * the same fight. That is not a limitation, it is the requirement — the
 * offline result has to be one the AI judge can be shown and asked to agree
 * with, and a result that changes when you look at it twice cannot be.
 */
export function resolveBattle(
  a: BattleSide,
  b: BattleSide,
  opts: {
    seed?: number;
    breakthroughCap?: number;
    terrain?: Terrain | null;
    /** A model's bounded read on specific matchups. Empty is the norm. */
    adjustments?: Adjustment[];
  } = {}
): BattleResult {
  const ground = opts.terrain ?? null;
  const advice = sanitiseAdjustments(opts.adjustments ?? []);

  const mk = (c: Card, side: 0 | 1, isCaptain = false, aura?: Aura): Fighter => {
    // The ground first, then the captain. Both are flat swings applied once, so
    // a card's printed numbers are the numbers it fights with — no hidden
    // arithmetic mid-fight that the player cannot see coming.
    const swing = terrainSwing(ground, c.traits);
    const atk = Math.max(1, c.atk + swing.atk + (aura?.atk ?? 0));
    const def = Math.max(1, c.def + swing.def + (aura?.def ?? 0));
    const fx = aura?.lends ? [...c.fx, aura.lends] : c.fx;
    // A dampening field drags the whole room down to one ceiling. Stats are
    // untouched: a god in a red-sun room is still a god's stat line, they simply
    // stop being unreachable.

    // The always-on ones are printed onto the card before a blow is thrown, so
    // the player sees the number they are actually fighting with.
    let atk2 = atk;
    let def2 = def;
    for (const adj of advice) {
      if (adj.vs || !mentions(c, adj.card)) continue;
      atk2 = Math.max(1, atk2 + (adj.atk ?? 0));
      def2 = Math.max(1, def2 + (adj.def ?? 0));
    }

    return {
    ...c,
    atk: atk2,
    def: def2,
    fx,
    hp: def2 * HP_PER_DEF,
    side,
    captain: isCaptain,
    grace: aura?.grace ?? 0,
    ascended: false,
    revives: c.fx.find((f) => f.k === "revive")?.n ?? 0,
    dead: false,
    revived: false,
    prepped: false,
    survived: false,
    alone: false,
    did: { damage: 0, kills: 0, breakthrough: 0, absorbed: 0, fought: false },
    fired: false,
    held: 0,
  };
  };

  // The captain goes on the end of the line. That is the whole implementation
  // of "does not fight until last" — the resolver already fights front to back,
  // so a captain is simply somebody standing behind everyone with an aura.
  const build = (s: BattleSide, side: 0 | 1): Fighter[] => {
    const aura = s.captain ? captainAura(s.captain) : undefined;
    const line = s.cards.map((c) => mk(c, side, false, aura));
    return s.captain ? [...line, mk(s.captain, side, true)] : line;
  };
  const teams: [Fighter[], Fighter[]] = [build(a, 0), build(b, 1)];
  /** Each side's captain aura, so the triggers below can reach it. */
  const auras: [Aura | null, Aura | null] = [
    a.captain ? captainAura(a.captain) : null,
    b.captain ? captainAura(b.captain) : null,
  ];
  /** Raises each captain has left. */
  const raises: [number, number] = [auras[0]?.raise ?? 0, auras[1]?.raise ?? 0];
  /** Substitutions each captain has left. */
  const subs: [number, number] = [
    (a.captain && captainAura(a.captain).swap) || 0,
    (b.captain && captainAura(b.captain).swap) || 0,
  ];
  const die = makeDie(
    opts.seed ??
      seedFrom([...a.cards, ...b.cards].map((c) => `${c.name}|${c.variant}|${c.tier}`).join("~"))
  );
  const hp: [number, number] = [a.hp, b.hp];
  const start: [number, number] = [a.hp, b.hp];

  /**
   * The most any single blow can put on a player.
   *
   * Without it the game has one dominant line: buy the biggest thing on the
   * board and let it kill your cheapest cards, because a 13-attack mythic
   * dragon flattening a 1/1 puts 12 on a 20-point player and that is most of a
   * health bar in one swing.
   *
   * A THIRD, measured rather than guessed. Across 600 simulated drafts the cap
   * cuts the worst single blow from 12 to 7 and changes almost nothing else:
   * same average length, same share of blowouts, same median winning margin —
   * and games still end with a player dead behind a line that held about one
   * time in ten, which is the outcome worth keeping. A quarter dropped that to
   * one in twenty-five and started to feel like nothing was at stake.
   */
  const cap = Math.max(
    1,
    (opts.breakthroughCap ?? Math.max(3, Math.round(Math.max(a.hp, b.hp) / 3))) +
      (ground?.breakthrough ?? 0)
  );
  const names: [string, string] = [a.name, b.name];
  const log: BattleEvent[] = [];
  let round = 0;

  const say = (
    kind: BattleEvent["kind"],
    text: string,
    side?: 0 | 1,
    extra?: Partial<BattleEvent>
  ) => log.push({ round, kind, side, text, ...extra });

  const front = (s: 0 | 1) => teams[s].find((f) => !f.dead) ?? null;

  for (const adj of advice) {
    say("advice", `${adj.card}: ${adj.why}`);
  }

  // A villain's captain ability lands on the OTHER line, once, at the bell.
  // Applied before the first round so the player can see the fight start on
  // the back foot rather than wondering why the numbers moved.
  for (const s of [0, 1] as const) {
    const doom = auras[s]?.doom;
    if (!doom) continue;
    const foe = s === 0 ? 1 : 0;
    const { atk = 0, def = 0 } = doom;
    if (!atk && !def) continue;
    for (const f of teams[foe]) {
      f.atk = Math.max(0, f.atk + atk);
      f.def = Math.max(1, f.def + def);
      f.hp = Math.max(1, Math.min(f.hp + def, f.def));
    }
    say(
      "captain",
      `${auras[s]!.label}: ${names[foe]}'s whole line fights at ` +
        `${atk >= 0 ? "+" : ""}${atk}/${def >= 0 ? "+" : ""}${def}.`,
      s
    );
  }

  if (ground && (ground.rules.length || ground.breakthrough)) {
    say("terrain", `${ground.name}. ${ground.rules.map((r) => r.note).join(" ")}`.trim());
  }
  for (const s of [0, 1] as const) {
    const cap2 = teams[s].find((f) => f.captain);
    if (cap2) {
      // Was hardcoded at +1/+1, so a command captain read one number on the
      // line-up card and a different one in the fight.
      const au = captainAura(cap2);
      const bits = [
        au.atk || au.def ? `${au.atk >= 0 ? "+" : ""}${au.atk}/${au.def >= 0 ? "+" : ""}${au.def}` : null,
        au.grace ? `+${au.grace} rushdown` : null,
      ].filter(Boolean).join(", ");
      say("captain", `${names[s]} names ${label(cap2)} captain — ${au.label}. The line fights at ${bits || "no change"}.`, s);
    }
  }

  /** A fallen card comes back at half health, strongest first. */
  const tryRevive = (s: 0 | 1) => {
    const healer = teams[s].find((f) => !f.dead && f.revives > 0);
    if (!healer) return;
    const fallen = teams[s]
      .filter((f) => f.dead && !f.revived)
      .sort((x, y) => y.tier - x.tier)[0];
    if (!fallen) return;
    healer.revives -= 1;
    fallen.dead = false;
    fallen.revived = true;
    fallen.hp = Math.max(1, Math.ceil(fallen.def / 2));
    say("revive", `${label(healer)} raises ${label(fallen)}, back up at ${fallen.hp}.`, s, {
      from: label(healer), to: label(fallen), hpAfter: fallen.hp, hpMax: fallen.def,
    });
  };

  /**
   * Land a computed outcome. Split from `computeStrike` so a simultaneous
   * exchange can work out BOTH swings against the same instant and only then
   * apply them — otherwise whoever the code happens to run first gets to kill
   * the other before they swing, which is not simultaneity, it is turn order
   * with extra steps.
   */
  const apply = (att: Fighter, def: Fighter, out: StrikeOutcome): void => {
    for (const n of out.notes) say("blocked", n, att.side);

    if (out.dealt === 0) {
      say("blocked", `${label(att)} lands nothing on ${label(def)}.`, att.side, {
        from: label(att), to: label(def),
        damage: 0, hpAfter: Math.max(0, def.hp), hpMax: def.hp,
        atk: out.raw, atkBase: att.atk,
      });
      return;
    }

    const hpBefore = def.hp;
    def.hp -= out.dealt;
    att.did.damage += out.dealt;
    att.did.fought = true;
    def.did.absorbed += out.dealt;
    def.did.fought = true;
    say("strike", `${label(att)} hits ${label(def)} for ${out.dealt}.`, att.side, {
      from: label(att), to: label(def),
      damage: out.dealt, hpAfter: Math.max(0, def.hp), hpMax: hpBefore,
      atk: out.raw, atkBase: att.atk,
    });
    if (def.hp > 0 || def.dead) return;

    // Refuses to fall, once. Nothing gets past it either — the blow did not go
    // through, so there is nothing on the other side of it to reach you.
    const undying = def.fx.find((f) => f.k === "undying");
    if (undying && !def.survived) {
      def.survived = true;
      def.hp = 1;
      say("survive", `${undying.label}: ${label(def)} is still standing, on 1.`, def.side);
      return;
    }

    def.dead = true;
    def.hp = 0;
    att.did.kills += 1;
    say("death", `${label(def)} is down.`, def.side, {
      from: label(att), to: label(def), hpAfter: 0, hpMax: hpBefore,
    });

    // Overflow is recorded, because "how much of that was wasted" is a real
    // fact about a card, and then it is thrown away. A killing blow kills one
    // card; the excess does not roll on to the next one and there is no player
    // behind the line to spend it on.
    const through = Math.max(0, out.raw - hpBefore);
    att.did.breakthrough += through;
    if (through >= Math.max(4, hpBefore)) {
      say("breakthrough", `${label(def)} is not just beaten, they are overwhelmed.`, att.side);
    }

    const blood = att.fx.find((f) => f.k === "bloodlust");
    if (blood && blood.k === "bloodlust") {
      att.atk += blood.n;
      say("bloodlust", `${blood.label}: ${label(att)} is now ${att.atk} attack.`, att.side);
    }

    // Mending used to top the player's bar back up. With no bar behind the
    // line it patches the card that did the mending, capped at what it was
    // printed with, so it is still worth having and cannot run away.
    const mend = att.fx.find((f) => f.k === "mend");
    if (mend && mend.k === "mend") {
      const before = att.hp;
      att.hp = Math.min(att.def * HP_PER_DEF, before + mend.n);
      if (att.hp > before) {
        say("mend", `${mend.label}: ${label(att)} back to ${att.hp}.`, att.side);
      }
    }

    tryRevive(def.side);
    allyFell(def.side);
  };

  /**
   * Who this card actually puts its blow into.
   *
   * Normally the fighter opposite. An ASSASSIN may instead reach the enemy
   * captain, who is otherwise untouchable until they are the last one left —
   * and still eats the return swing from the fighter they walked past, which
   * is what stops this being strictly better than fighting.
   */
  const markFor = (att: Fighter, def: Fighter): Fighter => {
    if (!att.fx.some((f) => f.k === "assassin")) return def;
    const cap = teams[def.side].find((c) => c.captain && !c.dead && c !== def);
    if (!cap) return def;
    say("swap", `${label(att)} slips past ${label(def)} and goes for ${label(cap)}.`, att.side);
    return cap;
  };

  /** One fighter swings at another, resolving immediately. */
  const swing = (att: Fighter, def: Fighter): void => {
    if (att.dead || def.dead) return;
    const mark = markFor(att, def);
    if (mark.dead) return;
    apply(att, mark, computeStrike(att, mark, advice));
  };

  /** A double-striker's second swing, taken only if it is still standing. */
  const followUp = (att: Fighter, def: Fighter): void => {
    if (!att.fx.some((f) => f.k === "double")) return;
    swing(att, def);
  };

  /**
   * Turn, if there is a form to turn into and something has triggered it.
   *
   * A card drafted already wearing the form does not turn into it a second
   * time. Otherwise Super Saiyan Goku goes Super Saiyan, ends up named "Goku —
   * Super Saiyan (Super Saiyan)", and collects a bonus somebody already paid
   * for at auction.
   */
  const tryAscend = (f: Fighter, triggered: boolean) => {
    if (f.dead || f.ascended || !triggered) return;
    const asc = f.fx.find((x) => x.k === "ascend");
    if (!asc || asc.k !== "ascend") return;
    if (`${f.name} ${f.variant ?? ""}`.toLowerCase().includes(asc.as.toLowerCase())) return;

    f.ascended = true;
    f.atk += asc.atk;
    f.def += asc.def;
    f.hp += asc.def;   // the new body is tougher, not just angrier
    f.name = `${f.name} — ${asc.as}`;
    say("ascend", `${asc.as}. ${f.name} is now ${f.atk}/${f.def}.`, f.side);
  };

  /** The health fraction this card turns at, or 0 if it has no form. */
  const asc0 = (f: Fighter): number => {
    const asc = f.fx.find((x) => x.k === "ascend");
    return asc && asc.k === "ascend" ? asc.at : 0;
  };

  /**
   * Fire the captain's own trick on this side, if this is its moment.
   *
   * Applied to everyone still standing INCLUDING the captain, because a
   * captain who gets angrier when the line dies should be angrier when they
   * finally step onto it.
   */
  const captainTrigger = (s: 0 | 1, moment: "allyDown" | "alone" | "kill" | "round") => {
    const au = auras[s];
    if (!au || au.when !== moment || !au.then) return;
    const { atk = 0, def = 0, heal = 0 } = au.then;
    if (!atk && !def && !heal) return;

    const live = teams[s].filter((f) => !f.dead);
    if (!live.length) return;
    for (const f of live) {
      f.atk = Math.max(0, f.atk + atk);
      f.def = Math.max(1, f.def + def);
      // Healing tops a card up towards what it was printed with, never past.
      if (heal) f.hp = Math.min(f.def * HP_PER_DEF, f.hp + heal);
    }
    const bits = [
      atk || def ? `${atk >= 0 ? "+" : ""}${atk}/${def >= 0 ? "+" : ""}${def}` : null,
      heal ? `${heal} back` : null,
    ].filter(Boolean).join(", ");
    say("captain", `${au.label}: ${names[s]}'s line takes ${bits}.`, s);
  };

  /**
   * A captain who puts somebody back on their feet.
   *
   * Takes the most recent casualty rather than the best one, because the card
   * you are still annoyed about losing is the one this should give back, and
   * because "raises the strongest" would make the choice for the player.
   */
  const tryRaise = (s: 0 | 1) => {
    if (raises[s] <= 0) return;
    const au = auras[s];
    if (!au) return;
    const back = [...teams[s]].reverse().find((f) => f.dead && !f.revived && !f.captain);
    if (!back) return;
    raises[s] -= 1;
    back.dead = false;
    back.revived = true;
    back.hp = Math.max(1, Math.round(back.def * HP_PER_DEF / 2));
    say("revive", `${au.label}: ${label(back)} is back on their feet, on ${back.hp}.`, s, {
      to: label(back), hpAfter: back.hp, hpMax: back.def,
    });
  };

  /** Somebody went down on this side. Anyone watching who can turn, turns. */
  const allyFell = (s: 0 | 1) => {
    for (const f of teams[s]) {
      const asc = f.fx.find((x) => x.k === "ascend");
      if (asc && asc.k === "ascend" && asc.onAllyDeath) tryAscend(f, true);
    }
    captainTrigger(s, "allyDown");
    captainTrigger(s === 0 ? 1 : 0, "kill");
    tryRaise(s);
  };

  /**
   * The captain pulls the card in front and sends in a better answer.
   *
   * Only from a genuinely losing position — the front cannot hurt what it is
   * facing, or is about to die to it — and only if somebody on the bench does
   * measurably better against that specific opponent. A captain who swaps for
   * the sake of swapping is just shuffling, and the mechanic has to read as
   * judgement or it is not worth promoting anyone for.
   *
   * The pulled card goes to the BACK of the line, not off it. You buy the
   * right matchup now and pay for it in the order later, which is the shape
   * every good decision in this game has.
   */
  const maybeSwap = (self: 0 | 1, foe: Fighter): boolean => {
    if (subs[self] <= 0) return false;
    const cap = teams[self].find((f) => f.captain && !f.dead);
    if (!cap) return false;

    const up = front(self);
    if (!up || up === cap) return false;

    const dealsNow = computeStrike(up, foe, advice).dealt;
    const takes = computeStrike(foe, up, advice).dealt;
    const doomed = takes >= up.hp;
    if (dealsNow > 0 && !doomed) return false;

    // Two points a card is worth here: what it does to this opponent, and
    // whether it is still standing afterwards.
    const worth = (f: Fighter) => {
      const out = computeStrike(f, foe, advice).dealt;
      const back = computeStrike(foe, f, advice).dealt;
      return out * 2 + (back < f.hp ? 3 : 0);
    };
    const here = worth(up);

    let best: Fighter | null = null;
    for (const f of teams[self]) {
      if (f.dead || f === up || f.captain) continue;
      if (!best || worth(f) > worth(best)) best = f;
    }
    if (!best || worth(best) <= here) return false;

    subs[self] -= 1;

    // The order is given. Whether it is followed is another matter, and the
    // attempt is spent either way — deciding to move something that will not
    // move is a bad decision, and the game should let you make it.
    const roll = die(6);
    if (roll > up.obeys) {
      say(
        "swap",
        up.obeys === 0
          ? `${label(cap)} calls ${label(up)} back. ${label(up)} does not appear to have heard.`
          : `${label(cap)} calls ${label(up)} back — rolls a ${roll} against ${up.obeys}. ${label(up)} refuses and stays where they are.`,
        self
      );
      return true;
    }

    const i = teams[self].indexOf(up);
    teams[self].splice(i, 1);
    teams[self].push(up);
    const j = teams[self].indexOf(best);
    teams[self].splice(j, 1);
    teams[self].unshift(best);

    say(
      "swap",
      `${label(cap)} pulls ${label(up)} out of it and sends ${label(best)} forward against ${label(foe)}.` +
        (up.obeys >= 6 ? "" : ` (${roll} against ${up.obeys})`),
      self
    );
    return true;
  };

  /**
   * A prep card facing something it cannot meaningfully hurt falls back.
   *
   * Only when there is somebody to cover — the last card standing does not get
   * to leave, which is the situation prep is worst in and that is correct.
   * Returns true if the line changed, so the caller re-reads its front.
   */
  const maybeWithdraw = (self: 0 | 1, foe: Fighter): boolean => {
    const f = front(self);
    if (!f || f.prepped) return false;

    const prep = f.fx.find((x) => x.k === "prep");
    if (!prep || prep.k !== "prep") return false;

    // Only when it is actually outclassed. Prep is an answer to a problem, not
    // a free upgrade taken against a farmhand.
    const outclassed = foe.def > f.atk * 1.6 || foe.atk > f.def * 1.6;
    if (!outclassed) return false;
    if (f.prepped) return false;

    const cover = teams[self].filter((x) => !x.dead && x !== f);
    if (!cover.length) {
      say("prep", `${label(f)} has nobody to buy the time. No withdrawal.`, self);
      f.prepped = true;
      return false;
    }

    f.prepped = true;
    const roll = die(6);
    const gain = PREP_ROLL[roll];

    // Back of the line: a teammate takes this round, which is the cost.
    const i = teams[self].indexOf(f);
    teams[self].splice(i, 1);
    teams[self].push(f);

    f.rush += gain.rush;
    f.atk += gain.atk;

    say(
      "prep",
      `${label(f)} withdraws to work the problem against ${label(foe)} — rolls a ${roll} ${gain.how}.` +
        (gain.rush || gain.atk
          ? ` Back at ${f.atk}/${f.def}${gain.rush ? ` and moving first` : ""}.`
          : ` Back exactly as they left, and a round gone.`),
      self
    );
    return true;
  };

  /**
   * A shot at the thing this card was built to kill.
   *
   * Fires at the fighter opposite when that is the right target. Returns true
   * only when the target actually goes down, because the caller re-reads the
   * round: a dragon that has just been shot off its feet is not standing there
   * to be fought.
   */
  const takeShot = (shooter: Fighter | null, target: Fighter | null, side: 0 | 1): boolean => {
    if (!shooter || !target || shooter.dead || target.dead) return false;
    if (shooter.fired) return false;
    const shot = shooter.fx.find((f) => f.k === "snipe");
    if (!shot || shot.k !== "snipe") return false;
    if (!shot.vs.some((t) => target.traits.includes(t))) return false;

    shooter.fired = true;
    const hit = die(100) < Math.round(shot.chance * 100);
    if (!hit) {
      say("blocked", `${label(shooter)} looses at ${label(target)} and misses.`, shooter.side);
      return false;
    }
    target.hp = 0;
    target.dead = true;
    shooter.did.kills += 1;
    shooter.did.fought = true;
    say("death", `${label(shooter)} puts a bolt clean through ${label(target)}.`, target.side, {
      from: label(shooter), to: label(target), hpAfter: 0,
    });
    allyFell(target.side);
    void side;
    return true;
  };

  /**
   * The second shot: at something on the enemy BENCH.
   *
   * Only for a scorpion that is stuck in a clash with somebody it was not
   * built for, and only if it lived through the exchange — a scorpion that
   * gets rushed down never gets to fire at all, which is the counter to it.
   */
  const shootTheBench = (shooter: Fighter | null, foe: 0 | 1) => {
    if (!shooter || shooter.dead || shooter.fired) return;
    const shot = shooter.fx.find((f) => f.k === "snipe");
    if (!shot || shot.k !== "snipe") return;

    const target = teams[foe].find(
      (c) => !c.dead && c !== front(foe) && shot.vs.some((t) => c.traits.includes(t))
    );
    if (!target) return;

    shooter.fired = true;
    if (die(100) >= Math.round(shot.chance * 100)) {
      say("blocked", `${label(shooter)} swings the scorpion round at ${label(target)} and misses.`, shooter.side);
      return;
    }
    target.hp = 0;
    target.dead = true;
    shooter.did.kills += 1;
    say("death", `${label(shooter)} finds ${label(target)} at the back of the line and puts a bolt through them.`, target.side, {
      from: label(shooter), to: label(target), hpAfter: 0,
    });
    allyFell(target.side);
  };

  /** End-of-round upkeep: healing, then transformations. */
  const upkeep = (f: Fighter) => {
    if (f.dead) return;

    // A captain who has run out of people to lead stops directing and fights.
    if (f.captain && !f.alone) {
      const others = teams[f.side].filter((x) => !x.dead && x !== f).length;
      if (others === 0) {
        f.alone = true;
        f.atk += 2;
        say("captain", `${label(f)} takes the field at ${f.atk} attack. There is nobody left to send.`, f.side);
        captainTrigger(f.side, "alone");
      }
    }

    const stand = f.fx.find((x) => x.k === "lastStand");
    if (stand && stand.k === "lastStand" && !f.alone) {
      const others = teams[f.side].filter((x) => !x.dead && x !== f).length;
      if (others === 0) {
        f.alone = true;
        f.atk += stand.n;
        say("lastStand", `${stand.label}: ${label(f)} is the last one left, at ${f.atk} attack.`, f.side);
      }
    }

    const regen = f.fx.find((x) => x.k === "regen");
    if (regen && regen.k === "regen" && f.hp < f.def) {
      const before = f.hp;
      f.hp = Math.min(f.def * HP_PER_DEF, f.hp + regen.n);
      if (f.hp > before) say("regen", `${label(f)} closes back to ${f.hp}.`, f.side);
    }

    tryAscend(f, f.hp <= f.def * asc0(f));
  };

  // ── Rounds ────────────────────────────────────────────────────────────────
  const standing = (s: 0 | 1) => teams[s].some((f) => !f.dead);
  /** Who was in each slot last round, so an arrival can be announced. */
  const held: [string, string] = ["", ""];
  while (round < MAX_ROUNDS && standing(0) && standing(1)) {
    round += 1;
    captainTrigger(0, "round");
    captainTrigger(1, "round");

    const f0 = front(0);
    const f1 = front(1);

    if (!f0 || !f1) {
      if (!f0 && !f1) {
        say("end", "Both teams are gone. Nobody is left standing to finish it.");
        break;
      }
      // One side has nobody left to put in the slot. That is the whole of it.
      const victim: 0 | 1 = f0 ? 1 : 0;
      say("exposed", `${names[victim]} has nobody left to send out.`, victim);
      break;
    }

    // A scorpion does not trade blows with a dragon. It takes the shot, and
    // if it lands there is no clash to have.
    if (takeShot(f0, f1, 1) || takeShot(f1, f0, 0)) {
      round -= 1;
      continue;
    }

    // Withdrawals are decided before anyone swings, and a withdrawal changes
    // who is standing there — so the round is re-read rather than played out
    // against a fighter who just left.
    // Substitutions and withdrawals both change who is standing there, so the
    // round is re-read rather than played out against somebody who just left.
    // Both are bounded per battle, so this cannot spin.
    if (maybeSwap(0, f1) || maybeSwap(1, f0)) {
      round -= 1;
      continue;
    }
    if (maybeWithdraw(0, f1) || maybeWithdraw(1, f0)) {
      round -= 1;
      continue;
    }

    // Somebody new on the field is the clearest beat a team fight has. Said
    // before the pairing so the screen can put them on screen arriving rather
    // than already standing there.
    for (const [s, f] of [[0, f0], [1, f1]] as const) {
      const who = label(f);
      if (held[s] === who) continue;
      const first = held[s] === "";
      held[s] = who;
      say(
        "captain",
        f.captain
          ? `${names[s]} has nobody left to send. ${who} takes the field.`
          : first
            ? `${names[s]} sends out ${who}.`
            : `${names[s]} sends out ${who}!`,
        s,
        { to: who }
      );
    }

    // Carries both fighters so the screen can fill its two slots before a
    // blow is thrown -- this is the only event that always knows both.
    say("round", `${label(f0)} (${f0.hp}) faces ${label(f1)} (${f1.hp}).`, undefined, {
      from: label(f0), to: label(f1),
    });

    // RUSHDOWN decides the order. One rusher against a standing target gets a
    // free blow, and if it kills, nothing comes back. Two rushers roll for it,
    // so being faster is an advantage rather than a guarantee. Two zeroes
    // trade at the same instant and can both fall, which is still the most
    // satisfying outcome the game produces.
    // Damage carries forward -- the winner of a clash holds the slot on
    // whatever health it has left -- and being hurt slows you down: one point
    // of rushdown per two damage taken. A card that just barely won is a card
    // the next one up can trade with.
    // Rushdown is the ambush, and an ambush stops being one. It falls off by a
    // point for every ROUND this card has been standing in the slot, and by
    // another for every two damage it is carrying — so Bronn's 2 is a 2 in the
    // fight he steps into, a 1 in the next, and nothing after that.
    const rushOf_ = (f: Fighter) =>
      Math.max(
        0,
        f.rush + f.grace + (f.fx.some((x) => x.k === "first") ? 2 : 0)
          - f.held
          - Math.floor(Math.max(0, f.def - f.hp) / 2)
      );
    f0.held += 1;
    f1.held += 1;
    const roll = order(rushOf_(f0), rushOf_(f1), () => die(6) + 1);
    const who = roll.who;
    say(
      "round",
      `Rushdown — ${label(f0)} rolls ${roll.dieA}+${roll.rushA}=${roll.dieA + roll.rushA}, ` +
        `${label(f1)} rolls ${roll.dieB}+${roll.rushB}=${roll.dieB + roll.rushB}. ` +
        (who === 0
          ? "They go together."
          : `${label(who === 1 ? f0 : f1)} is first.`),
      who === 1 ? f0.side : who === -1 ? f1.side : undefined
    );

    if (who === 1) {
      swing(f0, f1);
      followUp(f0, f1);
      swing(f1, f0);
      followUp(f1, f0);
    } else if (who === -1) {
      swing(f1, f0);
      followUp(f1, f0);
      swing(f0, f1);
      followUp(f0, f1);
    } else {
      // Both worked out against the same instant, then both landed — so a
      // fatal blow does not stop the answer to it, and two evenly matched
      // cards can take each other off the board together.
      const out0 = computeStrike(f0, f1, advice);
      const out1 = computeStrike(f1, f0, advice);
      apply(f0, f1, out0);
      apply(f1, f0, out1);
      followUp(f0, f1);
      followUp(f1, f0);
    }

    // Survived the round and never got to use the shot on whoever was in
    // front of them — so they look for the thing they were built for.
    shootTheBench(front(0), 1);
    shootTheBench(front(1), 0);

    for (const f of [...teams[0], ...teams[1]]) upkeep(f);
  }

  // ── Calling it ────────────────────────────────────────────────────────────
  const alive = (s: 0 | 1) => teams[s].filter((f) => !f.dead).length;
  let winner: 0 | 1 | null = null;
  if (alive(0) !== alive(1)) {
    winner = alive(0) > alive(1) ? 0 : 1;
  } else if (alive(0) > 0) {
    // Both lines still have somebody, so the clock ran out. Whoever is
    // carrying less damage across their survivors was winning.
    const left = (s: 0 | 1) => teams[s].filter((f) => !f.dead).reduce((n, f) => n + f.hp, 0);
    winner = left(0) === left(1) ? null : left(0) > left(1) ? 0 : 1;
  }

  const side = (s: 0 | 1) => ({
    name: names[s],
    // What the line has left between them, now that there is no bar behind it.
    hp: teams[s].filter((f) => !f.dead).reduce((n, f) => n + f.hp, 0),
    survivors: teams[s].filter((f) => !f.dead).map(label),
    fallen: teams[s].filter((f) => f.dead).map(label),
  });

  const loser: 0 | 1 | null = winner === null ? null : winner === 0 ? 1 : 0;
  const stillUp = winner === null ? 0 : teams[winner].filter((f) => !f.dead).length;

  const headline =
    winner === null || loser === null
      ? "A draw. Both lines finish on their knees."
      : alive(loser) > 0
        ? `Time called it — ${names[winner]} finishes stronger.`
        : stillUp === 1
          ? `${names[winner]} wins with one still standing.`
          : `${names[winner]} wins with ${stillUp} still standing.`;

  say("end", headline);

  const contributions: Contribution[] = ([0, 1] as const).flatMap((sd) =>
    teams[sd].map((f) => ({
      side: sd,
      name: label(f),
      damage: f.did.damage,
      kills: f.did.kills,
      breakthrough: f.did.breakthrough,
      printedDef: f.def,
      leftHp: f.dead ? 0 : Math.max(0, f.hp),
      absorbed: f.did.absorbed,
      survived: !f.dead,
      // A captain the line never ran out in front of never fought. That is not
      // a bust — it is the aura doing its job — so it is flagged rather than
      // scored as zero.
      benched: !f.did.fought,
    }))
  );

  return { winner, rounds: round, sides: [side(0), side(1)], log, headline, contributions };
}

// ── Telling the judge the same story ─────────────────────────────────────────

/**
 * The battle rendered for the AI judge's prompt.
 *
 * The offline resolver is not a fallback that disagrees with the model — it is
 * the game's rules, and the model is being asked to narrate a result, not
 * invent one. Handing it this keeps a verdict from saying a card was flavour
 * when the rules say it was a 10/10 two planes up.
 */
export function battleBriefing(cards: Card[], sideName: string): string {
  if (!cards.length) return "";
  const lines = cards.map((c) => {
    const fx = c.fx.length ? ` — ${c.fx.map((f) => f.label).join(", ")}` : "";
    const ord = c.obeys <= 1 ? ", takes no orders" : c.obeys >= 6 ? ", disciplined" : "";
    const speed = c.rush > 0 ? `, rushdown ${c.rush}` : "";
    return `  - ${label(c)}: ${c.atk}/${c.def}${speed}${ord}${fx}`;
  });
  return (
    `${sideName}'s cards, as the rules score them. ATK/DEF and RUSHDOWN are game ` +
    `facts, not opinions — a card with rushdown strikes first, and if that blow kills, ` +
    `nothing comes back. Your verdict must respect that:\n${lines.join("\n")}\n`
  );
}
