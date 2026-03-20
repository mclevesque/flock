"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const MOODS: Record<string, { icon: string; label: string }> = {
  gaming:    { icon: "🎮", label: "Gaming" },
  adventure: { icon: "⚔️", label: "Adventure" },
  thoughts:  { icon: "💭", label: "Thoughts" },
  victory:   { icon: "🏆", label: "Victory" },
  rant:      { icon: "😤", label: "Rant" },
  idea:      { icon: "💡", label: "Idea" },
  feels:     { icon: "❤️", label: "Feels" },
};

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

interface Comment {
  id: string; entry_id: string; author_id: string; username: string;
  avatar_url: string | null; content: string; created_at: string;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function ChronicleEntryClient({
  entry: initialEntry,
  comments: initialComments,
  sessionUserId,
  sessionUsername,
  sessionImage,
}: {
  entry: Entry;
  comments: Comment[];
  sessionUserId: string | null;
  sessionUsername: string | null;
  sessionImage: string | null;
}) {
  void sessionImage;
  const router = useRouter();
  const [entry, setEntry] = useState<Entry>(initialEntry);
  const [liked, setLiked] = useState(initialEntry.user_liked);
  const [likes, setLikes] = useState(initialEntry.likes_count);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const commentEndRef = useRef<HTMLDivElement>(null);

  const mood = entry.mood ? MOODS[entry.mood] : null;
  const vis = VIS_META[entry.visibility] ?? VIS_META.friends;
  const isOwner = sessionUserId === entry.user_id;

  // Scroll to #comments on hash
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#comments") {
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    }
  }, []);

  async function toggleLike() {
    if (!sessionUserId) return;
    const wasLiked = liked;
    setLiked(l => !l);
    setLikes(n => wasLiked ? n - 1 : n + 1);
    await fetch(`/api/chronicle/${entry.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "like" }),
    }).catch(() => {});
  }

  async function postComment() {
    if (!sessionUserId || !commentText.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/chronicle/${entry.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "comment", content: commentText.trim() }),
      });
      const d = await r.json();
      if (r.ok && d.id) {
        setComments(prev => [...prev, {
          id: d.id,
          entry_id: entry.id,
          author_id: sessionUserId,
          username: sessionUsername ?? "you",
          avatar_url: null,
          content: commentText.trim(),
          created_at: new Date().toISOString(),
        }]);
        setEntry(e => ({ ...e, comments_count: e.comments_count + 1 }));
        setCommentText("");
        setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch { /* ignore */ } finally { setPosting(false); }
  }

  async function deleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    await fetch(`/api/chronicle/${entry.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-comment", commentId }),
    }).catch(() => {});
    setComments(prev => prev.filter(c => c.id !== commentId));
    setEntry(e => ({ ...e, comments_count: Math.max(0, e.comments_count - 1) }));
  }

  async function deleteEntry() {
    if (!confirm("Permanently delete this entry? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/chronicle/${entry.id}`, { method: "DELETE" }).catch(() => {});
    router.push("/chronicle");
  }

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 100px" }}>
      {/* Header breadcrumb */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/chronicle" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
          ← Chronicle
        </Link>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{entry.title.slice(0, 50)}{entry.title.length > 50 ? "…" : ""}</span>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px 0" }}>
        {/* Author row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <Link href={`/profile/${entry.username}`}>
            <img
              src={entry.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${entry.username}`}
              style={{ width: 48, height: 48, borderRadius: 14, border: "2px solid rgba(124,92,191,0.35)", objectFit: "cover", display: "block" }}
              alt=""
            />
          </Link>
          <div>
            <Link href={`/profile/${entry.username}`} style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-purple-bright)", textDecoration: "none", display: "block" }}>
              @{entry.username}
            </Link>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {formatDate(entry.created_at)}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 12, color: vis.color, display: "flex", alignItems: "center", gap: 3, background: `${vis.color}18`, borderRadius: 20, padding: "3px 10px", border: `1px solid ${vis.color}40` }}>
              {vis.icon} {vis.label}
            </span>
            {mood && (
              <span style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "3px 10px", border: "1px solid rgba(255,255,255,0.1)" }}>
                {mood.icon} {mood.label}
              </span>
            )}
            {isOwner && (
              <>
                <button onClick={() => setEditOpen(true)} style={{ background: "rgba(124,92,191,0.12)", border: "1px solid rgba(124,92,191,0.3)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "#a78bfa", cursor: "pointer" }}>✏️ Edit</button>
                <button onClick={deleteEntry} disabled={deleting} style={{ background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "#f87171", cursor: "pointer" }}>🗑 Delete</button>
              </>
            )}
          </div>
        </div>

        {/* Title */}
        <h1 style={{ margin: "0 0 28px", fontSize: 36, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.25, color: "var(--text-primary)" }}>
          {entry.title}
        </h1>

        {/* Divider */}
        <div style={{ height: 2, background: "linear-gradient(90deg, rgba(124,92,191,0.4), rgba(79,142,240,0.2), transparent)", borderRadius: 2, marginBottom: 32 }} />

        {/* Body */}
        <div style={{ fontSize: 16, lineHeight: 1.85, color: "var(--text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 40 }}>
          {entry.body}
        </div>

        {/* Like + action row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: 48 }}>
          <button
            onClick={toggleLike}
            disabled={!sessionUserId}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 20px",
              background: liked ? "rgba(255,100,100,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${liked ? "rgba(255,100,100,0.3)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 12, cursor: sessionUserId ? "pointer" : "default",
              color: liked ? "#ff6b81" : "var(--text-muted)", fontSize: 15, fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            {liked ? "❤️" : "🤍"} {likes} {likes === 1 ? "like" : "likes"}
          </button>
          <a href="#comments" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "var(--text-muted)", fontSize: 14, textDecoration: "none" }}>
            💬 {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </a>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Updated {timeAgo(entry.updated_at)}
          </span>
        </div>

        {/* Comments section */}
        <section id="comments">
          <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
            💬 Comments ({comments.length})
          </h2>

          {comments.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 14 }}>
              No comments yet — be the first to reply!
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: "flex", gap: 12, padding: "14px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
                <Link href={`/profile/${c.username}`} style={{ flexShrink: 0 }}>
                  <img
                    src={c.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${c.username}`}
                    style={{ width: 34, height: 34, borderRadius: 9, border: "2px solid rgba(124,92,191,0.25)", objectFit: "cover", display: "block" }}
                    alt=""
                  />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <Link href={`/profile/${c.username}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-purple-bright)", textDecoration: "none" }}>@{c.username}</Link>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{timeAgo(c.created_at)}</span>
                    {sessionUserId === c.author_id && (
                      <button onClick={() => deleteComment(c.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, padding: "2px 6px", opacity: 0.6 }}>×</button>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.content}</p>
                </div>
              </div>
            ))}
            <div ref={commentEndRef} />
          </div>

          {/* Comment input */}
          {sessionUserId ? (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment…"
                rows={3}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) postComment(); }}
                style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", color: "var(--text-primary)", fontSize: 14, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit" }}
              />
              <button
                onClick={postComment}
                disabled={posting || !commentText.trim()}
                style={{ padding: "12px 20px", background: "linear-gradient(135deg, #7c3aed, #4f8ef0)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: posting || !commentText.trim() ? 0.6 : 1, flexShrink: 0 }}
              >
                {posting ? "Posting…" : "Reply"}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: 14, background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)" }}>
              <Link href="/signin" style={{ color: "var(--accent-purple-bright)", textDecoration: "none", fontWeight: 600 }}>Sign in</Link> to leave a comment
            </div>
          )}
        </section>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <EditModal
          entry={entry}
          onClose={() => setEditOpen(false)}
          onSave={updated => { setEntry(updated); setEditOpen(false); }}
        />
      )}
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
const MOODS_ARR = [
  { key: "gaming",   icon: "🎮", label: "Gaming" },
  { key: "adventure",icon: "⚔️", label: "Adventure" },
  { key: "thoughts", icon: "💭", label: "Thoughts" },
  { key: "victory",  icon: "🏆", label: "Victory" },
  { key: "rant",     icon: "😤", label: "Rant" },
  { key: "idea",     icon: "💡", label: "Idea" },
  { key: "feels",    icon: "❤️", label: "Feels" },
];

