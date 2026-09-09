"use client";

import { useEffect, useRef, useState } from "react";
import { canMatch, canOpen, canRaise, maxBid, openingBid, priceLabel, type Rules, type Side } from "@/lib/draftmasters/engine";
import Icon from "./Icon";
import type { VariantGrade } from "@/lib/draftmasters/packs";
import type { DiceState, GameView, PortraitMap } from "./types";

/** What each variant colour means, in one word and in a sentence. */
const GRADE_LABEL: Record<VariantGrade, string> = {
  crippling: "crippling",
  weakening: "weakened",
  neutral: "flavour",
  boon: "boosted",
  major: "major",
  legendary: "LEGENDARY",
  exalted: "EXALTED",
  mythic: "MYTHIC",
  uber: "UBER",
};

const GRADE_HINT: Record<VariantGrade, string> = {
  crippling: "Crippling — this guts them.",
  weakening: "Weakened — it hurts, but they're still themselves.",
  neutral: "Flavour — changes little. Probably just funny.",
  boon: "Boosted — helps a bit.",
  major: "Major — a real upgrade.",
  legendary: "LEGENDARY — helps enormously. Rationed to a couple per game.",
  exalted: "EXALTED — the best form they have short of myth.",
  mythic: "MYTHIC — game changing. Beats almost anything.",
  uber: "UBER — about one lot in five hundred. This does not lose.",
};

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
  /** Setting rolled for this game, shown beside the topic */
  arenaName?: string;
  /** What the rolled arena actually does to the fight. */
  arenaDesc?: string;
  /** The board's scenario, shown alongside it. */
  scenario?: string;
  onBid: (amount: number) => void;
  onPass: () => void;
  onMatch: () => void;
  /** Called once the sold reveal or a tied dice round has played out */
  onAdvance: () => void;
  /** Status line under the photo-feedback buttons */
  portraitNote: string | null;
  /** Keep this photo, or say it is the wrong person and swap in another. */
  onPortraitFeedback: (verdict: "good" | "bad") => void;
  /** A file picked for a character that has no photo anywhere */
  onPortraitUpload: (file: File) => void;
  /** Cameras and chat for a PvP room. Absent in solo — the feed fills that space. */
  media?: React.ReactNode;
}

