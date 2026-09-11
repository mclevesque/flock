"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PersonAvatar from "../components/PersonAvatar";
import { parseInvite, roomPath } from "@/lib/draftmasters/invite";
import FriendsDrawer from "./FriendsDrawer";
import Icon from "./Icon";
import { SOCIAL_STYLES } from "./social-styles";
import {
  SocialContext,
  type ActiveRoomInfo,
  type ChatVoice,
  type PushMessage,
  type Social,
  type SocialFriend,
  type SocialMe,
  type SocialPending,
} from "./social-context";
import { useDraftMedia } from "./useDraftMedia";
import { PeerAudio, VoicePortrait } from "./VoiceKit";

/**
 * DraftMasters' friends, chat and voice — mounted once, in the layout.
 *
 * It lives above the pages rather than in any of them because every part of it
 * has to outlast a navigation: a voice call should not hang up because you
 * tapped Ladder, an unread badge should not reset because you went to You, and
 * an invite that arrives while you are on the shelf should be one tap from the
 * room.
 *
 * Realtime is the hub's own per-user notifications party (the same one the
 * messages page listens on), so a message sent from greatsouls.net/messages
 * shows up here instantly and vice versa. Polling is only the safety net.
 */

interface Toast {
  id: string;
  kind: "invite" | "message" | "voice";
  friendId: string;
  name: string;
  avatar: string | null;
  text: string;
  code?: string;
}

type Sock = { send: (s: string) => void; close: () => void; addEventListener: WebSocket["addEventListener"] };

const PARTY_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
const REALTIME = Boolean(PARTY_HOST && PARTY_HOST !== "DISABLED");

