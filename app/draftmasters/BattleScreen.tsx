"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import type { Rules, Side } from "@/lib/draftmasters/engine";
import {
  battleHit,
  setBattleIntensity,
  startBattleMusic,
  stopBattleMusic,
  swordClash,
  victorySting,
} from "@/lib/draftmasters/battle-music";
import { isMuted } from "@/lib/draftmasters/sfx";
import { HP_PER_DEF, cardFor } from "@/lib/draftmasters/battle";
import type { BattleBeat, BattleScript, PortraitMap } from "./types";

/** What a card looks like right now, replayed from the beats so far. */
/** "Jaime Lannister (one hand)" -> "Jaime Lannister". */
const BARE = (name: string) => name.replace(/\s*\(.*\)\s*$/, "");

interface Live {
  name: string;
  atk: number;
  def: number;
  atkBase: number;
  hp: number;
  dead: boolean;
}

/**
 * The battle cinematic — the judge's verdict, dramatised.
 *
 * The winner is decided before a single frame plays, so this can never
 * disagree with "Calculate Winner"; it's a replay, not a second opinion.
 *
 * Beats advance on a timer sized to how much text there is to read, and the
 * whole thing is tap-to-advance so nobody is stuck watching at someone else's
 * pace. Motion respects prefers-reduced-motion: the shake and charge-in stop,
 * the story doesn't.
 */

interface Props {
  script: BattleScript;
  sides: Side[];
  rules: Rules;
  meId: string;
  portraits: PortraitMap;
  packName: string;
  onDone: () => void;
}

const MIN_BEAT_MS = 2600;
const MAX_BEAT_MS = 7000;
const MS_PER_CHAR = 26;

function beatDuration(beat: BattleBeat): number {
  // A beat with nothing to say is a fact for the log, not a moment. It still
  // gets its own frame so the log fills in order, just barely one.
  if (!beat.story) return 520;
  const read = MIN_BEAT_MS + beat.text.length * MS_PER_CHAR;
  // Big moments get an extra half-second to land.
  return Math.min(MAX_BEAT_MS, read + beat.intensity * 220);
}

