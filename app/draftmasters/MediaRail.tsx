"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import type { DraftMedia } from "./useDraftMedia";
import type { ChatLine } from "./types";

/**
 * Voice and camera rail for a PvP room.
 *
 * Mics are on by default — the whole point of drafting against a friend is
 * arguing about the picks. Camera is opt-in behind a button, and uses the
 * front camera on phones.
 */

interface Member {
  userId: string;
  name: string;
  avatarUrl: string | null;
  mic: boolean;
  cam: boolean;
}

interface Props {
  media: DraftMedia;
  members: Member[];
  meId: string;
  chat: ChatLine[];
  onSendChat: (text: string) => void;
}

export default function MediaRail({ media, members, meId, chat, onSendChat }: Props) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  const others = members.filter((m) => m.userId !== meId);

  return (
    <div className="dm-media">
      <div className="dm-tiles">
        <Tile
          stream={media.localStream}
          label="You"
          muted
          showVideo={media.camOn}
          speaking={media.speaking.has(meId)}
          micOn={media.micOn}
          fallback="You"
        />
        {others.map((m) => (
          <Tile
            key={m.userId}
            stream={media.peerStreams.get(m.userId) ?? null}
            label={m.name}
            muted={false}
            showVideo={m.cam}
            speaking={media.speaking.has(m.userId)}
            micOn={m.mic}
            fallback={m.name.charAt(0).toUpperCase()}
          />
        ))}
      </div>

      <div className="dm-media-controls">
        <button
          className="dm-btn dm-btn-icon"
          onClick={media.toggleMic}
          disabled={!media.ready}
          aria-pressed={media.micOn}
          title={media.micOn ? "Mute your mic" : "Unmute your mic"}
        >
          {media.micOn ? <Icon name="mic" size={16} /> : <Icon name="mute" size={16} />}
        </button>
        <button
          className="dm-btn"
          onClick={() => void media.toggleCam()}
          disabled={!media.ready}
          aria-pressed={media.camOn}
          style={{ flex: 1 }}
        >
          <><Icon name="camera" size={16} /> {media.camOn ? "Camera on" : "Turn on camera"}</>
        </button>
      </div>

      {media.error && (
        <p className="dm-note" style={{ marginTop: 8, color: "#f0a6a3" }}>
          {media.error}
        </p>
      )}

      <div className="dm-chat">
        <div className="dm-chat-log" ref={logRef}>
          {chat.length === 0 && <p className="dm-note">Talk trash here, or just use your mic.</p>}
          {chat.map((line, i) => (
            <div key={`${line.at}-${i}`} className="dm-chat-line">
              <strong>{line.userId === meId ? "You" : line.name}</strong> {line.text}
            </div>
          ))}
        </div>
        <form
          className="dm-row"
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (!text) return;
            onSendChat(text);
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
          />
          <button className="dm-btn" type="submit" disabled={!draft.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function Tile({
  stream,
  label,
  muted,
  showVideo,
  speaking,
  micOn,
  fallback,
}: {
  stream: MediaStream | null;
  label: string;
  muted: boolean;
  showVideo: boolean;
  speaking: boolean;
  micOn: boolean;
  fallback: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    // Autoplay can be blocked until the player interacts — they already have,
    // by clicking into the room, but swallow the rejection either way.
    el.play().catch(() => {});
  }, [stream]);

  const hasVideo = Boolean(showVideo && stream && stream.getVideoTracks().length);

  return (
    <div className="dm-tile" data-speaking={speaking ? "1" : "0"}>
      {/* The element stays mounted even when hidden so audio keeps playing. */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        style={{ display: hasVideo ? "block" : "none" }}
      />
      {!hasVideo && (
        <div style={{ fontSize: 26, fontWeight: 800, color: "var(--dm-mute)" }}>{fallback}</div>
      )}
      <span className="dm-tile-name">{label}</span>
      {!micOn && (
        <span className="dm-tile-badge" title="Muted">
          <Icon name="mute" size={16} />
        </span>
      )}
    </div>
  );
}
