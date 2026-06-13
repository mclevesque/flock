"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { C, display, Avatar, Smiley, memberColor, useLandscapeTrigger, type BudiLog, type BudiMember } from "../_ui";
import BudiRecorder from "../BudiRecorder";
import ClipCard, { type Clip } from "../ClipCard";

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

  // Rotate phone to landscape → open the camera
  useLandscapeTrigger(() => setRecording(true), !recording);

  const fetchClips = useCallback(() => {
    fetch(`/api/budi/clips?log=${log.id}`)
      .then(r => r.json())
      .then(d => setClips((d.clips ?? []) as Clip[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [log.id]);

  useEffect(() => { fetchClips(); }, [fetchClips]);
  useEffect(() => { fetch("/api/budi/logs").then(r => r.json()).then(d => setAllLogs((d.logs ?? []) as BudiLog[])).catch(() => {}); }, []);

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
    await fetch(`/api/budi/clips/${c.id}/highlight`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ highlight: next }) }).catch(() => {});
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
  function viewVlog(userId: string) { router.push(`/budi/u/${userId}`); }

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
              <div style={{ position: "absolute", top: 50, left: "50%", transform: "translateX(-50%)", zIndex: 41, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 16, padding: 6, minWidth: 230, maxHeight: "60dvh", overflowY: "auto", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
                {allLogs.map(l => {
                  const active = l.id === log.id;
                  return (
                    <button key={l.id} onClick={() => { setSwitcher(false); if (!active) router.push(`/budi/${l.id}`); }} style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                      background: active ? "rgba(255,62,201,0.12)" : "transparent", border: "none",
                      color: C.text, fontFamily: "inherit", fontSize: 15, fontWeight: 600, padding: "11px 12px", borderRadius: 10, cursor: "pointer", minHeight: 44,
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
        {!isSolo ? <button onClick={copyInvite} aria-label="share invite" style={iconBtn}>{copied ? "✓" : "⤴"}</button> : <span style={{ width: 44 }} />}
        <button onClick={() => setSheet(true)} aria-label="members" style={iconBtn}>☰</button>
      </header>

      {/* Member smileys — tap to view that person's vlog */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "2px 0 12px", flexWrap: "wrap" }}>
        {members.map(m => (
          <button key={m.user_id} onClick={() => viewVlog(m.user_id)} aria-label={`${m.username}'s vlog`} style={{ position: "relative", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
            <Avatar url={m.avatar_url} seed={m.user_id} size={30} />
            {(m.streak_count ?? 0) > 0 && <span style={{ position: "absolute", bottom: -4, right: -6, fontSize: 10, color: C.yellow, fontWeight: 700 }}>🔥{m.streak_count}</span>}
          </button>
        ))}
      </div>

      {/* Clip feed */}
      <main style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 18 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: C.muted, padding: 40, fontSize: 14 }}>loading…</div>
        ) : clips.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "44px 24px 0", gap: 14, color: C.muted }}>
            <Smiley size={70} color={memberColor(log.id)} />
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>no clips yet today</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 290, margin: 0 }}>
              {isSolo ? "your private space — the day runs 4am to 4am. tap record (or rotate your phone) to start your streak." : <>be the first to drop a clip. share code <b style={{ color: C.text }}>{log.invite_code}</b> to get your people in.</>}
            </p>
          </div>
        ) : (
          clips.map(c => (
            <ClipCard key={c.id} c={c} mine={c.user_id === meId}
              onLike={() => toggleLike(c)} onHighlight={() => toggleHighlight(c)} onDownload={() => download(c)}
              onAuthor={() => viewVlog(c.user_id)} />
          ))
        )}
      </main>

      {/* Record button */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 20, display: "flex", justifyContent: "center", padding: "10px 0 calc(16px + env(safe-area-inset-bottom))", background: "linear-gradient(to top, rgba(0,0,0,0.95) 60%, transparent)" }}>
        <button onClick={() => setRecording(true)} aria-label="record" style={{ width: 68, height: 68, borderRadius: "50%", border: "4px solid rgba(255,255,255,0.85)", background: `linear-gradient(135deg, ${C.pink}, ${C.violet})`, cursor: "pointer", fontSize: 26 }}>📷</button>
      </div>

      {recording && (
        <BudiRecorder defaultLogId={log.id} onClose={() => setRecording(false)} onPosted={() => { setRecording(false); setLoading(true); fetchClips(); router.refresh(); }} />
      )}

      {/* Info / members sheet */}
      {sheet && (
        <div onClick={() => setSheet(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: C.surface, borderTop: `1px solid ${C.border}`, borderRadius: "24px 24px 0 0", padding: "18px 20px calc(24px + env(safe-area-inset-bottom))", fontFamily: display, maxHeight: "78dvh", overflowY: "auto" }}>
            <div style={{ width: 40, height: 4, background: C.border, borderRadius: 99, margin: "0 auto 14px" }} />
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>{log.name}</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: C.muted }}>{isSolo ? "your solo log" : `${members.length}/${log.max_members} people`}</p>

            {!isSolo && log.invite_code && (
              <button onClick={copyInvite} style={{ width: "100%", marginBottom: 18, background: C.bg, border: `1px dashed ${C.border}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", color: C.text }}>
                <span style={{ fontSize: 13, color: C.muted }}>invite code</span>
                <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.18em", color: C.teal }}>{log.invite_code}</span>
                <span style={{ fontSize: 13, color: C.pink }}>{copied ? "copied!" : "copy"}</span>
              </button>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {members.map(m => (
                <button key={m.user_id} onClick={() => { setSheet(false); viewVlog(m.user_id); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 4px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", color: C.text, textAlign: "left", width: "100%" }}>
                  <Avatar url={m.avatar_url} seed={m.user_id} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{m.display_name || m.username}{m.user_id === meId ? " (you)" : ""}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{m.role === "owner" ? "owner" : "member"}{(m.streak_count ?? 0) > 0 ? ` · 🔥${m.streak_count} streak` : ""}</div>
                  </div>
                  <span style={{ fontSize: 13, color: C.muted }}>vlog ›</span>
                </button>
              ))}
            </div>

            {!isSolo && (
              <button onClick={leave} disabled={leaving} style={{ width: "100%", marginTop: 16, background: "transparent", border: `1px solid ${C.pinkDim}`, color: "#ff8fde", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{leaving ? "leaving..." : "leave party"}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 44, height: 44, flexShrink: 0, borderRadius: "50%",
  background: C.surface2, border: `1px solid ${C.border}`, color: C.text,
  fontSize: 22, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};
