"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";
import { IMMEASURABLE } from "@/lib/draftmasters/ubers";
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
  battleLoading: boolean;
  /**
   * What the room is waiting on, if anything. Set for BOTH players, not just
   * whoever pressed the button — the one who didn't press it used to get a
   * bare "waiting for the host" with no sign that anything was happening.
   */
  busy: "judging" | "staging" | null;
  onBattle: () => void;
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
  battleLoading,
  busy,
  onBattle,
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
          Send them out and find out what happens.
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

        {busy && <StagingBar key={busy} kind={busy} />}

        <div style={{ marginTop: 24 }}>
          {busy ? null : canJudge ? (
            <>
              {/* One button, because there is now only one answer. The
                  result is read off the fight, so a "just calculate it" path
                  would have to run the same fight and then hide it. */}
              <div className="dm-row" style={{ justifyContent: "center" }}>
                <button className="dm-btn dm-btn-battle dm-btn-lg" onClick={onBattle} disabled={loading || battleLoading}>
                  {battleLoading ? "Staging the fight…" : <><Icon name="swords" size={15} /> BATTLE!</>}
                </button>
              </div>
              <p className="dm-note" style={{ marginTop: 10 }}>
                Nobody has judged anything yet — the fight decides it.
              </p>
            </>
          ) : (
            <div className="dm-waiting">Waiting for the host to call it…</div>
          )}
        </div>
      </div>
    );
  }

  const noteFor = (id: string) => verdict.sideNotes.find((n) => n.sideId === id);

  return (
    <div className="dm-verdict">
      <div className="dm-verdict-crown"><Icon name="crown" size={15} /></div>
      {/* The headline already names the winner, so the old "You win." line
          under it was the same fact twice. Name, then why -- nothing else. */}
      <h2 className="dm-verdict-headline">{verdict.headline}</h2>
      <p className="dm-verdict-reasoning">{verdict.reasoning}</p>

      {verdict.plan && <PlanPanel plan={verdict.plan} />}

      {verdict.diceBreak?.winnerId && (
        <p className="dm-note" style={{ marginTop: 10, color: "var(--dm-gold)" }}>
          <Icon name="dice" size={15} /> The judge scored it even — settled on the dice
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
            {record.streak >= 3 && <span><Icon name="flame" size={15} /> {record.streak} straight</span>}
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
                  {side.isNpc ? <Icon name="bot" size={15} /> : side.name.charAt(0).toUpperCase()}
                </div>
                <div className="dm-score-name">{side.id === meId ? "You" : side.name}</div>
                {won && <span style={{ marginLeft: "auto", fontSize: 18 }}><Icon name="trophy" size={15} /></span>}
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
                        {pick.variant && (
                  <span className="dm-variant-note" data-grade={pick.variantGrade ?? "neutral"}>
                    {pick.variant}
                  </span>
                )}
                      </div>
                      <div className="dm-verdict-pick-price dm-money">${pick.price}</div>
                      {(() => {
                        // How much this pick mattered, 0–10, from the judge.
                        const c = note?.picks?.find((p) => matches(pick.name, p.name));
                        if (!c) return null;
                        // Some cards are not on the scale. Eru Ilúvatar did not
                        // contribute to the contest; he wrote the world it
                        // happens in, so a number there is a category error.
                        const immeasurable = c.contribution >= IMMEASURABLE;
                        return (
                          <span
                            className="dm-contrib"
                            data-immeasurable={immeasurable ? "1" : "0"}
                            title={immeasurable ? "Beyond measurement" : `Contribution ${c.contribution}/10`}
                          >
                            <span className="dm-contrib-bar">
                              <i style={{ width: `${Math.min(100, c.contribution * 10)}%` }} />
                            </span>
                            <span className="dm-contrib-n">
                              {immeasurable ? "∞/10" : `${c.contribution}/10`}
                            </span>
                          </span>
                        );
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

      {/* No "judged offline" notice. Which backend produced the verdict is our
          plumbing, not the player's concern — and announcing a fallback makes a
          perfectly good result read as a broken one. The distinction is still
          on the payload as `verdict.judged` and in the server logs, so it stays
          diagnosable without being confessed on screen. */}

      <div className="dm-row" style={{ marginTop: 26, justifyContent: "center" }}>
        {canJudge && (
          <button className="dm-btn dm-btn-battle dm-btn-lg" onClick={onBattle} disabled={battleLoading}>
            {battleLoading ? "Staging the fight…" : <><Icon name="swords" size={15} /> Watch the battle</>}
          </button>
        )}
        <button className="dm-btn dm-btn-primary dm-btn-lg" onClick={onPlayAgain}>
          Play again — new topic
        </button>
      </div>
    </div>
  );
}

// ── Staging bar ──────────────────────────────────────────────────────────────

/**
 * The wait, made watchable — and shown to BOTH players.
 *
 * The endgame does real work now: it reads every pick's wiki page, decides
 * what kind of contest the scenario actually is, war-games the matchups, then
 * writes the show. That's twenty to forty seconds, and the player who didn't
 * press the button used to sit on a blank "waiting for the host". So the room
 * gets a bar and a running commentary of what's happening.
 *
 * The bar is honest about being an estimate: it eases toward 95% and parks
 * there until the real thing lands, rather than pretending to know.
 */
const STAGES: Record<"judging" | "staging", string[]> = {
  judging: [
    "Looking every pick up…",
    "Working out what kind of contest this even is…",
    "Reading the room — who's biased, and toward whom…",
    "War-gaming the matchups…",
    "Hunting for the technicality that decides it…",
    "Writing the verdict…",
  ],
  staging: [
    "Reading the judge's notes…",
    "Setting the scene…",
    "Blocking out the contest…",
    "Finding the moment it turns…",
    "Rolling the cameras…",
  ],
};

/** Roughly how long the whole thing takes, per kind. */
const EXPECTED_MS: Record<"judging" | "staging", number> = { judging: 26000, staging: 34000 };

function StagingBar({ kind }: { kind: "judging" | "staging" }) {
  // Keyed on `kind` by the caller, so a fresh bar means a fresh clock and this
  // never has to reset itself mid-flight.
  const [started] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - started), 220);
    return () => clearInterval(t);
  }, [started]);

  const lines = STAGES[kind];
  const expected = EXPECTED_MS[kind];
  // Ease out toward 95% — fast at first, then visibly patient.
  const pct = Math.min(95, 95 * (1 - Math.pow(1 - Math.min(1, elapsed / expected), 2)));
  const line = lines[Math.min(lines.length - 1, Math.floor((elapsed / expected) * lines.length))];

  return (
    <div className="dm-staging" role="status" aria-live="polite">
      <div className="dm-staging-head">
        <span>{kind === "judging"
          ? <><Icon name="scales" size={15} /> The judge is working</>
          : <><Icon name="swords" size={15} /> Staging the show</>}</span>
        <span className="dm-staging-pct">{Math.round(pct)}%</span>
      </div>
      <div className="dm-staging-track">
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="dm-staging-line" key={line}>
        {line}
      </p>
    </div>
  );
}

