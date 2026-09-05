"use client";

import { useEffect, useRef, useState } from "react";
import { canMatch, canOpen, canRaise, maxBid, type Rules, type Side } from "@/lib/draftmasters/engine";
import type { DiceState, GameView, PortraitMap } from "./types";

/**
 * The auction stage — one lot under a spotlight and the two things a bidder
 * needs: what it costs right now, and whose move it is. No clock. A lot only
 * resolves when someone decides, so a dropped connection can't cost you a pick.
 */

const SOLD_REVEAL_MS = 3000;
const DICE_TIE_MS = 1900;
const DICE_WIN_MS = 1700;

interface Props {
  view: GameView;
  rules: Rules;
  meId: string;
  portraits: PortraitMap;
  speaking: Set<string>;
  packName: string;
  onBid: (amount: number) => void;
  onPass: () => void;
  onMatch: () => void;
  /** Called once the sold reveal or a tied dice round has played out */
  onAdvance: () => void;
}

export default function AuctionStage({
  view,
  rules,
  meId,
  portraits,
  speaking,
  packName,
  onBid,
  onPass,
  onMatch,
  onAdvance,
}: Props) {
  const me = view.sides.find((s) => s.id === meId) ?? null;
  const other = view.sides.find((s) => s.id !== meId) ?? null;
  const lot = view.lot;

  const myTurn = view.phase === "bidding" && view.turnId === meId;
  const myMax = me ? maxBid(me, rules) : 0;
  const iAmFull = me ? me.roster.length >= rules.rosterSize : false;
  const iHoldBid = view.highBidderId === meId;
  const isOpening = view.currentBid === 0;
  const holderName = view.sides.find((s) => s.id === view.highBidderId)?.name ?? "";
  const turnName = view.sides.find((s) => s.id === view.turnId)?.name ?? "the other side";

  const iCanOpen = me ? canOpen(me, rules) : false;
  const iCanRaise = me ? canRaise(me, rules, view.currentBid) : false;
  const iCanMatch = me ? canMatch(me, rules, view.currentBid) : false;

  // Client-driven progression. The reveal is cosmetic; when it's done we tell
  // the game to move on. In PvP both clients do this and the server takes the
  // first, so a client that never sees the reveal can't stall the room.
  const advanceRef = useRef(onAdvance);
  advanceRef.current = onAdvance;
  useEffect(() => {
    if (view.phase === "sold") {
      const t = setTimeout(() => advanceRef.current(), SOLD_REVEAL_MS);
      return () => clearTimeout(t);
    }
    if (view.phase === "dice" && view.dice) {
      // Tie: reroll once the tie has been seen. Winner: let the die sit,
      // then finish. Either way the game only moves when a client says so.
      const t = setTimeout(
        () => advanceRef.current(),
        view.dice.winnerId === null ? DICE_TIE_MS : DICE_WIN_MS
      );
      return () => clearTimeout(t);
    }
  }, [view.phase, view.dice, view.lot?.id]);

  const lastPick = view.phase === "sold" && lot ? lot.id : null;

  return (
    <div className="dm-stage">
      <div className="dm-block">
        <div className="dm-lotbar">
          <span>
            <strong>{packName}</strong>
          </span>
          <span>{view.lotsRemaining} left on the board</span>
        </div>

        {/* ── Portrait ─────────────────────────────────────────────────── */}
        <div className="dm-portrait-wrap" data-in={view.phase === "bidding" ? "1" : "0"} key={lot?.id}>
          {lot ? (
            <Portrait url={portraits[lot.imgQuery] ?? null} name={lot.name} />
          ) : (
            <div className="dm-portrait-fallback">—</div>
          )}
          <div className="dm-portrait-vignette" />
          {lot && (
            <div className="dm-portrait-caption">
              <h2 className="dm-lot-name">{lot.name}</h2>
              {lot.variant && <span className="dm-lot-variant">{lot.variant}</span>}
            </div>
          )}

          {view.phase === "sold" && (
            <div className="dm-sold-stamp">
              <div style={{ textAlign: "center" }}>
                <div className="dm-sold-text" data-kind={view.highBidderId ? "sold" : "passed"}>
                  {view.highBidderId ? "Sold" : "Passed"}
                </div>
                <div className="dm-sold-sub">
                  {view.highBidderId ? `${holderName} — $${view.currentBid}` : "Nobody wanted them"}
                </div>
              </div>
            </div>
          )}

          {view.phase === "dice" && view.dice && (
            <DiceOverlay dice={view.dice} sides={view.sides} meId={meId} />
          )}
        </div>

        {/* ── Money readout ────────────────────────────────────────────── */}
        <div className="dm-bidbar">
          {view.currentBid > 0 ? (
            <>
              <div className="dm-bid-amount dm-money">${view.currentBid}</div>
              <div className="dm-bid-holder">
                {iHoldBid ? (
                  <>
                    <strong>You</strong> hold the bid
                  </>
                ) : (
                  <>
                    <strong>{holderName}</strong> holds the bid
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="dm-bid-open">
              {view.phase !== "bidding"
                ? " "
                : myTurn
                  ? view.passedIds.length
                    ? "They passed — it's yours for $1 if you want it"
                    : "Your call — open the bidding or pass"
                  : `${turnName} has the opening bid`}
            </div>
          )}
        </div>

        {/* ── Controls ─────────────────────────────────────────────────── */}
        {view.phase === "bidding" && (
          <div className="dm-controls">
            {iAmFull ? (
              <div className="dm-waiting">Your roster is full — you&apos;re out of the bidding.</div>
            ) : !myTurn ? (
              <div className="dm-waiting">
                {iHoldBid ? (
                  <>
                    You hold the bid at <strong className="dm-money">${view.currentBid}</strong> —{" "}
                    {other?.name ?? "they"} decide.
                  </>
                ) : (
                  <>Waiting for {turnName}…</>
                )}
              </div>
            ) : isOpening ? (
              <div className="dm-quickbids">
                <button className="dm-quickbid" onClick={() => onBid(1)} disabled={!iCanOpen}>
                  $1<small>Open</small>
                </button>
                <button
                  className="dm-quickbid"
                  onClick={() => onBid(Math.min(3, myMax))}
                  disabled={myMax < 3}
                >
                  $3<small>Open strong</small>
                </button>
                <button className="dm-quickbid" onClick={onPass}>
                  Pass<small>Let it go</small>
                </button>
              </div>
            ) : (
              <RaiseControls
                currentBid={view.currentBid}
                myMax={myMax}
                canRaise={iCanRaise}
                canMatch={iCanMatch}
                onBid={onBid}
                onPass={onPass}
                onMatch={onMatch}
              />
            )}
          </div>
        )}

        {view.phase === "complete" && (
          <div className="dm-waiting" style={{ marginTop: 16 }}>
            Board&apos;s done. Time to find out who drafted better.
          </div>
        )}
      </div>

      {/* ── Right rail ─────────────────────────────────────────────────── */}
      <div className="dm-block">
        <div className="dm-scores">
          {view.sides.map((side) => (
            <ScoreCard
              key={side.id}
              side={side}
              rules={rules}
              isMe={side.id === meId}
              isTurn={view.phase === "bidding" && view.turnId === side.id}
              holdsBid={view.highBidderId === side.id}
              speaking={speaking.has(side.id)}
              portraits={portraits}
              newPickId={lastPick}
            />
          ))}
        </div>

        <div className="dm-ticker" aria-live="polite">
          {[...view.ticker].reverse().map((e) => (
            <div key={e.id} className="dm-ticker-line" data-kind={e.kind}>
              {e.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Raise controls ───────────────────────────────────────────────────────────

function RaiseControls({
  currentBid,
  myMax,
  canRaise,
  canMatch,
  onBid,
  onPass,
  onMatch,
}: {
  currentBid: number;
  myMax: number;
  canRaise: boolean;
  canMatch: boolean;
  onBid: (n: number) => void;
  onPass: () => void;
  onMatch: () => void;
}) {
  const steps = [1, 2, 5];
  return (
    <>
      {canRaise && (
        <>
          <div className="dm-quickbids">
            {steps.map((step) => {
              const amount = currentBid + step;
              return (
                <button
                  key={step}
                  className="dm-quickbid"
                  disabled={amount > myMax}
                  onClick={() => onBid(amount)}
                >
                  ${amount}
                  <small>+{step}</small>
                </button>
              );
            })}
          </div>
          <button
            className="dm-btn dm-btn-primary dm-btn-block"
            disabled={myMax <= currentBid}
            onClick={() => onBid(myMax)}
          >
            All in — ${myMax}
          </button>
        </>
      )}

      {canMatch && (
        <button className="dm-btn dm-btn-primary dm-btn-block dm-btn-lg" onClick={onMatch}>
          🎲 Match ${currentBid} and roll for it
        </button>
      )}

      {!canRaise && !canMatch && (
        <div className="dm-waiting">
          ${currentBid} is past your limit of ${myMax}. Pass to let them have it.
        </div>
      )}

      <button className="dm-btn dm-btn-ghost dm-btn-block" onClick={onPass}>
        Pass — let them have it
      </button>
    </>
  );
}

// ── Dice overlay ─────────────────────────────────────────────────────────────

const DIE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function DiceOverlay({ dice, sides, meId }: { dice: DiceState; sides: Side[]; meId: string }) {
  const round = dice.rounds[dice.rounds.length - 1];
  const [a, b] = dice.sideIds;
  const nameOf = (id: string) => (id === meId ? "You" : (sides.find((s) => s.id === id)?.name ?? "—"));
  const tie = round && round.a === round.b;
  const winner = dice.winnerId ? nameOf(dice.winnerId) : null;

  return (
    <div className="dm-sold-stamp" data-dice="1">
      <div style={{ textAlign: "center", padding: 12 }}>
        <div className="dm-eyebrow" style={{ color: "var(--dm-gold)" }}>
          {dice.reason === "verdict" ? "Judge has it even — dice decide" : `Even at $${dice.price} — dice decide`}
        </div>
        <div className="dm-dice-row" key={dice.rounds.length}>
          <div className="dm-die">
            <span className="dm-die-face">{round ? DIE[round.a] : "🎲"}</span>
            <span className="dm-die-name">{nameOf(a)}</span>
          </div>
          <span className="dm-die-vs">vs</span>
          <div className="dm-die">
            <span className="dm-die-face">{round ? DIE[round.b] : "🎲"}</span>
            <span className="dm-die-name">{nameOf(b)}</span>
          </div>
        </div>
        <div className="dm-sold-sub">
          {winner
            ? `${winner} ${winner === "You" ? "win" : "wins"} the roll${dice.rounds.length > 1 ? ` (after ${dice.rounds.length - 1} tie${dice.rounds.length > 2 ? "s" : ""})` : ""}`
            : tie
              ? `${round.a}–${round.b} — tie! Rolling again…`
              : "Rolling…"}
        </div>
      </div>
    </div>
  );
}

// ── Score card ───────────────────────────────────────────────────────────────

function ScoreCard({
  side,
  rules,
  isMe,
  isTurn,
  holdsBid,
  speaking,
  portraits,
  newPickId,
}: {
  side: Side;
  rules: Rules;
  isMe: boolean;
  isTurn: boolean;
  holdsBid: boolean;
  speaking: boolean;
  portraits: PortraitMap;
  newPickId: string | null;
}) {
  const cap = maxBid(side, rules);
  const slotsLeft = rules.rosterSize - side.roster.length;

  return (
    <div className="dm-score" data-turn={isTurn ? "1" : "0"} data-high={holdsBid ? "1" : "0"}>
      <div className="dm-score-top">
        {side.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="dm-avatar" data-speaking={speaking ? "1" : "0"} src={side.avatarUrl} alt="" />
        ) : (
          <div className="dm-avatar" data-speaking={speaking ? "1" : "0"}>
            {side.isNpc ? "🤖" : side.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="dm-score-name">{isMe ? "You" : side.name}</div>
        {isTurn && <span className="dm-turn-pill">{isMe ? "Your move" : "Deciding…"}</span>}
      </div>

      <div className="dm-score-budget dm-money">${side.budget}</div>
      <div className="dm-score-meta">
        {slotsLeft > 0 ? (
          <>
            max bid <span className="dm-money">${cap}</span> · {slotsLeft} slot{slotsLeft === 1 ? "" : "s"} left
          </>
        ) : (
          "roster full"
        )}
      </div>

      <div className="dm-roster">
        {Array.from({ length: rules.rosterSize }).map((_, i) => {
          const pick = side.roster[i];
          if (!pick) return <div key={i} className="dm-slot" data-filled="0" />;
          const url = portraits[pick.imgQuery];
          return (
            <div
              key={i}
              className="dm-slot"
              data-filled="1"
              data-new={pick.id === newPickId ? "1" : "0"}
              title={`${pick.name}${pick.variant ? ` (${pick.variant})` : ""} — $${pick.price}`}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={pick.name} />
              ) : (
                <span className="dm-slot-initial">{pick.name.charAt(0)}</span>
              )}
              <span className="dm-slot-price dm-money">${pick.price}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Portrait with adaptive framing ───────────────────────────────────────────

function Portrait({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    setBroken(false);
    setRatio(null);
  }, [url]);

  if (!url || broken) {
    return <div className="dm-portrait-fallback">{name.charAt(0).toUpperCase()}</div>;
  }

  const letterbox = ratio !== null && (ratio > 1.05 || ratio < 0.6);

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
  };

  return (
    <>
      {letterbox && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="dm-portrait-blur" src={url} alt="" aria-hidden="true" referrerPolicy="no-referrer" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="dm-portrait"
        data-fit={letterbox ? "contain" : "cover"}
        src={url}
        alt={name}
        onLoad={onLoad}
        onError={() => setBroken(true)}
        referrerPolicy="no-referrer"
      />
    </>
  );
}