export default function BattleScreen({ script, sides, rules, meId, portraits, packName, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const beats = script.beats;
  const beat = beats[index];
  const finished = index >= beats.length - 1 && beat?.kind === "final";

  const left = sides[0];
  const right = sides[1];
  // "DEAD" is right for a melee and wrong for everything else — a Pokémon
  // faints, a pageant contestant is cut, a thief gets caught.
  const outLabel = script.outLabel ?? "DEAD";
  const winner = sides.find((s) => s.id === script.winnerId);

  // Name -> portrait, so a beat's actors can be shown without another lookup.
  const portraitOf = useMemo(() => {
    const map = new Map<string, string | null>();
    sides.forEach((s) => s.roster.forEach((p) => map.set(p.name, portraits[p.imgQuery] ?? null)));
    return map;
  }, [sides, portraits]);

  /**
   * Every card's state as of the current beat.
   *
   * Replayed from the top each time rather than mutated forward, because the
   * player can scrub backwards with the keyboard and a running mutation would
   * be wrong the moment they did.
   */
  const live = useMemo(() => {
    const map = new Map<string, Live>();
    for (const s of sides) {
      for (const p of s.roster) {
        const c = cardFor(
          { name: p.name, variant: p.variant, baseTier: p.tier, tier: p.tier, grade: p.variantGrade },
          script.boardId
        );
        // The log labels a fighter with its variant attached, so register
        // both spellings and let either resolve.
        const label = p.variant ? `${p.name} (${p.variant})` : p.name;
        const card: Live = { name: label, atk: c.atk, def: c.def, atkBase: c.atk, hp: c.def * HP_PER_DEF, dead: false };
        map.set(label, card);
        map.set(p.name, card);
      }
    }
    const find = (n: string) => map.get(n) ?? map.get(BARE(n));
    for (let i = 0; i <= index && i < beats.length; i++) {
      const bt = beats[i];
      if (bt.from && bt.atk !== undefined) {
        const a = find(bt.from);
        if (a) a.atk = bt.atk;
      }
      if (bt.to && bt.hpAfter !== undefined) {
        const d = find(bt.to);
        if (d) d.hp = bt.hpAfter;
      }
      bt.eliminated?.forEach((n) => {
        const d = find(n);
        if (d) { d.dead = true; d.hp = 0; }
      });
      bt.revived?.forEach((n) => {
        const d = find(n);
        if (d) d.dead = false;
      });
    }
    return map;
  }, [sides, beats, index, script.boardId]);

  /**
   * Who is standing in each slot right now.
   *
   * Carried forward from the last beat that named a fighter, because plenty
   * of beats -- a captain's aura, a terrain note, the round marker -- name
   * nobody at all and the slots must not empty when one arrives.
   */
  const [slotL, slotR] = useMemo(() => {
    let l: Live | undefined;
    let r: Live | undefined;
    const onLeft = (n: string) => left?.roster.some((p) => p.name === BARE(n)) ?? false;
    for (let i = 0; i <= index && i < beats.length; i++) {
      for (const n of [beats[i].from, beats[i].to]) {
        if (!n) continue;
        const card = live.get(n) ?? live.get(BARE(n));
        if (!card) continue;
        if (onLeft(n)) l = card; else r = card;
      }
    }
    return [l, r] as const;
  }, [beats, index, live, left]);

  const lineFor = (id?: string) =>
    id ? script.lineup?.find((l) => l.sideId === id) : undefined;

  /** The most recent beat that actually had something to say. */
  const [told, toldAt] = useMemo(() => {
    for (let i = Math.min(index, beats.length - 1); i >= 0; i--) {
      if (beats[i].story) return [beats[i], i] as const;
    }
    return [undefined, -1] as const;
  }, [beats, index]);

  /** Everyone knocked out at or before the current beat. */
  const eliminated = useMemo(() => {
    const dead = new Set<string>();
    for (let i = 0; i <= index && i < beats.length; i++) {
      beats[i].eliminated?.forEach((n) => dead.add(n));
      // Somebody raised them. The set used to only grow, so a revived card
      // stayed crossed out for the rest of the fight.
      beats[i].revived?.forEach((n) => dead.delete(n));
    }
    return dead;
  }, [beats, index]);

  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // ── Audio ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isMuted()) return;
    startBattleMusic(0.42);
    return () => stopBattleMusic();
  }, []);

  useEffect(() => {
    if (!beat || isMuted()) return;
    // The score thickens as the fight escalates.
    setBattleIntensity(0.3 + (index / Math.max(1, beats.length - 1)) * 0.5 + beat.intensity * 0.08);
    if (beat.kind === "final") {
      stopBattleMusic(1.6);
      victorySting();
    } else if (beat.kind === "kill" || beat.intensity >= 3) {
      battleHit(1);
    } else if (beat.kind === "clash" || beat.kind === "turn") {
      swordClash();
    } else if (beat.intensity >= 2) {
      battleHit(0.6);
    }
  }, [beat, index, beats.length]);

  // ── Advance ────────────────────────────────────────────────────────────────

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, beats.length - 1));
  }, [beats.length]);

  // The log follows the fight. Scrolled rather than reversed, because reading
  // a battle bottom-to-top is a puzzle nobody asked for.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [index]);

  useEffect(() => {
    if (!beat || paused || finished) return;
    const t = setTimeout(next, beatDuration(beat));
    return () => clearTimeout(t);
  }, [beat, paused, finished, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        finished ? onDone() : next();
      } else if (e.key === "Escape") {
        onDone();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, next, onDone]);

  if (!beat) return null;

  const actingSide = beat.sideId;
  const actorsFrom = (name: string): "left" | "right" =>
    left?.roster.some((p) => p.name === name) ? "left" : "right";

  const shake = reducedMotion ? 0 : beat.intensity;
  const progress = ((index + 1) / beats.length) * 100;

  return (
    <div
      className="dm-bt"
      data-shake={shake}
      data-kind={beat.kind}
      key={`stage-${index}`}
      onClick={() => (finished ? onDone() : next())}
      role="button"
      tabIndex={0}
      aria-label="Battle — tap to advance"
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="dm-bt-top" onClick={(e) => e.stopPropagation()}>
        <span className="dm-bt-topic">
          {packName}
          {script.formatLabel && <em className="dm-bt-format">{script.formatLabel}</em>}
        </span>
        <div className="dm-bt-top-actions">
          <button
            className="dm-btn dm-btn-ghost dm-bt-mini"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
          >
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button className="dm-btn dm-btn-ghost dm-bt-mini" onClick={onDone}>
            Skip ▸
          </button>
        </div>
      </div>
      <div className="dm-bt-progress">
        <i style={{ width: `${progress}%` }} />
      </div>

      {/* ── Arena ───────────────────────────────────────────────────────── */}
      <div className="dm-bt-arena">
        <Rail side={left} align="left" eliminated={eliminated} portraitOf={portraitOf} rules={rules} meId={meId} acting={actingSide === left?.id} lineup={lineFor(left?.id)} fighting={slotL?.name} />

        <div className="dm-bt-center">
          {/* The two slots. Held by whoever is fighting, not by whoever the
              narrator happened to name, so the pair on screen is the pair the
              rules are resolving. */}
          <div className="dm-bt-slots" key={index} data-kind={beat.kind} data-intensity={beat.intensity}>
            <Slot
              live={slotL}
              portrait={slotL ? portraitOf.get(BARE(slotL.name)) ?? null : null}
              side="left"
              acting={!!beat.from && !!slotL && BARE(beat.from) === BARE(slotL.name)}
              hit={!!slotL && !!beat.to && BARE(beat.to) === BARE(slotL.name) ? beat.damage : undefined}
              out={slotL?.dead ?? false}
              outLabel={outLabel}
            />

            <span className="dm-bt-versus" aria-hidden="true">
              {beat.damage !== undefined && beat.damage > 0 ? (
                <b className="dm-bt-dmg" key={`d${index}`}>-{beat.damage}</b>
              ) : (
                <i />
              )}
            </span>

            <Slot
              live={slotR}
              portrait={slotR ? portraitOf.get(BARE(slotR.name)) ?? null : null}
              side="right"
              acting={!!beat.from && !!slotR && BARE(beat.from) === BARE(slotR.name)}
              hit={!!slotR && !!beat.to && BARE(beat.to) === BARE(slotR.name) ? beat.damage : undefined}
              out={slotR?.dead ?? false}
              outLabel={outLabel}
            />

            {(beat.kind === "clash" || beat.kind === "kill" || beat.intensity >= 2) && !reducedMotion && (
              <>
                <span className="dm-bt-slash" />
                {beat.intensity >= 2 && <span className="dm-bt-slash" data-second="1" />}
                <span className="dm-bt-flash" />
              </>
            )}
          </div>
        </div>

        <Rail side={right} align="right" eliminated={eliminated} portraitOf={portraitOf} rules={rules} meId={meId} acting={actingSide === right?.id} lineup={lineFor(right?.id)} fighting={slotR?.name} />
      </div>

      {/* ── Caption ─────────────────────────────────────────────────────── */}
      <div className="dm-bt-caption" data-kind={told?.kind ?? beat.kind}>
        <p key={toldAt}>{told?.text ?? ""}</p>
      </div>

      {/* The rules, in plain English, under the story. Everything the fight
          actually did — the rolls, the damage, the numbers — so a player who
          wants to know WHY can read it without the story having to stop and
          explain itself. */}
      <div className="dm-bt-log" onClick={(e) => e.stopPropagation()}>
        <p className="dm-bt-log-head">What is happening</p>
        <div className="dm-bt-log-lines" ref={logRef}>
          {beats.slice(0, index + 1).map((bt, i) => (
            <p key={i} data-kind={bt.kind} data-now={i === index ? "1" : "0"}>
              {bt.plain ?? bt.text}
            </p>
          ))}
        </div>
      </div>

      {finished ? (
        <div className="dm-bt-end" onClick={(e) => e.stopPropagation()}>
          <div className="dm-bt-crown"><Icon name="crown" size={15} /></div>
          <div className="dm-bt-winner">{winner?.id === meId ? "You win." : `${winner?.name ?? "Winner"} wins.`}</div>
          <button className="dm-btn dm-btn-primary dm-btn-lg" onClick={onDone}>
            See the full verdict
          </button>
        </div>
      ) : (
        <div className="dm-bt-hint">tap, space, or → to skip ahead</div>
      )}
    </div>
  );
}

