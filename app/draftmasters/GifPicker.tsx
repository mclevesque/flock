"use client";

import { useEffect, useRef, useState } from "react";
import { gifMessage } from "@/lib/draftmasters/chat-text";
import Icon from "./Icon";

/**
 * Pick a GIF, for either chat.
 *
 * The friends chat and the room chat both send plain text, so a GIF is sent as
 * text too -- the token gifMessage builds -- and each chat draws it where it
 * lands. Search goes through /api/gif-search, the hub's GIPHY proxy, so the
 * key never reaches the browser. With no key configured the proxy answers
 * empty, and the picker says so rather than sitting on a blank grid.
 */

interface Gif {
  id: string;
  title: string;
  images: { fixed_height_small?: { url: string }; fixed_height: { url: string } };
}

export function GifButton({ onSend, disabled = false }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="dm-btn dm-btn-ghost dm-gif-btn"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Send a GIF"
        aria-expanded={open}
      >
        GIF
      </button>
      {open && (
        <GifPicker
          onClose={() => setOpen(false)}
          onPick={(id) => {
            const text = gifMessage(id);
            if (text) onSend(text);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function GifPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(true);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // The friends sheet closes on Escape too; this one goes first.
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    box.current?.focus();
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Trending when the box is empty, search as you type -- debounced and
  // aborted, so a fast typist does not race eight requests.
  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/gif-search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        const json = (await res.json()) as { data?: Gif[] };
        setGifs(json.data ?? []);
      } catch {
        if (!ctl.signal.aborted) setGifs([]);
      }
      if (!ctl.signal.aborted) setLoading(false);
    }, q.trim() ? 350 : 0);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  return (
    <div className="dm-gif" role="dialog" aria-label="Pick a GIF">
      <div className="dm-gif-head">
        <input
          ref={box}
          className="dm-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search GIFs"
          aria-label="Search GIFs"
          enterKeyHint="search"
        />
        <button type="button" className="dm-fd-x" onClick={onClose} aria-label="Close GIFs">
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="dm-gif-grid">
        {gifs.map((g) => (
          <button key={g.id} type="button" className="dm-gif-pick" onClick={() => onPick(g.id)} title={g.title}>
            {/* eslint-disable-next-line @next/next/no-img-element -- GIPHY's CDN, animated */}
            <img src={(g.images.fixed_height_small ?? g.images.fixed_height).url} alt={g.title || "GIF"} loading="lazy" />
          </button>
        ))}
      </div>
      {!loading && gifs.length === 0 && (
        <p className="dm-gif-empty">{q.trim() ? "Nothing for that. Try another word." : "GIFs are not set up on this site yet."}</p>
      )}
      <p className="dm-gif-credit">Powered by GIPHY</p>
    </div>
  );
}
