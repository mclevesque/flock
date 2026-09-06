/**
 * DraftMasters — contest formats.
 *
 * The problem this solves: every verdict and every battle used to be written
 * as a melee. A beauty pageant came back as characters stabbing each other; a
 * Pokémon board came back as a brawl instead of a type-matchup duel where
 * things faint rather than die.
 *
 * So the judge now decides FIRST what kind of contest the scenario actually
 * describes, and everything downstream — the reasoning, the fight script, the
 * word stamped on whoever goes out — is staged by that format's playbook.
 *
 * Adding a format: add the id to FORMATS, write its four fields, done. The
 * judge is shown the list and picks; anything it invents falls back to melee.
 */

export type FormatId =
  | "melee"
  | "duel-series"
  | "pokemon"
  | "judged"
  | "vote"
  | "heist"
  | "survival"
  | "race"
  | "debate"
  | "sport"
  | "auction-of-wits";

export interface Format {
  id: FormatId;
  /** Shown to players — "Six-round Pokémon battle" */
  label: string;
  /** One line for the judge's menu, so it can pick the right one */
  menu: string;
  /** What the JUDGE must weigh in this format */
  judging: string;
  /** How the BATTLE writer must stage it, beat by beat */
  staging: string;
  /**
   * Word stamped over a portrait once they're out. "DEAD" is wrong for a
   * pageant and wrong for Pokémon — this is the one-word fix.
   */
  outLabel: string;
}