// ── Roster rail ──────────────────────────────────────────────────────────────

/**
 * One fighter, as a card.
 *
 * `hit` is the damage landing on it THIS beat, which floats off the card and
 * is the only animation on here that carries information.
 */
function Slot({
  live,
  portrait,
  side,
  acting,
  hit,
  out,
  outLabel,
}: {
  live: Live | undefined;
  portrait: string | null;
  side: "left" | "right";
  acting: boolean;
  hit?: number;
  out: boolean;
  outLabel: string;
}) {
  if (!live) return <span className="dm-bt-slot" data-side={side} data-empty="1" />;

  const maxHp = live.def * HP_PER_DEF;
  const frac = maxHp > 0 ? Math.max(0, live.hp) / maxHp : 0;
  const health = frac > 0.6 ? "ok" : frac > 0.3 ? "hurt" : "dying";
  const boosted = live.atk > live.atkBase;

  return (
    <figure className="dm-bt-slot" data-side={side} data-acting={acting ? "1" : "0"} data-dead={out ? "1" : "0"}>
      <span className="dm-bt-art">
        {portrait ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portrait} alt="" />
        ) : (
          <span className="dm-bt-art-fb">{live.name.charAt(0)}</span>
        )}
        {out && <span className="dm-bt-dead">{outLabel}</span>}
        {hit !== undefined && hit > 0 && (
          <b className="dm-bt-hit" key={`${live.name}-${live.hp}`}>-{hit}</b>
        )}
      </span>

      <figcaption className="dm-bt-name">
        {BARE(live.name)}
        {live.name !== BARE(live.name) && (
          <em title={live.name}>{live.name.slice(BARE(live.name).length + 2, -1)}</em>
        )}
      </figcaption>

      {/* Labelled, because an unlabelled number on a card that already has two
          numbers on it is a third mystery rather than a health bar. */}
      <span className="dm-bt-hp" data-health={health}>
        <i style={{ width: `${Math.round(frac * 100)}%` }} />
        <b><s>HEALTH</s>{Math.max(0, live.hp)} / {maxHp}</b>
      </span>

      {/* Bottom right, like every card game anybody has played. */}
      <span className="dm-bt-stats">
        <b data-boost={boosted ? "1" : "0"}>{live.atk}</b>
        <i>/</i>
        <b>{live.def}</b>
      </span>
    </figure>
  );
}


