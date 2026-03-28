"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "@/lib/use-session";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserProfile {
  id?: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  location?: string;
  website?: string;
  profile_song_title?: string;
  profile_song_artist?: string;
  profile_song_url?: string;
  chess_rating?: number;
  chess_wins?: number;
  chess_losses?: number;
}

export default function GsProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [playing, setPlaying] = useState(false);
  const [outbreakKills, setOutbreakKills] = useState<number | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/greatsouls");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.name) return;
    const username = session.user.name;

    fetch(`/api/users?username=${username}`)
      .then(r => r.json())
      .then(u => {
        if (u && !u.error) {
          setProfile(u);
          setAvatarSrc(u.avatar_url || null);
        }
      })
      .catch(() => {});

    // Fetch outbreak best kills for this user
    fetch("/api/outbreak?dev=1")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.leaderboard) return;
        const entries = (d.leaderboard as { username: string; kills: string | number }[])
          .filter(e => e.username === username);
        if (entries.length > 0) {
          const best = Math.max(...entries.map(e => Number(e.kills)));
          setOutbreakKills(best);
        }
      })
      .catch(() => {});
  }, [status, session?.user?.name]);

  async function handleAvatarUpload(file: File) {
    if (!profile?.id) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/avatar-upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      // Save to DB
      await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      });
      setAvatarSrc(url);
    } catch { /* ignore */ } finally {
      setUploadingAvatar(false);
    }
  }

  function toggleSong() {
    if (!profile?.profile_song_url) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(profile.profile_song_url);
      audioRef.current.loop = true;
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }

  if (status === "loading" || !profile) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#d4a942", fontFamily: "serif", fontSize: 20 }}>Loading...</div>
      </div>
    );
  }

  const username = session?.user?.name ?? "";
  const displayName = profile.display_name || username;
  const userId = (session?.user as { id?: string })?.id;
  const avatarDisplay = avatarSrc || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${username}`;

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8" }}>
      <style>{`
        .gs-avatar-wrap:hover .gs-avatar-overlay { opacity: 1 !important; }
      `}</style>

      {/* GS Navbar */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", padding: "10px 16px",
        background: "rgba(13,13,13,0.95)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid #2a2a2a",
      }}>
        <Link href="/greatsouls/hub" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <span style={{ fontSize: 20 }}>🔥</span>
          <span style={{ fontFamily: "serif", color: "#d4a942", fontWeight: 700, fontSize: 16, letterSpacing: "0.08em" }}>
            GREAT SOULS
          </span>
        </Link>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/greatsouls/hub" style={{ color: "#8a6d2b", fontSize: 12, fontWeight: 700, textDecoration: "none", letterSpacing: "0.08em" }}>
            🎮 GAMES
          </Link>
          <Link href="/leaderboards" style={{ color: "#8a6d2b", fontSize: 12, fontWeight: 700, textDecoration: "none", letterSpacing: "0.08em" }}>
            🏆 RANKS
          </Link>
          <Link href="/profile/edit" style={{ color: "#8a6d2b", fontSize: 12, fontWeight: 700, textDecoration: "none", letterSpacing: "0.08em" }}>
            ✏️ EDIT
          </Link>
          <Link href="/profile" style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(139,60,247,0.15)", border: "1px solid rgba(139,60,247,0.4)",
            borderRadius: 6, padding: "4px 10px", textDecoration: "none",
            color: "#a78bfa", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
          }}>
            ⚡ RYFT
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: 600, margin: "0 auto", padding: "32px 16px 80px" }}>

        {/* Profile header */}
        <div style={{
          background: "#111", border: "1px solid #2a2a2a", borderRadius: 16,
          overflow: "hidden", marginBottom: 20,
        }}>
          {/* Banner */}
          <div style={{
            height: 120,
            background: profile.banner_url
              ? `url(${profile.banner_url}) center/cover`
              : "linear-gradient(135deg, rgba(212,169,66,0.15), rgba(196,83,26,0.1))",
          }} />

          {/* Avatar + name row */}
          <div style={{ padding: "0 20px 20px", position: "relative" }}>
            {/* Avatar with upload overlay */}
            <div className="gs-avatar-wrap" style={{
              width: 80, height: 80, borderRadius: "50%",
              border: "3px solid #d4a942",
              overflow: "hidden", marginTop: -40,
              background: "#1a1a1a", position: "relative", cursor: "pointer",
            }} onClick={() => fileInputRef.current?.click()}>
              <img
                src={avatarDisplay}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={e => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${username}`; }}
              />
              <div className="gs-avatar-overlay" style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: 0, transition: "opacity 0.15s", fontSize: 22,
              }}>
                {uploadingAvatar ? "⏳" : "📷"}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ""; }}
            />

            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: "serif", color: "#d4a942", fontSize: 22, fontWeight: 700 }}>
                {displayName}
              </div>
              <div style={{ color: "#6a5a4a", fontSize: 13, marginBottom: 8 }}>@{username}</div>
              {profile.bio && (
                <div style={{ color: "#c8b89a", fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>{profile.bio}</div>
              )}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {profile.location && <span style={{ color: "#6a5a4a", fontSize: 12 }}>📍 {profile.location}</span>}
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer"
                    style={{ color: "#8a6d2b", fontSize: 12, textDecoration: "none" }}>
                    🔗 {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "#6a5a4a" }}>
                Tap avatar to change photo
              </div>
            </div>
          </div>
        </div>

        {/* Stats row — Outbreak kills + Chess ELO */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20,
        }}>
          {[
            { label: "BEST KILLS", value: outbreakKills !== null ? outbreakKills.toLocaleString() : "—", icon: "🧟" },
            { label: "CHESS ELO", value: profile.chess_rating ?? 1200, icon: "♟️" },
            { label: "CHESS W/L", value: `${profile.chess_wins ?? 0}/${profile.chess_losses ?? 0}`, icon: "🏆" },
          ].map(stat => (
            <div key={stat.label} style={{
              background: "#111", border: "1px solid #2a2a2a", borderRadius: 12,
              padding: "14px 16px", textAlign: "center",
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontFamily: "serif", color: "#d4a942", fontSize: 20, fontWeight: 700 }}>{stat.value}</div>
              <div style={{ color: "#6a5a4a", fontSize: 10, letterSpacing: "0.1em", marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Profile song */}
        {profile.profile_song_url && (
          <div style={{
            background: "#111", border: "1px solid #2a2a2a", borderRadius: 12,
            padding: "14px 18px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <button onClick={toggleSong} style={{
              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
              background: playing ? "rgba(212,169,66,0.2)" : "#1a1a1a",
              border: "2px solid #d4a942", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "#d4a942",
            }}>
              {playing ? "⏸" : "▶"}
            </button>
            <div>
              <div style={{ color: "#e8dcc8", fontSize: 14, fontWeight: 600 }}>
                {profile.profile_song_title || "Profile Song"}
              </div>
              <div style={{ color: "#6a5a4a", fontSize: 12 }}>
                {profile.profile_song_artist || ""}
              </div>
            </div>
            <div style={{ marginLeft: "auto", color: "#6a5a4a", fontSize: 11, letterSpacing: "0.08em" }}>
              🎵 PROFILE TRACK
            </div>
          </div>
        )}

        {/* Quick links */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/outbreak" style={{
            flex: 1, minWidth: 120, padding: "12px 0", textAlign: "center",
            background: "rgba(212,169,66,0.08)", border: "1px solid #2a2a2a", borderRadius: 10,
            color: "#d4a942", textDecoration: "none", fontSize: 13, fontWeight: 700,
          }}>
            🧟 Play Outbreak
          </Link>
          <Link href="/chess" style={{
            flex: 1, minWidth: 120, padding: "12px 0", textAlign: "center",
            background: "rgba(212,169,66,0.08)", border: "1px solid #2a2a2a", borderRadius: 10,
            color: "#d4a942", textDecoration: "none", fontSize: 13, fontWeight: 700,
          }}>
            ♟️ Play Chess
          </Link>
          <Link href="/profile/edit" style={{
            flex: 1, minWidth: 120, padding: "12px 0", textAlign: "center",
            background: "transparent", border: "1px solid #2a2a2a", borderRadius: 10,
            color: "#6a5a4a", textDecoration: "none", fontSize: 13, fontWeight: 700,
          }}>
            ✏️ Edit Profile
          </Link>
        </div>
      </main>
    </div>
  );
}