export const FORMATS: Format[] = [
  {
    id: "melee",
    label: "All-in melee",
    menu: "melee — both teams on the field at once, everyone fighting, last side standing wins",
    judging:
      "Raw power, durability and how the rosters cover each other. A single monster can carry; a team with no answer to it loses. Count the bodies honestly.",
    staging:
      "BOTH TEAMS FIGHT AT ONCE. Do not write a tidy bracket where each fighter appears once and retires. A fighter who wins an exchange STAYS IN and goes after the next one. Mix the shapes: an isolated duel inside the brawl, two ganging up on one, a rescue, an ambush from behind. The same name should appear across several beats — only the dead stop appearing.",
    outLabel: "DEAD",
  },
  {
    id: "duel-series",
    label: "One-on-one, best of the field",
    menu: "duel-series — fighters go ONE AT A TIME, 1v1, winner stays on or the next challenger steps up",
    judging:
      "Match them up pair by pair and call each duel. Who does each fighter draw? Depth matters more than a single monster here, because a monster can only be in one duel at a time — and a fighter who wins can be worn down by the next.",
    staging:
      "ONE DUEL AT A TIME. Never have two fights running at once. Announce the pairing, fight it out over 1-2 beats, resolve it, then the next challenger steps forward. A winner who stays on carries their damage into the next duel — say so. The crowd/field reacts between duels.",
    outLabel: "OUT",
  },
  {
    id: "pokemon",
    label: "Turn-based creature battle",
    menu: "pokemon — a turn-based creature battle: one active per side, type matchups, HP, switching, fainting (NOT death)",
    judging:
      "Use the actual video-game logic. TYPE MATCHUPS DECIDE MOST OF IT — Ground beats Electric, Water beats Fire, Fighting loses to Psychic and Flying, and so on; a super-effective attacker beats a nominally stronger mon it counters. Also weigh: stats and speed (who moves first), signature moves and abilities, stat-boosting setup, status conditions (paralysis, sleep, burn), and whether a side has a hard counter to the other's ace. A team with no answer to a type loses even if its raw power is higher. Nobody dies — they faint.",
    staging:
      "TURN-BASED, ONE ACTIVE POKÉMON PER SIDE. Never a brawl. Each beat is a turn or an exchange of turns: name the move, name the type effectiveness out loud (\"it's super effective!\"), and track HP in words — chipped, badly hurt, hanging on at a sliver. A hurt Pokémon KEEPS FIGHTING; only fainting takes it out, and fainting is not death. Use switching as real strategy — pull one out to absorb a hit, bring in the counter. Use status (paralysis, sleep, burn, confusion) and a stat-boost sweep at least once. Trainers can call out instructions. GET THE EFFECTIVENESS CALLS RIGHT: only call a hit super effective when the type chart actually says so — Water on Water is resisted, not super effective — and name the resisted and immune hits too. A wrong call is the one thing a Pokémon fan will not forgive.",
    outLabel: "FAINTED",
  },
  {
    id: "judged",
    label: "Judged competition",
    menu: "judged — a pageant, talent show, cook-off, fashion or dance contest scored by a PANEL. There is no fighting.",
    judging:
      "NOBODY FIGHTS. This is decided by the judges, full stop. Work out who the judges are (the scenario usually names them or implies them) and what each one privately wants — a judge's taste and history is the whole game. Then weigh: presentation, poise, stage presence, the talent round, how each contestant reads the room, and whether anyone works the panel directly. Cheap tricks, flattery, sabotage and a well-timed wink are legitimate and often decisive. Raw combat power is worth almost nothing here — a warlord who cannot smile loses to a nobody with charm.",
    staging:
      "NO VIOLENCE. Stage it as rounds: entrance/parade, the talent or main round, the interview or close, then the panel's scores. Name the judges and show their reactions — a judge leaning forward, a judge unimpressed, a judge who has clearly already made up their mind for personal reasons. Show at least one cheap trick or bit of working the panel, and at least one contestant who is spectacularly out of their depth. The final beat is the panel's decision, not a knockout. If a character IS a judge or is known to a judge, that history has to show on screen.",
    outLabel: "CUT",
  },
  {
    id: "vote",
    label: "Popular vote",
    menu: "vote — a crowd, fanbase or electorate decides. Popularity and messaging win, not strength.",
    judging:
      "The crowd decides. Weigh fame, likeability, who the audience already loves, who is scary or off-putting, and who can actually work a room. Notoriety cuts both ways. Raw power is irrelevant except as spectacle.",
    staging:
      "No fighting unless the crowd would enjoy it. Stage it as pitches, rallies, viral moments and gaffes, with the vote tally swinging between beats. End on the count.",
    outLabel: "ELIMINATED",
  },
  {
    id: "heist",
    label: "Heist / infiltration",
    menu: "heist — get in, take the thing, get out. Planning, stealth, tech and nerve.",
    judging:
      "INTELLIGENCE AND INGENUITY OUTWEIGH RAW STRENGTH. Weigh planning, stealth, technical skill, disguise, inside knowledge and improvisation when it goes wrong. A loud monster is a liability that trips every alarm. Ask who plans it, who gets through the door, and who blows it.",
    staging:
      "Stage it in phases: the plan, the way in, the complication, the improvisation, the exit. Show the clever pick outmanoeuvring the strong one and say exactly how. Someone loud should nearly ruin it. Getting caught is the elimination, not dying.",
    outLabel: "CAUGHT",
  },
  {
    id: "survival",
    label: "Survival",
    menu: "survival — the setting is the real opponent: cold, water, hunger, no air, no sunlight",
    judging:
      "THE ENVIRONMENT IS THE ENEMY. Say plainly which picks the setting ruins and which it hands the win to. Weigh resilience, resourcefulness, what they can eat, breathe and carry, and who cracks first. Fighting each other is usually the stupid option.",
    staging:
      "Beats are the environment attacking: hour one, nightfall, day three. Fighting between teams is rare and desperate. Show a pick who is simply built for this thriving while a stronger one fails. Going out means succumbing, not being killed.",
    outLabel: "LOST",
  },
  {
    id: "race",
    label: "Race",
    menu: "race — first to the line, over a course with obstacles",
    judging:
      "Speed, stamina over the actual distance, and how the terrain treats each racer. A sprinter loses a marathon. Sabotage and shortcuts count if they'd realistically happen.",
    staging:
      "Beats are stages of the course: the start, the first obstacle, the middle grind, the late collapse, the final straight. Track the lead changing hands. Going out means dropping out or being lapped.",
    outLabel: "OUT",
  },
  {
    id: "debate",
    label: "Debate",
    menu: "debate — argument, rhetoric and persuasion in front of an audience or moderator",
    judging:
      "Rhetoric, evidence, composure under attack and the ability to land a line. Being right matters less than being convincing. Intimidation reads as losing your temper.",
    staging:
      "Beats are exchanges: the opening, the cross-examination, the ambush question, the moment someone loses their cool, the close. No violence. Going out means being dismantled on stage.",
    outLabel: "DEMOLISHED",
  },
  {
    id: "sport",
    label: "Rules-bound game",
    menu: "sport — a match with actual rules and a scoreline: basketball, football, a card game, a tournament",
    judging:
      "Play it by the real rules of that game. Weigh position, fit and role — a roster of five centres loses. Fouls, cards and disqualifications are real outcomes. Score it like a scoreline, not a bodycount.",
    staging:
      "Beats are plays and periods with a running score. Use the real terminology of the sport. Someone fouls out or is sent off rather than dying. End on the final whistle.",
    outLabel: "FOULED OUT",
  },
  {
    id: "auction-of-wits",
    label: "Battle of wits",
    menu: "auction-of-wits — a puzzle, riddle, trial, negotiation or con where the smartest one wins",
    judging:
      "INTELLIGENCE, KNOWLEDGE AND DECEPTION DECIDE IT. A brilliant strategist beats a stronger fool. Weigh who spots the trick, who lies well, who keeps their nerve, and who is simply out of their depth.",
    staging:
      "Beats are moves in the game: an opening gambit, a bluff, a trap being laid, the moment someone realises they've been played. No fighting. Going out means being outsmarted.",
    outLabel: "OUTPLAYED",
  },
];

