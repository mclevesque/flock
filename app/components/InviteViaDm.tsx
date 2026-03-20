"use client";
/**
 * InviteViaDm — replaces "Copy Link" buttons for game invites.
 * Opens a friend picker and sends a DM in the format [game:id].
 *
 * Usage:
 *   <InviteViaDm gameTag="chess" gameId={gameId} label="Invite Friend" />
 *   <InviteViaDm gameTag="snes" gameId={roomId} label="📨 Invite" />
 */
import { useState, useEffect, useRef } from "react";

interface Friend { id: string; username: string; display_name: string | null; avatar_url: string | null; }

interface Props {
  gameTag: string;   // "chess" | "snes" | "poker" | "pong" | "waddabi" | "watch" | "quiz"
  gameId: string;    // the room/game/session ID
  label?: string;
  style?: React.CSSProperties;
}

export default function InviteViaDm({ gameTag, gameId, label = "📨 Invite", style }: Props) {
  const [open, setOpen]       = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Load friends when opening
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/friends")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setFriends(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function sendInvite(friend: Friend) {
    const content = `[${gameTag}:${gameId}]`;
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: friend.id, content }),
      });
      setSent(prev => new Set([...prev, friend.id]));
      // Auto-close after a moment if all friends sent
      setTimeout(() => {
        setSent(prev => {
          if (prev.size >= friends.length) setOpen(false);
          return prev;
        });
      }, 1500);
    } catch { /* ignore */ }
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }} ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: open ? "rgba(124,58,237,0.3)" : "rgba(124,58,237,0.15)",
          border: `1px solid ${open ? "rgba(124,58,237,0.6)" : "rgba(124,58,237,0.35)"}`,
          borderRadius: 8, padding: "7px 14px",
          color: "#c4b5fd", fontSize: 13, fontWeight: 700,
          cursor: "pointer", transition: "all 0.15s",
          ...style,
        }}
      >
        {label}
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0,
          background: "rgba(13,15,20,0.97)", backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
          width: 240, maxHeight: 320, overflowY: "auto",
          zIndex: 9999,
        }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
            Send invite to…
          </div>
          {loading && (
            <div style={{ padding: 20, textAlign: "center", color: "#6b7280", fontSize: 12 }}>Loading…</div>
          )}
          {!loading && friends.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "#6b7280", fontSize: 12 }}>No friends yet 😢</div>
          )}
          {friends.map(f => {
            const wasSent = sent.has(f.id);
            return (
              <div
                key={f.id}
                onClick={() => !wasSent && sendInvite(f)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", cursor: wasSent ? "default" : "pointer",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: wasSent ? "rgba(74,222,128,0.05)" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!wasSent) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = wasSent ? "rgba(74,222,128,0.05)" : "transparent"; }}
              >
                <img
                  src={f.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${f.username}`}
                  alt="" style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e8eaf6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.display_name ?? f.username}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>@{f.username}</div>
                </div>
                <span style={{ fontSize: 12, color: wasSent ? "#4ade80" : "#7c3aed", fontWeight: 700, flexShrink: 0 }}>
                  {wasSent ? "✓ Sent" : "Invite"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
