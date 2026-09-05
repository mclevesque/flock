"use client";

import { useEffect, useRef, useState } from "react";
import { maxBid, type Rules, type Side } from "@/lib/draftmasters/engine";
import { sfx } from "@/lib/draftmasters/sfx";
import type { GameView, PortraitMap } from "./types";

/**
 * The auction stage — one lot under a spotlight, a draining clock, and the
 * two things a bidder actually needs to see: what it costs right now, and the
 * most they're allowed to spend.
 */

interface Props {
  view: GameView;
  rules: Rules;
  meId: string;
  portraits: PortraitMap;
  speaking: Set<string>;
  packName: string;
  onBid: (amount: number) => void;
  onPass: () => void;
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
}: Props) {
  const me = view.sides.find((s) => s.id === meId) ?? null;
  const others = view.sides.filter((s) => s.id !== meId);
  const lot = view.lot;

  const remaining = useCountdown(view.deadline, view.phase === "bidding");
  const total = view.currentBid > 0 ? rules.bidSeconds : rules.openSeconds;
  const pct = Math.max(0, Math.min(100, (remaining / (total * 1000)) * 100));
  const urgent = remaining <= 3200 && view.phase === "bidding";

  // Quiet countdown ticks over the last few seconds only.
  const lastTickRef = useRef(-1);
  useEffect(() => {
    if (view.phase !== "bidding") {
      lastTickRef.current = -1;
      return;
    }
    const secs = Math.ceil(remaining / 1000);
    if (secs <= 5 && secs > 0 && secs !== lastTickRef.current) {
      lastTickRef.current = secs;
      sfx.tick(secs <= 3);
    }
  }, [remaining, view.phase]);

  const myMax = me ? maxBid(me, rules) : 0;
  const iAmFull = me ? me.roster.length >= rules.rosterSize : false;
  const iHoldBid = view.highBidderId === meId;
  const isOpening = view.currentBid === 0;
  const iCanOpen = isOpening && view.openerId === meId && myMax >= 1;
  const iCanRaise = !isOpening && !iHoldBid && myMax >= view.currentBid + 1;
  const openerName = view.sides.find((s) => s.id === view.openerId)?.name ?? "the other side";
  const holderName = view.sides.find((s) => s.id === view.highBidderId)?.name ?? "";

  const lastPick = lastSoldId(view);

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
                  {view.highBidderId
                    ? `${holderName} — $${view.currentBid}`
                    : "Nobody wanted them"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Clock ────────────────────────────────────────────────────── */}
        {view.phase === "bidding" && (
          <div className="dm-timer">
            <div className="dm-timer-track">
              <div
                className="dm-timer-fill"
                data-urgent={urgent ? "1" : "0"}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="dm-timer-label">
              <span>
                {isOpening
                  ? view.openerPassed
                    ? "Last chance to open"
                    : "Opening rights"
                  : "Going once…"}
              </span>
              <span className="dm-money">{Math.ceil(remaining / 1000)}s</span>
            </div>
          </div>
        )}

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
              {view.phase === "sold"
                ? " "
                : iCanOpen
                  ? "Your call — open the bidding or pass"
                  : `${openerName} has the opening bid`}
            </div>
          )}
        </div>

        {/* ── Controls ─────────────────────────────────────────────────── */}
        {view.phase === "bidding" && (
          <div className="dm-controls">
            {iAmFull ? (
              <div className="dm-waiting">Your roster is full — you&apos;re out of the bidding.</div>
            ) : iCanOpen ? (
              <div className="dm-quickbids">
                <button className="dm-quickbid" onClick={() => onBid(1)}>
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
            ) : iCanRaise ? (
              <RaiseControls currentBid={view.currentBid} myMax={myMax} onBid={onBid} />
            ) : iHoldBid ? (
              <div className="dm-waiting">
                You hold the bid at <strong className="dm-money">${view.currentBid}</strong> — waiting
                on {others[0]?.name ?? "the other side"}.
              </div>
            ) : isOpening ? (
              <div className="dm-waiting">Waiting for {openerName} to open…</div>
            ) : (
              <div className="dm-waiting">
                ${view.currentBid} is past your limit of ${myMax}. They&apos;ve got this one.
              </div>
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
              isOpener={view.openerId === side.id && view.currentBid === 0 && view.phase === "bidding"}
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
  onBid,
}: {
  currentBid: number;
  myMax: number;
  onBid: (n: number) => void;
}) {
  const steps = [1, 2, 5];
  return (
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
  );
}

// ── Score card ───────────────────────────────────────────────────────────────

function ScoreCard({
  side,
  rules,
  isMe,
  isOpener,
  holdsBid,
  speaking,
  portraits,
  newPickId,
}: {
  side: Side;
  rules: Rules;
  isMe: boolean;
  isOpener: boolean;
  holdsBid: boolean;
  speaking: boolean;
  portraits: PortraitMap;
  newPickId: string | null;
}) {
  const cap = maxBid(side, rules);
  const slotsLeft = rules.rosterSize - side.roster.length;

  return (
    <div className="dm-score" data-turn={isOpener ? "1" : "0"} data-high={holdsBid ? "1" : "0"}>
      <div className="dm-score-top">
        {side.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="dm-avatar"
            data-speaking={speaking ? "1" : "0"}
            src={side.avatarUrl}
            alt=""
          />
        ) : (
          <div className="dm-avatar" data-speaking={speaking ? "1" : "0"}>
            {side.isNpc ? "🤖" : side.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="dm-score-name">{isMe ? "You" : side.name}</div>
      </div>

      <div className="dm-score-budget dm-money">${side.budget}</div>
      <div className="dm-score-meta">
        {slotsLeft > 0 ? (
          <>
            max bid <span className="dm-money">${cap}</span> · {slotsLeft} slot
            {slotsLeft === 1 ? "" : "s"} left
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

// ── Portrait with graceful failure ───────────────────────────────────────────

/**
 * Portraits come from the open web, so their shapes are unpredictable.
 *
 *  • Portrait-ish (roughly 0.6–1.05) fills the card edge to edge, biased
 *    upward — heads sit in the top third of almost every photo, so a centred
 *    crop is what cuts them off.
 *  • Anything else (wide stills, tall strips) is letterboxed onto a blurred
 *    copy of itself. Nothing gets cropped, and the card still looks filled.
 */
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

  // Assume a good crop until the image reports otherwise — avoids a visible
  // reflow on the common case.
  const letterbox = ratio !== null && (ratio > 1.05 || ratio < 0.6);

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setRatio(img.naturalWidth / img.naturalHeight);
    }
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Ticks at ~15fps off an absolute deadline so tab-throttling can't desync it. */
function useCountdown(deadline: number, active: boolean): number {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));

  useEffect(() => {
    if (!active) {
      setRemaining(Math.max(0, deadline - Date.now()));
      return;
    }
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 66) {
        last = t;
        setRemaining(Math.max(0, deadline - Date.now()));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [deadline, active]);

  return remaining;
}

/**
 * The pick that just landed, so its roster slot can pop in.
 * During the "sold" reveal that's the lot on the block — which is exactly the
 * one that was added to somebody's shelf a moment ago.
 */
function lastSoldId(view: GameView): string | null {
  if (view.phase !== "sold" || !view.lot) return null;
  return view.lot.id;
}