function Rail({
  side,
  align,
  eliminated,
  portraitOf,
  rules,
  meId,
  acting,
  lineup,
  fighting,
}: {
  side: Side | undefined;
  align: "left" | "right";
  eliminated: Set<string>;
  portraitOf: Map<string, string | null>;
  rules: Rules;
  meId: string;
  acting: boolean;
  lineup?: { order: string[]; captain: string | null };
  /** Whoever is holding the slot for this side right now. */
  fighting?: string;
}) {
  if (!side) return <div className="dm-bt-rail" />;

  const byName = new Map(side.roster.map((p) => [p.name, p]));
  // Fighting order when we have it. The roster is in draft order, which is
  // the order lots came up at auction and means nothing during a battle.
  const line = lineup?.order.length
    ? lineup.order.map((n) => byName.get(n)).filter(Boolean)
    : side.roster.filter((p) => p.name !== lineup?.captain);
  const captain = lineup?.captain ? byName.get(lineup.captain) : undefined;

  const standing = side.roster.filter((p) => !eliminated.has(p.name)).length;
  const row = (p: NonNullable<ReturnType<typeof byName.get>>, i: number | null) => (
    <div
      key={p.id}
      className="dm-bt-card"
      data-dead={eliminated.has(p.name) ? "1" : "0"}
      data-now={BARE(fighting ?? "") === p.name ? "1" : "0"}
      title={p.name}
    >
      {i !== null && <span className="dm-bt-ord">{i + 1}</span>}
      <ActorPortrait url={portraitOf.get(p.name) ?? null} name={p.name} />
      <span className="dm-bt-card-name">{p.name}</span>
    </div>
  );

  return (
    <div className="dm-bt-rail" data-align={align} data-acting={acting ? "1" : "0"}>
      <div className="dm-bt-rail-head">
        <span className="dm-bt-rail-name">{side.id === meId ? "You" : side.name}</span>
        <span className="dm-bt-rail-count">
          {standing}/{side.roster.length || rules.rosterSize}
        </span>
      </div>

      <div className="dm-bt-rail-cards">{line.map((p, i) => row(p!, i))}</div>

      {/* Apart from the line, because that is what a captain is: somebody
          standing behind it who does not fight until it is gone. */}
      {captain && (
        <div className="dm-bt-rail-cap">
          <span className="dm-bt-rail-label">Captain</span>
          {row(captain, null)}
        </div>
      )}
    </div>
  );
}

// ── Portrait ─────────────────────────────────────────────────────────────────

function ActorPortrait({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<string | null>(url);
  if (ref.current !== url) {
    ref.current = url;
    if (broken) setBroken(false);
  }
  if (!url || broken) {
    return <span className="dm-bt-initial">{name.charAt(0).toUpperCase()}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} onError={() => setBroken(true)} referrerPolicy="no-referrer" draggable={false} />
  );
}