export default function SocialProvider({
  meId,
  meName,
  children,
}: {
  meId: string;
  meName: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [me, setMe] = useState<SocialMe | null>(null);
  const [friends, setFriends] = useState<SocialFriend[]>([]);
  const [pending, setPending] = useState<SocialPending[]>([]);
  const [activeRoom, setActiveRoom] = useState<ActiveRoomInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [chatWith, setChatWith] = useState<string | null>(null);
  const [inGame, setInGameState] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const openRef = useRef({ isOpen: false, chatWith: null as string | null });
  openRef.current = { isOpen, chatWith };
  const inGameRef = useRef(false);
  const friendsRef = useRef(friends);
  friendsRef.current = friends;
  const joinHandler = useRef<((code: string) => void) | null>(null);
  const listeners = useRef(new Set<(m: PushMessage) => void>());

  // ── Data ───────────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/draftmasters/social", { cache: "no-store" });
      const d = await r.json();
      const viewing = openRef.current.isOpen ? openRef.current.chatWith : null;
      setMe(d.me ?? null);
      // A chat that is open right now has been read, whatever the count says.
      setFriends(((d.friends ?? []) as SocialFriend[]).map((f) => (f.id === viewing ? { ...f, unread: 0 } : f)));
      setPending(d.pending ?? []);
      setActiveRoom(d.activeRoom ?? null);
    } catch {
      /* offline; the last list stands */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Presence and unread are only as fresh as the last fetch, and the push
  // socket can be down. Poll gently, faster while the drawer is open.
  useEffect(() => {
    const every = isOpen ? 30_000 : 120_000;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, every);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isOpen, refresh]);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.filter((p) => !(p.friendId === t.friendId && p.kind === t.kind)), { ...t, id }].slice(-3));
    setTimeout(() => setToasts((prev) => prev.filter((p) => p.id !== id)), t.kind === "message" ? 7000 : 20000);
  }, []);

  // ── Chat voice ─────────────────────────────────────────────────────────────

  const [voiceWith, setVoiceWith] = useState<string | null>(null);
  const voiceWithRef = useRef<string | null>(null);
  const [peerHere, setPeerHere] = useState(false);
  const [peerMuted, setPeerMuted] = useState(false);
  const voiceWs = useRef<Sock | null>(null);

  const sendVoiceSignal = useCallback(
    (toUserId: string, signalType: string, payload: unknown) => {
      voiceWs.current?.send(JSON.stringify({ type: "rtc-signal", toUserId, fromUserId: meId, signalType, payload }));
    },
    [meId]
  );
  const chatMedia = useDraftMedia(meId, sendVoiceSignal);
  const chatMediaRef = useRef(chatMedia);
  chatMediaRef.current = chatMedia;
  const meRef = useRef(me);
  meRef.current = me;

  const leaveVoice = useCallback(() => {
    voiceWs.current?.close();
    voiceWs.current = null;
    voiceWithRef.current = null;
    chatMediaRef.current.teardown();
    setVoiceWith(null);
    setPeerHere(false);
    setPeerMuted(false);
  }, []);

  /**
   * Voice with one friend, in a room only the two of you can be in.
   *
   * No ringing, no answer button: whoever opens the chat is in the call, and
   * the other side joins the moment they open it too. The `ring` push is only
   * so a friend whose drawer is closed finds out and can tap in.
   */
  const joinVoice = useCallback(
    async (friendId: string) => {
      if (inGameRef.current || !REALTIME) return;
      if (voiceWithRef.current === friendId) return;
      if (voiceWithRef.current) leaveVoice();

      voiceWithRef.current = friendId;
      setVoiceWith(friendId);
      setPeerHere(false);
      setPeerMuted(false);

      const { default: PartySocket } = await import("partysocket");
      if (voiceWithRef.current !== friendId) return; // switched while loading

      const room = `dmv-${[meId, friendId].sort().join("--")}`.slice(0, 120);
      const ws = new PartySocket({ host: PARTY_HOST!, party: "voice", room }) as unknown as Sock;
      voiceWs.current = ws;
      const media = () => chatMediaRef.current;
      void media().start();

      ws.addEventListener("open", () => {
        ws.send(
          JSON.stringify({
            type: "voice-join",
            userId: meId,
            username: meRef.current?.displayName ?? meName,
            avatarUrl: meRef.current?.avatar ?? null,
            isMuted: false,
          })
        );
      });
      ws.addEventListener("message", (ev: MessageEvent) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        switch (msg.type) {
          case "voice-snapshot": {
            const other = ((msg.participants as { userId: string; isMuted?: boolean }[]) ?? []).find(
              (p) => p.userId === friendId
            );
            setPeerHere(Boolean(other));
            setPeerMuted(Boolean(other?.isMuted));
            if (other) void media().connectTo(friendId);
            break;
          }
          case "voice-join":
            if (msg.userId !== friendId) break;
            // A rejoin is a new browser session on their end; the old
            // connection to it is dead weight and would fight the new offer.
            media().dropPeer(friendId);
            setPeerHere(true);
            setPeerMuted(Boolean(msg.isMuted));
            void media().connectTo(friendId);
            break;
          case "voice-leave":
            if (msg.userId !== friendId) break;
            media().dropPeer(friendId);
            setPeerHere(false);
            break;
          case "voice-mute":
            if (msg.userId === friendId) setPeerMuted(Boolean(msg.isMuted));
            break;
          case "rtc-signal":
            void media().handleSignal({
              fromUserId: String(msg.fromUserId),
              signalType: msg.signalType as "offer" | "answer" | "ice",
              payload: msg.payload as Record<string, unknown>,
            });
            break;
        }
      });

      void fetch("/api/draftmasters/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ring", userId: friendId }),
      }).catch(() => {});
    },
    [leaveVoice, meId, meName]
  );

  const announceMute = useCallback(
    (micOn: boolean) => {
      voiceWs.current?.send(JSON.stringify({ type: "voice-mute", userId: meId, isMuted: !micOn }));
    },
    [meId]
  );

  useEffect(() => () => voiceWs.current?.close(), []);

  // ── Push ───────────────────────────────────────────────────────────────────

  const onPush = useCallback(
    (n: PushMessage, queued: boolean) => {
      if (n.type === "friend-request" || n.type === "friend-accepted") {
        void refresh();
        return;
      }

      if (n.type === "dm-voice") {
        const from = n.from;
        if (!from || queued || inGameRef.current || voiceWithRef.current === from.userId) return;
        const f = friendsRef.current.find((x) => x.id === from.userId);
        pushToast({
          kind: "voice",
          friendId: from.userId,
          name: f?.displayName ?? from.username,
          avatar: f?.avatar ?? from.avatarUrl ?? null,
          text: "is in voice with you",
        });
        return;
      }

      if (n.type !== "new-message" || !n.senderId || !n.receiverId) return;
      listeners.current.forEach((l) => l(n));

      const mine = n.senderId === meId;
      const other = mine ? n.receiverId : n.senderId;
      const content = String(n.content ?? "");
      const code = parseInvite(content);
      const { isOpen: drawerOpen, chatWith: viewingId } = openRef.current;
      const viewing = !mine && drawerOpen && viewingId === other && document.visibilityState === "visible";

      setFriends((fs) =>
        fs.map((f) =>
          f.id === other
            ? {
                ...f,
                unread: mine || viewing ? f.unread : f.unread + 1,
                last: { text: code ? "Draft invite" : content.slice(0, 80), fromMe: mine, at: new Date().toISOString() },
              }
            : f
        )
      );

      if (mine || viewing || inGameRef.current) return;
      // Things that queued while this tab was closed: only a fresh invite is
      // still worth interrupting for.
      if (queued && (!code || Date.now() - (n.timestamp ?? 0) > 15 * 60_000)) return;

      const f = friendsRef.current.find((x) => x.id === other);
      pushToast({
        kind: code ? "invite" : "message",
        friendId: other,
        name: f?.displayName ?? n.from?.username ?? "A friend",
        avatar: f?.avatar ?? n.from?.avatarUrl ?? null,
        text: code ? "invited you to a draft" : content.slice(0, 90),
        code: code ?? undefined,
      });
    },
    [meId, pushToast, refresh]
  );

  const onPushRef = useRef(onPush);
  onPushRef.current = onPush;

  useEffect(() => {
    if (!REALTIME) return;
    let ws: Sock | null = null;
    let dead = false;
    void import("partysocket").then(({ default: PartySocket }) => {
      if (dead) return;
      ws = new PartySocket({ host: PARTY_HOST!, party: "notifications", room: meId }) as unknown as Sock;
      ws.addEventListener("message", (e: MessageEvent) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(e.data));
        } catch {
          return;
        }
        if (msg.type === "snapshot" && Array.isArray(msg.pending)) {
          (msg.pending as PushMessage[]).forEach((n) => onPushRef.current(n, true));
          return;
        }
        onPushRef.current(msg as unknown as PushMessage, false);
      });
    });
    return () => {
      dead = true;
      ws?.close();
    };
  }, [meId]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const post = useCallback(async (body: Record<string, unknown>) => {
    try {
      const r = await fetch("/api/draftmasters/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      return { ok: r.ok, ...d } as { ok: boolean; note?: string; error?: string; sent?: string[] };
    } catch {
      return { ok: false, error: "That did not work." };
    }
  }, []);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await post(body);
      if (res.ok) void refresh();
      return res;
    },
    [post, refresh]
  );

  const invite = useCallback(
    async (userIds: string[], code: string) => {
      const res = await post({ action: "invite", userIds, code });
      return { sent: res.sent ?? [], error: res.ok ? undefined : res.error };
    },
    [post]
  );

  const markRead = useCallback((friendId: string) => {
    setFriends((fs) => fs.map((f) => (f.id === friendId && f.unread ? { ...f, unread: 0 } : f)));
  }, []);

  const rememberRoom = useCallback(
    (code: string | null, host = false) => {
      setActiveRoom(code ? { code, isHost: host, at: new Date().toISOString() } : null);
      void post({ action: "room", code, host });
    },
    [post]
  );

  const open = useCallback((friendId?: string | null) => {
    setChatWith(friendId ?? null);
    setIsOpen(true);
    if (friendId) setToasts((prev) => prev.filter((t) => t.friendId !== friendId || t.kind === "invite"));
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const joinRoom = useCallback(
    (code: string) => {
      setIsOpen(false);
      setToasts((prev) => prev.filter((t) => t.code !== code));
      if (joinHandler.current) joinHandler.current(code);
      else router.push(roomPath(code));
    },
    [router]
  );

  const setJoinHandler = useCallback((fn: ((code: string) => void) | null) => {
    joinHandler.current = fn;
  }, []);

  const setInGame = useCallback(
    (v: boolean) => {
      inGameRef.current = v;
      setInGameState(v);
      if (v) {
        // The room has its own voice with everyone in it. Two calls with the
        // same friend would put their voice in your ears twice.
        if (voiceWithRef.current) leaveVoice();
        setIsOpen(false);
        setToasts([]);
      }
    },
    [leaveVoice]
  );

  const subscribe = useCallback((fn: (msg: PushMessage) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  // A page change closes the sheet — it was opened on top of the old page.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) setIsOpen(false);
    lastPath.current = pathname;
  }, [pathname]);

  const voice: ChatVoice = useMemo(
    () => ({
      withId: voiceWith,
      media: chatMedia,
      peerHere,
      peerMuted,
      join: (id: string) => void joinVoice(id),
      leave: leaveVoice,
      announceMute,
    }),
    [announceMute, chatMedia, joinVoice, leaveVoice, peerHere, peerMuted, voiceWith]
  );

  const value: Social = {
    ready: true,
    me,
    friends,
    pending,
    activeRoom,
    loaded,
    unreadTotal: friends.reduce((n, f) => n + f.unread, 0) + pending.length,
    isOpen,
    chatWith,
    inGame,
    voice: REALTIME ? voice : null,
    refresh,
    open,
    close,
    act,
    invite,
    markRead,
    rememberRoom,
    joinRoom,
    setJoinHandler,
    setInGame,
    subscribe,
  };

  const voiceFriend = voiceWith ? friends.find((f) => f.id === voiceWith) : null;

  return (
    <SocialContext.Provider value={value}>
      {children}
      <style dangerouslySetInnerHTML={{ __html: SOCIAL_STYLES }} />
      <div className="dm-social">
        <FriendsDrawer />
        <PeerAudio media={chatMedia} />

        {/* In a call with the drawer shut: the call is still a thing on
            screen, with both faces to mute and one tap back to the chat. */}
        {voiceWith && !isOpen && !inGame && (
          <div className="dm-voicepill" role="group" aria-label="Voice call">
            <VoicePortrait
              id={meId}
              name={meName}
              avatar={me?.avatar ?? null}
              isMe
              media={chatMedia}
              size={36}
              onToggleMine={announceMute}
            />
            <VoicePortrait
              id={voiceWith}
              name={voiceFriend?.displayName ?? "Friend"}
              avatar={voiceFriend?.avatar ?? null}
              isMe={false}
              media={chatMedia}
              selfMuted={peerMuted}
              present={peerHere}
              size={36}
            />
            <button type="button" className="dm-voicepill-open" onClick={() => open(voiceWith)}>
              {peerHere ? voiceFriend?.displayName ?? "Voice" : "Waiting…"}
            </button>
            <button type="button" className="dm-voicepill-x" onClick={leaveVoice} aria-label="Leave voice" title="Leave voice">
              <Icon name="close" size={15} />
            </button>
          </div>
        )}

        {!inGame && toasts.length > 0 && (
          <div className="dm-toasts" aria-live="polite">
            {toasts.map((t) => (
              <div key={t.id} className="dm-toast" data-kind={t.kind}>
                <PersonAvatar src={t.avatar} seed={t.friendId} className="dm-toast-face" />
                <button
                  type="button"
                  className="dm-toast-body"
                  onClick={() => {
                    setToasts((prev) => prev.filter((p) => p.id !== t.id));
                    open(t.friendId);
                  }}
                >
                  <b>{t.name}</b>
                  <span>{t.text}</span>
                </button>
                {t.kind === "invite" && t.code && (
                  <button type="button" className="dm-btn dm-btn-primary dm-toast-go" onClick={() => joinRoom(t.code!)}>
                    Join
                  </button>
                )}
                {t.kind === "voice" && (
                  <button
                    type="button"
                    className="dm-btn dm-btn-primary dm-toast-go"
                    onClick={() => {
                      setToasts((prev) => prev.filter((p) => p.id !== t.id));
                      open(t.friendId);
                      void joinVoice(t.friendId);
                    }}
                  >
                    <Icon name="mic" size={14} /> Talk
                  </button>
                )}
                <button
                  type="button"
                  className="dm-toast-x"
                  aria-label="Dismiss"
                  onClick={() => setToasts((prev) => prev.filter((p) => p.id !== t.id))}
                >
                  <Icon name="close" size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SocialContext.Provider>
  );
}
