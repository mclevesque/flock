"use client";

import type { Rules, Side } from "@/lib/draftmasters/engine";
import type { PlayerRecord, PortraitMap, Verdict } from "./types";
import { Thumb } from "./AuctionStage";

/**
 * The payoff screen. The judge has to commit to a winner and justify it, so
 * this leads with the verdict and then shows the receipts — every pick, what
 * it cost, and which one carried the team.
 */

interface Props {
  verdict: Verdict | null;
  loading: boolean;
  error: string | null;
  sides: Side[];
  rules: Rules;
  meId: string;
  portraits: PortraitMap;
  packName: string;
  canJudge: boolean;
  record: PlayerRecord | null;
  ratingDelta: number | null;
  mode: "solo" | "pvp";
  onJudge: () => void;
  onPlayAgain: () => void;
}

export default function VerdictScreen({
  verdict,
  loading,
  error,
  sides,
  rules,
  meId,
  portraits,
  packName,
  canJudge,
  record,
  ratingDelta,
  mode,
  onJudge,
  onPlayAgain,
}: Props) {
  if (!verdict) {
    return (
      <div className="dm-verdict">
        <p className="dm-eyebrow">{packName} · draft complete</p>
        <h2 className="dm-wordmark" style={{ fontSize: "clamp(26px, 7vw, 40px)" }}>
          Both rosters are set
        </h2>
        <p className="dm-tagline" style={{ maxWidth: 460, margin: "10px auto 0" }}>
          Hand it to the judge and find out who actually drafted better.
        </p>

        <div className="dm-verdict-sides" style={{ marginTop: 26 }}>
          {sides.map((side) => (
            <RosterCard
              key={side.id}
              side={side}
              rules={rules}
              isMe={side.id === meId}
              portraits={portraits}
            />
          ))}
        </div>

        {error && (
          <div className="dm-error" style={{ marginTop: 20, textAlign: "left" }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          {canJudge ? (
            <button
              className="dm-btn dm-btn-primary dm-btn-lg"
              onClick={onJudge}
              disabled={loading}
            >
              {loading ? "The judge is deliberating…" : "⚖️  Calculate Winner"}
            </button>
          ) : (
            <div className="dm-waiting">Waiting for the host to call it…</div>
          )}
        </div>
      </div>
    );
  }

  const winner = sides.find((s) => s.id === verdict.winnerId);
  const noteFor = (id: string) => verdict.sideNotes.find((n) => n.sideId === id);

  return (
    <div className="dm-verdict">
      <div className="dm-verdict-crown">👑</div>
      <h2 className="dm-verdict-headline">{verdict.headline}</h2>
      <p className="dm-verdict-winner">
        {winner?.id === meId ? "You win." : `${winner?.name ?? "Winner"} wins.`}
      </p>
      <p className="dm-verdict-reasoning">{verdict.reasoning}</p>

      {verdict.diceBreak?.winnerId && (
        <p className="dm-note" style={{ marginTop: 10, color: "var(--dm-gold)" }}>
          🎲 The judge scored it even — settled on the dice
          {verdict.diceBreak.rounds.length > 1
            ? ` after ${verdict.diceBreak.rounds.length - 1} tie${verdict.diceBreak.rounds.length > 2 ? "s" : ""}`
            : ""}
          : {verdict.diceBreak.rounds[verdict.diceBreak.rounds.length - 1].a}–
          {verdict.diceBreak.rounds[verdict.diceBreak.rounds.length - 1].b}
        </p>
      )}

      {record && (
        <div className="dm-panel" style={{ marginTop: 18, display: "inline-block" }}>
          <div className="dm-record" style={{ justifyContent: "center" }}>
            {mode === "pvp" && (
              <span>
                <strong>{record.rating}</strong> rating
                {ratingDelta !== null && ratingDelta !== 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      color: ratingDelta > 0 ? "var(--dm-green)" : "var(--dm-red)",
                      fontWeight: 800,
                    }}
                  >
                    {ratingDelta > 0 ? "+" : ""}
                    {ratingDelta}
                  </span>
                )}
              </span>
            )}
            <span>
              <strong>
                {mode === "pvp" ? `${record.pvpWins}–${record.pvpLosses}` : `${record.soloWins}–${record.soloLosses}`}
              </strong>{" "}
              {mode === "pvp" ? "vs friends" : "vs the house"}
            </span>
            {record.streak >= 3 && <span>🔥 {record.streak} straight</span>}
          </div>
        </div>
      )}

      <div className="dm-verdict-sides">
        {sides.map((side) => {
          const note = noteFor(side.id);
          const won = side.id === verdict.winnerId;
          return (
            <div key={side.id} className="dm-verdict-side" data-won={won ? "1" : "0"}>
              <div className="dm-score-top">
                <div className="dm-avatar">
                  {side.isNpc ? "🤖" : side.name.charAt(0).toUpperCase()}
                </div>
                <div className="dm-score-name">{side.id === meId ? "You" : side.name}</div>
                {won && <span style={{ marginLeft: "auto", fontSize: 18 }}>🏆</span>}
              </div>

              {note && (
                <>
                  <div className="dm-verdict-score dm-money" style={{ marginTop: 12 }}>
                    {note.score}
                    <span style={{ fontSize: 14, color: "var(--dm-mute)", fontWeight: 600 }}>
                      /100
                    </span>
                  </div>
                  <p className="dm-verdict-note">{note.note}</p>
                </>
              )}

              <div className="dm-verdict-picks">
                {side.roster.map((pick) => {
                  const isMvp = note?.mvp && matches(pick.name, note.mvp);
                  const isBust = !isMvp && note?.bust && matches(pick.name, note.bust);
                  const url = portraits[pick.imgQuery];
                  return (
                    <div key={pick.id} className="dm-verdict-pick">
                      <span className="dm-verdict-thumb">
                        <Thumb url={url ?? null} name={pick.name} />
                      </span>
                      <div className="dm-verdict-pick-name">
                        {pick.name}
                        {isMvp && (
                          <span className="dm-tag" data-kind="mvp">
                            MVP
                          </span>
                        )}
                        {isBust && (
                          <span className="dm-tag" data-kind="bust">
                            Bust
                          </span>
                        )}
                        {pick.variant && <span>{pick.variant}</span>}
                      </div>
                      <div className="dm-verdict-pick-price dm-money">${pick.price}</div>
                      {(() => {
                        // How much this pick mattered, 0–10, from the judge.
                        const c = note?.picks?.find((p) => matches(pick.name, p.name));
                        return c ? (
                          <span className="dm-contrib" title={`Contribution ${c.contribution}/10`}>
                            <span className="dm-contrib-bar">
                              <i style={{ width: `${c.contribution * 10}%` }} />
                            </span>
                            <span className="dm-contrib-n">{c.contribution}/10</span>
                          </span>
                        ) : null;
                      })()}
                    </div>
                  );
                })}
                {side.roster.length === 0 && (
                  <div className="dm-note">Drafted nobody. Bold strategy.</div>
                )}
              </div>

              <div className="dm-note" style={{ marginTop: 10 }}>
                ${rules.budget - side.budget} spent · ${side.budget} left on the table
              </div>
            </div>
          );
        })}
      </div>

      {verdict.judged === "offline" && (
        <p className="dm-note" style={{ marginTop: 16 }}>
          Judged offline — the AI judge was unreachable, so this one went to the tale of the tape.
        </p>
      )}

      <div style={{ marginTop: 26 }}>
        <button className="dm-btn dm-btn-primary dm-btn-lg" onClick={onPlayAgain}>
          Play again — new topic
        </button>
      </div>
    </div>
  );
}

