"use client";

import { useEffect, useRef, useState } from "react";
import PersonAvatar from "../components/PersonAvatar";
import { roomPath } from "@/lib/draftmasters/invite";
import { sfx } from "@/lib/draftmasters/sfx";
import Icon from "./Icon";
import { useSocial } from "./social-context";
import type { ChatLine } from "./types";
import type { DraftMedia } from "./useDraftMedia";
import { MicPicker, VoiceHint, VoicePortrait } from "./VoiceKit";

/**
 * Voice and chat inside a room.
 *
 * Replaces the media rail, which was two video tiles, a camera button and a
 * chat box — built for a video call that nobody was having. What people do
 * mid-draft is talk, and the two things they reach for are "mute me" and
 * "mute them". Both are now the faces themselves.
 *
 *   RoomVoice  inline: the lobby, the ready check, and the stage's side rail
 *              when the screen is tall enough to have one.
 *   RoomDock   floating: every other moment of the game. Faces down the left
 *              edge where no control lives, a chat bubble under them, and a
 *              card that opens from the top so the keyboard never covers it.
 *   InviteSheet  friends to send a card to, and the link for everyone else.
 */

export interface RoomMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  mic: boolean;
}

// ── Faces ────────────────────────────────────────────────────────────────────

export function RoomFaces({
  members,
  meId,
  myName,
  myAvatar,
  media,
  onMicChange,
  size = 44,
  label = false,
}: {
  members: RoomMember[];
  meId: string;
  myName: string;
  myAvatar: string | null;
  media: DraftMedia;
  onMicChange: (micOn: boolean) => void;
  size?: number;
  label?: boolean;
}) {
  // You first, always — and present even in the moment before the room has
  // confirmed the join, so your own mute is never missing.
  const others = members.filter((m) => m.userId !== meId);
  const me = members.find((m) => m.userId === meId) ?? { userId: meId, name: myName, avatarUrl: myAvatar, mic: true };

  return (
    <div className="dm-rv-faces">
      {[me, ...others].map((m) => (
        <VoicePortrait
          key={m.userId}
          id={m.userId}
          name={m.name}
          avatar={m.avatarUrl}
          isMe={m.userId === meId}
          media={media}
          selfMuted={!m.mic}
          size={size}
          label={label}
          onToggleMine={onMicChange}
        />
      ))}
    </div>
  );
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export function RoomChat({
  chat,
  meId,
  onSend,
  autoFocus = false,
}: {
  chat: ChatLine[];
  meId: string;
  onSend: (text: string) => void;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  return (
    <div className="dm-chat">
      <div className="dm-chat-log" ref={logRef} aria-live="polite">
        {chat.length === 0 && <p className="dm-note">Talk trash here, or just talk.</p>}
        {chat.map((line, i) => (
          <div
            key={`${line.at}-${i}`}
            className="dm-chat-line"
            data-system={line.system ? "1" : "0"}
            data-me={line.userId === meId ? "1" : "0"}
          >
            <strong>{line.userId === meId ? "You" : line.name}</strong> {line.text}
          </div>
        ))}
      </div>
      <form
        className="dm-row dm-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          onSend(text);
          setDraft("");
        }}
      >
        <input
          className="dm-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something…"
          maxLength={300}
          aria-label="Chat message"
          enterKeyHint="send"
          autoFocus={autoFocus}
        />
        <button className="dm-btn" type="submit" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

// ── Inline ───────────────────────────────────────────────────────────────────

interface VoiceProps {
  members: RoomMember[];
  meId: string;
  myName: string;
  myAvatar: string | null;
  media: DraftMedia;
  chat: ChatLine[];
  onSendChat: (text: string) => void;
  onMicChange: (micOn: boolean) => void;
}

export function RoomVoice(props: VoiceProps) {
  const { media, chat, meId, onSendChat } = props;
  return (
    // .dm-media keeps the stage rail's existing placement rules working.
    <div className="dm-media dm-roomvoice">
      <RoomFaces {...props} size={48} label />
      <div className="dm-rv-tools">
        <MicPicker media={media} compact />
        <span className="dm-rv-tip">Tap your face to mute yourself, anyone else&apos;s to mute them for you.</span>
      </div>
      <VoiceHint media={media} />
      <RoomChat chat={chat} meId={meId} onSend={onSendChat} />
    </div>
  );
}

// ── Floating ─────────────────────────────────────────────────────────────────

function lineKey(l: ChatLine | undefined): string {
  return l ? `${l.at}|${l.userId}|${l.text}` : "";
}

export function RoomDock({ defaultOpen, ...props }: VoiceProps & { defaultOpen: boolean }) {
  const { chat, meId, media, onSendChat } = props;
  const [open, setOpen] = useState(defaultOpen);
  const [tucked, setTucked] = useState(false);
  /**
   * Lines are tracked by identity, not by count: the room keeps the last 80,
   * so once it is full a new message does not change the length at all.
   */
  const [seenKey, setSeenKey] = useState(() => lineKey(chat[chat.length - 1]));
  /** The newest line whose preview bubble has already come and gone. */
  const [peekedKey, setPeekedKey] = useState(seenKey);

  const last = chat[chat.length - 1];
  const lastKey = lineKey(last);
  // Closed is not the same as off: a new line from someone else shows beside
  // the bubble for a few seconds, so chat is still live when it is tucked away.
  const peek = !open && last && last.userId !== meId && lastKey !== peekedKey ? last : null;
  const peeking = Boolean(peek);

  useEffect(() => {
    if (!peeking) return;
    const id = setTimeout(() => setPeekedKey(lastKey), 4500);
    return () => clearTimeout(id);
  }, [lastKey, peeking]);

  const seenAt = chat.findIndex((l) => lineKey(l) === seenKey);
  const unread = open ? 0 : chat.slice(seenAt + 1).filter((l) => l.userId !== meId && !l.system).length;

  const toggle = () => {
    setOpen((o) => !o);
    setSeenKey(lastKey);
    setPeekedKey(lastKey);
  };

  return (
    <div className="dm-dock" data-open={open ? "1" : "0"} data-tucked={tucked ? "1" : "0"}>
      <div className="dm-dock-rail">
        {/* Tucked keeps your own face: the one control that must never be
            more than a tap away mid-draft is muting yourself. */}
        <RoomFaces {...props} members={tucked ? [] : props.members} size={38} />
        <button
          type="button"
          className="dm-dock-chat"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? "Hide chat" : unread ? `Chat, ${unread} new` : "Chat"}
          title={open ? "Hide chat" : "Chat"}
        >
          <Icon name="chat" size={18} />
          {unread > 0 && <span className="dm-dock-badge">{unread > 9 ? "9+" : unread}</span>}
        </button>
        <button
          type="button"
          className="dm-dock-tuck"
          onClick={() => setTucked((t) => !t)}
          aria-label={tucked ? "Show voice" : "Tuck voice away"}
          title={tucked ? "Show voice" : "Tuck away"}
        >
          <Icon name="chevron" size={14} />
        </button>
      </div>

      {!open && peek && (
        <button type="button" className="dm-dock-peek" onClick={toggle}>
          <b>{peek.name}</b>
          {peek.text}
        </button>
      )}

      {open && (
        <div className="dm-dock-card" role="region" aria-label="Room chat">
          <div className="dm-dock-card-head">
            <b>Room chat</b>
            <MicPicker media={media} compact />
            <button type="button" className="dm-dock-x" onClick={toggle} aria-label="Hide chat">
              <Icon name="close" size={15} />
            </button>
          </div>
          <VoiceHint media={media} />
          <RoomChat chat={chat} meId={meId} onSend={onSendChat} />
        </div>
      )}
    </div>
  );
}

// ── Invite ───────────────────────────────────────────────────────────────────

/**
 * Who to bring into this room.
 *
 * Friends get an invite card in their chat — and a toast, if they are on the
 * site — that drops them straight into the room. The link is for everyone
 * else: texted, pasted, whatever. Both land in the same place.
 */
export function InviteSheet({ code, onClose }: { code: string; onClose: () => void }) {
  const s = useSocial();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const { refresh } = s;

  useEffect(() => {
    void refresh(); // who is around right now, not two minutes ago
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const link = typeof window !== "undefined" ? `${window.location.origin}${roomPath(code)}` : roomPath(code);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async (text: string, which: "link" | "code") => {
    sfx.click();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError(`Copy blocked — the code is ${code}.`);
    }
  };

  const share = async () => {
    if (canShare) {
      try {
        await navigator.share({ title: "DraftMasters", text: "Draft against me:", url: link });
        return;
      } catch {
        /* dismissed — fall through to copying */
      }
    }
    void copy(link, "link");
  };

  const sendTo = async (id: string) => {
    setBusy(id);
    setError(null);
    const res = await s.invite([id], code);
    if (res.sent.includes(id)) {
      sfx.click();
      setSent((prev) => new Set(prev).add(id));
    } else {
      setError(res.error ?? "That invite did not send.");
    }
    setBusy(null);
  };

  return (
    <div
      className="dm-sheet-scrim dm-invite-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={`Invite to room ${code}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dm-sheet dm-invite-sheet">
        <div className="dm-sheet-grip" aria-hidden="true" />
        <div className="dm-sheet-head">
          <h2 className="dm-sheet-title">Invite to this room</h2>
          <button type="button" className="dm-sheet-x dm-invite-x" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </div>

        <div className="dm-invite-link-row">
          <button type="button" className="dm-btn dm-btn-primary" onClick={() => void share()}>
            {copied === "link" ? (
              <>
                <Icon name="check" size={15} /> Link copied
              </>
            ) : (
              <>
                <Icon name="link" size={15} /> {canShare ? "Share room link" : "Copy room link"}
              </>
            )}
          </button>
          <button
            type="button"
            className="dm-btn dm-btn-ghost dm-invite-code"
            onClick={() => void copy(code, "code")}
            title="Copy the room code"
          >
            {copied === "code" ? "Copied" : code}
          </button>
        </div>
        <p className="dm-note">
          The link drops anyone straight into this room. The code works too — type it under Join a room.
        </p>

        {s.ready && (
          <>
            <p className="dm-fd-eyebrow">Friends</p>
            {!s.loaded && <p className="dm-fd-empty">Loading…</p>}
            {s.loaded && !s.friends.length && (
              <p className="dm-fd-empty">No friends yet. Add people from Friends on the shelf, or just send the link.</p>
            )}
            <div className="dm-invite-list">
              {s.friends.map((f) => {
                const done = sent.has(f.id);
                return (
                  <div key={f.id} className="dm-fd-row" data-kind="invite">
                    <span className="dm-fd-face" data-presence={f.inDraft ? "draft" : f.online ? "online" : "off"}>
                      <PersonAvatar src={f.avatar} seed={f.id} />
                    </span>
                    <span className="dm-fd-who">
                      <b>{f.displayName}</b>
                      <em>{f.inDraft ? "In a draft" : f.online ? "Online now" : "Gets it in their chat"}</em>
                    </span>
                    <button
                      type="button"
                      className="dm-btn dm-btn-primary dm-fd-small dm-invite-send"
                      data-sent={done ? "1" : "0"}
                      disabled={done || busy === f.id}
                      onClick={() => void sendTo(f.id)}
                    >
                      {done ? (
                        <>
                          <Icon name="check" size={14} /> Sent
                        </>
                      ) : busy === f.id ? (
                        "Sending…"
                      ) : (
                        "Invite"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {error && (
          <p className="dm-fd-note" data-bad="1">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
