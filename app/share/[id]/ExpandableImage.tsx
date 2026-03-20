"use client";
import { useState, useEffect } from "react";

export default function ExpandableImage({ src, alt, aspectRatio, objectFit, bg }: {
  src: string; alt: string; aspectRatio?: string; objectFit?: "cover" | "contain"; bg?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{ width: "100%", aspectRatio, background: bg ?? "#111", overflow: "hidden", lineHeight: 0, cursor: "zoom-in", position: "relative" }}
      >
        <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: objectFit ?? "cover", display: "block" }} />
        <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,0.55)", borderRadius: 8, padding: "4px 9px", fontSize: 12, color: "rgba(255,255,255,0.7)", pointerEvents: "none", backdropFilter: "blur(4px)" }}>⛶ expand</div>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        >
          <button onClick={() => setOpen(false)} style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", width: 42, height: 42, fontSize: 20, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          <img src={src} alt={alt} onClick={e => e.stopPropagation()} style={{ maxWidth: "min(92vw, 1400px)", maxHeight: "90dvh", objectFit: "contain", borderRadius: 12, boxShadow: "0 0 80px rgba(0,0,0,0.8)", cursor: "default", display: "block" }} />
          <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Click anywhere outside to close · Esc</div>
        </div>
      )}
    </>
  );
}
