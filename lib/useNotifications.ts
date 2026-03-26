"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "@/lib/use-session";

export interface PushNotification {
  type: string;
  from?: { userId: string; username: string; avatarUrl?: string };
  preview?: string;
  gameType?: string;
  roomId?: string;
  entryId?: string;
  ts?: number;
  id?: string;
}

export function useNotifications() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [chronicleReplyCount, setChronicleReplyCount] = useState(0);
  const [challenges, setChallenges] = useState<PushNotification[]>([]);
  const socketRef = useRef<unknown>(null);
  const callbacksRef = useRef<Set<(n: PushNotification) => void>>(new Set());

  // Allow external listeners (e.g., GlobalNotifications toast)
  const onNotification = useCallback((cb: (n: PushNotification) => void) => {
    callbacksRef.current.add(cb);
    return () => { callbacksRef.current.delete(cb); };
  }, []);

  const handleNotification = useCallback((n: PushNotification) => {
    const stamped = { ...n, ts: Date.now(), id: `${Date.now()}_${Math.random().toString(36).slice(2)}` };
    setNotifications((prev) => [...prev.slice(-19), stamped]);

    switch (n.type) {
      case "friend-request":
        setFriendRequestCount((c) => c + 1);
        break;
      case "friend-accepted":
        // Could trigger a toast but doesn't affect counts
        break;
      case "new-message":
        setUnreadMessageCount((c) => c + 1);
        break;
      case "chronicle-reply":
        setChronicleReplyCount((c) => c + 1);
        break;
      case "challenge":
      case "game-invite":
        setChallenges((prev) => [...prev, stamped]);
        break;
    }

    // Notify external listeners
    for (const cb of callbacksRef.current) cb(stamped);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (!host || host === "DISABLED") return;

    import("partysocket").then(({ default: PartySocket }) => {
      const ws = new PartySocket({
        host,
        party: "notifications",
        room: session.user!.id,
      });

      ws.addEventListener("message", (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);

          // Snapshot: batch of queued notifications
          if (msg.type === "snapshot" && Array.isArray(msg.pending)) {
            for (const n of msg.pending) handleNotification(n);
            return;
          }

          // Single notification
          if (msg.type) {
            handleNotification(msg);
          }
        } catch { /* ignore */ }
      });

      socketRef.current = ws;
    }).catch(() => {});

    return () => {
      if (socketRef.current) {
        (socketRef.current as { close: () => void }).close();
        socketRef.current = null;
      }
    };
  }, [session?.user?.id, handleNotification]);

  const clearFriendRequests = useCallback(() => setFriendRequestCount(0), []);
  const clearUnreadMessages = useCallback(() => setUnreadMessageCount(0), []);
  const clearChronicleReplies = useCallback(() => setChronicleReplyCount(0), []);
  const dismissChallenge = useCallback((id: string) => {
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return {
    notifications,
    friendRequestCount,
    unreadMessageCount,
    chronicleReplyCount,
    challenges,
    onNotification,
    clearFriendRequests,
    clearUnreadMessages,
    clearChronicleReplies,
    dismissChallenge,
  };
}
