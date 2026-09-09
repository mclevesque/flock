"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
 * The battle, as a story.
 *
 * The old screen put two big cards in the middle with a health bar, a stat box
 * and a caption, and it asked the player to hold four numbers in their head to
 * follow a fight. It also showed the same fact twice -- defence IS the health
 * -- which is confusing no matter how it is labelled.
 *
 * So: both rosters laid out horizontally, top and bottom, exactly as they are
 * at the draft table, and the fight itself told as prose between them. A card
 * is crossed out the moment the story reaches its death. When one side has
 * nobody left, the other side won -- which you can see, rather than read in a
 * headline.
 *
 * WHAT DECIDES THE FIGHT IS NOT THIS SCREEN AND NOT THE MODEL. The battle is
 * resolved before a word of this is written; the beats are a settled list. The
 * prose is written from that list, by a model when one is reachable and by the
 * offline narrator when it is not, and the crossings-out are keyed to the
 * beats rather than to the sentences, so a model that waxes lyrical cannot
 * change who died.
 */

interface Props {
  script: BattleScript;
  sides: Side[];
  rules: Rules;
  meId: string;
  portraits: PortraitMap;
  packName: string;
  arena?: string | null;
  onDone: () => void;
}

/** "Jaime Lannister (one hand)" -> "Jaime Lannister". */
const BARE = (n: string) => n.replace(/\s*\(.*\)\s*$/, "");

/** How long a paragraph holds before the next one arrives. */
const LINE_MS = 2100;
const LINE_MS_MIN = 900;

