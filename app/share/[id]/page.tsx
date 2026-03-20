import { auth } from "@/auth";
import { getShareById, getFriendshipStatus } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import ExpandableImage from "./ExpandableImage";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`;
}

export default async function PublicSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const viewerId = session?.user?.id;

  const share = await getShareById(id, viewerId).catch(() => null);
  if (!share || share.is_hidden) notFound();

  const s = share as {
    id: string; user_id: string; username: string; avatar_url: string | null;
    type: string; title: string | null; caption: string | null;
    image_data: string | null; image_url: string | null; video_url: string | null;
    likes_count: number; user_liked: boolean; created_at: string; flag_count: number;
  };

  const isMine = viewerId === s.user_id;
  const friendship = viewerId && !isMine ? await getFriendshipStatus(viewerId, s.user_id).catch(() => null) : null;
  const isFriend = (friendship as { status?: string } | null)?.status === "accepted";
  const imgSrc = s.image_url ?? s.image_data;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px 80px" }}>
      {/* Back to feed */}
      <div style={{ width: "100%", maxWidth: 600, marginBottom: 20 }}>
        <Link href="/feed" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>← Back to Share</Link>
      </div>

      <article style={{ width: "100%", maxWidth: 600, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 24, overflow: "hidden", boxShadow: "0 4px 40px rgba(0,0,0,0.3)" }}>

        {/* Image — expandable lightbox */}
        {imgSrc && (s.type === "photo" || s.type === "art") && (
          <ExpandableImage
            src={imgSrc}
            alt={s.title ?? "image"}
            aspectRatio={s.type === "photo" ? "4/3" : undefined}
            objectFit={s.type === "photo" ? "cover" : "contain"}
            bg={s.type === "art" ? "#fff" : "#111"}
          />
        )}

        {/* Video */}
        {(s.type === "video" || s.type === "clip") && s.video_url && (() => {
          const ytMatch = s.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (ytMatch) return (
            <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
              <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allowFullScreen />
            </div>
          );
          return <video src={s.video_url} controls style={{ width: "100%", maxHeight: 360, background: "#000" }} />;
        })()}

        <div style={{ padding: "22px 24px" }}>
          {/* Author */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Link href={`/profile/${s.username}`}>
              <img src={s.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${s.username}`}
                style={{ width: 44, height: 44, borderRadius: 12, border: "2px solid rgba(124,92,191,0.35)", objectFit: "cover" }} alt={s.username} />
            </Link>
            <div style={{ flex: 1 }}>
              <Link href={`/profile/${s.username}`} style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-purple-bright)", textDecoration: "none" }}>@{s.username}</Link>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{timeAgo(s.created_at as string)}</div>
            </div>
          </div>

          {s.title && <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>{s.title}</div>}
          {s.caption && <div style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 16 }}>{s.caption}</div>}

          <div style={{ height: 1, background: "var(--border)", marginBottom: 16 }} />

          {/* Actions — like only (no comments for non-friends viewing via link) */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* Like — works for logged-in users */}
            {viewerId ? (
              <form action={`/api/shares/${s.id}`} method="POST" style={{ margin: 0 }}>
                <button
                  type="button"
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", background: s.user_liked ? "rgba(255,100,100,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${s.user_liked ? "rgba(255,100,100,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, cursor: "pointer", color: s.user_liked ? "#ff6b81" : "var(--text-muted)", fontSize: 15, fontFamily: "inherit", fontWeight: 600 }}
                  onClick={async () => { await fetch(`/api/shares/${s.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "like" }) }); }}
                >
                  {s.user_liked ? "❤️" : "🤍"} {s.likes_count}
                </button>
              </form>
            ) : (
              <Link href="/signin" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "var(--text-muted)", fontSize: 15, textDecoration: "none" }}>
                🤍 {s.likes_count}
              </Link>
            )}

            {/* Friend request CTA for non-friends */}
            {viewerId && !isMine && !isFriend && (
              <Link href={`/profile/${s.username}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", background: "rgba(124,92,191,0.12)", border: "1px solid rgba(124,92,191,0.3)", borderRadius: 10, color: "var(--accent-purple-bright)", fontSize: 14, textDecoration: "none", fontWeight: 600 }}>
                ➕ Add @{s.username} as friend
              </Link>
            )}

            {/* Sign-in CTA for guests */}
            {!viewerId && (
              <Link href="/signin" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", background: "rgba(124,92,191,0.12)", border: "1px solid rgba(124,92,191,0.3)", borderRadius: 10, color: "var(--accent-purple-bright)", fontSize: 14, textDecoration: "none", fontWeight: 600 }}>
                Join Flock to connect with @{s.username} →
              </Link>
            )}
          </div>

          {/* Non-friend viewing note */}
          {viewerId && !isMine && !isFriend && (
            <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-muted)", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
              You&apos;re viewing a shared link. Add @{s.username} as a friend to see all their posts on your feed.
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
