"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import Scene, { SceneDefs } from "./Scene";
import { cardFor } from "@/lib/draftmasters/battle";
import { bandOf, isRated } from "@/lib/draftmasters/power";
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
import { riteFor, skipFrom, stepAt, RITE_HOLD, RITE_FADE } from "@/lib/draftmasters/rite";

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
  beats: { text: string; kills: string[]; turned: string[]; nulled: string[] }[];
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
  /** This player's case for why they win, judged by whoever writes the fight. */
  argument?: string;
  /**
   * Every side's case, by side id, once the room has sealed them.
   *
   * A friend game has two cases and only one of them was ever sent: each
   * client attached its own and nobody's opponent was ever answered.
   */
  args?: Record<string, string> | null;
  /**
   * Whether this screen writes the story or waits for one.
   *
   * Both clients used to write their own: two calls for a single fight, and
   * two different accounts of it side by side. The driver writes; the other
   * player gets it on the script.
   */
  writer?: boolean;
  /** The moment the crawl begins, set by the driver so both screens match. */
  beginAt?: number | null;
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
 * There used to be a Faster button, and everybody pressed it -- which is the
 * clearest signal there is that the default was wrong. This sits between the
 * old normal and the old fast: about a line every second and three quarters,
 * near 340 words a minute. Quick enough that a long battle does not drag,
 * slow enough to read every word, and one speed means one less decision in
 * front of the thing people came to watch.
 */
const CRAWL_PX_S = 21;

/** Where on the screen a line counts as read. Just below centre. */
const READ_AT = 0.56;

const ESC = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Light up whoever dies in this beat.
 *
 * Twenty paragraphs of fighting is a lot to follow, and the deaths are the
 * part that matters -- so the name of anyone who goes down is picked out of
 * the prose in red. It reads the same as before if you are not looking for it,
 * and tells you at a glance if you are.
 *
 * The casualties arrive as data, so this is a display decision only: nothing
 * here can change who died. It matches the drafted name, the name without its
 * parenthetical, and any distinctive word in it, because the prose properly
 * writes "Clegane" long after it last wrote "Gregor Clegane". When the story
 * calls somebody something else entirely -- "the overgrown monkey" -- nothing
 * lights up and the portrait still greys out on the bench.
 */
function mark(text: string, groups: { names: string[]; cls: string }[]) {
  /** Every form a name takes in the prose, and the class it is lit with. */
  const forms = new Map<string, string>();
  for (const g of groups) {
    for (const k of g.names) {
      const bare = k.replace(/\s*\(.*\)\s*$/, "").trim();
      const words = bare.split(/[^A-Za-z0-9']+/).filter((w) => w.length >= 4);
      for (const f of [bare, ...words]) {
        if (f && !forms.has(f.toLowerCase())) forms.set(f.toLowerCase(), g.cls);
      }
    }
  }
  if (!forms.size) return text;

  // Longest first, so "Gregor Clegane" wins over "Clegane" where both fit.
  const re = new RegExp(
    `\\b(${[...forms.keys()].sort((a, b) => b.length - a.length).map(ESC).join("|")})\\b`,
    "gi"
  );
  // One capturing group, so split() hands back the matches at odd indices.
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <em key={i} className={forms.get(p.toLowerCase()) ?? "dm-st-fell"}>
        {p}
      </em>
    ) : (
      p
    )
  );
}

/**
 * One paragraph as the reader sees it: its headline if it has one, and every
 * name it took off the board lit in the colour of that card's stamp -- red
 * for dead, blue for turned, grey for nulled.
 */
function beatText(t: { text: string; kills: string[]; turned?: string[]; nulled?: string[] }) {
  const loud = /^(FRIENDLY FIRE!|BETRAYAL!)\s*/.exec(t.text);
  const lit = mark(loud ? t.text.slice(loud[0].length) : t.text, [
    { names: t.kills, cls: "dm-st-fell" },
    { names: t.turned ?? [], cls: "dm-st-fell dm-st-fell-turned" },
    { names: t.nulled ?? [], cls: "dm-st-fell dm-st-fell-null" },
  ]);
  if (!loud) return lit;
  return (
    <>
      <strong className="dm-st-loud">{loud[1]}</strong> {lit}
    </>
  );
}


