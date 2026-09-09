"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RosterPick } from "@/lib/draftmasters/engine";
import { cardFor, captainAura, captainNote, hasCommand, type Card } from "@/lib/draftmasters/battle";
import Icon from "./Icon";
import Scene, { SceneDefs } from "./Scene";
import type { PortraitMap } from "./types";

/**
 * The screen between the draft and the fight.
 *
 * The draft decides WHO you have. This decides what they do with it, and it is
 * the only place in the game where a player makes a plan rather than a
 * purchase:
 *
 *   THE ORDER. Who stands in front. Measured across six hundred simulated
 *   drafts, leading with your cheap cards while the other side leads with
 *   monsters costs about seven points of win rate — the single biggest lever
 *   in the game, and until now it was set at random by draft order.
 *
 *   THE CAPTAIN. One card who does not fight while anybody else is standing.
 *   They lend the line their numbers, sometimes one of their tricks, and
 *   sometimes the ability to pull somebody out of a losing matchup — and they
 *   only take the field when they are the last one left. Which is why naming
 *   your best card captain is a real cost, and why Olenna Tyrell, who has never
 *   won a fight, is one of the best cards in the game.
 *
 * It is BLIND. Both players do this at the same time and neither sees the
 * other's until the first blow lands, so you are planning against a guess.
 *
 * Sixty seconds, then it locks whatever is on the table. A timer here is not
 * pressure for its own sake — without one, a four-card ordering puzzle with
 * perfect information becomes a solved problem somebody sits and solves.
 */

const SECONDS = 60;

export interface LineupResult {
  /** The line, in the order they fight. */
  order: RosterPick[];
  /** The one who holds it together from behind. */
  captain: RosterPick | null;
}

/** The card's own face, or the board's scene if we never found one. */
function Face({ pick, packId, portraits }: { pick: RosterPick; packId: string; portraits: PortraitMap }) {
  const url = portraits[pick.imgQuery];
  if (!url) return <Scene pack={packId} className="dm-lc-art" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="dm-lc-art" />;
}

