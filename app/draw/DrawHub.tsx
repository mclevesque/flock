"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Room {
  id: string; title: string; host_id: string; host_username: string; host_avatar: string;
  canvas_snapshot: string | null; viewer_count: number; updated_at: string;
}

export default function DrawHub() {
  const { data: session } = useSession();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/draw-room").then(r => r.json()).then(d => { if (Array.isArray(d)) setRooms(d); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function createRoom() {
    if (!session?.user?.id) return router.push("/signin");
    setCreating(true);
    const r = await fetch("/api/draw-room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTitle || "Untitled Drawing", isPublic }) });
    const room = await r.json();
    if (room.id) router.push(`/draw/${room.id}`);
    setCreating(false);
  }

  async function deleteRoom(e: React.MouseEvent, roomId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this canvas? This cannot be undone.")) return;
    setDeleting(roomId);
    await fetch(`/api/draw-room/${roomId}`, { method: "DELETE" }).catch(() => {});
    setRooms(prev => prev.filter(r => r.id !== roomId));
    setDeleting(null);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, background: "linear-gradient(135deg, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            🎨 Draw
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 14 }}>Create, watch, and share art live</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 12, padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >+ New Canvas</button>
      </div>

      {/* New room modal */}
      {showNew && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowNew(false)}>
          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-bright)", borderRadius: 18, padding: 28, width: 340, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700 }}>New Canvas</h3>
            <input
              value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="Untitled Drawing"
              style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", color: "var(--text-primary)", fontSize: 14, marginBottom: 14, outline: "none", boxSizing: "border-box" }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} style={{ width: 16, height: 16 }} />
              Public — others can watch
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px", fontSize: 14, color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
              <button onClick={createRoom} disabled={creating} style={{ flex: 2, background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: creating ? 0.6 : 1 }}>
                {creating ? "Creating…" : "🎨 Start Drawing"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)", fontSize: 15 }}>Loading rooms…</div>
      ) : rooms.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎨</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No one's drawing yet</div>
          <div style={{ fontSize: 14, marginBottom: 24 }}>Be the first to open a canvas</div>
          <button onClick={() => setShowNew(true)} style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Start Drawing</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {rooms.map(room => {
            const isOwner = session?.user?.id === room.host_id;
            return (
              <div key={room.id} style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-surface)", transition: "transform 0.15s, border-color 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(124,92,191,0.5)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}
              >
                <Link href={`/draw/${room.id}`} style={{ textDecoration: "none", display: "block" }}>
                  {/* Preview */}
                  <div style={{ height: 160, background: "var(--bg-elevated)", position: "relative", overflow: "hidden" }}>
                    {room.canvas_snapshot ? (
                      <img src={room.canvas_snapshot} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, opacity: 0.2 }}>🎨</div>
                    )}
                    <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", borderRadius: 8, padding: "3px 8px", fontSize: 11, color: "#fff", display: "flex", alignItems: "center", gap: 4 }}>
                      👁 {room.viewer_count}
                    </div>
                  </div>
                  {/* Info */}
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: isOwner ? 28 : 0 }}>{room.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <img src={room.host_avatar ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${room.host_username}`} style={{ width: 18, height: 18, borderRadius: 5 }} alt="" />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>@{room.host_username}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>Live</span>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4caf7d" }} />
                    </div>
                  </div>
                </Link>
                {/* Delete button — only shown for room owner */}
                {isOwner && (
                  <button
                    onClick={e => deleteRoom(e, room.id)}
                    disabled={deleting === room.id}
                    title="Delete canvas"
                    style={{
                      position: "absolute", top: 8, left: 8,
                      background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 8,
                      color: "#ef4444", fontSize: 14, cursor: "pointer", padding: "4px 8px",
                      opacity: deleting === room.id ? 0.5 : 1,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.3)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.7)")}
                  >
                    {deleting === room.id ? "…" : "🗑"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
