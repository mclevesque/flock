"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";

const MOODS = [
  { key: "gaming",   icon: "🎮", label: "Gaming" },
  { key: "adventure",icon: "⚔️", label: "Adventure" },
  { key: "thoughts", icon: "💭", label: "Thoughts" },
  { key: "victory",  icon: "🏆", label: "Victory" },
  { key: "rant",     icon: "😤", label: "Rant" },
  { key: "idea",     icon: "💡", label: "Idea" },
  { key: "feels",    icon: "❤️", label: "Feels" },
];
const MOOD_MAP = Object.fromEntries(MOODS.map(m => [m.key, m]));

const VIS_META: Record<string, { icon: string; label: string; color: string }> = {
  public:  { icon: "🌍", label: "Public",       color: "#4ade80" },
  friends: { icon: "👥", label: "Friends only", color: "#60a5fa" },
  private: { icon: "🔒", label: "Private",      color: "#f59e0b" },
};

interface Entry {
  id: string; user_id: string; username: string; avatar_url: string | null;
  title: string; body: string; mood: string | null; visibility: string;
  likes_count: number; comments_count: number; user_liked: boolean;
  created_at: string; updated_at: string;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function EntryCard({ entry, sessionUserId, onDelete }: { entry: Entry; sessionUserId: string | null; onDelete: (id: string) => void }) {
  const [liked, setLiked] = useState(entry.user_liked);
  const [likes, setLikes] = useState(entry.likes_count);
  const mood = entry.mood ? MOOD_MAP[entry.mood] : null;
  const vis = VIS_META[entry.visibility] ?? VIS_META.friends;
  const preview = entry.body.slice(0, 260) + (entry.body.length > 260 ? "…" : "");

  async function toggleLike() {
    if (!sessionUserId) return;
    setLiked(l => !l);
    setLikes(n => liked ? n - 1 : n + 1);
    await fetch(`/api/chronicle/${entry.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "like" }),
    }).catch(() => {});
  }

  async function handleDelete() {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    await fetch(`/api/chronicle/${entry.id}`, { method: "DELETE" }).catch(() => {});
    onDelete(entry.id);
  }

  return (
    <article style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", transition: "border-color 0.2s, box-shadow 0.2s", position: "relative" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,92,191,0.4)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 32px rgba(124,92,191,0.1)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      {/* Top bar */}
      <div style={{ padding: "18px 22px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <Link href={`/profile/${entry.username}`} style={{ flexShrink: 0 }}>
          <img src={entry.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${entry.username}`}
            style={{ width: 38, height: 38, borderRadius: 10, border: "2px solid rgba(124,92,191,0.3)", objectFit: "cover", display: "block" }} alt="" />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/profile/${entry.username}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-purple-bright)", textDecoration: "none" }}>@{entry.username}</Link>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 1 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{timeAgo(entry.created_at)}</span>
            <span style={{ fontSize: 11, color: vis.color, display: "flex", alignItems: "center", gap: 3 }}>{vis.icon} {vis.label}</span>
            {mood && <span style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "1px 8px", color: "var(--text-secondary)" }}>{mood.icon} {mood.label}</span>}
          </div>
        </div>
        {sessionUserId === entry.user_id && (
          <button onClick={handleDelete} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: "4px", opacity: 0.5 }}>🗑</button>
        )}
      </div>

      {/* Title + preview */}
      <Link href={`/chronicle/${entry.id}`} style={{ textDecoration: "none", display: "block", padding: "14px 22px 16px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.3 }}>{entry.title}</h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{preview}</p>
        {entry.body.length > 260 && (
          <span style={{ display: "inline-block", marginTop: 8, fontSize: 13, color: "var(--accent-purple-bright)", fontWeight: 600 }}>Read more →</span>
        )}
      </Link>

      {/* Actions */}
      <div style={{ padding: "0 22px 16px", display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <button onClick={toggleLike} disabled={!sessionUserId} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: liked ? "rgba(255,100,100,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${liked ? "rgba(255,100,100,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, cursor: sessionUserId ? "pointer" : "default", color: liked ? "#ff6b81" : "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>
          {liked ? "❤️" : "🤍"} {likes}
        </button>
        <Link href={`/chronicle/${entry.id}#comments`} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}>
          💬 {entry.comments_count}
        </Link>
        <Link href={`/chronicle/${entry.id}`} style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", textDecoration: "none", padding: "6px 10px" }}>
          Read full entry →
        </Link>
      </div>
    </article>
  );
}

function WriteModal({ onClose, onSave }: { onClose: () => void; onSave: (e: Entry) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [visibility, setVisibility] = useState("friends");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bodyRef.current?.focus(); }, []);

  // Auto-grow textarea
  function autoGrow(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  async function save() {
    if (!title.trim() || !body.trim()) { setError("Title and entry body are required."); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/chronicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, mood, visibility }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Failed to save"); return; }
      onSave(d as Entry);
    } catch { setError("Network error"); } finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 16px 60px", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 720, background: "var(--bg-elevated)", border: "1px solid var(--border-bright)", borderRadius: 22, boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "22px 28px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, background: "linear-gradient(135deg, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>📜 New Chronicle Entry</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title */}
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder="Entry title…"
            maxLength={200}
            style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", color: "var(--text-primary)", fontSize: 20, fontWeight: 700, outline: "none", boxSizing: "border-box", letterSpacing: -0.3 }}
          />

          {/* Body */}
          <textarea
            ref={bodyRef}
            value={body}
            onChange={autoGrow}
            onKeyDown={e => e.stopPropagation()}
            placeholder="Write your entry here… Tell your story, share your thoughts, record your victories."
            rows={10}
            style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", color: "var(--text-primary)", fontSize: 15, lineHeight: 1.75, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit", overflowY: "hidden" }}
          />

          {/* Mood + visibility row */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center", marginRight: 2 }}>Mood:</span>
              {MOODS.map(m => (
                <button key={m.key} onClick={() => setMood(mood === m.key ? null : m.key)}
                  style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${mood === m.key ? "rgba(124,92,191,0.6)" : "var(--border)"}`, background: mood === m.key ? "rgba(124,92,191,0.2)" : "transparent", color: mood === m.key ? "#a78bfa" : "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Visibility:</span>
            {Object.entries(VIS_META).map(([key, v]) => (
              <button key={key} onClick={() => setVisibility(key)}
                style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${visibility === key ? `${v.color}66` : "var(--border)"}`, background: visibility === key ? `${v.color}22` : "transparent", color: visibility === key ? v.color : "var(--text-muted)", fontSize: 12, cursor: "pointer", fontWeight: visibility === key ? 700 : 400 }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {error && <div style={{ color: "#f87171", fontSize: 13, background: "rgba(248,113,113,0.1)", borderRadius: 8, padding: "8px 12px" }}>⚠ {error}</div>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: "10px 22px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button onClick={save} disabled={saving || !title.trim() || !body.trim()}
              style={{ padding: "10px 28px", background: "linear-gradient(135deg, #7c3aed, #4f8ef0)", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: saving || !title.trim() || !body.trim() ? 0.6 : 1 }}>
              {saving ? "Saving…" : "📜 Publish Entry"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChronicleClient({ initialEntries, sessionUserId, sessionUsername, sessionImage }: {
  initialEntries: Entry[];
  sessionUserId: string | null;
  sessionUsername: string | null;
  sessionImage: string | null;
}) {
  void sessionUsername; void sessionImage;
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [showWrite, setShowWrite] = useState(false);
  const [offset, setOffset] = useState(initialEntries.length);
  const [hasMore, setHasMore] = useState(initialEntries.length === 20);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    const r = await fetch(`/api/chronicle?offset=${offset}`).catch(() => null);
    const d = r?.ok ? await r.json() : [];
    if (Array.isArray(d) && d.length > 0) {
      setEntries(prev => [...prev, ...d]);
      setOffset(o => o + d.length);
      setHasMore(d.length === 20);
    } else setHasMore(false);
    setLoadingMore(false);
  }, [offset]);

  function onSave(entry: Entry) {
    setEntries(prev => [entry, ...prev]);
    setShowWrite(false);
  }

  function onDelete(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 80px" }}>
      {/* Hero banner */}
      <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(79,142,240,0.12) 50%, rgba(74,222,128,0.08) 100%)", borderBottom: "1px solid var(--border)", padding: "44px 32px 36px" }}>
        <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 40, fontWeight: 900, letterSpacing: -1, background: "linear-gradient(135deg, #a78bfa 0%, #60a5fa 60%, #4ade80 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              📜 Chronicle
            </h1>
            <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 15 }}>
              Your story, chapter by chapter — long-form journals from your crew
            </p>
          </div>
          {sessionUserId ? (
            <button onClick={() => setShowWrite(true)}
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f8ef0)", color: "#fff", border: "none", borderRadius: 14, padding: "12px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.35)", letterSpacing: 0.2 }}>
              ✍️ Write Entry
            </button>
          ) : (
            <Link href="/signin" style={{ background: "linear-gradient(135deg, #7c3aed, #4f8ef0)", color: "#fff", borderRadius: 14, padding: "12px 26px", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>Sign in to write</Link>
          )}
        </div>
      </div>

      {/* Feed */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 20px" }}>
        {entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>📜</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No entries yet</div>
            <div style={{ fontSize: 14, marginBottom: 28 }}>Be the first to chronicle your story</div>
            {sessionUserId && (
              <button onClick={() => setShowWrite(true)} style={{ background: "linear-gradient(135deg, #7c3aed, #4f8ef0)", color: "#fff", border: "none", borderRadius: 14, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>✍️ Write Your First Entry</button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {entries.map(e => <EntryCard key={e.id} entry={e} sessionUserId={sessionUserId} onDelete={onDelete} />)}
            </div>
            {hasMore && (
              <div style={{ textAlign: "center", marginTop: 40 }}>
                <button onClick={loadMore} disabled={loadingMore} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 36px", fontSize: 14, color: "var(--text-secondary)", cursor: "pointer", opacity: loadingMore ? 0.6 : 1 }}>
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showWrite && <WriteModal onClose={() => setShowWrite(false)} onSave={onSave} />}
    </div>
  );
}
