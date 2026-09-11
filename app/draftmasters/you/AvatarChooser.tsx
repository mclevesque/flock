"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PersonAvatar from "../../components/PersonAvatar";
import { PORTRAITS, portraitUrl } from "@/lib/avatars";
import Icon from "../Icon";
import { useSocial } from "../social-context";

/**
 * Your face: one of the drawn portraits, or a photo of your own.
 *
 * A photo is cropped to a square and shrunk to 256px HERE, in the browser,
 * before anything is sent. A phone photo is 3-5MB and the platform's request
 * limit is not much bigger; a 256px WebP is tens of kilobytes, loads instantly
 * in every friend's list, and never needed a native image library on the
 * server (the reason the portrait upload broke once already).
 *
 * The crop is drag-to-position and a zoom slider, because a centred square of
 * a portrait photo is usually a chin.
 */

const OUT = 256;
const PREVIEW = 200;
const MAX_INPUT = 20 * 1024 * 1024;

interface Crop {
  img: ImageBitmap | HTMLImageElement;
  w: number;
  h: number;
  /** Centre of the crop, as a fraction of the image. */
  x: number;
  y: number;
  zoom: number;
}

export default function AvatarChooser({ userId, initial }: { userId: string; initial: string }) {
  const router = useRouter();
  const social = useSocial();
  const [current, setCurrent] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ px: number; py: number } | null>(null);

  const saved = async (avatar: string) => {
    setCurrent(avatar);
    setNote({ text: "Saved. This is you everywhere now." });
    void social.refresh();
    router.refresh();
  };

  const pickPortrait = async (id: (typeof PORTRAITS)[number]["id"]) => {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/draftmasters/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portrait: id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Couldn't save that.");
      await saved(d.avatar);
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : "Couldn't save that.", bad: true });
    }
    setBusy(false);
  };

  const onFile = async (file: File | undefined) => {
    setNote(null);
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      setNote({ text: "That isn't an image.", bad: true });
      return;
    }
    if (file.size > MAX_INPUT) {
      setNote({ text: "That photo is over 20MB — pick a smaller one.", bad: true });
      return;
    }
    try {
      const img = await decode(file);
      const w = "naturalWidth" in img ? img.naturalWidth : img.width;
      const h = "naturalHeight" in img ? img.naturalHeight : img.height;
      if (w < 32 || h < 32) throw new Error("small");
      // Faces sit in the top half of most photos; start the crop there.
      setCrop({ img, w, h, x: 0.5, y: h > w ? 0.38 : 0.5, zoom: 1 });
    } catch {
      setNote({ text: "Couldn't read that photo. A JPG or PNG always works.", bad: true });
    }
  };

  // Redraw the preview whenever the crop moves.
  useEffect(() => {
    const el = canvas.current;
    if (!crop || !el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    el.width = PREVIEW * ratio;
    el.height = PREVIEW * ratio;
    draw(ctx, crop, PREVIEW * ratio);
  }, [crop]);

  const upload = async () => {
    if (!crop) return;
    setBusy(true);
    setNote(null);
    try {
      const out = document.createElement("canvas");
      out.width = OUT;
      out.height = OUT;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("Your browser couldn't prepare that photo.");
      draw(ctx, crop, OUT);

      // WebP where the browser can write it; older Safari silently hands back a PNG.
      let dataUrl = out.toDataURL("image/webp", 0.86);
      if (!dataUrl.startsWith("data:image/webp")) dataUrl = out.toDataURL("image/jpeg", 0.88);

      const url = (await viaFunction(dataUrl)) ?? (await viaRoute(out));
      if (!url) throw new Error("The photo service is down right now — try again shortly, or pick a portrait.");

      const r = await fetch("/api/draftmasters/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Couldn't save that photo.");
      setCrop(null);
      await saved(d.avatar);
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : "Couldn't save that photo.", bad: true });
    }
    setBusy(false);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || !crop) return;
    const side = Math.min(crop.w, crop.h) / crop.zoom;
    // Dragging the picture right moves the window left, like every photo cropper.
    const dx = ((e.clientX - drag.current.px) / PREVIEW) * side;
    const dy = ((e.clientY - drag.current.py) / PREVIEW) * side;
    drag.current = { px: e.clientX, py: e.clientY };
    setCrop({ ...crop, x: crop.x - dx / crop.w, y: crop.y - dy / crop.h });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="dm-avatar-pick">
      <div className="dm-avatar-now">
        <PersonAvatar src={current} seed={userId} alt="Your avatar" />
        <div className="dm-avatar-now-who">
          <b>Your face on the site</b>
          <em>Friends see it in chat, rooms and the draft.</em>
          <label className="dm-btn dm-avatar-upload" data-busy={busy ? "1" : "0"}>
            <Icon name="camera" size={16} /> Upload a photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              disabled={busy}
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {crop && (
        <div className="dm-crop">
          <canvas
            ref={canvas}
            aria-label="Drag to position your photo"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          <label className="dm-crop-zoom">
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={crop.zoom}
              onChange={(e) => setCrop({ ...crop, zoom: Number(e.target.value) })}
            />
          </label>
          <p className="dm-note">Drag to line it up.</p>
          <div className="dm-crop-actions">
            <button type="button" className="dm-btn dm-btn-ghost" onClick={() => setCrop(null)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="dm-btn dm-btn-primary" onClick={() => void upload()} disabled={busy}>
              {busy ? "Saving…" : "Use this photo"}
            </button>
          </div>
        </div>
      )}

      {note && (
        <p className="dm-fd-note" data-bad={note.bad ? "1" : "0"} role="status">
          {note.text}
        </p>
      )}

      <p className="dm-eyebrow dm-sub">Or pick a portrait</p>
      <div className="dm-avatar-grid">
        {PORTRAITS.map((p) => {
          const url = portraitUrl(p.id);
          return (
            <button
              key={p.id}
              type="button"
              className="dm-avatar-opt"
              aria-pressed={current === url}
              aria-label={p.name}
              title={p.name}
              disabled={busy}
              onClick={() => void pickPortrait(p.id)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" loading="lazy" />
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Crop window in image pixels, kept inside the image whatever the drag did. */
function draw(ctx: CanvasRenderingContext2D, c: Crop, size: number) {
  const side = Math.min(c.w, c.h) / c.zoom;
  const sx = Math.min(Math.max(c.x * c.w - side / 2, 0), c.w - side);
  const sy = Math.min(Math.max(c.y * c.h - side / 2, 0), c.h - side);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(c.img, sx, sy, side, side, 0, 0, size, size);
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap honours EXIF rotation where supported, so a portrait
  // phone photo does not arrive on its side.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall back to an <img>, which Safari decodes HEIC through */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** The signed Netlify function — the path that works in production. */
async function viaFunction(dataUrl: string): Promise<string | null> {
  try {
    const t = await fetch("/api/draftmasters/avatar", { cache: "no-store" });
    const { token } = (await t.json()) as { token?: string | null };
    if (!token) return null;
    const r = await fetch("/.netlify/functions/avatar-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, dataUrl }),
    });
    const raw = await r.text();
    const d = JSON.parse(raw) as { url?: string };
    return r.ok && d.url ? d.url : null;
  } catch {
    return null;
  }
}

/** The hub's older upload route — works under plain `next dev`, where there are no Netlify functions. */
async function viaRoute(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
    if (!blob) return null;
    const form = new FormData();
    form.append("file", blob, "avatar.jpg");
    const r = await fetch("/api/avatar-upload", { method: "POST", body: form });
    const raw = await r.text();
    const d = JSON.parse(raw) as { url?: string };
    return r.ok && d.url ? d.url : null;
  } catch {
    return null;
  }
}