// ── How it was decided ───────────────────────────────────────────────────────

/**
 * The judge's working, shown under the verdict.
 *
 * This is the part people argue about, so it's worth showing: what kind of
 * contest it decided this was, who on the panel was in the tank for whom, and
 * the rules-lawyer detail that settled it.
 */
function PlanPanel({ plan }: { plan: NonNullable<Verdict["plan"]> }) {
  const hasBody = plan.howItWorks || plan.panel.length || plan.matchups.length || plan.twists.length;
  if (!hasBody) return null;

  return (
    <div className="dm-plan">
      <p className="dm-eyebrow">
        How it was decided · <span className="dm-plan-format">{plan.formatLabel}</span>
      </p>
      {plan.howItWorks && <p className="dm-plan-how">{plan.howItWorks}</p>}

      {plan.decidedBy.length > 0 && (
        <div className="dm-plan-tags">
          {plan.decidedBy.map((d) => (
            <span key={d} className="dm-plan-tag">
              {d}
            </span>
          ))}
        </div>
      )}

      {plan.panel.length > 0 && (
        <div className="dm-plan-block">
          <h4>On the panel</h4>
          <ul>
            {plan.panel.map((j) => (
              <li key={j.name}>
                <strong>{j.name}</strong> — {j.bias}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.matchups.length > 0 && (
        <div className="dm-plan-block">
          <h4>The matchups</h4>
          <ul>
            {plan.matchups.map((m) => (
              <li key={`${m.a}-${m.b}`}>
                <strong>
                  {m.a} vs {m.b}
                </strong>{" "}
                — {m.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.twists.length > 0 && (
        <div className="dm-plan-block" data-twist="1">
          <h4>The detail that did it</h4>
          <ul>
            {plan.twists.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
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
        <div className="dm-avatar">{side.isNpc ? <Icon name="bot" size={15} /> : side.name.charAt(0).toUpperCase()}</div>
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
                {pick.variant && (
                  <span className="dm-variant-note" data-grade={pick.variantGrade ?? "neutral"}>
                    {pick.variant}
                  </span>
                )}
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
