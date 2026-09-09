"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Pack } from "@/lib/draftmasters/packs";
import { STYLES } from "../styles";
import { STUDIO_STYLES } from "./styles";

/**
 * Portrait studio — walk a board and fix every picture in it.
 *
 * The game resolves portraits automatically from Google, Fandom, Wikipedia and
 * Commons, and it gets a lot of them wrong: the wrong Jon Snow, a screenshot
 * of the actor at an awards ceremony, a blank. Fixing those one at a time as
 * they come up mid-draft is miserable, so this is the room where you fix a
 * whole franchise in one sitting.
 *
 * Drop an image on a card, paste one from the clipboard, or click to browse.
 * It is written to R2, cropped to the card's shape, and saved as the curated
 * portrait for that CHARACTER — so it wins on every board they appear on, not
 * just this one.
 */

interface Entry {
  n: string;
  s?: string;
  wiki?: string;
}

type Status = "idle" | "saving" | "saved" | "error";

/** The card's aspect. Portraits are cropped to this so the grid never jumps. */
const CARD_W = 900;
const CARD_H = 1125;

/**
 * Crop-to-fill at card shape, in the browser.
 *
 * "Adjusted slightly to fit the borders" is the whole job here: a dropped
 * photo is any shape at all, and letting it letterbox leaves grey bars down
 * the sides of the card. This scales to COVER and centres the crop slightly
 * high, because faces sit in the top third of most portraits and a centre
 * crop decapitates them.
 */
async function toCardPortrait(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(CARD_W / bitmap.width, CARD_H / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");

  // Bias the crop upward: 35% of the overflow above, 65% below.
  const dx = (CARD_W - w) / 2;
  const dy = (CARD_H - h) * 0.35;
  ctx.drawImage(bitmap, dx, dy, w, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9)
  );
  if (blob) return blob;
  // Safari used to refuse WebP from toBlob; JPEG is a fine fallback at this size.
  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9)
  );
  if (!jpeg) throw new Error("couldn't encode that image");
  return jpeg;
}

/**
 * Store the cropped image.
 *
 * Goes to the Netlify function rather than a Next route: Turbopack cannot
 * ship the AWS SDK, so every R2 write from a Next route fails. See
 * netlify/functions/portrait-store. The image is already cropped to card size
 * here, so the payload is a couple of hundred KB even as base64.
 */
async function storeImage(
  name: string,
  blob: Blob
): Promise<{ url?: string; error?: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("couldn't read the image"));
    reader.readAsDataURL(blob);
  });

  const res = await fetch("/.netlify/functions/portrait-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, dataUrl }),
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as { url?: string; error?: string };
  } catch {
    // A crashed function answers in plain text; say something useful rather
    // than letting JSON.parse throw a syntax error at the person curating.
    return { error: `storage is unavailable (${res.status})` };
  }
}

