"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import Scene, { SceneDefs } from "./Scene";
import { cardFor } from "@/lib/draftmasters/battle";
import type { Rules, Side } from "@/lib/draftmasters/engine";
import {
  battleHit,
  setBattleIntensity,
  startBattleMusic,
  stopBattleMusic,
  victoryFanfare,
} from "@/lib/draftmasters/battle-music";
import { isMuted } from "@/lib/draftmasters/sfx";
import type { BattleScript, PortraitMap } from "./types";

/**
 * The battle, as a story that scrolls.
 *
 * It reads as ONE piece of prose climbing the screen at reading pace, not a
 * stack of paragraphs arriving one at a time. Paragraphs that appear and
 * vanish make the reader restart on every one of them; a crawl lets them
 * settle in and listen, which is the whole point of the screen.
 *
 * The rosters sit above and below, laid out exactly as they are at the draft
 * table, and a card is struck out at the moment the line that kills them
 * passes the middle of the screen -- so the crossings-out are keyed to what
 * you are reading right now rather than to a clock.
 *
 * THE MODEL DECIDES THE FIGHT. One call to /tell returns the prose, the
 * casualties as data, the winner, and the plain-language reason they won: all
 * four together, so nothing can disagree with anything else and one battle
 * costs one round trip.
 */

/**
 * A battle, as written. Held by the caller so a rewatch replays THIS fight
 * rather than paying for a new one -- the same beats, the same deaths, the
 * same ending, which is the only thing "rewatch" can honestly mean.
 */
export interface ToldBattle {
  beats: { text: string; kills: string[] }[];
  winnerId: string;
  why: string;
  mvp: { name: string; note: string } | null;
}

interface Props {
  script: BattleScript;
  sides: Side[];
  rules: Rules;
  meId: string;
  portraits: PortraitMap;
  packName: string;
  arena?: string | null;
  /** A story already written. Given one, this screen makes no request at all. */
  replay?: ToldBattle | null;
  /** Handed up the moment it is written, so a rewatch costs nothing. */
  onTold: (told: ToldBattle) => void;
  onDone: () => void;
}

/** "Jaime Lannister (one hand)" -> "Jaime Lannister". */
const BARE = (n: string) => n.replace(/\s*\(.*\)\s*$/, "");

/**
 * How fast the story climbs, in pixels a second.
 *
 * Set from reading speed rather than taste: a line of this text runs to about
 * eleven words, dramatic reading sits near 150 words a minute, so a line wants
 * roughly four seconds. Slower than instinct says and correct anyway -- this is
 * meant to be listened to, and two people are reading it at once.
 */
const CRAWL_PX_S = 13;

/** Where on the screen a line counts as read. Just below centre. */
const READ_AT = 0.56;

/**
 * The opening rite.
 *
 * A battle takes fifteen to forty-five seconds to write, and three breathing
 * dots make that feel like a page that has failed to load. This is the same
 * wait spent well: the announcer settling the room before the fight, which is
 * what the moment actually is.
 *
 * Each step REPLACES what is on screen, so a step listing two lines means the
 * first is still standing when the second arrives. `at` is milliseconds from
 * the screen opening. Nothing here is ever cut off mid-line -- the crawl waits
 * for the last line to land and then fades it out; see `rolling`.
 */
function riteFor(a: string, b: string): { at: number; lines: string[] }[] {
  return [
    { at: 300, lines: ["The combatants gather…"] },
    { at: 3000, lines: ["The combatants gather…", "…and the crowd goes silent in anticipation."] },
    { at: 6600, lines: ["Who will be victorious?"] },
    { at: 8600, lines: ["Who will be victorious?", `Team ${a} — or Team ${b}?`] },
    { at: 12000, lines: [] },
    { at: 13000, lines: ["May The Warrior grant strength to the righteous,"] },
    { at: 15800, lines: [
      "May The Warrior grant strength to the righteous,",
      "May The Mother grant mercy to the innocent…",
    ] },
    { at: 19600, lines: [] },
    { at: 20600, lines: ["And may death sustain life."] },
  ];
}

