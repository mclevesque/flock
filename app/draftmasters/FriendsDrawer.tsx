"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PersonAvatar from "../components/PersonAvatar";
import { parseInvite } from "@/lib/draftmasters/invite";
import { rememberedMicGrant } from "./useDraftMedia";
import Icon from "./Icon";
import { useSocial, type ChatMsg, type SocialFriend } from "./social-context";
import { MicPicker, VoiceHint, VoicePortrait } from "./VoiceKit";

/**
 * Friends: the people, and a conversation with each of them.
 *
 * What it deliberately does NOT have any more is an Invite button on every
 * row. That button copied a link to a room that did not exist yet, so the
 * friend clicked it and landed on the shelf with nobody there. Invites now come
 * from inside a room you are actually hosting, and arrive here as a card in
 * the chat that takes you straight to it.
 *
 * One component, two shapes, and CSS picks: a slide-over from the right on a
 * wide screen, a sheet from the bottom on a phone. Same markup, so the two can
 * never disagree about what a friend row says.
 */

export default function FriendsDrawer() {
  const s = useSocial();
  const inset = useKeyboardInset(s.isOpen);
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const { close } = s;

  // Escape closes; the page underneath does not scroll while it is open.
  useEffect(() => {
    if (!s.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close, s.isOpen]);

  if (!s.ready || !s.isOpen) return null;

  const friend = s.chatWith ? s.friends.find((f) => f.id === s.chatWith) ?? null : null;

  // Pull the sheet down by its grip to dismiss it, the way every phone sheet works.
  const onTouchStart = (e: React.TouchEvent) => {
    drag.current = { y: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current || !sheet.current) return;
    drag.current.dy = Math.max(0, e.touches[0].clientY - drag.current.y);
    sheet.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onTouchEnd = () => {
    if (!drag.current || !sheet.current) return;
    const far = drag.current.dy > 90;
    sheet.current.style.transform = "";
    drag.current = null;
    if (far) close();
  };

  return (
    <div
      className="dm-fd-scrim"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside
        ref={sheet}
        className="dm-fd"
        role="dialog"
        aria-modal="true"
        aria-label={friend ? `Chat with ${friend.displayName}` : "Friends"}
        style={{ ["--dm-kb" as string]: `${inset}px` }}
      >
        <div
          className="dm-fd-grip"
          aria-hidden="true"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
        {friend ? <ChatView key={friend.id} friend={friend} /> : <FriendsPanel />}
      </aside>
    </div>
  );
}

// ── The list ─────────────────────────────────────────────────────────────────

export function FriendsPanel({ page = false }: { page?: boolean }) {
  const s = useSocial();
  const [add, setAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);

  const submit = async () => {
    const name = add.trim();
    if (!name) return;
    setBusy(true);
    setNote(null);
    const res = await s.act({ action: "add", username: name });
    setNote(res.ok ? { text: res.note ?? "Done." } : { text: res.error ?? "That did not work.", bad: true });
    if (res.ok) setAdd("");
    setBusy(false);
  };

  const around = s.friends.filter((f) => f.online || f.inDraft).length;

  return (
    <div className="dm-fd-view" data-page={page ? "1" : "0"}>
      {!page && (
        <header className="dm-fd-head">
          <div className="dm-fd-title">
            <b>Friends</b>
            <em>{s.loaded ? (around ? `${around} around` : `${s.friends.length} total`) : "Loading…"}</em>
          </div>
          <button type="button" className="dm-fd-x" onClick={s.close} aria-label="Close">
            <Icon name="close" size={17} />
          </button>
        </header>
      )}

      <form
        className="dm-fd-add"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          className="dm-input"
          placeholder="Add someone by name"
          value={add}
          onChange={(e) => setAdd(e.target.value)}
          aria-label="Add a friend by username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
        />
        <button type="submit" className="dm-btn dm-btn-primary" disabled={busy || !add.trim()}>
          Add
        </button>
      </form>
      {note && (
        <p className="dm-fd-note" data-bad={note.bad ? "1" : "0"}>
          {note.text}
        </p>
      )}

      <div className="dm-fd-scroll">
        {s.pending.length > 0 && (
          <>
            <p className="dm-fd-eyebrow">Waiting on you</p>
            {s.pending.map((p) => (
              <div key={p.id} className="dm-fd-row" data-kind="pending">
                <span className="dm-fd-face">
                  <PersonAvatar src={p.avatar} seed={p.id} />
                </span>
                <span className="dm-fd-who">
                  <b>{p.displayName}</b>
                  <em>wants to be friends</em>
                </span>
                <button type="button" className="dm-btn dm-btn-primary dm-fd-small" onClick={() => void s.act({ action: "accept", userId: p.id })}>
                  Accept
                </button>
                <button type="button" className="dm-btn dm-btn-ghost dm-fd-small" onClick={() => void s.act({ action: "decline", userId: p.id })}>
                  No
                </button>
              </div>
            ))}
          </>
        )}

        {s.friends.length > 0 && <p className="dm-fd-eyebrow">{page ? "Your friends" : "Tap someone to chat"}</p>}

        {s.friends.map((f) => (
          <button key={f.id} type="button" className="dm-fd-row" onClick={() => s.open(f.id)}>
            <span className="dm-fd-face" data-presence={presence(f)}>
              <PersonAvatar src={f.avatar} seed={f.id} />
            </span>
            <span className="dm-fd-who">
              <b>{f.displayName}</b>
              <em>{f.last ? `${f.last.fromMe ? "You: " : ""}${f.last.text}` : recordLine(f)}</em>
            </span>
            <span className="dm-fd-side">
              {f.unread > 0 ? (
                <span className="dm-fd-unread" aria-label={`${f.unread} unread`}>
                  {f.unread > 9 ? "9+" : f.unread}
                </span>
              ) : (
                <span className="dm-fd-status" data-presence={presence(f)}>
                  {f.inDraft ? "In a draft" : f.online ? "Online" : ""}
                </span>
              )}
              {s.voice?.withId === f.id && <Icon name="mic" size={13} className="dm-fd-invoice" />}
            </span>
          </button>
        ))}

        {s.loaded && !s.friends.length && !s.pending.length && (
          <p className="dm-fd-empty">
            Nobody yet. Add someone by name above — they need an account here
            {s.me ? (
              <>
                , and <b>{s.me.username}</b> is the name they will be looking for
              </>
            ) : null}
            .
          </p>
        )}
      </div>

      <p className="dm-fd-foot">
        <Icon name="friends" size={14} /> To draft with a friend, open a room and tap <b>Invite</b>.
      </p>
    </div>
  );
}

function presence(f: SocialFriend): "draft" | "online" | "off" {
  return f.inDraft ? "draft" : f.online ? "online" : "off";
}

function recordLine(f: SocialFriend): string {
  return f.record ? `${f.record.rating} · ${f.record.pvpWins}W ${f.record.pvpLosses}L` : "no drafts yet";
}

// ── A conversation ───────────────────────────────────────────────────────────

/** Leaving a call with someone means you meant it — don't rejoin it every time their chat opens this session. */
const leftVoiceWith = new Set<string>();

function ChatView({ friend }: { friend: SocialFriend }) {
  const s = useSocial();
  const meId = s.me?.id ?? "";
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const { markRead, subscribe } = s;

  useEffect(() => {
    let dead = false;
    markRead(friend.id);
    void (async () => {
      try {
        const r = await fetch(`/api/draftmasters/social?with=${encodeURIComponent(friend.id)}`, { cache: "no-store" });
        const d = await r.json();
        if (!dead) setMsgs((d.messages ?? []) as ChatMsg[]);
      } catch {
        if (!dead) setError("Couldn't load this chat.");
      }
      if (!dead) setLoading(false);
    })();
    return () => {
      dead = true;
    };
  }, [friend.id, markRead]);

  // Live messages for this pair only. Our own sends come back too (for other
  // tabs); those replace the optimistic copy instead of doubling it.
  useEffect(
    () =>
      subscribe((n) => {
        const pair =
          (n.senderId === friend.id && n.receiverId === meId) || (n.senderId === meId && n.receiverId === friend.id);
        if (!pair) return;
        const m: ChatMsg = {
          id: Number(n.messageId ?? Date.now()),
          from: String(n.senderId),
          to: String(n.receiverId),
          text: String(n.content ?? ""),
          at: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
        };
        setMsgs((prev) =>
          prev.some((p) => p.id === m.id)
            ? prev
            : [...prev.filter((p) => !(p.pending && p.from === m.from && p.text === m.text)), m].slice(-150)
        );
        if (n.senderId === friend.id) {
          markRead(friend.id);
          void fetch("/api/draftmasters/social", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "read", userId: friend.id }),
          }).catch(() => {});
        }
      }),
    [friend.id, markRead, meId, subscribe]
  );

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, loading]);

  // Voice joins on its own once the mic has been allowed before. The first
  // time is a button, because the browser insists on a tap for the prompt.
  const voice = s.voice;
  useEffect(() => {
    if (!voice || voice.withId || s.inGame) return;
    if (leftVoiceWith.has(friend.id) || !rememberedMicGrant()) return;
    voice.join(friend.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.id]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !meId) return;
    setDraft("");
    setError(null);
    const temp: ChatMsg = { id: -Date.now(), from: meId, to: friend.id, text, at: new Date().toISOString(), pending: true };
    setMsgs((prev) => [...prev, temp]);
    const res = await s.act({ action: "say", userId: friend.id, text });
    const saved = (res as { message?: ChatMsg }).message;
    setMsgs((prev) => {
      if (!res.ok) return prev.filter((p) => p.id !== temp.id);
      if (!saved || prev.some((p) => p.id === saved.id)) return prev.filter((p) => p.id !== temp.id);
      return prev.map((p) => (p.id === temp.id ? saved : p));
    });
    if (!res.ok) {
      setError(res.error ?? "Not sent.");
      setDraft(text);
    }
  }, [draft, friend.id, meId, s]);

  const status = friend.inDraft ? "In a draft" : friend.online ? "Online" : "Offline";

  return (
    <div className="dm-fd-view" data-chat="1">
      <header className="dm-fd-head">
        <button type="button" className="dm-fd-back" onClick={() => s.open(null)} aria-label="Back to friends">
          <Icon name="arrow" size={17} />
        </button>
        <span className="dm-fd-face" data-presence={presence(friend)}>
          <PersonAvatar src={friend.avatar} seed={friend.id} />
        </span>
        <div className="dm-fd-title">
          <b>{friend.displayName}</b>
          <em>
            {status} · {recordLine(friend)}
          </em>
        </div>
        <button type="button" className="dm-fd-x" onClick={s.close} aria-label="Close">
          <Icon name="close" size={17} />
        </button>
      </header>

      {voice && <ChatVoiceBar friend={friend} />}

      <div className="dm-fd-log" ref={logRef} aria-live="polite">
        {loading && <p className="dm-fd-empty">Loading…</p>}
        {!loading && !msgs.length && (
          <p className="dm-fd-empty">No messages yet. Say hi — or host a room and invite {friend.displayName} from there.</p>
        )}
        {msgs.map((m) => {
          const mine = m.from === meId;
          const code = parseInvite(m.text);
          if (code) {
            return (
              <div key={m.id} className="dm-invite-card" data-mine={mine ? "1" : "0"}>
                <span className="dm-invite-mark">
                  <Icon name="cards" size={18} />
                </span>
                <span className="dm-invite-who">
                  <b>{mine ? `You invited ${friend.displayName}` : `${friend.displayName} invited you to draft`}</b>
                  <em>
                    Room {code} · {clock(m.at)}
                  </em>
                </span>
                <button type="button" className="dm-btn dm-btn-primary" onClick={() => s.joinRoom(code)}>
                  {mine ? "Open" : "Join"}
                </button>
              </div>
            );
          }
          return (
            <div key={m.id} className="dm-bubble" data-mine={mine ? "1" : "0"} data-pending={m.pending ? "1" : "0"}>
              <span>{m.text}</span>
              <time>{clock(m.at)}</time>
            </div>
          );
        })}
      </div>

      {error && <p className="dm-fd-note" data-bad="1">{error}</p>}

      <form
        className="dm-fd-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          className="dm-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${friend.displayName}`}
          maxLength={500}
          aria-label="Message"
          enterKeyHint="send"
        />
        <button type="submit" className="dm-btn dm-btn-primary dm-fd-send" disabled={!draft.trim()} aria-label="Send">
          <Icon name="arrow" size={18} />
        </button>
      </form>
    </div>
  );
}

function ChatVoiceBar({ friend }: { friend: SocialFriend }) {
  const s = useSocial();
  const v = s.voice!;
  const inThis = v.withId === friend.id;
  const media = v.media;

  if (!inThis) {
    return (
      <div className="dm-cv" data-on="0">
        <button
          type="button"
          className="dm-btn dm-cv-join"
          onClick={() => {
            leftVoiceWith.delete(friend.id);
            v.join(friend.id);
          }}
        >
          <Icon name="mic" size={15} /> {v.withId ? "Switch voice here" : "Join voice"}
        </button>
        <span className="dm-cv-note">
          No calling or answering — you are both in the moment {friend.displayName} opens this chat too.
        </span>
      </div>
    );
  }

  const connected = media.peerStreams.has(friend.id);
  const status =
    media.micState === "asking"
      ? "Allow your mic…"
      : !v.peerHere
        ? `Waiting for ${friend.displayName}`
        : connected
          ? "Connected"
          : "Connecting…";

  return (
    <div className="dm-cv" data-on="1">
      <div className="dm-cv-row">
        <VoicePortrait
          id={s.me?.id ?? ""}
          name={s.me?.displayName ?? "You"}
          avatar={s.me?.avatar ?? null}
          isMe
          media={media}
          size={44}
          onToggleMine={v.announceMute}
        />
        <VoicePortrait
          id={friend.id}
          name={friend.displayName}
          avatar={friend.avatar}
          isMe={false}
          media={media}
          selfMuted={v.peerMuted}
          present={v.peerHere}
          size={44}
        />
        <span className="dm-cv-status" data-live={connected ? "1" : "0"}>
          <i aria-hidden="true" /> {status}
          <small>Tap a face to mute</small>
        </span>
        <button
          type="button"
          className="dm-btn dm-btn-ghost dm-cv-leave"
          onClick={() => {
            leftVoiceWith.add(friend.id);
            v.leave();
          }}
        >
          Leave
        </button>
      </div>
      <div className="dm-cv-row">
        <MicPicker media={media} compact />
      </div>
      <VoiceHint media={media} />
    </div>
  );
}

function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * How much of the screen the on-screen keyboard is covering.
 *
 * A bottom sheet pinned with position: fixed stays where it is when the
 * keyboard opens on iOS and most Android browsers — the keyboard slides over
 * it and the message box disappears under it. The visual viewport knows the
 * real visible area, so the sheet lifts by the difference.
 */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    const first = requestAnimationFrame(update);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(first);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return active ? inset : 0;
}