const BY_ID = new Map<string, Format>(FORMATS.map((f) => [f.id, f]));

/** Never throws — an unknown or invented id falls back to a straight melee. */
export function getFormat(id: unknown): Format {
  return BY_ID.get(String(id ?? "").trim().toLowerCase()) ?? BY_ID.get("melee")!;
}

/** The menu the judge picks from. */
export function formatMenu(): string {
  return FORMATS.map((f) => `- "${f.id}": ${f.menu}`).join("\n");
}

/**
 * The judge's read on the contest, produced alongside the verdict and handed
 * to the battle writer so the fight is staged the same way it was judged.
 */
export interface ContestPlan {
  format: FormatId;
  /** Plain-English name for this specific contest, shown to players */
  formatLabel: string;
  /** 1-2 sentences: how this contest is actually resolved */
  howItWorks: string;
  /** The axes that decide it, most important first */
  decidedBy: string[];
  /** Judges, crowd or officials — and what each one privately wants */
  panel: { name: string; bias: string }[];
  /** Head-to-head reads the verdict turns on */
  matchups: { a: string; b: string; note: string }[];
  /**
   * Rules-lawyer details and lore gotchas — the Death Note that needs a real
   * name, the vampire caught at noon, the Electric type standing on Ground.
   */
  twists: string[];
}

const strArray = (v: unknown, cap: number, len: number): string[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => String(x ?? "").trim().slice(0, len))
    .filter(Boolean)
    .slice(0, cap);

/** Clamp whatever the model returned into a plan the rest of the app can trust. */
export function sanitizePlan(raw: unknown): ContestPlan {
  const r = (raw ?? {}) as Record<string, unknown>;
  const fmt = getFormat(r.format);
  return {
    format: fmt.id,
    formatLabel: String(r.formatLabel ?? "").trim().slice(0, 60) || fmt.label,
    howItWorks: String(r.howItWorks ?? "").trim().slice(0, 320),
    decidedBy: strArray(r.decidedBy, 5, 80),
    panel: (Array.isArray(r.panel) ? (r.panel as Record<string, unknown>[]) : [])
      .map((p) => ({
        name: String(p?.name ?? "").trim().slice(0, 60),
        bias: String(p?.bias ?? "").trim().slice(0, 160),
      }))
      .filter((p) => p.name && p.bias)
      .slice(0, 5),
    matchups: (Array.isArray(r.matchups) ? (r.matchups as Record<string, unknown>[]) : [])
      .map((m) => ({
        a: String(m?.a ?? "").trim().slice(0, 60),
        b: String(m?.b ?? "").trim().slice(0, 60),
        note: String(m?.note ?? "").trim().slice(0, 200),
      }))
      .filter((m) => m.a && m.b && m.note)
      .slice(0, 6),
    twists: strArray(r.twists, 4, 220),
  };
}

/** Render a plan back into prompt text for the battle writer. */
export function planBriefing(plan: ContestPlan): string {
  const lines = [
    `FORMAT: ${plan.format} — ${plan.formatLabel}`,
    plan.howItWorks && `HOW IT RESOLVES: ${plan.howItWorks}`,
    plan.decidedBy.length && `WHAT DECIDES IT: ${plan.decidedBy.join("; ")}`,
    plan.panel.length &&
      `THE PANEL / CROWD (their bias is the story — show it):\n${plan.panel
        .map((p) => `  - ${p.name}: ${p.bias}`)
        .join("\n")}`,
    plan.matchups.length &&
      `KEY MATCHUPS the judge already called — your beats must agree with these:\n${plan.matchups
        .map((m) => `  - ${m.a} vs ${m.b}: ${m.note}`)
        .join("\n")}`,
    plan.twists.length &&
      `TWISTS — each of these MUST actually happen on screen, they are the best moments you have:\n${plan.twists
        .map((t) => `  - ${t}`)
        .join("\n")}`,
  ].filter(Boolean);
  return lines.join("\n");
}