export default function BattleStory({
  script,
  sides,
  rules,
  meId,
  portraits,
  packName,
  arena,
  onDone,
}: Props) {
  const beats = script.beats;

  /** One paragraph of the fight, and whoever it kills. */
  type Told = { text: string; kills: string[]; big: boolean };

  /**
   * The fight the local resolver already worked out.
   *
   * Available instantly, so the battle starts the moment the screen opens and
   * nothing waits on a network call. If the model answers, its telling
   * replaces this; if it does not, this IS the telling.
   */
  const offline = useMemo<Told[]>(
    () =>
      beats
        .filter((x) => x.story || x.eliminated?.length)
        .map((x) => ({
          text: x.text,
          kills: (x.eliminated ?? []).map(BARE),
          big: !!x.eliminated?.length || x.intensity >= 2,
        })),
    [beats]
  );

  const [told, setTold] = useState<Told[]>([]);
  /** Waiting on the telling. The rosters are up; the page is not. */
  const [writing, setWriting] = useState(true);
  const [shown, setShown] = useState(0);
  const [paused, setPaused] = useState(false);
  const [wonBy, setWonBy] = useState<string>(script.winnerId);
  const log = useRef<HTMLDivElement>(null);



  // ── The model's version, if it comes ──────────────────────────────────────
  useEffect(() => {
    let dropped = false;
    (async () => {
      try {
        const res = await fetch("/api/draftmasters/tell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            arena,
            sides: sides.map((s) => ({
              id: s.id,
              name: s.id === meId ? "You" : s.name,

              cards: s.roster.map((p) => {
                const c = cardFor(
                  { name: p.name, variant: p.variant, baseTier: p.tier, tier: p.tier, grade: p.variantGrade },
                  script.boardId
                );
                return {
                  name: p.name,
                  variant: p.variant,
                  grade: p.variantGrade,
                  // Only the named tricks. The model does not need our numbers
                  // and it does need to know that this one strikes first.
                  abilities: c.fx.map((f) => f.label),
                };
              }),
            })),
          }),
        });
        const data = (await res.json()) as {
          beats?: { text: string; kills?: string[] }[];
          winner?: string;
        };
        if (dropped) return;
        if (data.beats?.length) {
          setTold(
            data.beats.map((x) => ({
              text: x.text,
              kills: (x.kills ?? []).map(BARE),
              big: !!x.kills?.length,
            }))
          );
          if (data.winner) setWonBy(data.winner);
        } else {
          // No model, no key, or a refusal. The fight was already resolved
          // locally, so there is a telling in hand either way.
          setTold(offline);
        }
      } catch {
        setTold(offline);
      } finally {
        if (!dropped) setWriting(false);
      }
    })();
    return () => { dropped = true; };
  }, [sides, meId, script.boardId, script.winnerId, arena]);

  // ── Pacing ────────────────────────────────────────────────────────────────
  const finished = !writing && shown >= told.length;

  useEffect(() => {
    if (writing || paused || finished || !told.length) return;
    const words = told[shown]?.text.split(/\s+/).length ?? 12;
    const ms = Math.max(LINE_MS_MIN, Math.min(4200, LINE_MS + words * 55));
    const t = setTimeout(() => setShown((n) => n + 1), ms);
    return () => clearTimeout(t);
  }, [shown, paused, finished, told]);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
    const t = told[shown - 1];
    if (t?.kills.length) battleHit(0.85);

    // The walk-out is quiet, the middle builds, and the end is the loudest
    // thing in it. A death spikes above that line rather than replacing it.
    const through = told.length ? shown / told.length : 0;
    const build = 0.22 + through * 0.55;
    setBattleIntensity(Math.min(1, build + (t?.kills.length ? 0.25 : 0)));
  }, [shown, told]);

  useEffect(() => {
    if (!isMuted()) startBattleMusic();
    return () => stopBattleMusic();
  }, []);

  // The last card falls and the music says so.
  const rung = useRef(false);
  useEffect(() => {
    if (!finished || rung.current) return;
    rung.current = true;
    if (!isMuted()) victoryFanfare();
  }, [finished]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        finished ? onDone() : setShown((n) => n + 1);
      } else if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, onDone]);

  /** Everyone the story has already killed. */
  const dead = useMemo(() => {
    const out = new Set<string>();
    for (let i = 0; i < shown && i < told.length; i++) {
      told[i].kills.forEach((n) => out.add(n));
    }
    return out;
  }, [shown, told]);

  const mine = sides.find((s) => s.id === meId) ?? sides[0];
  const theirs = sides.find((s) => s.id !== mine?.id);
  const lineFor = (id?: string) => (id ? script.lineup?.find((l) => l.sideId === id) : undefined);

  const winnerSide = sides.find((s) => s.id === wonBy);
  const winnerName = wonBy === meId ? "You" : winnerSide?.name ?? "They";
  /** Who the winner has left, for the line under the name. */
  const survivors = (winnerSide?.roster ?? [])
    .filter((p) => !dead.has(p.name))
    .map((p) => p.name);

  return (
    <div className="dm-st" onClick={() => (finished ? onDone() : setShown((n) => n + 1))}>
      <SceneDefs />
      {/* The board's own landscape, behind everything. Same drawing as the
          case on the shelf, so the fight is visibly happening in the world
          you picked. */}
      <div className="dm-st-ground" aria-hidden="true">
        <Scene pack={script.boardId ?? "custom"} className="dm-st-scene" />
      </div>
      <div className="dm-st-top" onClick={(e) => e.stopPropagation()}>
        <span className="dm-st-where">
          {packName}
          {arena && <em>{arena}</em>}
        </span>
        <div className="dm-st-controls">
          <button className="dm-btn dm-btn-ghost dm-bt-mini" onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button className="dm-btn dm-btn-ghost dm-bt-mini" onClick={onDone}>Skip</button>
        </div>
      </div>

      {/* Theirs on top, yours underneath, the way the draft table sits. */}
      <Bench
        side={theirs}
        dead={dead}
        portraits={portraits}
        rules={rules}
        boardId={script.boardId}
        lineup={lineFor(theirs?.id)}
        label={theirs?.name ?? "Them"}
        align="top"
      />

      <div className="dm-st-page" ref={log}>
        {writing && (
          <p className="dm-st-writing">
            <span /><span /><span />
          </p>
        )}
        {/* Only the last few, each further back than the one in front. A
            growing list is a transcript; this is meant to be listened to. */}
        {told.slice(Math.max(0, shown - 4), shown).map((t, i, arr) => (
          <p
            key={shown - arr.length + i}
            data-kill={t.kills.length ? "1" : "0"}
            data-back={arr.length - 1 - i}
          >
            {t.text}
          </p>
        ))}
        {!finished && <p className="dm-st-more" aria-hidden="true">…</p>}
      </div>

      <Bench
        side={mine}
        dead={dead}
        portraits={portraits}
        rules={rules}
        boardId={script.boardId}
        lineup={lineFor(mine?.id)}
        label="You"
        align="bottom"
      />

      {finished && (
        <div className="dm-st-win" onClick={(e) => e.stopPropagation()}>
          <div className="dm-st-win-in">
            <span className="dm-st-win-crown"><Icon name="crown" size={22} /></span>
            <h2 className="dm-st-win-name">{winnerName} wins!</h2>
            <p className="dm-st-win-left">
              {survivors.length === 0
                ? "Nobody left standing on either side."
                : survivors.length === 1
                  ? `${survivors[0]} is the last one standing.`
                  : `${survivors.length} still standing: ${survivors.join(", ")}.`}
            </p>
            <button className="dm-btn dm-btn-primary dm-btn-lg" onClick={onDone}>
              See the full verdict
            </button>
          </div>
        </div>
      )}

      {!finished && <div className="dm-st-hint">tap, space or → for the next beat</div>}
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
  boardId,
  lineup,
  label,
  align,
}: {
  side: Side | undefined;
  dead: Set<string>;
  portraits: PortraitMap;
  rules: Rules;
  boardId?: string;
  lineup?: { order: string[]; captain: string | null };
  label: string;
  align: "top" | "bottom";
}) {
  if (!side) return <div className="dm-st-bench" data-align={align} />;

  const byName = new Map(side.roster.map((p) => [p.name, p]));
  const line = lineup?.order.length
    ? lineup.order.map((n) => byName.get(n)).filter(Boolean)
    : side.roster.filter((p) => p.name !== lineup?.captain);
  const captain = lineup?.captain ? byName.get(lineup.captain) : undefined;
  const ordered = [...line, ...(captain ? [captain] : [])];
  const standing = side.roster.filter((p) => !dead.has(p.name)).length;

  return (
    <div className="dm-st-bench" data-align={align}>
      <span className="dm-st-who">
        {label}
        <b>{standing}/{side.roster.length || rules.rosterSize}</b>
      </span>

      <div className="dm-st-cards">
        {ordered.map((p, i) => {
          if (!p) return null;
          const isCap = captain?.name === p.name;
          return (
            <figure
              key={p.id}
              className="dm-st-card"
              data-dead={dead.has(p.name) ? "1" : "0"}
              data-cap={isCap ? "1" : "0"}
              title={p.variant ? `${p.name} — ${p.variant}` : p.name}
            >
              <span className="dm-st-art">
                {portraits[p.imgQuery] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={portraits[p.imgQuery]!} alt="" />
                ) : (
                  <span className="dm-st-initial">{p.name.charAt(0)}</span>
                )}
                {isCap && <span className="dm-st-cap"><Icon name="crown" size={11} /></span>}
                {!isCap && <span className="dm-st-ord">{i + 1}</span>}
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
