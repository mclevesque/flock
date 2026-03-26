"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "@/lib/use-session";

interface OnlineUser {
  userId: string;
  username: string;
  avatarUrl?: string;
}

// Module-level singleton — shared across all components
let _socket: unknown = null;
let _onlineUsers = new Map<string, OnlineUser>();
let _listeners = new Set<() => void>();
let _joined = false;

function notify() {
  for (const fn of _listeners) fn();
}

export function usePresence() {
  const { data: session } = useSession();
  const [, setTick] = useState(0);
  const socketRef = useRef<unknown>(null);

  // Subscribe to changes
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  // Create singleton socket
  useEffect(() => {
    if (!session?.user?.id) return;
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (!host || host === "DISABLED") return;
    if (_socket) {
      // Already connected — just send join if not yet joined for this user
      if (!_joined) {
        try {
          (_socket as { send: (msg: string) => void }).send(
            JSON.stringify({
              type: "join",
              userId: session.user.id,
              username: session.user.name || "Unknown",
              avatarUrl: (session.user as Record<string, unknown>).image || undefined,
            })
          );
          _joined = true;
        } catch { /* socket not ready yet */ }
      }
      return;
    }

    import("partysocket").then(({ default: PartySocket }) => {
      const ws = new PartySocket({
        host,
        party: "presence",
        room: "global",
      });

      ws.addEventListener("open", () => {
        ws.send(
          JSON.stringify({
            type: "join",
            userId: session.user!.id,
            username: session.user!.name || "Unknown",
            avatarUrl: (session.user as Record<string, unknown>).image || undefined,
          })
        );
        _joined = true;
      });

      ws.addEventListener("message", (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);

          if (msg.type === "snapshot" && Array.isArray(msg.users)) {
            _onlineUsers = new Map();
            for (const u of msg.users) {
              _onlineUsers.set(u.userId, u);
            }
            notify();
          }

          if (msg.type === "user-joined" && msg.userId) {
            _onlineUsers.set(msg.userId, {
              userId: msg.userId,
              username: msg.username,
              avatarUrl: msg.avatarUrl,
            });
            notify();
          }

          if (msg.type === "user-left" && msg.userId) {
            _onlineUsers.delete(msg.userId);
            notify();
          }
        } catch { /* ignore */ }
      });

      _socket = ws;
      socketRef.current = ws;
    }).catch(() => {});

    // Don't close on unmount — singleton stays alive
  }, [session?.user?.id]);

  const isOnline = useCallback((userId: string) => _onlineUsers.has(userId), []);

  return {
    onlineUsers: _onlineUsers,
    isOnline,
    count: _onlineUsers.size,
  };
}
