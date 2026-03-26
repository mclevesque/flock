"use client";
/**
 * GlobalNotifications
 *
 * Polls for unread direct messages every 30s. Shows a non-intrusive slide-in
 * toast at bottom-left when new messages arrive. Works everywhere in Flock
 * without interrupting art, games, or fullscreen experiences.
 *
 * - Does NOT show when already on /messages pages
 * - Auto-dismisses after 10s
 * - Maximum 1 toast at a time (newest sender wins)
 * - Stacks up to 3 unseen senders in the single toast
 * - Respects browser visibility API — pauses polling when tab is hidden
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "@/lib/use-session";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useNotifications, type PushNotification } from "@/lib/useNotifications";

interface Conversation {
  other_user: string;
  last_message: string;
  last_sender_id: string;
  created_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Notification {
  id: string;
  senderIds: string[];
  senders: { userId: string; username: string; avatarUrl: string | null }[];
  preview: string;
  count: number;
  partyId?: string; // set when this notification is a party invite
}

const AUTO_DISMISS_MS = 10_000;
const PARTY_DISMISS_MS = 3 * 60 * 1000; // 3 minutes for party invites

export default function GlobalNotifications() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [notification, setNotification] = useState<Notification | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onNotification } = useNotifications();

  // ── Global keyboard fix ──────────────────────────────────────────────────────
  // Stop keydown events from propagating out of ANY text input sitewide.
  // This prevents Phaser (and any other game engine) from intercepting WASD/Space
  // while the user is typing — regardless of which page is mounted or whether
  // a game canvas is running in the background during Next.js page transitions.
  useEffect(() => {
    const blockForInputs = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        e.stopPropagation();
      }
    };
    // capture: true — runs before Phaser's bubble-phase window listener
    document.addEventListener("keydown", blockForInputs, { capture: true });
    return () => document.removeEventListener("keydown", blockForInputs, { capture: true });
  }, []);

  // Don't show on messages pages
  const isMessagesPage = pathname?.startsWith("/messages");

  const clearDismissTimer = useCallback(() => {
    if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null; }
  }, []);

  const dismiss = useCallback(() => {
    clearDismissTimer();
    setNotification(null);
  }, [clearDismissTimer]);

  const showNotification = useCallback((notif: Notification, duration = AUTO_DISMISS_MS) => {
    clearDismissTimer();
    setNotification(notif);
    dismissTimer.current = setTimeout(dismiss, duration);
  }, [clearDismissTimer, dismiss]);

  // Subscribe to push notifications instead of polling
  useEffect(() => {
    if (!session?.user?.id) return;
    const unsub = onNotification((n: PushNotification) => {
      if (isMessagesPage && n.type === "new-message") return; // don't toast on messages page
      if (document.hidden) return;

      const isPartyInvite = n.type === "new-message" && n.preview?.startsWith("[party:");
      const partyId = isPartyInvite ? n.preview?.slice(7, -1) : undefined;

      const notif: Notification = {
        id: n.id || Date.now().toString(),
        senderIds: n.from ? [n.from.userId] : [],
        senders: n.from ? [{ userId: n.from.userId, username: n.from.username, avatarUrl: n.from.avatarUrl || null }] : [],
        preview: isPartyInvite ? "🎮 Invited you to their party!"
          : n.type === "friend-request" ? `${n.from?.username || "Someone"} sent you a friend request!`
          : n.type === "friend-accepted" ? `${n.from?.username || "Someone"} accepted your friend request!`
          : n.type === "chronicle-reply" ? `${n.from?.username || "Someone"} replied to your chronicle entry`
          : n.type === "challenge" ? `${n.from?.username || "Someone"} challenged you to ${n.gameType || "a game"}!`
          : n.preview || "New notification",
        count: 1,
        partyId,
      };

      showNotification(notif, partyId ? PARTY_DISMISS_MS : AUTO_DISMISS_MS);
    });
    return () => { unsub(); clearDismissTimer(); };
  }, [session?.user?.id, isMessagesPage, onNotification, showNotification, clearDismissTimer]);

  // Dismiss when navigating to messages
  useEffect(() => {
    if (isMessagesPage) dismiss();
  }, [isMessagesPage, dismiss]);

  if (!notification || isMessagesPage) return null;

  const { senders, preview, count, partyId } = notification;
  const multi = senders.length > 1;
  const isPartyInvite = !!partyId;

  const borderColor = isPartyInvite ? "rgba(100,200,100,0.55)" : "rgba(124,92,191,0.45)";

  return (
    <div
      style={{
        position: "fixed",
        top: 60,
        right: 16,
        zIndex: 9999,
        maxWidth: 320,
        width: "calc(100vw - 32px)",
        background: "rgba(12, 10, 22, 0.94)",
        backdropFilter: "blur(18px)",
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
        boxShadow: "0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
        padding: "12px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        animation: "slideInFromTop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        pointerEvents: "all",
      }}
    >
      <style>{`
        @keyframes slideInFromTop {
          from { opacity: 0; transform: translateY(-16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
      `}</style>

      {/* Avatar(s) */}
      <div style={{ position: "relative", flexShrink: 0, width: 42, height: 42 }}>
        <img
          src={senders[0].avatarUrl || `https://api.dicebear.com/9.x/adventurer/svg?seed=${senders[0].username}`}
          alt={senders[0].username}
          style={{ width: 42, height: 42, borderRadius: 10, border: `2px solid ${isPartyInvite ? "rgba(100,200,100,0.6)" : "rgba(124,92,191,0.6)"}`, objectFit: "cover" }}
        />
        {multi && (
          <img
            src={senders[1].avatarUrl || `https://api.dicebear.com/9.x/adventurer/svg?seed=${senders[1].username}`}
            alt={senders[1].username}
            style={{
              width: 22, height: 22, borderRadius: 6,
              border: "2px solid rgba(12,10,22,0.95)",
              position: "absolute", bottom: -4, right: -4,
              objectFit: "cover",
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isPartyInvite ? "#88dd99" : "#fff", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isPartyInvite ? "🎮 " : "💬 "}
          {multi
            ? `${senders.map(s => `@${s.username}`).join(", ")}${count > 3 ? ` +${count - 3}` : ""}`
            : `@${senders[0].username}`}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {preview}
        </div>

        {/* Party invite: Join button */}
        {isPartyInvite ? (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <Link
              href={`/town?joinParty=${partyId}`}
              onClick={dismiss}
              style={{
                display: "inline-block",
                fontSize: 12, fontWeight: 800,
                color: "#88dd99",
                background: "rgba(60,180,80,0.2)",
                border: "1px solid rgba(80,200,100,0.5)",
                borderRadius: 8, padding: "5px 14px",
                textDecoration: "none",
              }}
            >
              Join Party →
            </Link>
            <button
              onClick={dismiss}
              style={{
                fontSize: 12, fontWeight: 700,
                color: "rgba(255,255,255,0.4)",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, padding: "5px 10px", cursor: "pointer",
              }}
            >
              Decline
            </button>
          </div>
        ) : (
          <Link
            href={multi ? "/messages" : `/messages?with=${senders[0].userId}`}
            onClick={dismiss}
            style={{
              display: "inline-block", marginTop: 8,
              fontSize: 11, fontWeight: 700,
              color: "#c8aaff",
              background: "rgba(124,92,191,0.18)",
              border: "1px solid rgba(124,92,191,0.35)",
              borderRadius: 8, padding: "3px 10px",
              textDecoration: "none",
            }}
          >
            Open Messages →
          </Link>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        style={{
          background: "transparent", border: "none",
          color: "rgba(255,255,255,0.3)", fontSize: 16,
          cursor: "pointer", flexShrink: 0, padding: "0 2px",
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