export default function BattleStory({
  script,
  sides,
  rules,
  meId,
  portraits,
  packName,
  arena,
  argument,
  args,
  writer = true,
  beginAt,
  replay,
  onTold,
  onDone,
}: Props) {
  const beats = script.beats;

  /** One paragraph of the fight, and whoever it kills. */
  type Told = { text: string; kills: string[]; turned: string[]; nulled: string[] };

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
        .map((x) => ({ text: x.text, kills: (x.eliminated ?? []).map(BARE), turned: [], nulled: [] })),
    [beats]
  );

  const [told, setTold] = useState<Told[]>([]);
  const [why, setWhy] = useState("");
  /** Waiting on the telling. The rosters are up; the page is not. */
  const [writing, setWriting] = useState(true);
  /** Index of the last paragraph the reader has reached. */
  const [upTo, setUpTo] = useState(-1);
  const [paused, setPaused] = useState(false);
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
  const reelRef = useRef<HTMLDivElement>(null);
  /** Survives a pause, so resuming picks up where the reader was left. */
  const startAt = useRef(0);
  const paras = useRef<(HTMLParagraphElement | null)[]>([]);
  /** Kept out of state so the frame loop can read it without re-subscribing. */
  const readRef = useRef(-1);
  /** When the rite started, and how far the reader has tapped it forward. */
  const riteClock = useRef({ t0: 0, skip: 0 });

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
    // Already written -- by this screen before a rewatch, or by the other
    // player and sent along with the script. Nothing to ask anybody.
    if (replay) {
      setTold(replay.beats);
      setWonBy(replay.winnerId);
      setWhy(replay.why);
      setWriting(false);
      return;
    }

    // Somebody else is writing it. Sit on the rite until it arrives.
    if (!writer) return;

    if (asked.current) return;
    asked.current = true;

    const body = JSON.stringify({
      arena,
      sides: sides.map((s) => ({
        id: s.id,
        // Real names both ways: the verdict has to name the winner, and "You"
        // is not a name it can use.
        name: s.name,
        // Only this player's case. Nobody argues on somebody else's behalf.
        // Both cases when the room has them; otherwise just this player's.
        argument: args ? args[s.id]?.trim() || null : s.id === meId ? argument?.trim() || null : null,
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
            // What this card actually IS, in a band rather than a number --
            // but ONLY when somebody has rated it. An unrated card takes its
            // board's ordinary value, and shipping that as a band tells the
            // story a god is a foot soldier. No bracket, no claim.
            power: isRated({ name: p.name, variant: p.variant }) ? bandOf(c.atk) : null,
            // Only the named tricks. The model does not need our numbers and
            // it does need to know that this one strikes first.
            abilities: c.fx.map((f) => f.label),
          };
        }),
      })),
    });

    type Answer = {
      beats?: { text: string; kills?: string[]; turned?: string[]; nulled?: string[] }[];
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
          const beats = data.beats!.map((x) => ({
            text: x.text,
            kills: (x.kills ?? []).map(BARE),
            turned: (x.turned ?? []).map(BARE),
            nulled: (x.nulled ?? []).map(BARE),
          }));
          const winnerId = data.winner || script.winnerId;
          setTold(beats);
          setWonBy(winnerId);
          if (data.verdict) setWhy(data.verdict);
          onTold({ beats, winnerId, why: data.verdict ?? "", mvp: data.mvp ?? null });
        } else {
          // Shared even though it is ours. The other player is waiting on a
          // told and gets NOTHING if the writer quietly falls back -- they sat
          // through the rite and then landed on the result having read no
          // story at all.
          // Say so in the console. "The prose seems less creative" is what
          // this looks like from the outside, and there was no way to tell
          // the fallback from a telling that simply came back plain.
          console.warn("[battle] the writer did not answer - offline narration");
          setTold(offline);
          onTold({ beats: offline, winnerId: script.winnerId, why: "", mvp: null });
        }
      } finally {
        setWriting(false);
      }
    })();
    // One battle, one telling -- `asked` guards that. The two deps are the
    // ways a story can arrive from outside: a rewatch, or the other player's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay, writer]);

  // -- The rite -------------------------------------------------------------
  /**
   * Keyed on the two NAMES, not on `sides`.
   *
   * The rite's whole timeline hangs off one effect, and the "finished" timer
   * at the end of it is what lets the crawl start. Any re-run of that effect
   * tears every timer down and starts them again from zero, so the finish can
   * be pushed out indefinitely and the story just sits there unread -- which
   * is the symptom that was reported.
   *
   * `sides` is rebuilt whenever the game commits, so a memo keyed on it can
   * hand back a new `rite` for reasons that have nothing to do with the rite.
   * Strings compare by value, and the ref guard below means the schedule is
   * armed exactly once whatever else changes.
   */
  const usName = (sides.find((x) => x.id === meId) ?? sides[0])?.name ?? "You";
  const themName = sides.find((x) => x.id !== meId)?.name ?? "Them";
  const rite = useMemo(() => riteFor(usName, themName), [usName, themName]);

  /**
   * ONE CLOCK, not nine timers.
   *
   * The rite used to arm a timeout per step. That works until the tab is
   * throttled for even a moment -- then several fire in a burst, and a step
   * from the middle of the sequence can be painted for a frame on its way to
   * the right one, which reads as a line of unrelated text flashing up.
   *
   * Asking the clock what should be on screen has no such state to get wrong:
   * however long the gap was, the answer is whatever is true NOW. It also
   * ends the once-guard problem for good -- an interval that is cleared and
   * restarted just restarts the clock, which is exactly right, so React's
   * development double-invoke costs nothing instead of silently arming
   * nothing.
   */
  useEffect(() => {
    riteClock.current = { t0: performance.now(), skip: 0 };
    const id = window.setInterval(() => {
      const c = riteClock.current;
      const ms = performance.now() - c.t0 + c.skip;
      setRiteAt(stepAt(rite, ms));
      if (ms >= rite[rite.length - 1].at + RITE_HOLD) {
        setRiteReady(true);
        window.clearInterval(id);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [rite]);

  /**
   * A tap on the rite moves it on a line.
   *
   * The skip is added to the same clock rather than stepping a counter, so the
   * interval above keeps answering "what is true now" and cannot disagree with
   * the tap. Past the last line it ends the hold, and the story starts as soon
   * as it is written.
   */
  const skipRite = useCallback(() => {
    if (riteReady) return;
    const c = riteClock.current;
    const ms = performance.now() - c.t0 + c.skip;
    const to = skipFrom(rite, ms);
    c.skip += to - ms;
    setRiteAt(stepAt(rite, to));
    if (to >= rite[rite.length - 1].at + RITE_HOLD) setRiteReady(true);
  }, [rite, riteReady]);

  /**
   * Hand over only when BOTH are true: the story is written and the rite has
   * finished speaking. Starting the crawl the instant the fetch lands would
   * cut the closing line in half, which is the one thing this was built not to
   * do -- so a fast answer waits the couple of seconds out, and a slow one
   * finds the rite already holding for it.
   */
  useEffect(() => {
    if (writing || !riteReady || rolling) return;
    // In a friend game the driver stamps the moment both crawls begin, so the
    // two read in step rather than one racing ahead of the other.
    const wait = Math.max(RITE_FADE, beginAt ? beginAt - Date.now() : 0);
    const t = window.setTimeout(() => setRolling(true), wait);
    return () => clearTimeout(t);
  }, [writing, riteReady, rolling, beginAt]);

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
    /**
     * The crawl's position, kept HERE and moved with a TRANSFORM.
     *
     * Two bugs live at this line and they are the same bug twice. Writing the
     * position to scrollTop lost the fraction -- at twenty-one pixels a second
     * a frame is a third of a pixel, and scrollTop will not keep that -- which
     * first stopped the story dead, and then, once the position was kept here
     * instead, showed up on a phone as a jitter: every frame the browser
     * rounded our fractional value to a whole device pixel, so the text
     * stepped and stalled instead of gliding.
     *
     * A transform has no such rounding. It is sub-pixel by definition and it
     * runs on the compositor, which is what smooth means on a handset. Layout
     * is untouched, so offsetTop still reports where paragraphs really are and
     * the read-line arithmetic below is unchanged.
     */
    let pos = startAt.current;

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
      const reel = reelRef.current;
      const max = el.scrollHeight - el.clientHeight;
      pos = Math.min(max, pos + (CRAWL_PX_S * dt) / 1000);
      startAt.current = pos;
      if (reel) reel.style.transform = `translate3d(0, ${-pos}px, 0)`;

      const line = pos + el.clientHeight * READ_AT;
      let i = readRef.current;
      while (i + 1 < told.length) {
        const p = paras.current[i + 1];
        // Three quarters down the paragraph, not halfway: the blow usually
        // lands in its last sentence, and a portrait that greys out while you
        // are still reading the set-up gives the death away before it happens.
        if (!p || p.offsetTop + p.offsetHeight * 0.78 > line) break;
        i += 1;
      }
      if (i !== readRef.current) {
        readRef.current = i;
        setUpTo(i);
      }

      if (pos >= max - 0.5) {
        // Hand the reel back to the browser: drop the transform, put the same
        // distance into a real scroll, and from here the reader drives.
        if (reel) reel.style.transform = "";
        el.scrollTop = max;
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [rolling, told, done, paused]);

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
        // While it is running the reel moves by transform, so nudging
        // scrollTop would do nothing; once it is done the browser owns it.
        if (done) view.current?.scrollBy({ top: 220 });
        else startAt.current += 220;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, done]);

  /** Everyone the reader has watched go down. */
  const dead = useMemo(() => {
    const out = new Set<string>();
    for (let i = 0; i <= upTo && i < told.length; i++) {
      told[i].kills.forEach((n) => out.add(n));
    }
    return out;
  }, [upTo, told]);

  /** Everyone who has changed sides. Gone from this bench, but not dead. */
  const turned = useMemo(() => {
    const out = new Set<string>();
    for (let i = 0; i <= upTo && i < told.length; i++) {
      (told[i].turned ?? []).forEach((n) => out.add(n));
    }
    return out;
  }, [upTo, told]);

  /** The things that ended without dying, because they were never alive. */
  const nulled = useMemo(() => {
    const out = new Set<string>();
    for (let i = 0; i <= upTo && i < told.length; i++) {
      (told[i].nulled ?? []).forEach((n) => out.add(n));
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
            <button
              className="dm-btn dm-btn-ghost dm-bt-mini"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? "Resume" : "Pause"}
            </button>
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
        turned={turned}
        nulled={nulled}
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
          <div
            className="dm-st-rite"
            data-out={writing || !riteReady ? "0" : "1"}
            data-skip={riteReady ? "0" : "1"}
            role={riteReady ? undefined : "button"}
            tabIndex={riteReady ? undefined : 0}
            title={riteReady ? undefined : "Tap to skip ahead"}
            onClick={skipRite}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              // Kept from the page's own keys, where space is pause.
              e.preventDefault();
              e.stopPropagation();
              skipRite();
            }}
          >
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
        {/* Laid out from the first frame, because the crawl measures it, but
            invisible until the rite has finished speaking. Rendering it
            plainly meant the opening beats sat behind the invocation, two
            different pieces of prose stacked on the same pixels. */}
        <div className="dm-st-reel" ref={reelRef} data-hold={rolling ? "0" : "1"}>
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
              {beatText(t)}
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
        turned={turned}
        nulled={nulled}
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
  turned,
  nulled,
  portraits,
  rules,
  lineup,
  label,
  align,
}: {
  side: Side | undefined;
  dead: Set<string>;
  turned: Set<string>;
  nulled: Set<string>;
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
  // Turned counts as gone from this bench: they are fighting for the others.
  const standing = side.roster.filter(
    (p) => !dead.has(p.name) && !turned.has(p.name) && !nulled.has(p.name)
  ).length;

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
          const gone = turned.has(p.name);
          const spent = nulled.has(p.name);
          return (
            <figure
              key={p.id}
              className="dm-st-card"
              data-dead={out ? "1" : "0"}
              data-turned={gone ? "1" : "0"}
              data-null={spent ? "1" : "0"}
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
                {!out && gone && <span className="dm-st-turned">TURNED</span>}
                {!out && !gone && spent && <span className="dm-st-null">NULL</span>}
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
