"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import Scene, { SceneDefs } from "./Scene";

/**
 * What happens when you pick the Custom case.
 *
 * Custom used to mean one thing: type a phrase, send it to a model, wait
 * twenty-odd seconds and hope eighty characters came back at plausible tiers
 * in a shape that parses. It was the slowest thing in the game, the most
 * expensive, and by a distance the most likely to fail.
 *
 * It was also, going by what people actually typed, mostly unnecessary —
 * "Marvel vs DC", "anime vs video games", "everything". They were not asking
 * for a new board. They were asking for several at once, which is the
 * crossover this game is secretly about and which needs no model at all.
 *
 * So Custom is now: pick up to five franchises, dealt into one pool from
 * boards that already exist. Instant, and every card arrives with the tiers,
 * variants, planes, traits, effects and portrait somebody already got right.
 *
 * The typed path is gone entirely. Arenas are declared per board and rolled
 * per game, so a sentence about a stadium was never going to change anything
 * the board had not already decided — and between twenty-six boards and any
 * mix of them, the world somebody wants is almost always already here.
 * Building a board now makes no model calls at all.
 *
 * Search matches boards by name AND by who is on them, so typing "klaus" finds
 * both The Vampire Diaries and The CW. That lookup is a server call, because
 * two thousand entries have no business in a phone's bundle.
 */

const MAX = 5;

export interface PickerBoard {
  id: string;
  name: string;
  count: number;
}

interface Hit extends PickerBoard {
  because: string;
}

export default function UniversePicker({
  boards,
  chosen,
  onChange,
  onClose,
  onConfirm,
}: {
  boards: PickerBoard[];
  chosen: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const box = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => box.current?.focus());
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced, and aborted on the next keystroke — typing "godzilla" should not
  // leave eight requests racing to answer with a stale prefix.
  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/draftmasters/mix?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        if (res.ok) setHits((await res.json()).hits as Hit[]);
      } catch { /* aborted or offline — the full list is still below */ }
    }, 160);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const rows: Hit[] = hits ?? boards.map((b) => ({ ...b, because: "board" }));
  const full = chosen.length >= MAX;

  const toggle = (id: string) => {
    if (chosen.includes(id)) onChange(chosen.filter((x) => x !== id));
    else if (!full) onChange([...chosen, id]);
  };

  return (
    <div className="dm-cusheet">
      <SceneDefs />

      <div className="dm-cusheet-head">
        <span className="dm-eyebrow">Build a custom board</span>
        <button type="button" className="dm-sheet-x" onClick={onClose} aria-label="Close">
          <Icon name="close" size={15} />
        </button>
      </div>

      {chosen.length > 0 && (
        <div className="dm-cusheet-chips">
          {chosen.map((id) => (
            <button key={id} type="button" className="dm-cuchip" onClick={() => toggle(id)}>
              {boards.find((b) => b.id === id)?.name ?? id}
              <Icon name="close" size={11} />
            </button>
          ))}
        </div>
      )}

      <div className="dm-usel-search">
        <Icon name="search" size={15} />
        <input
          ref={box}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search universes, or a character in one"
          aria-label="Search universes"
        />
      </div>

      <div className="dm-cusheet-list">
        {rows.map((b) => {
          const on = chosen.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              className="dm-usel-row"
              data-on={on ? "1" : "0"}
              data-off={!on && full ? "1" : "0"}
              onClick={() => toggle(b.id)}
              aria-pressed={on}
            >
              <span className="dm-usel-chip"><Scene pack={b.id} /></span>
              {/* Every row reads the same way — the count — so the list stays
                  scannable even when the search matched a person rather than
                  the board's own name. */}
              <span className="dm-usel-text">
                <b>{b.name}</b>
                <em>{b.count} characters</em>
              </span>
              <span className="dm-usel-add">{on ? "✓" : "+"}</span>
            </button>
          );
        })}
        {rows.length === 0 && <p className="dm-waiting">Nothing matches “{q}”.</p>}
      </div>

      <p className="dm-cusheet-foot">
        {chosen.length === 0
          ? `Pick up to ${MAX}. One universe plays as itself; two or more are dealt into a single pool.`
          : chosen.length === 1
            ? `One universe. Add another and they get mixed — ${MAX - chosen.length} slots left.`
            : `${chosen.length} universes, one pool. Every card keeps its own world’s power scale, so a knight really does end up opposite a Titan.${full ? " That is the limit." : ""}`}
      </p>

      <button
        type="button"
        className="dm-btn dm-btn-primary dm-btn-lg dm-cusheet-go"
        disabled={chosen.length === 0}
        onClick={onConfirm}
      >
        {chosen.length > 1
          ? `MIX ${chosen.length} UNIVERSES`
          : chosen.length === 1
            ? "USE THIS UNIVERSE"
            : "PICK AT LEAST ONE"}
      </button>
    </div>
  );
}