/** How long the closing line holds before the story is allowed to start. */
const RITE_HOLD = 2400;
/** The handover fade, so the rite dissolves into the story rather than cutting. */
const RITE_FADE = 1100;

export default function BattleStory({
  script,
  sides,
  rules,
  meId,
  portraits,
  packName,
  arena,
  replay,
  onTold,
  onDone,
}: Props) {
  const beats = script.beats;

  /** One paragraph of the fight, and whoever it kills. */
  type Told = { text: string; kills: string[] };

  /**
   * The fight the local resolver already worked out.
   *
   * The fallback, and only the fallback: if the model cannot be reached there
   * is still a battle to watch rather than an error.
   */
  const offline = useMemo<Told[]>(
    () =>
      beats
        .filter((x) => x.story || x.eliminated?.length)
        .map((x) => ({ text: x.text, kills: (x.eliminated ?? []).map(BARE) })),
    [beats]
  );

  const [told, setTold] = useState<Told[]>([]);
  const [why, setWhy] = useState("");
  /** Waiting on the telling. The rosters are up; the page is not. */
  const [writing, setWriting] = useState(true);
  /** Index of the last paragraph the reader has reached. */
  const [upTo, setUpTo] = useState(-1);
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  /** Which step of the opening rite is on screen. */
  const [riteAt, setRiteAt] = useState(-1);
  /** The rite has said its last line and held it. */
  const [riteReady, setRiteReady] = useState(false);
  /** The rite has faded and the story is moving. */
  const [rolling, setRolling] = useState(false);
  /** The crawl has run out. From here the reader drives. */
  const [done, setDone] = useState(false);
  const [wonBy, setWonBy] = useState<string>(script.winnerId);

  const view = useRef<HTMLDivElement>(null);
  const paras = useRef<(HTMLParagraphElement | null)[]>([]);
  /** Kept out of state so the frame loop can read it without re-subscribing. */
  const readRef = useRef(-1);

  // -- The telling ----------------------------------------------------------
  /**
   * Runs exactly once per battle.
   *
   * There is deliberately NO cancellation here. The obvious version sets a
   * `dropped` flag in the cleanup and checks it before touching state -- but
   * React's development double-invoke mounts, unmounts and remounts this
   * component, and the once-guard makes the second mount a no-op. The first
   * attempt is then the only attempt AND it has already been marked dropped,
   * so the story comes back to a closure that refuses to use it: the screen
   * sits on the loading dots forever with a perfectly good battle in hand.
   * Setting state after unmount is a no-op in React 18; a lost story is not.
   */
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    // Already written. Nothing to ask anybody.
    if (replay) {
      setTold(replay.beats);
      setWonBy(replay.winnerId);
      setWhy(replay.why);
      setWriting(false);
      return;
    }

    const body = JSON.stringify({
      arena,
      sides: sides.map((s) => ({
        id: s.id,
        // Real names both ways: the verdict has to name the winner, and "You"
        // is not a name it can use.
        name: s.name,
        cards: s.roster.map((p) => {
          const c = cardFor(
            {
              name: p.name,
              variant: p.variant,
              baseTier: p.tier,
              tier: p.tier,
              grade: p.variantGrade,
            },
            script.boardId
          );
          return {
            name: p.name,
            variant: p.variant,
            grade: p.variantGrade,
            // Only the named tricks. The model does not need our numbers and
            // it does need to know that this one strikes first.
            abilities: c.fx.map((f) => f.label),
          };
        }),
      })),
    });

    type Answer = {
      beats?: { text: string; kills?: string[] }[];
      winner?: string;
      verdict?: string;
      mvp?: { name: string; note: string } | null;
    };

    const ask = async (): Promise<Answer | null> => {
      try {
        const res = await fetch("/api/draftmasters/tell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        const data = (await res.json()) as Answer;
        return data.beats?.length ? data : null;
      } catch {
        return null;
      }
    };

    (async () => {
      try {
        /**
         * Two goes before we give up on a written battle.
         *
         * The fallback is the local resolver's captions -- "Caraxes finds the
         * gap and drives it home!" thirty times over -- and that is not a
         * story, it is a scoreboard with adjectives. It exists so the game
         * still works with no network, not as a version anybody should see
         * because one provider was briefly slow. A second attempt costs a few
         * seconds of the dots; showing the captions costs the whole battle.
         */
        const data = (await ask()) ?? (await ask());
        if (data) {
          const beats = data.beats!.map((x) => ({ text: x.text, kills: (x.kills ?? []).map(BARE) }));
          const winnerId = data.winner || script.winnerId;
          setTold(beats);
          setWonBy(winnerId);
          if (data.verdict) setWhy(data.verdict);
          onTold({ beats, winnerId, why: data.verdict ?? "", mvp: data.mvp ?? null });
        } else {
          setTold(offline);
        }
      } finally {
        setWriting(false);
      }
    })();
    // Deliberately empty: one battle, one telling. See `asked`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- The rite -------------------------------------------------------------
  const rite = useMemo(() => {
    const us = sides.find((s) => s.id === meId) ?? sides[0];
    const them = sides.find((s) => s.id !== us?.id);
    return riteFor(us?.name ?? "You", them?.name ?? "Them");
  }, [sides, meId]);

  useEffect(() => {
    const timers = rite.map((step, i) =>
      window.setTimeout(() => setRiteAt(i), step.at)
    );
    timers.push(
      window.setTimeout(
        () => setRiteReady(true),
        rite[rite.length - 1].at + RITE_HOLD
      )
    );
    return () => timers.forEach(clearTimeout);
  }, [rite]);

  /**
   * Hand over only when BOTH are true: the story is written and the rite has
   * finished speaking. Starting the crawl the instant the fetch lands would
   * cut the closing line in half, which is the one thing this was built not to
   * do -- so a fast answer waits the couple of seconds out, and a slow one
   * finds the rite already holding for it.
   */
  useEffect(() => {
    if (writing || !riteReady || rolling) return;
    const t = window.setTimeout(() => setRolling(true), RITE_FADE);
    return () => clearTimeout(t);
  }, [writing, riteReady, rolling]);

  // -- The crawl ------------------------------------------------------------
  /**
   * One animation-frame loop drives everything: the scroll position, which
   * paragraph counts as read, and when the story has run out. Keeping them on
   * the same clock is what stops a card being struck out before or after the
   * sentence that kills them is under the reader's eye.
   */
  useEffect(() => {
    if (!rolling || !told.length || done || paused) return;
    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      // Clamped: a backgrounded tab hands back a gap of seconds, and without
      // this the story would leap half its length the moment you came back.
      const dt = Math.min(120, now - last);
      last = now;
      const el = view.current;
      if (!el) {
        raf = requestAnimationFrame(step);
        return;
      }

      const max = el.scrollHeight - el.clientHeight;
      const next = Math.min(max, el.scrollTop + (CRAWL_PX_S * (fast ? 2.4 : 1) * dt) / 1000);
      el.scrollTop = next;

      const line = next + el.clientHeight * READ_AT;
      let i = readRef.current;
      while (i + 1 < told.length) {
        const p = paras.current[i + 1];
        if (!p || p.offsetTop + p.offsetHeight * 0.55 > line) break;
        i += 1;
      }
      if (i !== readRef.current) {
        readRef.current = i;
        setUpTo(i);
      }

      if (next >= max - 0.5) {
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [rolling, told, done, paused, fast]);

  // -- Sound ----------------------------------------------------------------
  useEffect(() => {
    if (!isMuted()) startBattleMusic();
    return () => stopBattleMusic();
  }, []);

  // Under the rite the music is barely there; the walk-out lifts it.
  useEffect(() => {
    setBattleIntensity(rolling ? 0.22 : 0.1);
  }, [rolling]);

  useEffect(() => {
    if (upTo < 0 || !told.length) return;
    if (told[upTo]?.kills.length) battleHit(0.85);
    // The walk-out is quiet, the middle builds, and the end is the loudest
    // thing in it. A death spikes above that line rather than replacing it.
    const through = (upTo + 1) / told.length;
    setBattleIntensity(
      Math.min(1, 0.22 + through * 0.55 + (told[upTo]?.kills.length ? 0.25 : 0))
    );
  }, [upTo, told]);

  const rung = useRef(false);
  useEffect(() => {
    if (!done || rung.current) return;
    rung.current = true;
    if (!isMuted()) victoryFanfare();
  }, [done]);

  // -- Controls -------------------------------------------------------------
  const winnerSide = sides.find((s) => s.id === wonBy) ?? sides[0];
  /**
   * The winner, named, and grammatical either way.
   *
   * Sides carry the player's own name, so this normally reads "mclevesque
   * wins!". The guard is for the one case where a side really is called
   * "You" -- then it conjugates rather than printing "You wins!".
   */
  const winnerName = winnerSide?.name?.trim() || "Nobody";
  const winLine = /^you$/i.test(winnerName) ? "You win!" : `${winnerName} wins!`;

  const finish = useCallback(() => onDone(), [onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        finish();
      } else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (view.current) view.current.scrollTop += 220;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  /** Everyone the reader has watched go down. */
  const dead = useMemo(() => {
    const out = new Set<string>();
    for (let i = 0; i <= upTo && i < told.length; i++) {
      told[i].kills.forEach((n) => out.add(n));
    }
    return out;
  }, [upTo, told]);

  const mine = sides.find((s) => s.id === meId) ?? sides[0];
  const theirs = sides.find((s) => s.id !== mine?.id);
  const lineFor = (id?: string) =>
    id ? script.lineup?.find((l) => l.sideId === id) : undefined;

  const survivors = (winnerSide?.roster ?? [])
    .filter((p) => !dead.has(p.name))
    .map((p) => p.name);

  return (
    <div className="dm-st">
      <SceneDefs />
      {/* The board's own landscape, behind everything. Same drawing as the
          case on the shelf, so the fight is visibly happening in the world
          you picked. */}
      <div className="dm-st-ground" aria-hidden="true">
        <Scene pack={script.boardId ?? "custom"} className="dm-st-scene" />
      </div>

      <div className="dm-st-top">
        <span className="dm-st-where">
          {packName}
          {arena && <em>{arena}</em>}
        </span>
        <div className="dm-st-controls">
          {!done && (
            <>
              <button
                className="dm-btn dm-btn-ghost dm-bt-mini"
                onClick={() => setPaused((p) => !p)}
              >
                {paused ? "Resume" : "Pause"}
              </button>
              <button
                className="dm-btn dm-btn-ghost dm-bt-mini"
                onClick={() => setFast((f) => !f)}
              >
                {fast ? "Normal" : "Faster"}
              </button>
            </>
          )}
          <button className="dm-btn dm-btn-ghost dm-bt-mini" onClick={finish}>
            {done ? "Done" : "Skip"}
          </button>
        </div>
      </div>

      {/* Theirs on top, yours underneath, the way the draft table sits. */}
      <Bench
        side={theirs}
        dead={dead}
        portraits={portraits}
        rules={rules}
        lineup={lineFor(theirs?.id)}
        label={theirs?.name ?? "Them"}
        align="top"
      />

      {/* The crawl. Locked while it runs, so the loop and the reader are not
          fighting over one scrollbar, and handed over the moment it ends --
          the first thing anybody wants is to read the good bit again. */}
      <div className="dm-st-page" ref={view} data-done={done ? "1" : "0"}>
        {/* Over the page, not inside the reel: the beats can arrive and sit
            below the fold without shifting the ground under the rite, and the
            handover is a dissolve rather than a cut. */}
        {!rolling && (
          <div className="dm-st-rite" data-out={writing || !riteReady ? "0" : "1"}>
            {(rite[riteAt]?.lines ?? []).map((line, i) => (
              <p key={`${riteAt}-${i}`} className="dm-st-rite-line" data-last={riteAt === rite.length - 1 ? "1" : "0"}>
                {line}
              </p>
            ))}
            {/* Only once the rite has said its piece and is still waiting.
                Before that it would read as a loading spinner over a poem. */}
            {riteReady && writing && (
              <span className="dm-st-rite-wait" aria-label="Writing the battle">
                <i /><i /><i />
              </span>
            )}
          </div>
        )}
        <div className="dm-st-reel">
          <div className="dm-st-gap" aria-hidden="true" />

          {told.map((t, i) => (
            <p
              key={i}
              ref={(el) => {
                paras.current[i] = el;
              }}
              className="dm-st-beat"
              data-kill={t.kills.length ? "1" : "0"}
            >
              {t.text}
            </p>
          ))}

          {!writing && told.length > 0 && (
            <section className="dm-st-fin">
              <span className="dm-st-win-crown">
                <Icon name="crown" size={22} />
              </span>
              <h2 className="dm-st-win-name">{winLine}</h2>
              <p className="dm-st-win-left">
                {survivors.length === 0
                  ? "Nobody left standing on either side."
                  : survivors.length === 1
                    ? `${survivors[0]} is the last one standing.`
                    : `${survivors.length} still standing: ${survivors.join(", ")}.`}
              </p>
              {why && <p className="dm-st-why">{why}</p>}
              <button className="dm-btn dm-btn-primary dm-btn-lg" onClick={finish}>
                See the full verdict
              </button>
            </section>
          )}

          <div className="dm-st-gap" data-tail="1" aria-hidden="true" />
        </div>
      </div>

      <Bench
        side={mine}
        dead={dead}
        portraits={portraits}
        rules={rules}
        lineup={lineFor(mine?.id)}
        label={mine?.name ?? "You"}
        align="bottom"
      />

      <div className="dm-st-hint">
        {done
          ? "scroll back through it, or take the verdict"
          : "space to pause · → to hurry it along"}
      </div>
    </div>
  );
}

/**
 * One side's roster, laid out across the screen.
 *
 * Same shape as the draft table's picks row, deliberately: this is the same
 * information at the same moment in the game, and a player should not have to
 * learn a second layout for it.
 */
function Bench({
  side,
  dead,
  portraits,
  rules,
  lineup,
  label,
  align,
}: {
  side: Side | undefined;
  dead: Set<string>;
  portraits: PortraitMap;
  rules: Rules;
  lineup?: { order: string[]; captain: string | null };
  label: string;
  align: "top" | "bottom";
}) {
  if (!side) return <div className="dm-st-bench" data-align={align} />;

  const byName = new Map(side.roster.map((p) => [p.name, p]));
  const line = lineup?.order.length
    ? lineup.order.map((n) => byName.get(n)).filter(Boolean)
    : side.roster.slice();
  const seen = new Set(line.map((p) => p?.name));
  const ordered = [...line, ...side.roster.filter((p) => !seen.has(p.name))];
  const standing = side.roster.filter((p) => !dead.has(p.name)).length;

  return (
    <div className="dm-st-bench" data-align={align}>
      <span className="dm-st-who">
        {label}
        <b>
          {standing}/{side.roster.length || rules.rosterSize}
        </b>
      </span>

      <div className="dm-st-cards">
        {ordered.map((p) => {
          if (!p) return null;
          const out = dead.has(p.name);
          return (
            <figure
              key={p.id}
              className="dm-st-card"
              data-dead={out ? "1" : "0"}
              title={p.variant ? `${p.name} — ${p.variant}` : p.name}
            >
              <span className="dm-st-art">
                {portraits[p.imgQuery] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={portraits[p.imgQuery]!} alt="" />
                ) : (
                  <span className="dm-st-initial">{p.name.charAt(0)}</span>
                )}
                {/* Struck through and stamped. Grey alone reads as "not this
                    one yet"; the word is what makes it read as gone. */}
                {out && <span className="dm-st-down">DOWN</span>}
              </span>
              <figcaption>{p.name}</figcaption>
              {/* The condition, not a stat line. What was drafted is the thing
                  that changes the fight now; the numbers do not reach it. */}
              {p.variant && <span className="dm-st-cond">{p.variant}</span>}
            </figure>
          );
        })}
      </div>
    </div>
  );
}
