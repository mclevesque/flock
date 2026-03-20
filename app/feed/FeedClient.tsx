"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Share {
  id: string; user_id: string; username: string; avatar_url: string | null;
  type: string; title: string | null; caption: string | null;
  image_data: string | null; image_url: string | null; video_url: string | null;
  game_data: Record<string, unknown> | null;
  likes_count: number; user_liked: boolean; created_at: string;
  view_count?: number; flag_count?: number; is_hidden?: boolean;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`; return `${Math.floor(s/86400)}d`;
}

function GameWinCard({ data }: { data: Record<string, unknown> }) {
  const icons: Record<string, string> = { chess: "♟️", quiz: "🧠", poker: "🃏", snes: "🎮" };
  const colors: Record<string, string> = { chess: "124,92,191", quiz: "74,144,217", poker: "74,217,144", snes: "239,130,56" };
  const game = (data.game as string) ?? "game";
  const c = colors[game] ?? "124,92,191";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: `rgba(${c},0.08)`, borderRadius: 12, border: `1px solid rgba(${c},0.25)` }}>
      <span style={{ fontSize: 40 }}>{icons[game] ?? "🏆"}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: `rgb(${c})` }}>{data.result as string ?? "Victory!"}</div>
        {!!data.opponent && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>vs @{String(data.opponent)}</div>}
        {!!data.score && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1 }}>Score: {String(data.score)}</div>}
      </div>
      <div style={{ marginLeft: "auto", fontSize: 28 }}>🏆</div>
    </div>
  );
}

function VideoCard({ url, shareId, onView }: { url: string; shareId?: string; onView?: () => void }) {
  const viewedRef = useRef(false);
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  function trackView() {
    if (viewedRef.current || !shareId) return;
    viewedRef.current = true;
    const numId = Number(shareId);
    if (!isNaN(numId)) { /* view tracking removed */ }
    onView?.();
  }
  if (ytMatch) return (
    <div style={{ position: "relative", paddingBottom: "56.25%", borderRadius: 12, overflow: "hidden", background: "#000" }} onClick={trackView}>
      <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allowFullScreen />
    </div>
  );
  return <video src={url} controls style={{ width: "100%", borderRadius: 12, maxHeight: 320, background: "#000" }} onPlay={trackView} />;
}

function ShareLinkModal({ share, onClose, friends }: { share: Share; onClose: () => void; friends: { id: string; username: string; avatar_url: string | null }[] }) {
  const [copied, setCopied] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/share/${share.id}`;

  async function copyLink() {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function sendToFriend(friendId: string, friendName: string) {
    await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiverId: friendId, content: `Check out this post on Flock: ${link}` }) }).catch(() => {});
    setSentTo(friendName); setTimeout(() => setSentTo(null), 2500);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-bright)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>↗ Share Post</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <div style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link}</div>
          <button onClick={copyLink} style={{ padding: "10px 18px", background: copied ? "rgba(74,217,144,0.2)" : "rgba(124,92,191,0.2)", border: `1px solid ${copied ? "rgba(74,217,144,0.4)" : "rgba(124,92,191,0.4)"}`, borderRadius: 10, color: copied ? "#4ad990" : "var(--accent-purple-bright)", cursor: "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
            {copied ? "✓ Copied" : "Copy Link"}
          </button>
        </div>
        {friends.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Send to a Friend on Flock</div>
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {friends.map(f => (
                <button key={f.id} onClick={() => sendToFriend(f.id, f.username)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: sentTo === f.username ? "rgba(74,217,144,0.1)" : "var(--bg-surface)", border: `1px solid ${sentTo === f.username ? "rgba(74,217,144,0.3)" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", width: "100%" }}>
                  <img src={f.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${f.username}`} style={{ width: 28, height: 28, borderRadius: 8, objectFit: "cover" }} alt="" />
                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>@{f.username}</span>
                  {sentTo === f.username && <span style={{ marginLeft: "auto", fontSize: 12, color: "#4ad990" }}>Sent! ✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
        <button onClick={onClose} style={{ marginTop: 16, width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 10, padding: 10, fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>Close</button>
      </div>
    </div>
  );
}

const TYPE_META: Record<string, { label: string; bg: string; color: string }> = {
  art:      { label: "🎨 Art",    bg: "rgba(165,105,255,0.12)", color: "#b97dff" },
  photo:    { label: "📸 Photo",  bg: "rgba(255,140,50,0.12)",  color: "#ffaa44" },
  video:    { label: "🎬 Video",  bg: "rgba(74,144,217,0.12)",  color: "#5aabf5" },
  thoughts: { label: "💭 Thoughts", bg: "rgba(124,92,191,0.12)", color: "#a78bfa" },
  tag:      { label: "🏃 Tag",    bg: "rgba(255,183,77,0.12)",  color: "#ffcc66" },
  game_win: { label: "🏆 Win",    bg: "rgba(74,217,144,0.12)",  color: "#4ad990" },
};
const getTypeMeta = (t: string) => TYPE_META[t] ?? TYPE_META.game_win;

function ShareCard({ share, onLike, onDelete, isOwn, isAdmin, onFlag, onShare, onImageClick }: {
  share: Share; onLike: (id: string) => void; onDelete: (id: string) => void;
  isOwn: boolean; isAdmin?: boolean; onFlag: (id: string) => void; onShare: (share: Share) => void;
  onImageClick?: (src: string, alt: string) => void;
}) {
  const [liked, setLiked] = useState(share.user_liked);
  const [likes, setLikes] = useState(share.likes_count);
  const [views, setViews] = useState(share.view_count ?? 0);
  const [flagged, setFlagged] = useState(false);
  const meta = getTypeMeta(share.type);
  const imgSrc = share.image_url ?? (share.type !== "photo" ? share.image_data : null);

  async function toggleLike() {
    const prev = liked, prevN = likes;
    setLiked(!prev); setLikes(l => prev ? l - 1 : l + 1);
    try {
      const r = await fetch(`/api/shares/${share.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "like" }) });
      const d = await r.json();
      setLiked(d.liked); setLikes(prev ? prevN - 1 : prevN + 1);
    } catch { setLiked(prev); setLikes(prevN); }
    onLike(share.id);
  }

  async function handleFlag() {
    if (flagged || isOwn) return;
    if (!confirm("Report this post for violating community guidelines?")) return;
    const r = await fetch(`/api/shares/${share.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "flag" }) });
    const d = await r.json();
    setFlagged(true);
    if (d.hidden) onFlag(share.id);
  }

  return (
    <article style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 24, overflow: "hidden", transition: "border-color 0.2s, box-shadow 0.2s", boxShadow: "0 2px 24px rgba(0,0,0,0.18)" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,92,191,0.45)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 40px rgba(124,92,191,0.12)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 24px rgba(0,0,0,0.18)"; }}
    >
      {/* Photo / art image — 4:3, click to open lightbox */}
      {imgSrc && (share.type === "photo" || share.type === "art") && (
        <div
          onClick={() => onImageClick?.(imgSrc, share.title ?? "image")}
          style={{
            width: "100%",
            aspectRatio: share.type === "photo" ? "4/3" : undefined,
            maxHeight: share.type === "art" ? 560 : undefined,
            background: "#111", overflow: "hidden", lineHeight: 0,
            cursor: onImageClick ? "zoom-in" : "default",
            position: "relative",
          }}
        >
          <img src={imgSrc} alt={share.title ?? "image"} style={{ width: "100%", height: "100%", objectFit: share.type === "photo" ? "cover" : "contain", display: "block", background: share.type === "art" ? "#fff" : undefined }} />
          {onImageClick && (
            <div style={{
              position: "absolute", bottom: 10, right: 10,
              background: "rgba(0,0,0,0.55)", borderRadius: 8, padding: "4px 9px",
              fontSize: 12, color: "rgba(255,255,255,0.7)", pointerEvents: "none",
              backdropFilter: "blur(4px)",
            }}>⛶ expand</div>
          )}
        </div>
      )}
      {/* Video */}
      {(share.type === "video" || share.type === "clip") && share.video_url && (
        <div style={{ padding: "20px 24px 12px" }}><VideoCard url={share.video_url} shareId={share.id} onView={() => setViews(v => v + 1)} /></div>
      )}
      <div style={{ padding: "20px 24px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Link href={`/profile/${share.username}`} style={{ flexShrink: 0 }}>
            <img src={share.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${share.username}`}
              onError={e => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${share.username}`; }}
              style={{ width: 42, height: 42, borderRadius: 12, border: "2px solid rgba(124,92,191,0.35)", display: "block", objectFit: "cover" }} alt={share.username} />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link href={`/profile/${share.username}`} style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-purple-bright)", textDecoration: "none", display: "block" }}>@{share.username}</Link>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{timeAgo(share.created_at)} ago</div>
          </div>
          <div style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: meta.bg, color: meta.color, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{meta.label}</div>
        </div>
        {share.title && <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.35 }}>{share.title}</div>}
        {share.caption && <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 10 }}>{share.caption}</div>}
        {share.type === "game_win" && share.game_data && <div style={{ marginBottom: 12 }}><GameWinCard data={share.game_data} /></div>}
        <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={toggleLike} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: liked ? "rgba(255,100,100,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${liked ? "rgba(255,100,100,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, cursor: "pointer", color: liked ? "#ff6b81" : "var(--text-muted)", fontSize: 14, fontFamily: "inherit", fontWeight: 600, transition: "all 0.15s" }}>
            {liked ? "❤️" : "🤍"} <span>{likes}</span>
          </button>
          {(share.type === "video" || share.type === "clip") && views > 0 && (
            <span style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, padding: "7px 12px" }}>👁 {views.toLocaleString()}</span>
          )}
          <button onClick={() => onShare(share)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, cursor: "pointer", color: "var(--text-muted)", fontSize: 13, fontFamily: "inherit" }}>↗ Share</button>
          <div style={{ flex: 1 }} />
          {!isOwn && !isAdmin && (
            <button onClick={handleFlag} title="Report post" style={{ background: "transparent", border: "none", color: flagged ? "rgba(255,80,80,0.5)" : "var(--text-muted)", cursor: flagged ? "default" : "pointer", fontSize: 15, padding: "7px 8px", opacity: flagged ? 0.5 : 0.55 }}>🚩</button>
          )}
          {(isOwn || isAdmin) && (
            <button onClick={() => { if (confirm("Delete this post?")) onDelete(share.id); }} title="Delete post" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: "7px 10px", opacity: 0.6 }}>🗑</button>
          )}
        </div>
      </div>
    </article>
  );
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        cursor: "zoom-out",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 18, right: 18,
          background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "50%", width: 42, height: 42, fontSize: 20, color: "#fff",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1,
        }}
      >×</button>
      {/* Image — natural size but capped to viewport */}
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "min(92vw, 1400px)",
          maxHeight: "90dvh",
          objectFit: "contain",
          borderRadius: 12,
          boxShadow: "0 0 80px rgba(0,0,0,0.8)",
          cursor: "default",
          display: "block",
        }}
      />
      <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
        Click anywhere outside to close · Esc
      </div>
    </div>
  );
}