function EditModal({ entry, onClose, onSave }: { entry: Entry; onClose: () => void; onSave: (e: Entry) => void }) {
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.body);
  const [mood, setMood] = useState<string | null>(entry.mood);
  const [visibility, setVisibility] = useState(entry.visibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = `${bodyRef.current.scrollHeight}px`;
    }
  }, []);

  async function save() {
    if (!title.trim() || !body.trim()) { setError("Title and body are required."); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch(`/api/chronicle/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, mood, visibility }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Failed to save"); return; }
      onSave({ ...entry, title, body, mood, visibility, updated_at: new Date().toISOString(), ...d });
    } catch { setError("Network error"); } finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 16px 60px", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 720, background: "var(--bg-elevated)", border: "1px solid var(--border-bright)", borderRadius: 22, boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding: "22px 28px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>✏️ Edit Entry</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title…" maxLength={200}
            style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", color: "var(--text-primary)", fontSize: 18, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />

          <textarea ref={bodyRef} value={body} onChange={autoGrow} placeholder="Your entry…" rows={12}
            style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", color: "var(--text-primary)", fontSize: 15, lineHeight: 1.75, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit", overflowY: "hidden" }} />

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 2 }}>Mood:</span>
            {MOODS_ARR.map(m => (
              <button key={m.key} onClick={() => setMood(mood === m.key ? null : m.key)}
                style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${mood === m.key ? "rgba(124,92,191,0.6)" : "var(--border)"}`, background: mood === m.key ? "rgba(124,92,191,0.2)" : "transparent", color: mood === m.key ? "#a78bfa" : "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
                {m.icon} {m.label}
              </button>
            ))}
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

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "10px 22px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button onClick={save} disabled={saving || !title.trim() || !body.trim()}
              style={{ padding: "10px 28px", background: "linear-gradient(135deg, #7c3aed, #4f8ef0)", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: saving || !title.trim() || !body.trim() ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