export default function LineupScreen({
  roster,
  packId,
  portraits,
  onConfirm,
}: {
  roster: RosterPick[];
  packId: string;
  /** Keyed by imgQuery, same map the draft table and the battle use. */
  portraits: PortraitMap;
  onConfirm: (result: LineupResult) => void;
}) {
  const [order, setOrder] = useState<RosterPick[]>(() => roster.slice(1));
  const [captain, setCaptain] = useState<RosterPick | null>(() => roster[0] ?? null);
  const [left, setLeft] = useState(SECONDS);
  const [held, setHeld] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const doneRef = useRef(false);

  const confirm = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onConfirm({ order, captain });
  }, [onConfirm, order, captain]);

  // The clock. Locks whatever is on the table rather than nagging.
  useEffect(() => {
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          confirm();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [confirm]);

  /** Cards are built once per pick so the stat line never recomputes mid-drag. */
  const cards = useMemo(() => {
    const m = new Map<string, Card>();
    for (const p of roster) {
      m.set(
        p.name + (p.variant ?? ""),
        cardFor(
          { name: p.name, variant: p.variant, baseTier: p.tier, tier: p.tier, grade: p.variantGrade },
          packId
        )
      );
    }
    return m;
  }, [roster, packId]);

  const cardOf = (p: RosterPick) => cards.get(p.name + (p.variant ?? ""));
  const key = (p: RosterPick) => p.name + (p.variant ?? "");

  const aura = captain ? captainAura(cardOf(captain)!) : null;

  /**
   * Dragging, on pointer events rather than HTML5 drag-and-drop.
   *
   * HTML5 hands you a translucent browser-drawn ghost you cannot style, no say
   * in what the row does while you are holding a card, and nothing at all on
   * touch. This screen is mostly feel, so it is worth owning outright.
   */
  const onPointerDown = (e: React.PointerEvent, p: RosterPick) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    setHeld(key(p));
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!held || !rowRef.current) return;
    const slots = Array.from(rowRef.current.querySelectorAll<HTMLElement>("[data-slot]"));
    let to = slots.length;
    for (let i = 0; i < slots.length; i++) {
      const b = slots[i].getBoundingClientRect();
      if (e.clientX < b.left + b.width / 2) { to = i; break; }
    }
    setOrder((cur) => {
      const from = cur.findIndex((x) => key(x) === held);
      if (from < 0) return cur;
      const target = to > from ? to - 1 : to;
      if (target === from) return cur;
      const next = cur.slice();
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const promote = (p: RosterPick) => {
    setOrder((cur) => {
      const rest = cur.filter((x) => key(x) !== key(p));
      return captain ? [...rest, captain] : rest;
    });
    setCaptain(p);
  };

  const ring = 2 * Math.PI * 18;
  const on = (ring * left) / SECONDS;

  return (
    <div className="dm-lineup">
      <SceneDefs />

      <div className="dm-lineup-top">
        <div className="dm-lineup-clock">
          <span className="dm-ring">
            <svg viewBox="0 0 42 42" width="46" height="46">
              <circle className="bg" cx="21" cy="21" r="18" fill="none" strokeWidth="3" />
              <circle
                className="fg" cx="21" cy="21" r="18" fill="none" strokeWidth="3"
                strokeDasharray={`${on.toFixed(1)} ${ring.toFixed(1)}`}
              />
            </svg>
            <b>{left}</b>
          </span>
          <p>
            <b>Locks in {left} second{left === 1 ? "" : "s"}</b>
            Whatever is on the table when it hits zero is what fights.
          </p>
        </div>
      </div>

      <p className="dm-eyebrow dm-lineup-label">The line — first one up fights first</p>
      <div
        className="dm-row4"
        ref={rowRef}
        onPointerMove={onPointerMove}
        onPointerUp={() => setHeld(null)}
        onPointerCancel={() => setHeld(null)}
      >
        {order.map((p, i) => {
          const c = cardOf(p)!;
          return (
            <div
              key={key(p)}
              data-slot={i}
              className="dm-lc"
              data-held={held === key(p) ? "1" : "0"}
              onPointerDown={(e) => onPointerDown(e, p)}
            >
              <span className="dm-lc-in">
                <Face pick={p} packId={packId} portraits={portraits} />
                <span className="dm-lc-veil" />
                <span className="dm-lc-txt">
                  <b>{p.name}</b>
                  <i>{c.atk}/{c.def}</i>
                  <s>{i === 0 ? "leads" : c.rush > 0 ? `rushdown ${c.rush}` : c.fx[0]?.label ?? ""}</s>
                </span>
              </span>
              <span className="dm-lc-pos">{i + 1}</span>
              <button
                type="button"
                className="dm-lc-promote"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => promote(p)}
              >
                Make captain
              </button>
            </div>
          );
        })}
      </div>

      <div className="dm-behind"><span>behind the line</span></div>

      <div className="dm-capwrap">
        {captain ? (
          <>
            <div className="dm-lc dm-lc-cap">
              <span className="dm-lc-crown"><Icon name="crown" size={17} /></span>
              <span className="dm-lc-in">
                <Face pick={captain} packId={packId} portraits={portraits} />
                <span className="dm-lc-veil" />
                <span className="dm-lc-txt">
                  <b>{captain.name}</b>
                  <i>{cardOf(captain)!.atk}/{cardOf(captain)!.def}</i>
                  <s>Captain</s>
                </span>
              </span>
            </div>
            <div className="dm-cmdbar" data-command={hasCommand(cardOf(captain)!) ? "1" : "0"}>
              <b>{aura?.label}</b>
              {captainNote(cardOf(captain)!)}
            </div>
          </>
        ) : (
          <p className="dm-waiting">Pick anyone as captain.</p>
        )}
      </div>

      <button type="button" className="dm-btn dm-btn-primary dm-btn-lg dm-lineup-go" onClick={confirm}>
        CONFIRM TEAM
      </button>
    </div>
  );
}