async function checkNSFW(imgElement: HTMLImageElement): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nsfwjs = await import("nsfwjs") as any;
    const model = await (nsfwjs.default ?? nsfwjs).load();
    const predictions = await model.classify(imgElement);
    type P = { className: string; probability: number };
    const get = (name: string) => (predictions as P[]).find(p => p.className === name)?.probability ?? 0;
    return get("Porn") > 0.6 || get("Hentai") > 0.6 || get("Sexy") > 0.5;
  } catch { return false; }
}

export default function FeedClient() {
  const { data: session } = useSession();
  const [shares, setShares] = useState<Share[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [uploadType, setUploadType] = useState<"photo" | "thoughts">("photo");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadVideoFileName, setUploadVideoFileName] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [nsfwChecking, setNsfwChecking] = useState(false);
  const [shareModal, setShareModal] = useState<Share | null>(null);
  const [friends, setFriends] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewImgRef = useRef<HTMLImageElement | null>(null);

  const load = useCallback(async (o = 0) => {
    try {
      const r = await fetch(`/api/shares?offset=${o}`);
      const d = await r.json();
      const arr: Share[] = Array.isArray(d) ? d : (d.shares ?? []);
      const fc: number = d.friendCount ?? 0;
      if (o === 0) setShares(arr); else setShares(prev => [...prev, ...arr]);
      setFriendCount(fc);
      setHasMore(arr.length === 24);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(0); }, [load]);
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/friends").then(r => r.json()).then(d => { if (Array.isArray(d)) setFriends(d); }).catch(() => {});
  }, [session?.user?.id]);

  function onLike(_id: string) { void _id; }
  function onFlag(id: string) { setShares(prev => prev.filter(s => s.id !== id)); }
  async function onDelete(id: string) {
    try {
      await fetch(`/api/shares/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete" }) });
      setShares(prev => prev.filter(s => s.id !== id));
    } catch { /* ignore */ }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith("image/")) { setUploadError("Please select an image file."); return; }
    if (f.size > 8 * 1024 * 1024) { setUploadError("Image must be under 8 MB."); return; }
    setUploadFile(f); setUploadPreview(URL.createObjectURL(f)); setUploadError(null);
  }

  async function uploadShare() {
    if (!session?.user?.id) return;
    setUploadError(null);
    if (uploadType === "photo" && uploadFile && previewImgRef.current) {
      setNsfwChecking(true);
      const isNsfw = await checkNSFW(previewImgRef.current);
      setNsfwChecking(false);
      if (isNsfw) { setUploadError("This image was flagged as explicit or suggestive and cannot be posted on Flock."); return; }
    }
    setUploading(true);
    try {
      let imageUrl: string | null = null;
      if (uploadType === "photo" && uploadFile) {
        const form = new FormData(); form.append("file", uploadFile);
        const res = await fetch("/api/upload/photo", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) { setUploadError(data.error ?? "Upload failed"); setUploading(false); return; }
        imageUrl = data.url;
      }
      const res = await fetch("/api/shares", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: uploadType, title: uploadTitle || null, caption: uploadCaption || null, imageUrl, videoUrl: uploadType !== "photo" && uploadUrl ? uploadUrl : null }),
      });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Post failed"); setUploading(false); return; }
      setShowUpload(false); setUploadTitle(""); setUploadCaption(""); setUploadUrl(""); setUploadFile(null); setUploadPreview(null); setUploadVideoFileName(null);
      load(0);
    } catch { setUploadError("Something went wrong. Try again."); }
    finally { setUploading(false); }
  }

  const canPost = uploadType === "photo" ? !!uploadFile && !!uploadTitle.trim() : uploadType === "thoughts" ? !!uploadTitle.trim() : !!uploadTitle.trim() && !!uploadUrl.trim();

  return (
    <>
    <div style={{ minHeight: "100vh", padding: "0 0 80px" }}>
      <div style={{ background: "linear-gradient(135deg, rgba(124,92,191,0.12) 0%, rgba(232,67,147,0.08) 50%, rgba(79,172,254,0.08) 100%)", borderBottom: "1px solid var(--border)", padding: "40px 32px 32px" }}>
        <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, letterSpacing: -1, background: "linear-gradient(135deg, #f093fb 0%, #f5576c 40%, #4facfe 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>✨ Share</h1>
            <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 15 }}>Photos, art, wins, and clips from friends</p>
          </div>
          {session?.user?.id && (
            <button onClick={() => setShowUpload(true)} style={{ background: "linear-gradient(135deg, var(--accent-purple), #e84393)", color: "#fff", border: "none", borderRadius: 14, padding: "12px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3, boxShadow: "0 4px 20px rgba(124,92,191,0.35)" }}>+ Share Something</button>
          )}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => { setShowUpload(false); setUploadError(null); setUploadVideoFileName(null); setUploadUrl(""); }}>
          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-bright)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.7)", maxHeight: "92dvh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 22px", fontSize: 18, fontWeight: 700 }}>Share Something</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {([["photo","📸 Photo"],["thoughts","💭 Thoughts"]] as [string,string][]).map(([t, label]) => (
                <button key={t} onClick={() => { setUploadType(t as typeof uploadType); setUploadFile(null); setUploadPreview(null); setUploadUrl(""); setUploadVideoFileName(null); setUploadError(null); }}
                  style={{ flex: 1, padding: "9px", borderRadius: 10, border: "1px solid var(--border)", background: uploadType === t ? "rgba(124,92,191,0.25)" : "transparent", color: uploadType === t ? "var(--accent-purple-bright)" : "var(--text-muted)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  {label}
                </button>
              ))}
            </div>

            {uploadType === "photo" && (
              <div style={{ marginBottom: 16 }}>
                <div onClick={() => fileInputRef.current?.click()} style={{ width: "100%", aspectRatio: "4/3", borderRadius: 14, overflow: "hidden", border: `2px dashed ${uploadPreview ? "transparent" : "var(--border)"}`, background: uploadPreview ? "#000" : "rgba(255,255,255,0.03)", cursor: "pointer", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {uploadPreview ? (
                    <img ref={previewImgRef} src={uploadPreview} crossOrigin="anonymous" alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
                      <div style={{ fontSize: 13 }}>Click to upload a photo</div>
                      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>JPEG · PNG · GIF · WebP · max 8 MB</div>
                    </div>
                  )}
                  {nsfwChecking && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 }}>Checking content…</div>}
                </div>
                {uploadPreview && <button onClick={() => { setUploadFile(null); setUploadPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", marginTop: 6 }}>✕ Remove photo</button>}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept={uploadType === "photo" ? "image/*" : "video/*"} style={{ display: "none" }} onChange={handleFileChange} />
            <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Title *" style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 14px", color: "var(--text-primary)", fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" }} />
            <textarea value={uploadCaption} onChange={e => setUploadCaption(e.target.value)} placeholder="Caption (optional)" rows={2} style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 14px", color: "var(--text-primary)", fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />

            {uploadType === "thoughts" && (
              <div style={{ background: "rgba(124,92,191,0.06)", border: "1px solid rgba(124,92,191,0.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 13, color: "var(--text-muted)" }}>
                💭 Quick thought — just a title and caption, no media needed
              </div>
            )}

            {uploadError && (
              <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ff8080", marginBottom: 14 }}>⚠️ {uploadError}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowUpload(false); setUploadError(null); setUploadVideoFileName(null); setUploadUrl(""); }} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 10, padding: 11, fontSize: 14, color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
              <button onClick={uploadShare} disabled={uploading || nsfwChecking || !canPost} style={{ flex: 2, background: "linear-gradient(135deg, var(--accent-purple), #e84393)", color: "#fff", border: "none", borderRadius: 10, padding: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: (uploading || nsfwChecking || !canPost) ? 0.6 : 1 }}>
                {nsfwChecking ? "Checking…" : uploading ? "Sharing…" : "✨ Share"}
              </button>
            </div>
          </div>
        </div>
      )}

      {shareModal && <ShareLinkModal share={shareModal} onClose={() => setShareModal(null)} friends={friends} />}

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px 0" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)", fontSize: 15 }}>Loading feed…</div>
        ) : shares.length === 0 ? (
          <div style={{ textAlign: "center", padding: 100 }}>
            {session?.user?.id && friendCount === 0 ? (
              <>
                <div style={{ fontSize: 64, marginBottom: 20 }}>👋</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Your feed is waiting!</div>
                <div style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 8 }}>Share is friends-only — your friends&apos; posts appear here.</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 28 }}>Add some friends to see their photos and highlights!</div>
                <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                  <a href="/friends" style={{ background: "rgba(124,92,191,0.2)", border: "1px solid rgba(124,92,191,0.4)", borderRadius: 14, padding: "12px 24px", fontSize: 15, color: "var(--accent-purple-bright)", textDecoration: "none" }}>🔍 Find Friends</a>
                  <button onClick={() => setShowUpload(true)} style={{ background: "rgba(232,67,147,0.15)", border: "1px solid rgba(232,67,147,0.35)", borderRadius: 14, padding: "12px 24px", fontSize: 15, color: "#e84393", cursor: "pointer" }}>📸 Post your first photo</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 64, marginBottom: 20 }}>✨</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Nothing here yet</div>
                <div style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 28 }}>Be the first — share a photo, win, or clip!</div>
                <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={() => setShowUpload(true)} style={{ background: "rgba(124,92,191,0.2)", border: "1px solid rgba(124,92,191,0.4)", borderRadius: 14, padding: "12px 24px", fontSize: 15, color: "var(--accent-purple-bright)", cursor: "pointer" }}>📸 Share a Photo</button>
                  <a href="/draw" style={{ background: "rgba(74,144,217,0.15)", border: "1px solid rgba(74,144,217,0.35)", borderRadius: 14, padding: "12px 24px", fontSize: 15, color: "#4a90d9", textDecoration: "none" }}>🎨 Draw Art</a>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
              {shares.map(s => <ShareCard key={s.id} share={s} onLike={onLike} onDelete={onDelete} isOwn={session?.user?.id === s.user_id} isAdmin={session?.user?.name === "mclevesque"} onFlag={onFlag} onShare={setShareModal} onImageClick={(src, alt) => setLightbox({ src, alt })} />)}
            </div>
            {hasMore && (
              <div style={{ textAlign: "center", marginTop: 48 }}>
                <button onClick={() => { const o = offset + 24; setOffset(o); load(o); }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 36px", fontSize: 14, color: "var(--text-secondary)", cursor: "pointer" }}>Load more</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>

    {/* Image lightbox */}
    {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </>
  );
}
