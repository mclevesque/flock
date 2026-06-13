"use client";
import { useState, useEffect, useRef } from "react";
import { C, Avatar } from "./_ui";

export interface Clip {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  duration_seconds: number;
  caption: string;
  media_type: string;
  highlight: boolean;
  recorded_at: string;
  created_at: string;
  like_count: number;
  liked: boolean;
  comment_count: number;
  media_url: string | null;
  thumb_url: string | null;
}

export function clockTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function ClipCard({ c, mine, onLike, onHighlight, onDownload, onAuthor }: {
  c: Clip; mine: boolean; onLike: () => void; onHighlight: () => void; onDownload: () => void; onAuthor?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [menu, setMenu] = useState(false);

  // Android perf: only play a clip while it's actually on-screen
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.5 });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  function toggleSound() {
    const v = videoRef.current; if (!v) return;
    const m = !muted; setMuted(m); v.muted = m; v.play().catch(() => {});
  }

  const authorBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none",
    padding: 0, cursor: onAuthor ? "pointer" : "default", fontFamily: "inherit", color: "#fff",
  };

  // ── Audio (voice note) card ──
  if (c.media_type === "audio") {
    return (
      <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", background: C.surface, border: `1px solid ${C.border}`, padding: "16px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button onClick={onAuthor} disabled={!onAuthor} style={{ ...authorBtn, color: C.text }}>
            <Avatar url={c.avatar_url} seed={c.user_id} size={28} />
            <span style={{ fontSize: 16, fontWeight: 700 }}>{c.username}</span>
          </button>
          <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 700, color: C.muted }}>{clockTime(c.recorded_at || c.created_at)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: `linear-gradient(135deg, ${C.pink}, ${C.violet})`, flexShrink: 0 }}>🎙</div>
          <audio src={c.media_url ?? undefined} controls style={{ flex: 1, height: 38 }} />
        </div>
        {c.caption && <div style={{ fontSize: 14, marginTop: 10, color: C.text }}>{c.caption}</div>}
        <ClipActions c={c} mine={mine} menu={menu} setMenu={setMenu} onLike={onLike} onHighlight={onHighlight} onDownload={onDownload} inline />
      </div>
    );
  }

  // ── Video card ──
  return (
    <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", background: "#0a0a0c", aspectRatio: "3 / 4" }}>
      <video ref={videoRef} src={c.media_url ?? undefined} poster={c.thumb_url ?? undefined}
        muted autoPlay loop playsInline onClick={toggleSound}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "pointer" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 12, left: 12 }}>
        <button onClick={onAuthor} disabled={!onAuthor} style={authorBtn}>
          <Avatar url={c.avatar_url} seed={c.user_id} size={26} />
          <span style={{ fontSize: 17, fontWeight: 700, textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>{c.username}</span>
        </button>
      </div>
      <span style={{ position: "absolute", top: "46%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 34, fontWeight: 800, color: "#fff", textShadow: "0 2px 14px rgba(0,0,0,0.65)", pointerEvents: "none" }}>
        {clockTime(c.recorded_at || c.created_at)}
      </span>
      <span style={{ position: "absolute", bottom: 12, left: 12, fontSize: 13, color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.4)", borderRadius: 999, padding: "3px 9px", pointerEvents: "none" }}>{muted ? "🔇 tap for sound" : "🔊"}</span>
      {c.caption && (
        <div style={{ position: "absolute", bottom: 44, left: 12, right: 64, fontSize: 14, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.7)", pointerEvents: "none" }}>{c.caption}</div>
      )}
      <ClipActions c={c} mine={mine} menu={menu} setMenu={setMenu} onLike={onLike} onHighlight={onHighlight} onDownload={onDownload} />
    </div>
  );
}

function ClipActions({ c, mine, menu, setMenu, onLike, onHighlight, onDownload, inline }: {
  c: Clip; mine: boolean; menu: boolean; setMenu: (v: boolean) => void;
  onLike: () => void; onHighlight: () => void; onDownload: () => void; inline?: boolean;
}) {
  const fab: React.CSSProperties = {
    width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer",
    background: inline ? "transparent" : "rgba(0,0,0,0.35)", color: "#fff", fontSize: 18,
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  if (mine) {
    return (
      <div style={inline
        ? { display: "flex", justifyContent: "flex-end", marginTop: 8, position: "relative" }
        : { position: "absolute", right: 12, bottom: 12 }}>
        <button onClick={() => setMenu(!menu)} aria-label="more" style={fab}>⋯</button>
        {menu && (
          <>
            <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
            <div style={{ position: "absolute", right: 0, bottom: 48, zIndex: 51, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 6, minWidth: 180, boxShadow: "0 12px 36px rgba(0,0,0,0.6)" }}>
              <button onClick={() => { onHighlight(); setMenu(false); }} style={menuItem}>{c.highlight ? "⭐ remove highlight" : "⭐ save as highlight"}</button>
              <button onClick={() => { onDownload(); setMenu(false); }} style={menuItem}>⬇ save to device</button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={inline
      ? { display: "flex", gap: 16, marginTop: 8, alignItems: "center" }
      : { position: "absolute", right: 12, bottom: 12, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
      <button aria-label="reply" style={fab}>↩</button>
      <button onClick={onLike} aria-label="like" style={{ ...fab, flexDirection: "column", height: c.like_count > 0 ? 48 : 40 }}>
        <span style={{ fontSize: 18 }}>{c.liked ? "❤️" : "🤍"}</span>
        {c.like_count > 0 && <span style={{ fontSize: 10, fontWeight: 700 }}>{c.like_count}</span>}
      </button>
    </div>
  );
}

const menuItem: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left", background: "transparent",
  border: "none", color: C.text, fontSize: 15, fontWeight: 500, padding: "11px 12px",
  borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
};