export default function AuctionStage({
  view,
  rules,
  meId,
  portraits,
  speaking,
  packName,
  arenaName,
  arenaDesc,
  scenario,
  onBid,
  onPass,
  onMatch,
  onAdvance,
  portraitNote,
  onPortraitFeedback,
  onPortraitUpload,
  media,
}: Props) {
  const me = view.sides.find((s) => s.id === meId) ?? null;
  const other = view.sides.find((s) => s.id !== meId) ?? null;
  const lot = view.lot;

  const myTurn = view.phase === "bidding" && view.turnId === meId;
  const myMax = me ? maxBid(me, rules) : 0;
  const iAmFull = me ? me.roster.length >= rules.rosterSize : false;
  const iHoldBid = view.highBidderId === meId;
  // "Opening" means nobody has claimed it yet — a $0 claim still counts as a bid.
  const isOpening = !view.highBidderId;
  const openAmt = me ? openingBid(me, rules) : 1;
  const holderName = view.sides.find((s) => s.id === view.highBidderId)?.name ?? "";
  const turnName = view.sides.find((s) => s.id === view.turnId)?.name ?? "the other side";

  const iCanOpen = me ? canOpen(me, rules, other ?? undefined) : false;
  const iCanRaise = me ? canRaise(me, rules, view.currentBid) : false;
  const iCanMatch = me ? canMatch(me, rules, view.currentBid) : false;
  // Used the one free pass while drafting unopposed — this lot must fill a slot.
  const passLocked = view.passLocked.includes(meId);

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

  // No photo resolved for this lot — the card is a letter, and tapping it
  // opens a file picker so a human can just supply the right one.
  const hasPhoto = Boolean(lot && portraits[lot.imgQuery]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [arenaOpen, setArenaOpen] = useState(false);

  return (
    /* The desktop arena seats exactly two players across a table. Anything
       else keeps the plain stacked rail at every width. */
    <div className="dm-stage" data-arena={view.sides.length === 2 ? "1" : "0"}>
      {/* On desktop this block is the centre of the table — the lot, the price
          and the controls. On narrow screens it's simply the top of the stack. */}
      <div className="dm-block dm-stage-main">
        <div className="dm-lotbar">
          <span>
            <strong>{packName}</strong>
            {arenaName && (
              /* The pin used to be a label. The arena is rolled per game and
                 changes what a pick is worth — a flooded field is a different
                 auction — so the words behind it have to be reachable during
                 the bidding, not only on the prep screen you already left. */
              <button
                type="button"
                className="dm-arena-pill"
                data-open={arenaOpen ? "1" : "0"}
                style={{ marginLeft: 8 }}
                onClick={() => setArenaOpen((v) => !v)}
                aria-expanded={arenaOpen}
                title="What this arena means"
              >
                <Icon name="pin" size={13} />
                {arenaName}
              </button>
            )}
          </span>
        </div>

        {arenaOpen && arenaName && (
          <div className="dm-arena-note" role="note">
            <button
              type="button"
              className="dm-arena-note-x"
              onClick={() => setArenaOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
            <strong><Icon name="pin" size={13} /> {arenaName}</strong>
            {arenaDesc && <p>{arenaDesc}</p>}
            {scenario && <p className="dm-arena-note-scenario">{scenario}</p>}
          </div>
        )}

        {/* ── The lot card ─────────────────────────────────────────────────
            Portrait plus the photo-fixing row that belongs to it. Another
            `display: contents` wrapper — invisible on narrow screens, the left
            half of the centre in the desktop arena. */}
        <div className="dm-lot-card">
        {/* ── Portrait ─────────────────────────────────────────────────── */}
        <div
          className="dm-portrait-wrap"
          data-in={view.phase === "bidding" ? "1" : "0"}
          data-shiny={lot?.shiny ? "1" : undefined}
          /* Only the top of the ladder dresses the whole card. Everything
             below it is expressed by the chip alone, which is what keeps an
             uber from looking like a slightly better legendary. */
          data-grade={lot?.variantGrade === "uber" ? "uber" : undefined}
          data-uploadable={lot && !hasPhoto ? "1" : "0"}
          key={lot?.id}
          onClick={() => {
            if (lot && !hasPhoto) fileRef.current?.click();
          }}
          title={lot && !hasPhoto ? `Upload a photo for ${lot.name}` : undefined}
        >
          {lot ? (
            <Portrait url={portraits[lot.imgQuery] ?? null} name={lot.name} />
          ) : (
            <div className="dm-portrait-fallback">—</div>
          )}
          {lot && !hasPhoto && (
            <span className="dm-portrait-upload">
              <strong><Icon name="camera" size={15} /> Tap to add a photo</strong>
              <small>no picture found for {lot.name}</small>
            </span>
          )}
          <div className="dm-portrait-vignette" />
          {lot && (
            <div className="dm-portrait-caption">
              <h2 className="dm-lot-name">{lot.name}</h2>
              {lot.variant && (
                <span
                  className="dm-lot-variant"
                  data-grade={lot.variantGrade ?? "neutral"}
                  title={GRADE_HINT[lot.variantGrade ?? "neutral"]}
                >
                  {lot.variant}
                  <em className="dm-grade-tag">{GRADE_LABEL[lot.variantGrade ?? "neutral"]}</em>
                </span>
              )}
            </div>
          )}

          {view.phase === "sold" && (
            <div className="dm-sold-stamp">
              <div style={{ textAlign: "center" }}>
                <div className="dm-sold-text" data-kind={view.highBidderId ? "sold" : "passed"}>
                  {view.highBidderId ? "Sold" : "Passed"}
                </div>
                <div className="dm-sold-sub">
                  {view.highBidderId ? `${holderName} — ${priceLabel(view.currentBid)}` : "Nobody wanted them"}
                </div>
              </div>
            </div>
          )}

          {view.phase === "dice" && view.dice && (
            <DiceOverlay dice={view.dice} sides={view.sides} meId={meId} />
          )}
        </div>

        {/* ── Photo feedback ────────────────────────────────────────────── */}
        {lot && (view.phase === "bidding" || view.phase === "sold") && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="dm-sr"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPortraitUpload(f);
                e.target.value = ""; // let the same file be picked again
              }}
            />
            {/* The good/wrong/upload row used to sit here. Curating a
                picture is a calm, batch job and this is neither — it is
                the middle of an auction with a clock running. It all
                happens on the portrait studio page now. */}
            {portraitNote && <div className="dm-photo-note">{portraitNote}</div>}
          </>
        )}
        </div>

        {/* ── Money readout + controls ──────────────────────────────────
            Wrapper is `display: contents` on narrow screens, so the stack
            below the lot card is byte-for-byte what it always was. In the
            desktop arena it becomes the right half of the centre — price
            over controls, sitting beside the lot card rather than under it. */}
        <div className="dm-lot-actions">
        {/* The plain "your call" prompt repeats what the Open/Pass buttons
            underneath already say. Flagged so a phone can drop that one state
            and keep the bar for the ones carrying real information — the
            standing bid, the pass lock, whose turn it is. */}
        <div
          className="dm-bidbar"
          data-plain={
            !view.highBidderId &&
            view.phase === "bidding" &&
            myTurn &&
            !passLocked &&
            openAmt > 0 &&
            !view.passedIds.length
              ? "1"
              : undefined
          }
        >
          {view.highBidderId ? (
            <>
              <div className="dm-bid-amount dm-money">{view.currentBid > 0 ? `$${view.currentBid}` : "Free"}</div>
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
                  ? passLocked
                    ? "You used your pass — this one fills your slot"
                    : openAmt === 0
                      ? "You're out of money — claim it for free, or pass"
                      : view.passedIds.length
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
                    You hold the bid at <strong className="dm-money">{priceLabel(view.currentBid)}</strong> —{" "}
                    {other?.name ?? "they"} decide.
                  </>
                ) : myMax === 0 ? (
                  <>You&apos;re out of money — you&apos;ll claim leftovers for free once {other?.name ?? "they"} can&apos;t bid.</>
                ) : (
                  <>Waiting for {turnName}…</>
                )}
              </div>
            ) : isOpening ? (
              <div className="dm-quickbids">
                <button className="dm-quickbid" onClick={() => onBid(openAmt)} disabled={!iCanOpen}>
                  {openAmt === 0 ? "Free" : "$1"}
                  <small>{openAmt === 0 ? "Claim" : "Open"}</small>
                </button>
                <button
                  className="dm-quickbid"
                  onClick={() => onBid(Math.min(3, myMax))}
                  disabled={myMax < 3}
                >
                  $3<small>Open strong</small>
                </button>
                <button className="dm-quickbid" onClick={onPass} disabled={passLocked}>
                  Pass<small>{passLocked ? "Must fill a slot" : "Let it go"}</small>
                </button>
              </div>
            ) : null}
            {myTurn && !iAmFull && isOpening && iCanOpen && myMax >= 1 && (
              <CustomBid min={Math.max(1, openAmt)} max={myMax} onBid={onBid} verb="Open at" />
            )}
            {!iAmFull && myTurn && !isOpening && (
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
      </div>

      {/* ── Right rail ───────────────────────────────────────────────────
          Narrow: a rail under the lot — two score cards, then the ticker.
          Desktop: this wrapper and .dm-scores go `display: contents`, so each
          side's seat and roster become grid items of .dm-stage directly and
          get placed around the table (see styles.ts, "Arena layout"). */}
      <div className="dm-block dm-stage-rail">
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

        {/* Cameras and chat, in the layout rather than dumped underneath it.
            This used to render after the whole stage in a floating 380px box,
            which on a tall narrow screen meant the table stopped halfway down
            and the rest of the phone was black. It is a rail item now, so it
            takes the room the table does not. */}
        {media}
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
          Match ${currentBid} and roll for it
        </button>
      )}

      {!canRaise && !canMatch && (
        <div className="dm-waiting">
          ${currentBid} is past your limit of ${myMax}. Pass to let them have it.
        </div>
      )}

      {canRaise && <CustomBid min={currentBid + 1} max={myMax} onBid={onBid} verb="Bid" />}

      <button className="dm-btn dm-btn-ghost dm-btn-block" onClick={onPass}>
        Pass — let them have it
      </button>
    </>
  );
}