export default function PortraitStudio({ packs }: { packs: Pack[] }) {
  const [packId, setPackId] = useState<string>(packs[0]?.id ?? "");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [imgContext, setImgContext] = useState("");
  const [packWiki, setPackWiki] = useState<string | undefined>();
  const [portraits, setPortraits] = useState<Record<string, string | null>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /** The card the cursor is over, so a paste knows where to land. */
  const focused = useRef<string | null>(null);

  const queryFor = useCallback(
    (e: Entry) => `${e.s ? `${e.n} ${e.s}` : e.n} ${imgContext}`.trim(),
    [imgContext]
  );

  // ── Load a board and resolve everything it has ─────────────────────────────
  useEffect(() => {
    if (!packId) return;
    let cancelled = false;
    setLoading(true);
    setPortraits({});
    setStatus({});
    (async () => {
      try {
        const res = await fetch(`/api/draftmasters/pack/${encodeURIComponent(packId)}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        const pack = data.pack as Pack;
        const list = (pack.entries ?? []) as Entry[];
        setEntries(list);
        setImgContext(pack.imgContext ?? "");
        setPackWiki(pack.wiki);

        const ctx = pack.imgContext ?? "";
        const queries = list.map((e) => ({
          q: `${e.s ? `${e.n} ${e.s}` : e.n} ${ctx}`.trim(),
          name: e.n,
          wiki: e.wiki ?? pack.wiki,
        }));
        /**
         * Resolved in batches of 40, because the route silently caps a request
         * at that many.
         *
         * The game never noticed — a draft asks about ~26 picks. A studio board
         * is the WHOLE franchise, and Game of Thrones has 61, so everything
         * past the fortieth came back as nothing. That looked exactly like "no
         * picture found", which is why portraits that had been uploaded and
         * saved correctly still showed as gaps on reload.
         *
         * Batches are applied as they land, so the grid fills in rather than
         * sitting empty through several seconds of live lookups.
         */
        const BATCH = 40;
        for (let start = 0; start < queries.length; start += BATCH) {
          if (cancelled) return;
          const slice = queries.slice(start, start + BATCH);
          const pres = await fetch("/api/draftmasters/portrait", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ queries: slice, wiki: pack.wiki }),
          });
          // The route answers with an ARRAY parallel to the queries it was
          // sent, not a map — so index it back onto the card's query string.
          const pdata = await pres.json();
          const resolved = (pdata.portraits ?? []) as { url: string | null }[];
          if (cancelled) return;
          setPortraits((prev) => {
            const next = { ...prev };
            slice.forEach((qq, i) => {
              next[qq.q] = resolved[i]?.url ?? null;
            });
            return next;
          });
        }
      } catch {
        if (!cancelled) setNote("Couldn't load that board.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [packId]);

  // ── Save one portrait ──────────────────────────────────────────────────────
  const save = useCallback(
    async (entry: Entry, file: File | Blob) => {
      const key = queryFor(entry);
      setStatus((s) => ({ ...s, [entry.n]: "saving" }));
      setNote(null);
      try {
        const cropped = await toCardPortrait(file);

        const stored = await storeImage(entry.n, cropped);
        if (!stored?.url) throw new Error(stored?.error ?? "couldn't store the image");

        // Then record it as the curated portrait for this character, which is
        // what makes it win on every board they turn up on.
        await fetch("/api/draftmasters/portrait/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imgQuery: key,
            url: stored.url,
            source: "curated",
            verdict: "good",
            name: entry.n,
          }),
        });

        setPortraits((p) => ({ ...p, [key]: stored.url ?? null }));
        setStatus((s) => ({ ...s, [entry.n]: "saved" }));
      } catch (e) {
        setStatus((s) => ({ ...s, [entry.n]: "error" }));
        setNote(e instanceof Error ? e.message : "Upload failed.");
      }
    },
    [queryFor]
  );

  // ── Paste anywhere, into whichever card you're hovering ────────────────────
  useEffect(() => {
    const onPaste = (ev: ClipboardEvent) => {
      const name = focused.current;
      if (!name) return;
      const item = [...(ev.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (!item) return;
      const file = item.getAsFile();
      const entry = entries.find((e) => e.n === name);
      if (file && entry) {
        ev.preventDefault();
        void save(entry, file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [entries, save]);

  const shown = onlyMissing ? entries.filter((e) => !portraits[queryFor(e)]) : entries;
  const have = entries.filter((e) => portraits[queryFor(e)]).length;

  return (
    <div className="dm">
      <style dangerouslySetInnerHTML={{ __html: STYLES + STUDIO_STYLES }} />
      <div className="dm-shell">
        <header className="ps-head">
          <div>
            <p className="dm-eyebrow" style={{ margin: 0 }}>Portrait studio</p>
            <h1 className="ps-title">Fix a whole board at once</h1>
          </div>
          <Link className="dm-btn dm-btn-ghost" href="/draftmasters">Back to the game</Link>
        </header>

        <p className="dm-note ps-help">
          Drop an image on a card, paste one while hovering it, or click to browse. Pictures are cropped to the card
          shape and saved to that <em>character</em> — so a good Jon Snow fixes every board he appears on.
        </p>

        <div className="ps-controls">
          <select className="ps-select" value={packId} onChange={(e) => setPackId(e.target.value)}>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
            ))}
          </select>
          <button
            className="dm-btn dm-btn-ghost"
            data-on={onlyMissing ? "1" : "0"}
            onClick={() => setOnlyMissing((v) => !v)}
          >
            {onlyMissing ? "Showing gaps only" : "Show gaps only"}
          </button>
          <span className="ps-count">
            {loading ? "Loading…" : `${have} of ${entries.length} have a picture`}
          </span>
        </div>

        {note && <p className="ps-note-err">{note}</p>}

        <div className="ps-grid">
          {shown.map((entry) => {
            const key = queryFor(entry);
            const url = portraits[key];
            const st = status[entry.n] ?? "idle";
            return (
              <PortraitCard
                key={entry.n}
                entry={entry}
                url={url ?? null}
                status={st}
                onFocus={() => (focused.current = entry.n)}
                onBlur={() => {
                  if (focused.current === entry.n) focused.current = null;
                }}
                onFile={(f) => void save(entry, f)}
              />
            );
          })}
        </div>

        {!loading && !shown.length && (
          <p className="dm-note" style={{ textAlign: "center", padding: "40px 0" }}>
            Every character on this board has a picture. Nice.
          </p>
        )}
      </div>
    </div>
  );
}

function PortraitCard({
  entry,
  url,
  status,
  onFile,
  onFocus,
  onBlur,
}: {
  entry: Entry;
  url: string | null;
  status: Status;
  onFile: (f: File) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div
      className="ps-card"
      data-over={over ? "1" : "0"}
      data-status={status}
      onMouseEnter={onFocus}
      onMouseLeave={onBlur}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f?.type.startsWith("image/")) onFile(f);
      }}
      onClick={() => input.current?.click()}
    >
      <div className="ps-shot">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="ps-initial">{entry.n.charAt(0).toUpperCase()}</span>
        )}
        {status === "saving" && <span className="ps-badge ps-saving">saving…</span>}
        {status === "saved" && <span className="ps-badge ps-saved">saved</span>}
        {status === "error" && <span className="ps-badge ps-error">failed</span>}
        {over && <span className="ps-drop">drop to replace</span>}
      </div>
      <p className="ps-name">{entry.n}</p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
