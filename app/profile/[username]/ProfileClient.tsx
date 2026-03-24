"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { actionSendFriendRequest, actionAcceptFriendRequest, actionPostWallComment } from "@/lib/actions";
import ProfileMusicPlayer from "@/app/components/ProfileMusicPlayer";
import { useVoice } from "@/app/components/VoiceWidget";
import { VIBE_TAGS } from "@/app/vibe/vibeData";
import { useVibe } from "@/app/components/VibePlayer";
import { friendAdded, drop as dropSound, pop, swoosh, click as clickSound } from "@/app/components/sounds";
import StoryViewer from "@/app/components/StoryViewer";

interface User {
  id: string; username: string; display_name: string; bio: string;
  location: string; website: string; banner_url: string; avatar_url: string;
  profile_song_title: string; profile_song_artist: string; profile_song_url: string;
  discord_handle: string; steam_handle: string;
  chess_rating: number; chess_wins: number; chess_losses: number; chess_draws: number;
  favorite_game?: string | null;
}

interface SnesGame {
  id: string; game_name: string; status: string; winner_id: string | null;
  host_id: string; guest_id: string | null;
  host_username: string; host_avatar: string | null;
  guest_username: string | null; guest_avatar: string | null;
  updated_at: string;
}

interface ChessGame {
  id: string; status: string; winner_id: string | null;
  white_id: string; black_id: string;
  white_username: string; white_avatar: string;
  black_username: string; black_avatar: string;
  updated_at: string; moves: string[];
}

interface Video { id: number; title: string; url: string; views: number; created_at: string; }
interface WallPost { id: number; author_id: string; content: string; created_at: string; username: string; avatar_url: string; }
interface WallReply { id: number; post_id: number; author_id: string; content: string; created_at: string; username: string; avatar_url: string | null; parent_id?: number | null; edited_at?: string | null; }
interface Friendship { status: string; requester_id: string; }
interface Friend { id: string; username: string; display_name: string; avatar_url: string; }

interface Privileges {
  snes_access: boolean;
  can_post: boolean;
  can_comment: boolean;
  can_voice: boolean;
  site_ban_until: string | null;
  updated_at?: string;
}

interface Props {
  user: User | null;
  videos: Video[];
  wallPosts: WallPost[];
  initialReplies?: Record<number, WallReply[]>;
  friendship: Friendship | null;
  friends: Friend[];
  sessionUserId: string | null;
  sessionUsername: string | null;
  username: string;
  storageBytes: number;
  lastChessGame: ChessGame | null;
  replyPrivacy: string;
  lastSnesGame: SnesGame | null;
  privileges: Privileges | null;
  adventureStats: { level: number; xp: number; class: string | null; wins: number; quests_completed: number } | null;
}



const VIDEO_GRADIENTS = [
  "linear-gradient(135deg, #1a0a2e, #3d1b6e)",
  "linear-gradient(135deg, #0a1a2e, #1b3d6e)",
  "linear-gradient(135deg, #0a2e1a, #1b6e3d)",
];

const STORAGE_LIMIT = 1 * 1024 * 1024 * 1024; // 1 GB

function extractYouTubeId(text: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return m[1];
  }
  return null;
}

function stripYouTubeUrl(text: string): string {
  return text.replace(/https?:\/\/(www\.)?(youtube\.com\/(watch\?[^\s]*|shorts\/[^\s]*|embed\/[^\s]*)|youtu\.be\/[^\s]*)/g, "").trim();
}

