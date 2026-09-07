"use client";

import { useState } from "react";
import { ARGUMENT_MAX, type ArgumentRuling } from "@/lib/draftmasters/arguments";
import type { Side } from "./types";

/**
 * The sealed-argument screen: one box, one submission, then the panel's ruling.
 *
 * The box is deliberately blind — nothing here ever renders the opponent's
 * text before the ruling arrives, because both cases are meant to be written
 * without sight of each other. Once `rulings` lands, both are shown together
 * with every claim marked accepted or thrown out.
 */
export default function ArgumentScreen({
  sides,
  meId,
  rulings,
  submitted,
  busy,
  canDrive,
  error,
  onSubmit,
  onSkip,
  onContinue,
}: {
  sides: Side[];
  meId: string;
  rulings: ArgumentRuling[];
  /** Side ids that have sealed a case. Never their text. */
  submitted: string[];
  busy: boolean;
  canDrive: boolean;
  error: string | null;
  onSubmit: (text: string) => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const [text, setText] = useState("");
  const mine = sides.find((s) => s.id === meId);
  const iSubmitted = submitted.includes(meId);
  const ruled = rulings.length > 0;
  const left = ARGUMENT_MAX - text.length;

  if (ruled) {
    return (
      <section className="dm-panel dm-args">
        <p className="dm-eyebrow">The panel has ruled</p>
        <h2 className="dm-h2">Both cases, opened together</h2>
        <div className="dm-args-rulings">
          {rulings.map((r) => {
            const side = sides.find((s) => s.id === r.sideId);
            return (
              <article key={r.sideId} className="dm-args-ruling" data-me={r.sideId === meId ? "1" : "0"}>
                <header className="dm-args-ruling-head">
                  <strong>{side?.name ?? r.sideId}</strong>
                  <span className="dm-args-sway" data-zero={r.totalSway === 0 ? "1" : "0"}>
                    {r.totalSway > 0 ? `+${r.totalSway} weight` : "nothing landed"}
                  </span>
                </header>
                {r.argument ? <blockquote className="dm-args-quote">{r.argument}</blockquote> : null}
                <ul className="dm-args-claims">
                  {r.claims.map((c, i) => (
                    <li key={i} data-ok={c.accepted ? "1" : "0"}>
                      <span className="dm-args-verdict">{c.accepted ? `accepted +${c.sway}` : "thrown out"}</span>
                      <span className="dm-args-claim">{c.text}</span>
                      {c.reason ? <span className="dm-args-reason">{c.reason}</span> : null}
                    </li>
                  ))}
                </ul>
                {r.summary ? <p className="dm-note">{r.summary}</p> : null}
              </article>
            );
          })}
        </div>
        {canDrive ? (
          <button className="dm-btn dm-btn-primary dm-btn-lg dm-btn-block" onClick={onContinue} disabled={busy}>
            {busy ? "The judge is deciding…" : "Take it to the judge"}
          </button>
        ) : (
          <p className="dm-note">Waiting for the other player to take it to the judge…</p>
        )}
        {error ? <p className="dm-error">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="dm-panel dm-args">
      <p className="dm-eyebrow">Before the judge decides</p>
      <h2 className="dm-h2">Argue your roster</h2>
      <p className="dm-note">
        One case, one submission — and the other player can&apos;t see what you write. The panel checks every claim
        against what you actually drafted, so a point that isn&apos;t true earns nothing. Be specific: name your picks
        and say what they do here.
      </p>

      {mine ? (
        <p className="dm-args-roster">
          You drafted:{" "}
          {mine.roster.length
            ? mine.roster.map((p) => `${p.name}${p.variant ? ` (${p.variant})` : ""}`).join(", ")
            : "nobody"}
        </p>
      ) : null}

      {iSubmitted ? (
        <div className="dm-args-sealed">
          <strong>Your case is sealed.</strong>
          <p className="dm-note">
            {busy ? "The panel is reading both cases…" : "Waiting for the other player to make theirs…"}
          </p>
        </div>
      ) : (
        <>
          <textarea
            className="dm-args-input"
            value={text}
            maxLength={ARGUMENT_MAX}
            rows={5}
            placeholder="e.g. Gojo unsealed hard-counters their whole front line, and nothing they drafted can touch him before he moves."
            onChange={(e) => setText(e.target.value)}
          />
          <div className="dm-args-actions">
            <span className="dm-args-count" data-low={left < 60 ? "1" : "0"}>
              {left} left
            </span>
            <button className="dm-btn dm-btn-ghost" onClick={onSkip} disabled={busy}>
              Say nothing
            </button>
            <button
              className="dm-btn dm-btn-primary"
              onClick={() => onSubmit(text.trim())}
              disabled={busy || text.trim().length < 8}
            >
              Seal my case
            </button>
          </div>
        </>
      )}

      {/* Who has sealed — never what they said. */}
      <ul className="dm-args-status">
        {sides.map((s) => (
          <li key={s.id} data-in={submitted.includes(s.id) ? "1" : "0"}>
            {s.name}: {submitted.includes(s.id) ? "case sealed" : "still writing"}
          </li>
        ))}
      </ul>

      {error ? <p className="dm-error">{error}</p> : null}
    </section>
  );
}
