"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { C, display, Avatar } from "../../_ui";
import ClipCard, { type Clip } from "../../ClipCard";

interface VlogUser { id: string; username: string; display_name: string | null; avatar_url: string | null; }

export default function BudiVlogView({ user, clips: initial, meId }: { user: VlogUser; clips: Clip[]; meId: string }) {
  const router = useRouter();
  const [clips, setClips] = useState<Clip[]>(initial);
  const isMe = user.id === meId;

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

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: display, paddingBottom: "calc(40px + env(safe-area-inset-bottom))" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "max(14px, env(safe-area-inset-top)) 14px 10px", position: "sticky", top: 0, zIndex: 10, background: "linear-gradient(to bottom, #000 72%, transparent)" }}>
        <button onClick={() => router.back()} aria-label="back" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: "50%", background: C.surface2, border: `1px solid ${C.border}`, color: C.text, fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
        <Avatar url={user.avatar_url} seed={user.id} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.display_name || user.username}{isMe ? " (you)" : ""}</div>
          <div style={{ fontSize: 13, color: C.muted }}>vlog ⭐</div>
        </div>
      </header>

      <main style={{ padding: "4px 14px", display: "flex", flexDirection: "column", gap: 18 }}>
        {clips.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, padding: "48px 24px", fontSize: 14, lineHeight: 1.6 }}>
            {isMe ? "your vlog is empty — post a clip to your vlog and it shows up here." : `${user.username} hasn't posted to their vlog yet.`}
          </div>
        ) : (
          clips.map(c => (
            <ClipCard key={c.id} c={c} mine={isMe}
              onLike={() => toggleLike(c)} onHighlight={() => toggleHighlight(c)} onDownload={() => download(c)} />
          ))
        )}
      </main>
    </div>
  );
}