function fmtBytes(b: number) {
  if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

const MODERATORS = ["mclevesque"];

export default function ProfileClient({ user, videos, wallPosts: initialWallPosts, initialReplies, friendship, friends, sessionUserId, sessionUsername, username, storageBytes, lastChessGame, replyPrivacy: _replyPrivacy, lastSnesGame, privileges: initialPrivileges, adventureStats }: Props) {
  void _replyPrivacy; // used server-side only; editing is in /profile/edit
  const isMod = MODERATORS.includes((sessionUsername ?? "").toLowerCase());
  const [privileges, setPrivileges] = useState<Privileges>(initialPrivileges ?? { snes_access: true, can_post: true, can_comment: true, can_voice: true, site_ban_until: null });
  const [privSaving, setPrivSaving] = useState(false);
  const [privSaved, setPrivSaved] = useState(false);
  const [wallPosts, setWallPosts] = useState(initialWallPosts);
  const [wallInput, setWallInput] = useState("");
  const [wallError, setWallError] = useState("");
  const [vibeInterests, setVibeInterests] = useState<string[]>([]);
  const { setInterests: setMyVibe, play: playVibe, playlist: vibePlaylist, playing: vibePlaying, pause: vibePause, stop: vibeStop } = useVibe();
  const [profileTab, setProfileTab] = useState<"videos" | "vibe" | "wall">("videos");
  // replies: map of postId → replies array (seeded from SSR batch load, refreshed client-side)
  const [replies, setReplies] = useState<Record<number, WallReply[]>>(initialReplies ?? {});
  // which posts have their replies expanded (Set of postIds)
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(() => {
    // Auto-expand posts that already have replies from SSR
    return new Set(Object.keys(initialReplies ?? {}).map(Number).filter(id => (initialReplies?.[id]?.length ?? 0) > 0));
  });
  // which post's reply input is open (only one at a time)
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  // reply input text
  const [replyInput, setReplyInput] = useState("");
  const [replyLoading, setReplyLoading] = useState<number | null>(null);
  const [editingReply, setEditingReply] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [replyingToReply, setReplyingToReply] = useState<{ replyId: number; username: string; postId: number } | null>(null);
  const [nestedReplyInput, setNestedReplyInput] = useState("");
  const [nestedReplyLoading, setNestedReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [deletingPost, setDeletingPost] = useState<number | null>(null);
  const [deletingReply, setDeletingReply] = useState<number | null>(null);
  const [friendStatus, setFriendStatus] = useState(friendship?.status ?? null);
  const [showGames, setShowGames] = useState(false);
  const [launchingGame, setLaunchingGame] = useState(false);
  const { startDmCall } = useVoice();

  // They sent ME a request (I can accept it)
  const theyRequestedMe = friendStatus === "pending" && friendship?.requester_id === user?.id;
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(2);
  const isOwn = sessionUserId === user?.id;

  // Story state — fetch on mount if logged in, check if this profile user has an active story
  type Story = { id: string; user_id: string; username: string; avatar_url: string | null; video_url: string | null; thumbnail_url: string | null; duration_seconds: number; expires_at: string; views: number; };
  const [profileStory, setProfileStory] = useState<Story | null>(null);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  useEffect(() => {
    if (!sessionUserId || !user?.id) return;
    fetch("/api/stories")
      .then(r => r.ok ? r.json() : { stories: [] })
      .then(d => {
        const match = (d.stories as Story[]).find(s => s.user_id === user.id);
        setProfileStory(match ?? null);
      })
      .catch(() => {});
  }, [sessionUserId, user?.id]);

  // Draggable friends
  const [friendOrder, setFriendOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return friends.map(f => f.id);
    try { const s = localStorage.getItem(`flock_friend_order_${user?.id}`); return s ? JSON.parse(s) : friends.map(f => f.id); } catch { return friends.map(f => f.id); }
  });
  const [showAllFriends, setShowAllFriends] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  // Touch drag state for mobile friend reorder
  const touchDragIdx = useRef<number | null>(null);
  const touchDragOver = useRef<number | null>(null);
  const friendsGridRef = useRef<HTMLDivElement>(null);

  // Client-side reply refresh — always fetch fresh replies so they never go missing.
  // We MERGE (not replace) into existing state so SSR-loaded replies aren't lost if the
  // API fetch returns empty or partial results due to a transient DB error.
  useEffect(() => {
    if (!wallPosts.length) return;
    const ids = wallPosts.map(p => p.id).join(",");
    fetch(`/api/wall-reply?postIds=${ids}`)
      .then(r => r.ok ? r.json() : null)
      .then((grouped: Record<string, WallReply[]> | null) => {
        if (!grouped || Object.keys(grouped).length === 0) return;
        setReplies(prev => {
          const merged = { ...prev };
          for (const [k, v] of Object.entries(grouped)) merged[Number(k)] = v;
          return merged;
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallPosts.length]);

  // Load vibe interests for this profile
  useEffect(() => {
    fetch(`/api/vibe?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.interests)) setVibeInterests(d.interests); })
      .catch(() => {});
  }, [username]);

  // Native (non-passive) touchmove so preventDefault() actually works and stops page scroll
  useEffect(() => {
    const grid = friendsGridRef.current;
    if (!grid || !isOwn) return;
    function handleNativeTouchMove(e: TouchEvent) {
      if (touchDragIdx.current === null) return;
      e.preventDefault();
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const cell = el?.closest("[data-fidx]") as HTMLElement | null;
      if (cell?.dataset?.fidx !== undefined) {
        const idx = Number(cell.dataset.fidx);
        if (!isNaN(idx) && idx !== touchDragOver.current) {
          touchDragOver.current = idx;
          setDragOver(idx);
        }
      }
    }
    grid.addEventListener("touchmove", handleNativeTouchMove, { passive: false });
    return () => grid.removeEventListener("touchmove", handleNativeTouchMove);
  }, [isOwn]);

  const avatar = user?.id ? `/api/avatar/${user.id}?v=2` : `https://api.dicebear.com/9.x/pixel-art/svg?seed=${username}`;
  const displayName = user?.display_name || username;

  const displayWallPosts = wallPosts;
  const displayVideos = videos;

  const profileTrack = user?.profile_song_url ? {
    title: user.profile_song_title || "Ginseng Strip 2002",
    artist: user.profile_song_artist || "Bladee",
    url: user.profile_song_url,
  } : undefined;


  async function handleAdminAvatarUpload(file: File) {
    if (!user?.id) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("targetUserId", user.id);
      const res = await fetch("/api/admin/avatar-upload", { method: "POST", body: form });
      if (res.ok) setAvatarVersion(v => v + 1);
    } catch { /* ignore */ } finally { setUploadingAvatar(false); }
  }

  async function handleAddFriend() {
    if (!user) return;
    await actionSendFriendRequest(user.id);
    setFriendStatus("pending");
    friendAdded();
  }

  function reorderFriends(fromIdx: number, toIdx: number) {
    setFriendOrder(prev => {
      // Rebuild ordered array from the current friends list (removes stale/unfriended IDs)
      const currentSorted = [...friends].sort((a, b) => {
        const ai = prev.indexOf(a.id); const bi = prev.indexOf(b.id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      // Perform the swap on the clean, current list
      const [moved] = currentSorted.splice(fromIdx, 1);
      currentSorted.splice(toIdx, 0, moved);
      const next = currentSorted.map(f => f.id);
      try { localStorage.setItem(`flock_friend_order_${user?.id}`, JSON.stringify(next)); } catch { /**/ }
      return next;
    });
    dropSound();
  }

  async function handleWallPost() {
    if (!wallInput.trim() || !user || !sessionUserId) return;
    setWallError("");
    try {
      await actionPostWallComment(user.id, wallInput.trim());
      setWallPosts(prev => [{
        id: Date.now(), author_id: sessionUserId, content: wallInput.trim(),
        created_at: new Date().toISOString(), username: "you", avatar_url: avatar,
      }, ...prev]);
      setWallInput("");
    } catch (e: unknown) {
      setWallError(e instanceof Error ? e.message : "Failed to post");
    }
  }

  // Replies are pre-loaded SSR via initialReplies — no client fetch needed on mount.
  // After new posts are added (optimistic), replies for them will be empty until page refresh,
  // which is correct since a brand-new post has no replies yet.

  async function submitReply(postId: number) {
    const content = replyInput.trim();
    if (!content || !sessionUserId) return;
    setReplyLoading(postId);
    setReplyError(null);
    setReplyInput(""); // optimistic clear
    try {
      const res = await fetch("/api/wall-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content }),
      });
      if (res.ok) {
        const updated = await res.json() as WallReply[];
        setReplies(prev => ({ ...prev, [postId]: Array.isArray(updated) ? updated : prev[postId] ?? [] }));
        setExpandedReplies(prev => { const n = new Set(prev); n.add(postId); return n; });
        setReplyingTo(null);
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setReplyInput(content); // restore what they typed
        setReplyError(body.error ?? "Couldn't send reply — try again");
      }
    } catch {
      setReplyInput(content); // restore on network error
      setReplyError("Network error — check connection and try again");
    } finally {
      setReplyLoading(null);
    }
  }

  async function handleDeletePost(postId: number) {
    if (!confirm("Delete this wall post?")) return;
    setDeletingPost(postId);
    try {
      const res = await fetch(`/api/wall-post?id=${postId}`, { method: "DELETE" });
      if (res.ok) {
        setWallPosts(prev => prev.filter(p => p.id !== postId));
        setReplies(prev => { const n = { ...prev }; delete n[postId]; return n; });
      }
    } catch { /* ignore */ } finally {
      setDeletingPost(null);
    }
  }

  async function handleDeleteReply(replyId: number, postId: number) {
    if (!confirm("Delete this reply?")) return;
    setDeletingReply(replyId);
    try {
      const res = await fetch(`/api/wall-reply?id=${replyId}`, { method: "DELETE" });
      if (res.ok) {
        setReplies(prev => ({
          ...prev,
          [postId]: (prev[postId] ?? []).filter(r => r.id !== replyId),
        }));
      }
    } catch { /* ignore */ } finally {
      setDeletingReply(null);
    }
  }

  async function handleEditReply(replyId: number, postId: number) {
    if (!editContent.trim()) return;
    try {
      const res = await fetch("/api/wall-reply", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: replyId, content: editContent.trim() }),
      });
      if (res.ok) {
        setReplies(prev => ({
          ...prev,
          [postId]: (prev[postId] ?? []).map(r =>
            r.id === replyId ? { ...r, content: editContent.trim(), edited_at: new Date().toISOString() } : r
          ),
        }));
        setEditingReply(null);
        setEditContent("");
      }
    } catch { /* ignore */ }
  }

  async function submitNestedReply() {
    if (!nestedReplyInput.trim() || !replyingToReply || !sessionUserId) return;
    setNestedReplyLoading(true);
    const { replyId, postId } = replyingToReply;
    const content = nestedReplyInput.trim();
    setNestedReplyInput("");
    try {
      const res = await fetch("/api/wall-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content, parentId: replyId }),
      });
      if (res.ok) {
        const updated = await res.json() as WallReply[];
        setReplies(prev => ({ ...prev, [postId]: updated }));
        setExpandedReplies(prev => { const n = new Set(prev); n.add(postId); return n; });
        setReplyingToReply(null);
      }
    } catch { /* ignore */ } finally {
      setNestedReplyLoading(false);
    }
  }

  // Touch drag handlers for mobile friend reorder
  function onFriendTouchStart(idx: number) {
    touchDragIdx.current = idx;
    dragIdx.current = idx;
  }
  function onFriendTouchMove(e: React.TouchEvent, containerEl: HTMLElement) {
    if (touchDragIdx.current === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = el?.closest("[data-fidx]") as HTMLElement | null;
    if (cell?.dataset?.fidx !== undefined) {
      const idx = Number(cell.dataset.fidx);
      if (!isNaN(idx) && idx !== touchDragOver.current) {
        touchDragOver.current = idx;
        setDragOver(idx);
      }
    }
    void containerEl; // suppress lint
  }
  function onFriendTouchEnd() {
    if (touchDragIdx.current !== null && touchDragOver.current !== null && touchDragIdx.current !== touchDragOver.current) {
      reorderFriends(touchDragIdx.current, touchDragOver.current);
    }
    touchDragIdx.current = null;
    touchDragOver.current = null;
    dragIdx.current = null;
    setDragOver(null);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 0 80px" }}>

      {/* Profile header */}
      <div className="profile-header-row" style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 8px", position: "relative", zIndex: 1, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {/* Story ring — gradient border when this user has an active story */}
          <div
            style={{
              width: 104, height: 104, borderRadius: 20, padding: 3,
              background: profileStory
                ? "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)"
                : "transparent",
              cursor: profileStory ? "pointer" : "default",
            }}
            onClick={() => { if (profileStory) setStoryViewerOpen(true); }}
            title={profileStory ? `View ${isOwn ? "your" : `${displayName}'s`} story` : undefined}
          >
            <div style={{ width: "100%", height: "100%", borderRadius: 17, overflow: "hidden", background: "var(--bg-base)", border: profileStory ? "2px solid var(--bg-base)" : "none" }}>
              <img
                src={`/api/avatar/${user?.id ?? username}?v=${avatarVersion}`}
                alt={displayName}
                onError={e => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${username}`; (e.currentTarget as HTMLImageElement).onerror = null; }}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
                onClick={e => { if (!profileStory && isMod) { e.stopPropagation(); avatarInputRef.current?.click(); } }}
              />
            </div>
          </div>
          {isMod && (
            <div
              onClick={() => avatarInputRef.current?.click()}
              style={{ position: "absolute", inset: 0, borderRadius: 20, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s", cursor: "pointer", fontSize: 28 }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}
            >
              {uploadingAvatar ? "⏳" : "📷"}
            </div>
          )}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleAdminAvatarUpload(f); e.target.value = ""; }}
          />
          <span className="status-dot online" style={{ position: "absolute", bottom: 4, right: 4, width: 14, height: 14, border: "3px solid var(--bg-base)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{displayName}</h1>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>@{user?.username ?? username}</span>
            <span style={{ background: "rgba(124,92,191,0.15)", border: "1px solid var(--accent-purple)", color: "var(--accent-purple-bright)", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px" }}>MEMBER</span>
          </div>
          {user?.bio && <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "4px 0 0" }}>{user.bio}</p>}
        </div>
        <div className="profile-actions">
          {!isOwn && sessionUserId && (
            <>
              <Link href={`/messages?with=${user?.id}`} style={{ background: "var(--accent-purple)", color: "#fff", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                💬 Message
              </Link>
              <button
                onClick={async () => { if (user) { await startDmCall(user.id, user.username); } }}
                style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                📞 Call
              </button>
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowGames(v => !v)}
                  disabled={launchingGame}
                  style={{ background: showGames ? "rgba(124,92,191,0.2)" : "transparent", border: "1px solid var(--border-bright)", color: "var(--text-secondary)", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  🎮 Games ▾
                </button>
                {showGames && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 6, zIndex: 100, minWidth: 160, display: "flex", flexDirection: "column", gap: 2, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                    {[
                      { label: "♟ Chess", href: `/messages?with=${user?.id}&game=chess` },
                      { label: "🧠 Quiz", href: `/messages?with=${user?.id}&game=quiz` },
                      { label: "🃏 Poker", href: `/poker` },
                      { label: "🎮 SNES", href: `/emulator` },
                    ].map(item => (
                      <Link key={item.label} href={item.href} onClick={() => setShowGames(false)}
                        style={{ padding: "8px 12px", borderRadius: 7, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none", background: "transparent", display: "block" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,92,191,0.15)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {theyRequestedMe ? (
                <button
                  onClick={async () => { await actionAcceptFriendRequest(user!.id); setFriendStatus("accepted"); friendAdded(); }}
                  style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Accept ✓
                </button>
              ) : (
                <button
                  onClick={handleAddFriend}
                  disabled={!!friendStatus}
                  style={{ background: "transparent", color: friendStatus ? "var(--text-muted)" : "var(--text-secondary)", border: "1px solid var(--border-bright)", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: friendStatus ? "default" : "pointer", whiteSpace: "nowrap" }}
                >
                  {friendStatus === "accepted" ? "Friends ✓" : friendStatus === "pending" ? "Requested" : "Add Friend"}
                </button>
              )}
            </>
          )}
          {isOwn && (
            <Link href="/profile/edit" style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-bright)", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
              Edit Profile
            </Link>
          )}
          {!sessionUserId && (
            <a href="/api/auth/signin" style={{ background: "var(--accent-purple)", color: "#fff", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
              Sign In
            </a>
          )}
        </div>
      </div>

      {/* Profile Song — full-width strip below header */}
      {profileTrack && (
        <div style={{ padding: "0 8px 12px" }}>
          <ProfileMusicPlayer track={profileTrack} />
        </div>
      )}

      {/* Two column */}
      <div className="profile-layout" style={{ padding: "0 8px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* About */}
          <div className="panel">
            <div className="panel-header">About Me</div>
            <div style={{ padding: 14 }}>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                {user?.bio || "No bio yet. Sign in and edit your profile to add one."}
              </p>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {user?.location && <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-muted)" }}><span>📍</span><span>{user.location}</span></div>}
                {user?.website && <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-muted)" }}><span>🔗</span><a href={user.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-blue)", textDecoration: "none" }}>{user.website.replace(/^https?:\/\//, "")}</a></div>}
                {user?.discord_handle && (
                  <div style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "center" }}>
                    <span style={{ background: "#5865F2", color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>Discord</span>
                    <span style={{ color: "var(--text-secondary)" }}>{user.discord_handle}</span>
                  </div>
                )}
                {user?.steam_handle && (
                  <div style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "center" }}>
                    <span style={{ background: "#1b2838", color: "#c7d5e0", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700, border: "1px solid #4a90d9" }}>Steam</span>
                    <a href={`https://steamcommunity.com/id/${user.steam_handle}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-blue)", textDecoration: "none" }}>{user.steam_handle}</a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Vibe Mix ─────────────────────────────────────────────────── */}
          {vibeInterests.length > 0 && (
            <div className="panel">
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>⚡ Vibe Mix</span>
                {isOwn && (
                  <Link href="/vibe" style={{ fontSize: 11, color: "var(--accent-purple-bright)", textDecoration: "none", fontWeight: 600 }}>Edit →</Link>
                )}
              </div>
              <div style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {vibeInterests.map(id => {
                    const tag = VIBE_TAGS.find(t => t.id === id);
                    return tag ? (
                      <span key={id} style={{
                        background: `${tag.color}18`, border: `1px solid ${tag.color}44`,
                        borderRadius: 20, padding: "3px 10px", fontSize: 12, color: tag.color, fontWeight: 700,
                      }}>{tag.emoji} {tag.label}</span>
                    ) : null;
                  })}
                </div>
                {isOwn ? (
                  <Link href="/vibe" style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none",
                    borderRadius: 8, padding: "7px 16px", color: "#fff", fontSize: 13,
                    fontWeight: 700, textDecoration: "none",
                  }}>▶ Open My Vibe</Link>
                ) : (
                  <button
                    onClick={() => { setMyVibe(vibeInterests); playVibe(); }}
                    style={{
                      background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none",
                      borderRadius: 8, padding: "7px 16px", color: "#fff", fontSize: 13,
                      fontWeight: 700, cursor: "pointer",
                    }}
                  >▶ Play {user?.display_name || username}&apos;s Vibe</button>
                )}
              </div>
            </div>
          )}

          {/* Friends */}
          <div className="panel">
            <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Friends <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{friends.length}</span></span>
              {isOwn && friends.length > 0 && <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>hold & drag to arrange</span>}
            </div>
            <div style={{ padding: 12 }}>
              {friends.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
                  {isOwn ? "No friends yet. Find people to add!" : "No friends yet."}
                </div>
              ) : (() => {
                // Sort friends by stored order
                const sorted = [...friends].sort((a, b) => {
                  const ai = friendOrder.indexOf(a.id);
                  const bi = friendOrder.indexOf(b.id);
                  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                });
                const displayed = showAllFriends ? sorted : sorted.slice(0, 8);
                return (
                  <>
                    <div
                      ref={friendsGridRef}
                      style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}
                      // Catch-all dragover on container: prevents "no-drop" cursor in gaps between tiles
                      onDragOver={e => e.preventDefault()}
                      onTouchEnd={() => { if (isOwn) onFriendTouchEnd(); }}
                    >
                      {displayed.map((f, i) => (
                        <div
                          key={f.id}
                          data-fidx={i}
                          draggable={isOwn}
                          onDragStart={() => { dragIdx.current = i; }}
                          onDragOver={e => { e.preventDefault(); setDragOver(i); }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={() => {
                            if (dragIdx.current !== null && dragIdx.current !== i) {
                              reorderFriends(dragIdx.current, i);
                            }
                            dragIdx.current = null;
                            setDragOver(null);
                          }}
                          onDragEnd={() => { dragIdx.current = null; setDragOver(null); }}
                          onTouchStart={() => { if (isOwn) onFriendTouchStart(i); }}
                          style={{
                            textAlign: "center", cursor: isOwn ? "grab" : "default",
                            opacity: dragOver === i ? 0.5 : 1,
                            // No transform — shrinking the element causes spurious dragleave/dragenter loops
                            transition: "opacity 0.1s",
                            touchAction: isOwn ? "none" : "auto",
                            userSelect: "none",
                          }}
                        >
                          <Link href={`/profile/${f.username}`} style={{ textDecoration: "none" }} draggable={false} onDragStart={e => e.preventDefault()}>
                            <img
                              src={`/api/avatar/${f.id}?v=2`}
                              alt={f.username}
                              onError={e => { (e.currentTarget as HTMLImageElement).src = `/api/avatar/${f.id}?v=2`; (e.currentTarget as HTMLImageElement).onerror = null; }}
                              style={{ width: "100%", aspectRatio: "1", borderRadius: 8, objectFit: "cover", border: dragOver === i ? "2px solid var(--accent-purple)" : "1px solid var(--border)", display: "block", transition: "border 0.1s" }}
                              draggable={false}
                            />
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {f.username}
                            </div>
                          </Link>
                        </div>
                      ))}
                    </div>
                    {friends.length > 8 && (
                      <button
                        onClick={() => { setShowAllFriends(v => !v); pop(); }}
                        style={{ marginTop: 10, width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontSize: 12, padding: "6px", cursor: "pointer" }}
                      >
                        {showAllFriends ? "▲ Show less" : `▾ View all ${friends.length} friends`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Storage usage — visible to all visitors */}
          <div className="panel">
            <div className="panel-header" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Storage</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{fmtBytes(storageBytes)} / 1 GB</span>
            </div>
            <div style={{ padding: "10px 14px" }}>
              <div style={{ background: "var(--bg-elevated)", borderRadius: 6, height: 8, overflow: "hidden", marginBottom: 6 }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, (storageBytes / STORAGE_LIMIT) * 100).toFixed(1)}%`,
                  background: storageBytes / STORAGE_LIMIT > 0.9
                    ? "linear-gradient(90deg, #e05555, #f08080)"
                    : storageBytes / STORAGE_LIMIT > 0.7
                    ? "linear-gradient(90deg, #d4a017, #f0c040)"
                    : "linear-gradient(90deg, var(--accent-purple), var(--accent-blue))",
                  borderRadius: 6,
                  transition: "width 0.4s ease",
                }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {isOwn ? `${fmtBytes(STORAGE_LIMIT - storageBytes)} remaining · ` : ""}{videos.length} video{videos.length !== 1 ? "s" : ""} uploaded
              </div>
              {isOwn && (
                <div style={{ marginTop: 8 }}>
                  <a href="/profile/edit" style={{ fontSize: 11, color: "var(--accent-purple-bright)", textDecoration: "none" }}>Manage in Edit Profile →</a>
                </div>
              )}
            </div>
          </div>

          {/* Town Adventure Stats */}
          {adventureStats && (adventureStats.level > 1 || adventureStats.quests_completed > 0) && (() => {
            const lvl = adventureStats.level ?? 1;
            const xp = adventureStats.xp ?? 0;
            const xpForNext = lvl * 100;
            const xpPct = Math.min(100, Math.round((xp / xpForNext) * 100));
            const cls = adventureStats.class;
            const classEmoji: Record<string, string> = { warrior: "⚔️", mage: "🔮", archer: "🏹", rogue: "🗡️", paladin: "🛡️" };
            const emoji = cls ? (classEmoji[cls] ?? "⚔️") : "🏘️";
            return (
              <div className="panel">
                <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🏘️ Town Adventure</span>
                  <span style={{ fontSize: 11, color: "var(--accent-purple-bright)", fontWeight: 700 }}>
                    {emoji} {cls ? cls.charAt(0).toUpperCase() + cls.slice(1) : "Adventurer"}
                  </span>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                    <div style={{ textAlign: "center", flex: 1, background: "var(--bg-elevated)", borderRadius: 8, padding: "8px 0" }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#ffd700" }}>{lvl}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>LEVEL</div>
                    </div>
                    <div style={{ textAlign: "center", flex: 1, background: "var(--bg-elevated)", borderRadius: 8, padding: "8px 0" }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#4ad990" }}>{adventureStats.wins ?? 0}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>WINS</div>
                    </div>
                    <div style={{ textAlign: "center", flex: 1, background: "var(--bg-elevated)", borderRadius: 8, padding: "8px 0" }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "var(--accent-blue)" }}>{adventureStats.quests_completed ?? 0}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>QUESTS</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                      <span>XP Progress</span>
                      <span>{xp} / {xpForNext}</span>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${xpPct}%`, background: "linear-gradient(90deg, #ffd700, #ffaa00)", borderRadius: 3, transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Chess */}
          {(user?.chess_rating || lastChessGame) && (() => {
            const uid = user?.id;
            const isWhite = lastChessGame?.white_id === uid;
            const opponent = isWhite ? lastChessGame?.black_username : lastChessGame?.white_username;
            const opponentAvatar = isWhite ? lastChessGame?.black_avatar : lastChessGame?.white_avatar;
            let result: "win" | "loss" | "draw" | null = null;
            if (lastChessGame) {
              if (lastChessGame.status === "draw" || lastChessGame.status === "stalemate") result = "draw";
              else if (lastChessGame.winner_id === uid) result = "win";
              else if (lastChessGame.winner_id) result = "loss";
            }
            const resultColor = result === "win" ? "#4ad990" : result === "loss" ? "#f08080" : "var(--text-muted)";
            const resultLabel = result === "win" ? "Victory" : result === "loss" ? "Defeat" : result === "draw" ? "Draw" : "—";
            return (
              <div className="panel">
                <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>♟ Chess</span>
                  <span style={{ fontSize: 12, color: "var(--accent-purple-bright)", fontWeight: 700 }}>★ {user?.chess_rating ?? 1200}</span>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
                    {[
                      { label: "W", val: user?.chess_wins ?? 0, color: "#4ad990" },
                      { label: "L", val: user?.chess_losses ?? 0, color: "#f08080" },
                      { label: "D", val: user?.chess_draws ?? 0, color: "var(--text-muted)" },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ textAlign: "center", flex: 1, background: "var(--bg-elevated)", borderRadius: 8, padding: "8px 0" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {lastChessGame && opponent && (
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Last Game</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img
                          src={opponentAvatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${opponent}`}
                          alt={opponent}
                          style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link href={`/profile/${opponent}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-purple-bright)", textDecoration: "none" }}>
                            {opponent}
                          </Link>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {new Date(lastChessGame.updated_at).toLocaleDateString()} · {lastChessGame.moves?.length ?? 0} moves
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 800, color: resultColor, flexShrink: 0 }}>{resultLabel}</span>
                      </div>
                      <Link href={`/chess/${lastChessGame.id}`} style={{ display: "block", marginTop: 10, textAlign: "center", fontSize: 11, color: "var(--accent-blue)", textDecoration: "none" }}>
                        View game →
                      </Link>
                    </div>
                  )}
                  {!lastChessGame && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>No games played yet.</div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* SNES / Favorite Game widget */}
          {(() => {
            const favGame = user?.favorite_game;
            const displayGame = favGame || lastSnesGame?.game_name;
            if (!displayGame && !lastSnesGame) return null;
            const uid = user?.id;
            const isHost = lastSnesGame?.host_id === uid;
            const opponent = isHost ? lastSnesGame?.guest_username : lastSnesGame?.host_username;
            const opponentAvatar = isHost ? lastSnesGame?.guest_avatar : lastSnesGame?.host_avatar;
            let snesResult: "win" | "loss" | "draw" | null = null;
            if (lastSnesGame?.status === "completed" && lastSnesGame.winner_id) {
              if (lastSnesGame.winner_id === uid) snesResult = "win";
              else snesResult = "loss";
            } else if (lastSnesGame?.status === "completed") snesResult = "draw";
            const snesResultColor = snesResult === "win" ? "#4ad990" : snesResult === "loss" ? "#f08080" : "var(--text-muted)";
            const snesResultLabel = snesResult === "win" ? "Victory" : snesResult === "loss" ? "Defeat" : snesResult === "draw" ? "Draw" : null;

            return (
              <div className="panel">
                <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🎮 {favGame ? "Favorite Game" : "Recently Played"}</span>
                  <Link href="/emulator" style={{ fontSize: 11, color: "var(--accent-blue)", textDecoration: "none" }}>Play →</Link>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{
                    background: "linear-gradient(135deg, rgba(124,92,191,0.12), rgba(74,144,217,0.08))",
                    border: "1px solid rgba(124,92,191,0.2)", borderRadius: 10, padding: "10px 12px",
                    marginBottom: lastSnesGame && opponent ? 10 : 0,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{displayGame}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>SNES</div>
                  </div>
                  {lastSnesGame && opponent && !favGame && (
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Last Match</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={opponentAvatar || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${opponent}`} alt={opponent}
                          onError={e => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${opponent}`; (e.currentTarget as HTMLImageElement).onerror = null; }}
                          style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link href={`/profile/${opponent}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-purple-bright)", textDecoration: "none" }}>@{opponent}</Link>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(lastSnesGame.updated_at).toLocaleDateString()}</div>
                        </div>
                        {snesResultLabel && <span style={{ fontSize: 12, fontWeight: 800, color: snesResultColor, flexShrink: 0 }}>{snesResultLabel}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Membership CTA — only show to logged-out visitors */}
          {!sessionUserId && (
            <div style={{ background: "linear-gradient(135deg, rgba(124,92,191,0.15), rgba(74,144,217,0.1))", border: "1px solid rgba(124,92,191,0.3)", borderRadius: 12, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>✦</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-purple-bright)", marginBottom: 4 }}>Join FLOCK</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>No ads. Ever. Sign up free.</div>
              <a href="/api/auth/signin" style={{ display: "block", width: "100%", background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "none", boxSizing: "border-box" }}>
                Sign Up Free
              </a>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
            {[
              { key: "videos", label: `🎬 Videos (${videos.length})` },
              { key: "vibe", label: "⚡ Vibe" },
              { key: "wall", label: "💬 Wall" },
            ].map(t => (
              <button key={t.key} onClick={() => setProfileTab(t.key as "videos" | "vibe" | "wall")}
                style={{
                  background: "none", border: "none", borderBottom: profileTab === t.key ? "2px solid var(--accent-purple-bright)" : "2px solid transparent",
                  marginBottom: -1, padding: "8px 16px", fontSize: 13, fontWeight: profileTab === t.key ? 800 : 500,
                  color: profileTab === t.key ? "var(--accent-purple-bright)" : "var(--text-muted)", cursor: "pointer",
                }}
              >{t.label}</button>
            ))}
          </div>

          {/* Videos tab */}
          {profileTab === "videos" && displayVideos.length > 0 && (
            <div className="panel">
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Videos <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>({videos.length})</span></span>
              </div>
              <div style={{ padding: 14 }}>
                <div className="video-grid-3">
                  {displayVideos.map((vid, i) => (
                    <div key={vid.id} className="video-card" style={{ textDecoration: "none" }}>
                      <div style={{ aspectRatio: "16/9", borderRadius: 8, marginBottom: 7, border: "1px solid var(--border)", overflow: "hidden", position: "relative", background: VIDEO_GRADIENTS[i % VIDEO_GRADIENTS.length] }}>
                        {vid.url ? (
                          <video
                            src={vid.url}
                            muted
                            preload="metadata"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 1; }}
                          />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "rgba(255,255,255,0.3)" }}>▶</div>
                        )}
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s", background: "rgba(0,0,0,0.3)" }} className="video-thumb-overlay">
                          <span style={{ fontSize: 28, color: "#fff" }}>▶</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{vid.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{vid.views >= 1000 ? `${(vid.views / 1000).toFixed(1)}k` : vid.views} views</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Vibe tab */}
          {profileTab === "vibe" && (() => {
            const customInterests = vibeInterests.filter(id => id.startsWith("custom:"));
            const curatedInterests = vibeInterests.filter(id => !id.startsWith("custom:"));
            return (
              <div className="panel">
                <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>⚡ {isOwn ? "My" : `${user?.display_name ?? username}'s`} Vibe Mix</span>
                  {isOwn && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {vibePlaying && (
                        <button onClick={() => vibePause()} style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#c084fc", cursor: "pointer", fontWeight: 700 }}>⏸ Pause</button>
                      )}
                      <button onClick={() => vibeStop()} style={{ background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#f87171", cursor: "pointer", fontWeight: 700 }}>✕ Stop</button>
                    </div>
                  )}
                </div>
                <div style={{ padding: 14 }}>
                  {vibeInterests.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                        {isOwn ? "You haven't set up your Vibe mix yet." : `${user?.display_name ?? username} hasn't set up their Vibe mix yet.`}
                      </div>
                      {isOwn && (
                        <Link href="/vibe" style={{ display: "inline-block", background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "#fff", textDecoration: "none", borderRadius: 10, padding: "8px 20px", fontSize: 13, fontWeight: 800 }}>⚡ Set Up My Vibe</Link>
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        {curatedInterests.map(id => {
                          const tag = VIBE_TAGS.find(t => t.id === id);
                          return tag ? (
                            <span key={id} style={{ background: `${tag.color}22`, border: `1px solid ${tag.color}55`, borderRadius: 20, padding: "3px 10px", fontSize: 12, color: tag.color, fontWeight: 700 }}>{tag.emoji} {tag.label}</span>
                          ) : null;
                        })}
                        {customInterests.map(id => (
                          <span key={id} style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 20, padding: "3px 10px", fontSize: 12, color: "#c084fc", fontWeight: 700 }}>✨ {id.slice("custom:".length)}</span>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {!vibePlaying && (
                          <button
                            onClick={() => { setMyVibe(vibeInterests); playVibe(); }}
                            style={{ flex: 1, background: "linear-gradient(135deg, #7c3aed, #a855f7)", border: "none", borderRadius: 10, padding: "10px", fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer" }}
                          >▶ {isOwn ? "Play My Mix" : `Play ${user?.display_name ?? username}'s Mix`}</button>
                        )}
                        {vibePlaying && vibePlaylist.length > 0 && (
                          <div style={{ flex: 1, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 10, padding: "10px", textAlign: "center", fontSize: 13, color: "#c084fc", fontWeight: 700 }}>⚡ Playing in mini player</div>
                        )}
                        {isOwn && (
                          <Link href="/vibe" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--text-muted)", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center" }}>Edit</Link>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Wall */}
          {profileTab === "wall" && <div className="panel">
            <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Wall</span>
              {isOwn && (
                <Link href="/profile/edit" style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none", opacity: 0.7 }}>⚙ Privacy settings</Link>
              )}
            </div>
            <div style={{ padding: 14 }}>
              {sessionUserId && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <img src={avatar} onError={e => { (e.currentTarget as HTMLImageElement).src = `/api/avatar/${user?.id ?? "placeholder"}`; (e.currentTarget as HTMLImageElement).onerror = null; }} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }} alt="you" />
                    <div style={{ flex: 1, display: "flex", gap: 8 }}>
                      <textarea
                        value={wallInput}
                        onChange={e => setWallInput(e.target.value)}
                        placeholder="Leave a comment..."
                        style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", minHeight: 60 }}
                      />
                      <button onClick={() => { handleWallPost(); clickSound(); }} style={{ alignSelf: "flex-end", background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Post</button>
                    </div>
                  </div>
                  {wallError && <div style={{ fontSize: 12, color: "#f08080", marginTop: 6, paddingLeft: 42 }}>{wallError}</div>}
                </div>
              )}
              {displayWallPosts.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  No posts yet — be the first to leave a message!
                </div>
              )}
              {displayWallPosts.map(post => {
                const postReplies = replies[post.id] ?? [];
                const replyCount = postReplies.length;
                const showingInput = replyingTo === post.id;
                return (
                  <div key={post.id} style={{ marginBottom: 4 }}>
                    {/* Main post */}
                    <div style={{ display: "flex", gap: 10, padding: "12px 0" }}>
                      <img src={`/api/avatar/${post.author_id}?v=2`} onError={e => { (e.currentTarget as HTMLImageElement).onerror = null; }} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0, marginTop: 1 }} alt={post.username} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4, flexWrap: "wrap" }}>
                          <Link href={`/profile/${post.username}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-purple-bright)", textDecoration: "none" }}>@{post.username}</Link>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(post.created_at).toLocaleDateString()}</span>
                        </div>
                        {(() => {
                          const ytId = extractYouTubeId(post.content);
                          const textOnly = ytId ? stripYouTubeUrl(post.content) : post.content;
                          return (
                            <>
                              {textOnly && <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>{textOnly}</p>}
                              {ytId && (
                                <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", borderRadius: 10, overflow: "hidden", background: "#000", marginBottom: 8 }}>
                                  <iframe
                                    src={`https://www.youtube-nocookie.com/embed/${ytId}?controls=1&rel=0&modestbranding=1`}
                                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                                    allow="encrypted-media; picture-in-picture"
                                    allowFullScreen
                                    loading="lazy"
                                    title="YouTube video"
                                  />
                                </div>
                              )}
                            </>
                          );
                        })()}
                        {/* Reply / collapse button + delete */}
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {sessionUserId && (
                            <button
                              onClick={() => {
                                if (showingInput) { setReplyingTo(null); setReplyInput(""); }
                                else {
                                  setReplyingTo(post.id); setReplyInput("");
                                  // Auto-expand replies when opening reply input
                                  setExpandedReplies(prev => { const n = new Set(prev); n.add(post.id); return n; });
                                }
                              }}
                              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
                            >
                              {showingInput ? "✕ Cancel" : "💬 Reply"}
                            </button>
                          )}
                          {replyCount > 0 && (
                            <button
                              onClick={() => setExpandedReplies(prev => {
                                const n = new Set(prev);
                                if (n.has(post.id)) n.delete(post.id); else n.add(post.id);
                                return n;
                              })}
                              style={{ background: "none", border: "none", color: "var(--accent-purple-bright)", fontSize: 11, cursor: "pointer", padding: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}
                            >
                              {expandedReplies.has(post.id) ? "▲" : "▼"} {replyCount} repl{replyCount === 1 ? "y" : "ies"}
                            </button>
                          )}
                          {sessionUserId && (sessionUserId === post.author_id || sessionUserId === user?.id) && (
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              disabled={deletingPost === post.id}
                              title="Delete post"
                              style={{ background: "none", border: "none", color: "#ef4444", fontSize: 11, cursor: "pointer", padding: 0, opacity: 0.7, marginLeft: "auto" }}
                            >{deletingPost === post.id ? "…" : "🗑"}</button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Replies — nested, editable, deletable. Expandable via toggle. */}
                    {(expandedReplies.has(post.id) && postReplies.length > 0 || showingInput) && (
                      <div style={{ marginLeft: 36, borderLeft: "2px solid rgba(124,58,237,0.18)", paddingLeft: 12, marginBottom: 8 }}>
                        {postReplies.map(r => {
                          const isMyReply = sessionUserId === r.author_id;
                          const canDelete = sessionUserId && (isMyReply || sessionUserId === user?.id);
                          const parentReply = r.parent_id ? postReplies.find(p => p.id === r.parent_id) : null;
                          const isEditing = editingReply === r.id;
                          return (
                            <div key={r.id} style={{ marginBottom: 10, marginLeft: r.parent_id ? 20 : 0 }}>
                              <div style={{ display: "flex", gap: 7 }}>
                                <img src={`/api/avatar/${r.author_id}?v=2`} onError={e => { (e.currentTarget as HTMLImageElement).onerror = null; }} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--border)", flexShrink: 0, marginTop: 1 }} alt={r.username} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginBottom: 2 }}>
                                    <Link href={`/profile/${r.username}`} style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-purple-bright)", textDecoration: "none" }}>@{r.username}</Link>
                                    {parentReply && (
                                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>↩ @{parentReply.username}</span>
                                    )}
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleDateString()}</span>
                                    {r.edited_at && <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>(edited)</span>}
                                    <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
                                      {/* Reply to this reply — wall owner or friends */}
                                      {sessionUserId && sessionUserId !== r.author_id && (
                                        <button
                                          onClick={() => { setReplyingToReply({ replyId: r.id, username: r.username, postId: post.id }); setNestedReplyInput(""); }}
                                          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 10, cursor: "pointer", padding: "1px 4px", opacity: 0.6 }}
                                          title="Reply"
                                        >↩</button>
                                      )}
                                      {/* Edit own reply */}
                                      {isMyReply && !isEditing && (
                                        <button
                                          onClick={() => { setEditingReply(r.id); setEditContent(r.content); }}
                                          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 10, cursor: "pointer", padding: "1px 4px", opacity: 0.5 }}
                                          title="Edit"
                                        >✏️</button>
                                      )}
                                      {/* Delete */}
                                      {canDelete && (
                                        <button
                                          onClick={() => handleDeleteReply(r.id, post.id)}
                                          disabled={deletingReply === r.id}
                                          style={{ background: "none", border: "none", color: "#ef4444", fontSize: 10, cursor: "pointer", padding: "1px 4px", opacity: 0.7 }}
                                          title="Delete"
                                        >{deletingReply === r.id ? "…" : "🗑"}</button>
                                      )}
                                    </div>
                                  </div>
                                  {isEditing ? (
                                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                      <input
                                        autoFocus
                                        value={editContent}
                                        onChange={e => setEditContent(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") handleEditReply(r.id, post.id); if (e.key === "Escape") { setEditingReply(null); setEditContent(""); } }}
                                        style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 7, padding: "4px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none", fontFamily: "inherit", minWidth: 0 }}
                                        maxLength={500}
                                      />
                                      <button onClick={() => handleEditReply(r.id, post.id)} style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                                      <button onClick={() => { setEditingReply(null); setEditContent(""); }} style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}>✕</button>
                                    </div>
                                  ) : (
                                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, wordBreak: "break-word" }}>{r.content}</p>
                                  )}
                                  {/* Nested reply input for this specific reply */}
                                  {replyingToReply?.replyId === r.id && (
                                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                      <input
                                        autoFocus
                                        value={nestedReplyInput}
                                        onChange={e => setNestedReplyInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitNestedReply(); } if (e.key === "Escape") setReplyingToReply(null); }}
                                        placeholder={`Reply to @${r.username}…`}
                                        style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 7, padding: "5px 9px", color: "var(--text-primary)", fontSize: 12, outline: "none", fontFamily: "inherit", minWidth: 0 }}
                                        maxLength={500}
                                      />
                                      <button onClick={submitNestedReply} disabled={nestedReplyLoading || !nestedReplyInput.trim()} style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: nestedReplyInput.trim() ? 1 : 0.5 }}>{nestedReplyLoading ? "…" : "↩"}</button>
                                      <button onClick={() => setReplyingToReply(null)} style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 8px", fontSize: 12, cursor: "pointer" }}>✕</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {/* Reply to post input */}
                        {showingInput && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: postReplies.length > 0 ? 6 : 0 }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                autoFocus
                                value={replyInput}
                                onChange={e => { setReplyInput(e.target.value); setReplyError(null); }}
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitReply(post.id); } if (e.key === "Escape") { setReplyingTo(null); setReplyInput(""); setReplyError(null); } }}
                                placeholder="Write a reply…"
                                style={{ flex: 1, background: "var(--bg-elevated)", border: `1px solid ${replyError && replyingTo === post.id ? "#f87171" : "var(--border)"}`, borderRadius: 8, padding: "6px 10px", color: "var(--text-primary)", fontSize: 16, outline: "none", fontFamily: "inherit", minWidth: 0 }}
                                maxLength={500}
                              />
                              <button
                                onClick={() => submitReply(post.id)}
                                disabled={replyLoading === post.id || !replyInput.trim()}
                                style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: replyInput.trim() ? 1 : 0.5, flexShrink: 0 }}
                              >{replyLoading === post.id ? "…" : "Reply"}</button>
                            </div>
                            {replyError && replyingTo === post.id && (
                              <div style={{ fontSize: 11, color: "#f87171", paddingLeft: 2 }}>{replyError}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ borderBottom: "1px solid var(--border)" }} />
                  </div>
                );
              })}
            </div>
          </div>}
        </div>
      </div>

      {/* Moderator Privileges Panel — only visible to moderators */}
      {/* Build timestamp — only visible to mclevesque when viewing their own profile */}
      {isOwn && username.toLowerCase() === "mclevesque" && (
        <div style={{ padding: "0 8px", marginTop: 16 }}>
          <div style={{
            border: "1px solid rgba(100,200,255,0.2)",
            background: "rgba(0,100,180,0.06)",
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 11,
            fontFamily: "monospace",
            color: "rgba(100,200,255,0.6)",
          }}>
            🔧 <strong style={{ color: "rgba(100,200,255,0.8)" }}>Build deployed:</strong>{" "}
            {process.env.NEXT_PUBLIC_BUILD_TIME
              ? new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString("en-US", {
                  timeZone: "America/New_York",
                  month: "short", day: "numeric", year: "numeric",
                  hour: "numeric", minute: "2-digit", second: "2-digit",
                  hour12: true,
                }) + " EST"
              : "unknown"}
          </div>
        </div>
      )}

      {isMod && user && (
        <div style={{ padding: "0 8px", marginTop: 24 }}>
          <div className="panel" style={{ border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.04)" }}>
            <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#f87171" }}>
              <span>🛡 Moderator Panel — @{user.username}</span>
              {privileges.updated_at && <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>Last updated {new Date(privileges.updated_at ?? "").toLocaleDateString()}</span>}
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                {([
                  { key: "snes_access", label: "🎮 SNES Access", description: "Can play SNES games" },
                  { key: "can_post", label: "📝 Can Post", description: "Can post on walls" },
                  { key: "can_comment", label: "💬 Can Comment", description: "Can comment on videos" },
                  { key: "can_voice", label: "🎤 Can Voice Chat", description: "Can join voice channels" },
                ] as { key: keyof Privileges; label: string; description: string }[]).map(({ key, label, description }) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 10, cursor: "pointer", border: `1px solid ${privileges[key] ? "rgba(74,222,128,0.25)" : "rgba(239,68,68,0.25)"}` }}>
                    <input
                      type="checkbox"
                      checked={!!privileges[key]}
                      onChange={e => setPrivileges(prev => ({ ...prev, [key]: e.target.checked }))}
                      style={{ width: 16, height: 16, accentColor: "var(--accent-purple)", cursor: "pointer" }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{description}</div>
                    </div>
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: privileges[key] ? "#4ade80" : "#f87171" }}>
                      {privileges[key] ? "ON" : "OFF"}
                    </span>
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>⏳ Site Ban Until:</label>
                <input
                  type="datetime-local"
                  value={privileges.site_ban_until ? new Date(privileges.site_ban_until).toISOString().slice(0, 16) : ""}
                  onChange={e => setPrivileges(prev => ({ ...prev, site_ban_until: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none", fontFamily: "inherit" }}
                />
                {privileges.site_ban_until && (
                  <button
                    onClick={() => setPrivileges(prev => ({ ...prev, site_ban_until: null }))}
                    style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}
                  >
                    Clear Ban
                  </button>
                )}
                {privileges.site_ban_until && new Date(privileges.site_ban_until) > new Date() && (
                  <span style={{ fontSize: 11, color: "#f87171", fontWeight: 700 }}>🔴 ACTIVE BAN</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={async () => {
                    if (!user) return;
                    setPrivSaving(true);
                    setPrivSaved(false);
                    try {
                      const res = await fetch("/api/privileges", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: user.id, ...privileges }),
                      });
                      if (res.ok) { setPrivSaved(true); setTimeout(() => setPrivSaved(false), 2500); }
                    } catch { /* ignore */ } finally { setPrivSaving(false); }
                  }}
                  disabled={privSaving}
                  style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: privSaving ? 0.7 : 1 }}
                >
                  {privSaving ? "Saving…" : "💾 Save Changes"}
                </button>
                {privSaved && <span style={{ fontSize: 13, color: "#4ade80", fontWeight: 700 }}>✓ Saved</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Story viewer — opens when clicking a profile avatar with an active story */}
      {storyViewerOpen && profileStory && profileStory.video_url && (
        <StoryViewer
          stories={[{ ...profileStory, video_url: profileStory.video_url }]}
          startIndex={0}
          onClose={() => setStoryViewerOpen(false)}
          currentUserId={sessionUserId ?? ""}
          onDelete={(id) => { if (profileStory.id === id) { setProfileStory(null); setStoryViewerOpen(false); } }}
        />
      )}
    </div>
  );
}
