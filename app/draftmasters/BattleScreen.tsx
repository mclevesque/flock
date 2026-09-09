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
import type { BattleBeat, BattleScript, PortraitMap } from "./types";

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
  const read = MIN_BEAT_MS + beat.text.length * MS_PER_CHAR;
  // Big moments get an extra half-second to land.
  return Math.min(MAX_BEAT_MS, read + beat.intensity * 220);
}

export default function BattleScreen({ script, sides, rules, meId, portraits, packName, onDone }: Props) {
  const [index, setIndex] = useState(0);
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

  /** Everyone knocked out at or before the current beat. */
  const eliminated = useMemo(() => {
    const dead = new Set<string>();
    for (let i = 0; i <= index && i < beats.length; i++) beats[i].eliminated?.forEach((n) => dead.add(n));
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
        <Rail side={left} align="left" eliminated={eliminated} portraitOf={portraitOf} rules={rules} meId={meId} acting={actingSide === left?.id} />

        <div className="dm-bt-center">
          <div className="dm-bt-clash" key={index} data-kind={beat.kind} data-intensity={beat.intensity}>
            {beat.actors.map((name) => {
              // The stamp belongs on whoever just died, not floating over the
              // winner — you should be able to see at a glance who it was.
              const justDied = beat.eliminated?.includes(name) ?? false;
              return (
                <figure
                  key={name}
                  className="dm-bt-actor"
                  data-from={actorsFrom(name)}
                  data-dead={eliminated.has(name) ? "1" : "0"}
                >
                  <span className="dm-bt-actor-shot">
                    <ActorPortrait url={portraitOf.get(name) ?? null} name={name} />
                    {justDied && <span className="dm-bt-dead">{outLabel}</span>}
                  </span>
                  <figcaption>{name}</figcaption>
                </figure>
              );
            })}
            {(beat.kind === "clash" || beat.kind === "kill" || beat.intensity >= 2) && !reducedMotion && (
              <>
                <span className="dm-bt-slash" />
                {beat.intensity >= 2 && <span className="dm-bt-slash" data-second="1" />}
                <span className="dm-bt-flash" />
              </>
            )}
          </div>
        </div>

        <Rail side={right} align="right" eliminated={eliminated} portraitOf={portraitOf} rules={rules} meId={meId} acting={actingSide === right?.id} />
      </div>

      {/* ── Caption ─────────────────────────────────────────────────────── */}
      <div className="dm-bt-caption" data-kind={beat.kind}>
        <p key={index}>{beat.text}</p>
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

function Rail({
  side,
  align,
  eliminated,
  portraitOf,
  rules,
  meId,
  acting,
}: {
  side: Side | undefined;
  align: "left" | "right";
  eliminated: Set<string>;
  portraitOf: Map<string, string | null>;
  rules: Rules;
  meId: string;
  acting: boolean;
}) {
  if (!side) return <div className="dm-bt-rail" />;
  const standing = side.roster.filter((p) => !eliminated.has(p.name)).length;
  return (
    <div className="dm-bt-rail" data-align={align} data-acting={acting ? "1" : "0"}>
      <div className="dm-bt-rail-head">
        <span className="dm-bt-rail-name">{side.id === meId ? "You" : side.name}</span>
        <span className="dm-bt-rail-count">
          {standing}/{side.roster.length || rules.rosterSize}
        </span>
      </div>
      <div className="dm-bt-rail-cards">
        {side.roster.map((p) => (
          <div key={p.id} className="dm-bt-card" data-dead={eliminated.has(p.name) ? "1" : "0"} title={p.name}>
            <ActorPortrait url={portraitOf.get(p.name) ?? null} name={p.name} />
            <span className="dm-bt-card-name">{p.name}</span>
          </div>
        ))}
      </div>
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
