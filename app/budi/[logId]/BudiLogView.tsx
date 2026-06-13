"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { C, display, Avatar, Smiley, memberColor, type BudiLog, type BudiMember } from "../_ui";
import BudiRecorder from "../BudiRecorder";

interface Clip {
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

function clockTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function BudiLogView({ log, members, meId }: { log: BudiLog; members: BudiMember[]; meId: string }) {
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [allLogs, setAllLogs] = useState<BudiLog[]>([]);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const isSolo = log.kind === "solo";

  const fetchClips = useCallback(() => {
    fetch(`/api/budi/clips?log=${log.id}`)
      .then(r => r.json())
      .then(d => setClips((d.clips ?? []) as Clip[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [log.id]);

  useEffect(() => { fetchClips(); }, [fetchClips]);

  // Logs for the title-bar switcher
  useEffect(() => {
    fetch("/api/budi/logs").then(r => r.json()).then(d => setAllLogs((d.logs ?? []) as BudiLog[])).catch(() => {});
  }, []);

  async function copyInvite() {
    if (!log.invite_code) return;
    try { await navigator.clipboard.writeText(log.invite_code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* blocked */ }
  }

  async function leave() {
    if (!confirm(`Leave "${log.name}"?`)) return;
    setLeaving(true);
    const res = await fetch(`/api/budi/logs/${log.id}/leave`, { method: "POST" });
    if (res.ok) router.push("/budi"); else setLeaving(false);
  }

  async function toggleLike(c: Clip) {
    setClips(prev => prev.map(x => x.id === c.id ? { ...x, liked: !x.liked, like_count: x.like_count + (x.liked ? -1 : 1) } : x));
    await fetch(`/api/budi/clips/${c.id}/like`, { method: "POST" }).catch(() => {});
  }

  async function toggleHighlight(c: Clip) {
    const next = !c.highlight;
    setClips(prev => prev.map(x => x.id === c.id ? { ...x, highlight: next } : x));
    await fetch(`/api/budi/clips/${c.id}/highlight`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ highlight: next }),
    }).catch(() => {});
  }

  async function download(c: Clip) {
    if (!c.media_url) return;
    try {
      const r = await fetch(c.media_url); const b = await r.blob();
      const u = URL.createObjectURL(b); const a = document.createElement("a");
      a.href = u; a.download = `budi-${c.id}.webm`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
    } catch { /* ignore */ }
  }

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: display, paddingBottom: "calc(120px + env(safe-area-inset-bottom))" }}>
      {/* Top bar */}
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "max(14px, env(safe-area-inset-top)) 14px 8px", position: "sticky", top: 0, zIndex: 30, background: "linear-gradient(to bottom, #000 72%, transparent)" }}>
        <button onClick={() => router.push("/budi")} aria-label="back" style={iconBtn}>‹</button>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", position: "relative" }}>
          <button onClick={() => setSwitcher(o => !o)} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 999, padding: "9px 18px",
            color: C.text, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            maxWidth: 240, minHeight: 42, overflow: "hidden",
          }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.name}</span>
            <span style={{ fontSize: 11, color: C.muted, transform: switcher ? "rotate(180deg)" : "none" }}>▼</span>
          </button>
          {switcher && (
            <>
              <div onClick={() => setSwitcher(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div style={{
                position: "absolute", top: 50, left: "50%", transform: "translateX(-50%)", zIndex: 41,
                background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 16, padding: 6,
                minWidth: 230, maxHeight: "60dvh", overflowY: "auto", boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
              }}>
                {allLogs.map(l => {
                  const active = l.id === log.id;
                  return (
                    <button key={l.id} onClick={() => { setSwitcher(false); if (!active) router.push(`/budi/${l.id}`); }} style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                      background: active ? "rgba(255,62,201,0.12)" : "transparent", border: "none",
                      color: C.text, fontFamily: "inherit", fontSize: 15, fontWeight: 600, padding: "11px 12px",
                      borderRadius: 10, cursor: "pointer", minHeight: 44,
                    }}>
                      <span style={{ fontSize: 18 }}>{l.kind === "solo" ? "⭐" : "👥"}</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                      {(l.streak_count ?? 0) > 0 && <span style={{ fontSize: 12, color: C.yellow }}>🔥{l.streak_count}</span>}
                      {active && <span style={{ color: C.pink, fontSize: 13 }}>●</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        {!isSolo
          ? <button onClick={copyInvite} aria-label="share invite" style={iconBtn}>{copied ? "✓" : "⤴"}</button>
          : <span style={{ width: 44 }} />}
        <button onClick={() => setSheet(true)} aria-label="members" style={iconBtn}>☰</button>
      </header>

      {/* Member smileys */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "2px 0 12px", flexWrap: "wrap" }}>
        {members.map(m => (
          <div key={m.user_id} style={{ position: "relative" }}>
            <Avatar url={m.avatar_url} seed={m.user_id} size={30} />
            {(m.streak_count ?? 0) > 0 && (
              <span style={{ position: "absolute", bottom: -4, right: -6, fontSize: 10, color: C.yellow, fontWeight: 700 }}>🔥{m.streak_count}</span>
            )}
          </div>
        ))}
      </div>

      {/* Clip feed (chronological) */}
      <main style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 18 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: C.muted, padding: 40, fontSize: 14 }}>loading…</div>
        ) : clips.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "44px 24px 0", gap: 14, color: C.muted }}>
            <Smiley size={70} color={memberColor(log.id)} />
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>no clips yet today</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 290, margin: 0 }}>
              {isSolo
                ? "your private space — the day runs 4am to 4am. tap record to start your streak."
                : <>be the first to drop a clip. share code <b style={{ color: C.text }}>{log.invite_code}</b> to get your people in.</>}
            </p>
          </div>
        ) : (
          clips.map(c => (
            <ClipCard key={c.id} c={c} mine={c.user_id === meId}
              onLike={() => toggleLike(c)} onHighlight={() => toggleHighlight(c)} onDownload={() => download(c)} />
          ))
        )}
      </main>

      {/* Record button */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 20, display: "flex", justifyContent: "center", padding: "10px 0 calc(16px + env(safe-area-inset-bottom))", background: "linear-gradient(to top, rgba(0,0,0,0.95) 60%, transparent)" }}>
        <button onClick={() => setRecording(true)} aria-label="record" style={{
          width: 68, height: 68, borderRadius: "50%", border: "4px solid rgba(255,255,255,0.85)",
          background: `linear-gradient(135deg, ${C.pink}, ${C.violet})`, cursor: "pointer", fontSize: 26,
        }}>📷</button>
      </div>

      {recording && (
        <BudiRecorder defaultLogId={log.id} onClose={() => setRecording(false)} onPosted={() => { setRecording(false); setLoading(true); fetchClips(); router.refresh(); }} />
      )}

      {/* Info / members sheet */}
      {sheet && (
        <div onClick={() => setSheet(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 460, background: C.surface, borderTop: `1px solid ${C.border}`,
            borderRadius: "24px 24px 0 0", padding: "18px 20px calc(24px + env(safe-area-inset-bottom))",
            fontFamily: display, maxHeight: "78dvh", overflowY: "auto",
          }}>
            <div style={{ width: 40, height: 4, background: C.border, borderRadius: 99, margin: "0 auto 14px" }} />
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>{log.name}</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: C.muted }}>
              {isSolo ? "your solo log" : `${members.length}/${log.max_members} people`}
            </p>

            {!isSolo && log.invite_code && (
              <button onClick={copyInvite} style={{
                width: "100%", marginBottom: 18, background: C.bg, border: `1px dashed ${C.border}`,
                borderRadius: 14, padding: "14px 16px", cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "space-between", color: C.text,
              }}>
                <span style={{ fontSize: 13, color: C.muted }}>invite code</span>
                <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.18em", color: C.teal }}>{log.invite_code}</span>
                <span style={{ fontSize: 13, color: C.pink }}>{copied ? "copied!" : "copy"}</span>
              </button>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {members.map(m => (
                <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 4px" }}>
                  <Avatar url={m.avatar_url} seed={m.user_id} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{m.display_name || m.username}{m.user_id === meId ? " (you)" : ""}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      {m.role === "owner" ? "owner" : "member"}{(m.streak_count ?? 0) > 0 ? ` · 🔥${m.streak_count} streak` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!isSolo && (
              <button onClick={leave} disabled={leaving} style={{
                width: "100%", marginTop: 16, background: "transparent", border: `1px solid ${C.pinkDim}`,
                color: "#ff8fde", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>{leaving ? "leaving..." : "leave party"}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ClipCard({ c, mine, onLike, onHighlight, onDownload }: {
  c: Clip; mine: boolean; onLike: () => void; onHighlight: () => void; onDownload: () => void;
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

  // ── Audio (voice note) card ──
  if (c.media_type === "audio") {
    return (
      <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", background: C.surface, border: `1px solid ${C.border}`, padding: "16px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Avatar url={c.avatar_url} seed={c.user_id} size={28} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>{c.username}</span>
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

  // ── Video card (full-bleed, overlay actions) ──
  return (
    <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", background: "#0a0a0c", aspectRatio: "3 / 4" }}>
      <video ref={videoRef} src={c.media_url ?? undefined} poster={c.thumb_url ?? undefined}
        muted autoPlay loop playsInline onClick={toggleSound}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "pointer" }} />

      {/* gradient top for legibility */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)", pointerEvents: "none" }} />

      {/* name top-left */}
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 8, pointerEvents: "none" }}>
        <Avatar url={c.avatar_url} seed={c.user_id} size={26} />
        <span style={{ fontSize: 17, fontWeight: 700, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>{c.username}</span>
      </div>

      {/* big time centered */}
      <span style={{ position: "absolute", top: "46%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 34, fontWeight: 800, color: "#fff", textShadow: "0 2px 14px rgba(0,0,0,0.65)", pointerEvents: "none" }}>
        {clockTime(c.recorded_at || c.created_at)}
      </span>

      {/* mute hint */}
      <span style={{ position: "absolute", bottom: 12, left: 12, fontSize: 13, color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.4)", borderRadius: 999, padding: "3px 9px", pointerEvents: "none" }}>{muted ? "🔇 tap for sound" : "🔊"}</span>

      {/* caption bottom */}
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
    // own clip → ⋯ menu with save options
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

  // others' clip → reply + heart stacked on the right
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

const iconBtn: React.CSSProperties = {
  width: 44, height: 44, flexShrink: 0, borderRadius: "50%",
  background: C.surface2, border: `1px solid ${C.border}`, color: C.text,
  fontSize: 22, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};
const menuItem: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left", background: "transparent",
  border: "none", color: C.text, fontSize: 15, fontWeight: 500, padding: "11px 12px",
  borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
};