function RosterCard({
  side,
  rules,
  isMe,
  portraits,
}: {
  side: Side;
  rules: Rules;
  isMe: boolean;
  portraits: PortraitMap;
}) {
  return (
    <div className="dm-verdict-side">
      <div className="dm-score-top">
        <div className="dm-avatar">{side.isNpc ? "🤖" : side.name.charAt(0).toUpperCase()}</div>
        <div className="dm-score-name">{isMe ? "You" : side.name}</div>
      </div>
      <div className="dm-verdict-picks">
        {side.roster.map((pick) => {
          const url = portraits[pick.imgQuery];
          return (
            <div key={pick.id} className="dm-verdict-pick">
              <span className="dm-verdict-thumb">
                <Thumb url={url ?? null} name={pick.name} />
              </span>
              <div className="dm-verdict-pick-name">
                {pick.name}
                {pick.variant && <span>{pick.variant}</span>}
              </div>
              <div className="dm-verdict-pick-price dm-money">${pick.price}</div>
            </div>
          );
        })}
        {side.roster.length === 0 && <div className="dm-note">Drafted nobody.</div>}
      </div>
      <div className="dm-note" style={{ marginTop: 10 }}>
        ${rules.budget - side.budget} spent · ${side.budget} left
      </div>
    </div>
  );
}

/** The judge names picks in prose, so match loosely rather than exactly. */
function matches(pickName: string, label: string): boolean {
  const a = pickName.toLowerCase();
  const b = label.toLowerCase().trim();
  if (!b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
