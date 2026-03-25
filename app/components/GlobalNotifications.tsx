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

const POLL_INTERVAL_MS = 30_000;
const AUTO_DISMISS_MS = 10_000;
const PARTY_DISMISS_MS = 3 * 60 * 1000; // 3 minutes for party invites

export default function GlobalNotifications() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [notification, setNotification] = useState<Notification | null>(null);
  const lastSeenTimestamps = useRef<Record<string, string>>({});
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialized = useRef(false);

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

  const checkForNewMessages = useCallback(async () => {
    if (!session?.user?.id || isMessagesPage) return;
    if (document.hidden) return; // don't ping while tab is hidden

    try {
      const r = await fetch("/api/messages");
      if (!r.ok) return;
      const conversations: Conversation[] = await r.json();

      if (!Array.isArray(conversations)) return;

      // First poll: just seed timestamps, don't show notifications yet
      if (!initialized.current) {
        for (const c of conversations) {
          lastSeenTimestamps.current[c.other_user] = c.created_at;
        }
        initialized.current = true;
        return;
      }

      // Find conversations with newer messages than last seen — only from others, never our own outgoing
      const newOnes = conversations.filter(c => {
        if (c.last_sender_id === session?.user?.id) return false; // skip messages we sent
        const last = lastSeenTimestamps.current[c.other_user];
        if (!last) return true; // brand new sender
        return new Date(c.created_at) > new Date(last);
      });

      if (newOnes.length === 0) return;

      // Update last-seen for all
      for (const c of conversations) {
        lastSeenTimestamps.current[c.other_user] = c.created_at;
      }

      // Detect party invite (single sender, message is [party:id])
      const partyInvite = newOnes.length === 1 && newOnes[0].last_message?.startsWith("[party:")
        ? newOnes[0].last_message.slice(7, -1)
        : undefined;

      const previewText = partyInvite
        ? "🎮 Invited you to their party!"
        : newOnes.length === 1
          ? (newOnes[0].last_message?.startsWith("[")
              ? "Sent you a message"
              : (newOnes[0].last_message?.slice(0, 60) || "Sent you a message"))
          : `${newOnes.length} new conversations`;

      // Build notification
      const notif: Notification = {
        id: Date.now().toString(),
        senderIds: newOnes.map(c => c.other_user),
        senders: newOnes.slice(0, 3).map(c => ({
          userId: c.other_user,
          username: c.username,
          avatarUrl: c.avatar_url,
        })),
        preview: previewText,
        count: newOnes.length,
        partyId: partyInvite,
      };

      showNotification(notif, partyInvite ? PARTY_DISMISS_MS : AUTO_DISMISS_MS);
    } catch { /* silently ignore network errors */ }
  }, [session, isMessagesPage, showNotification]);

  // Setup polling
  useEffect(() => {
    if (!session?.user?.id) return;

    // Initial check slightly delayed to let page settle
    const initTimeout = setTimeout(checkForNewMessages, 3000);
    pollTimer.current = setInterval(checkForNewMessages, POLL_INTERVAL_MS);

    // Also re-check when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) checkForNewMessages();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(initTimeout);
      if (pollTimer.current) clearInterval(pollTimer.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearDismissTimer();
    };
  }, [session, checkForNewMessages, clearDismissTimer]);

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