// ── Custom bid ───────────────────────────────────────────────────────────────

/**
 * Name your own number.
 *
 * The +1/+2/+5 buttons cover the common raises, but an auction where you can
 * only nudge in fixed steps isn't really an auction — sometimes the move is to
 * jump straight to $14 and end the conversation. Clamped to the same range the
 * engine and the room server enforce, so this can only ever produce a bid they
 * would have accepted anyway.
 */
function CustomBid({
  min,
  max,
  onBid,
  verb,
}: {
  min: number;
  max: number;
  onBid: (n: number) => void;
  verb: string;
}) {
  const [raw, setRaw] = useState("");
  const lo = Math.max(0, min);
  // Nothing to name when the only legal bid is the minimum.
  if (max < lo) return null;

  const parsed = Math.round(Number(raw));
  const valid = raw.trim() !== "" && Number.isFinite(parsed) && parsed >= lo && parsed <= max;

  const submit = () => {
    if (!valid) return;
    onBid(parsed);
    setRaw("");
  };

  return (
    <form
      className="dm-custombid"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className="dm-custombid-sign">$</span>
      <input
        className="dm-custombid-input"
        value={raw}
        onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={`${lo}–${max}`}
        aria-label={`Custom bid between $${lo} and $${max}`}
      />
      <button type="submit" className="dm-btn dm-btn-primary dm-custombid-go" disabled={!valid}>
        {verb} {valid ? `$${parsed}` : "…"}
      </button>
    </form>
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
            <span className="dm-die-face">{round ? DIE[round.a] : "⚄"}</span>
            <span className="dm-die-name">{nameOf(a)}</span>
          </div>
          <span className="dm-die-vs">vs</span>
          <div className="dm-die">
            <span className="dm-die-face">{round ? DIE[round.b] : "⚁"}</span>
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

  const turn = isTurn ? "1" : "0";
  const high = holdsBid ? "1" : "0";

  return (
    /* data-seat drives which side of the desktop table this player sits on.
       On desktop .dm-score is `display: contents`, so .dm-seat and .dm-roster
       below are placed independently — seat at the left/right rail, roster
       along the top/bottom edge. The flags are repeated on both children
       because the shared parent no longer paints anything there. */
    <div
      className="dm-score"
      data-seat={isMe ? "me" : "them"}
      data-turn={turn}
      data-high={high}
    >
      <div className="dm-seat" data-turn={turn} data-high={high}>
        <div className="dm-score-top">
          {/* Fixed-aspect slot sized for a webcam tile. It is `display: contents`
              on narrow screens so the avatar keeps its original inline place;
              on desktop it becomes the 4:3 box a <video> can drop straight into
              alongside (or instead of) the avatar below. */}
          <div className="dm-seat-feed">
            {side.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="dm-avatar" data-speaking={speaking ? "1" : "0"} src={side.avatarUrl} alt="" />
            ) : (
              <div className="dm-avatar" data-speaking={speaking ? "1" : "0"}>
                {side.isNpc ? <Icon name="bot" size={22} /> : side.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
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
      </div>

      <div className="dm-roster" data-turn={turn} data-high={high}>
        {/* Desktop only — on the table the strips are detached from the name. */}
        <span className="dm-roster-tag">{isMe ? "Your picks" : `${side.name}'s picks`}</span>
        {Array.from({ length: rules.rosterSize }).map((_, i) => {
          const pick = side.roster[i];
          if (!pick) return <div key={i} className="dm-slot" data-filled="0" />;
          const url = portraits[pick.imgQuery];
          return (
            <div
              key={i}
              className="dm-slot"
              data-filled="1"
              data-grade={pick.variantGrade ?? ""}
              data-new={pick.id === newPickId ? "1" : "0"}
              title={`${pick.name}${pick.variant ? ` (${pick.variant})` : ""} — $${pick.price}`}
            >
              <Thumb url={url ?? null} name={pick.name} />
              <span className="dm-slot-price dm-money">${pick.price}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Roster thumbnail with graceful failure ───────────────────────────────────

/** Small portrait that falls back to a lettered tile if the image 404s. */
export function Thumb({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  if (!url || broken) return <span className="dm-slot-initial">{name.charAt(0).toUpperCase()}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" onError={() => setBroken(true)} referrerPolicy="no-referrer" />
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
