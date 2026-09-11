"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PersonAvatar from "../components/PersonAvatar";
import Icon from "./Icon";
import type { DraftMedia } from "./useDraftMedia";

/**
 * The pieces voice is made of on screen, shared by the room and the friends
 * chat so the two cannot drift apart.
 *
 *   PeerAudio      the speakers. Mounted once, above every screen, so a call
 *                  keeps playing while the draft moves from lobby to auction to
 *                  battle — it used to play through the video tiles, which
 *                  unmounted with the screen and took the other player's voice
 *                  with them.
 *   VoicePortrait  a face you tap to mute. Your own mutes your mic; anyone
 *                  else's mutes them for you alone.
 *   MicPicker      which microphone.
 *   VoiceHint      what to do when there is no mic yet.
 */

// ── Speakers ─────────────────────────────────────────────────────────────────

export function PeerAudio({ media }: { media: DraftMedia }) {
  const [blocked, setBlocked] = useState(false);
  const els = useRef(new Map<string, HTMLAudioElement>());

  const unlock = useCallback(() => {
    let failed = false;
    els.current.forEach((el) => {
      el.play().catch(() => {
        failed = true;
      });
    });
    // play() settles asynchronously; give it a beat before deciding.
    setTimeout(() => setBlocked(failed), 250);
  }, []);

  return (
    <>
      {[...media.peerStreams.entries()].map(([peerId, stream]) => (
        <PeerSpeaker
          key={peerId}
          stream={stream}
          muted={media.mutedPeers.has(peerId)}
          onMount={(el) => {
            if (el) els.current.set(peerId, el);
            else els.current.delete(peerId);
          }}
          onBlocked={() => setBlocked(true)}
        />
      ))}
      {/* Autoplay rules: a page that has not been touched may not play sound.
          Capturing the mic usually lifts that, but not everywhere, and a call
          you cannot hear with no explanation is the worst version of this. */}
      {blocked && media.peerStreams.size > 0 && (
        <button type="button" className="dm-voice-unlock" onClick={unlock}>
          <Icon name="sound" size={16} /> Tap to hear voice
        </button>
      )}
    </>
  );
}

function PeerSpeaker({
  stream,
  muted,
  onMount,
  onBlocked,
}: {
  stream: MediaStream;
  muted: boolean;
  onMount: (el: HTMLAudioElement | null) => void;
  onBlocked: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    onMount(el);
    return () => onMount(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().catch(() => onBlocked());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  return <audio ref={ref} autoPlay playsInline muted={muted} className="dm-voice-audio" />;
}

// ── A face you tap ───────────────────────────────────────────────────────────

export function VoicePortrait({
  id,
  name,
  avatar,
  isMe,
  media,
  selfMuted,
  present = true,
  size = 44,
  label,
  onToggleMine,
}: {
  id: string;
  name: string;
  avatar: string | null;
  isMe: boolean;
  media: DraftMedia;
  /** Their own mic is off — told to us by the room. Ignored for yourself; the hook knows. */
  selfMuted?: boolean;
  /** In the call right now. A friend who has not joined voice is shown dimmed. */
  present?: boolean;
  size?: number;
  /** Show the name under the face. */
  label?: boolean;
  /** Your own portrait: called after the mic flips, so the caller can tell the room. */
  onToggleMine?: (micOn: boolean) => void;
}) {
  const live = media.micState === "live";
  const mine = isMe;
  const speaking = media.speaking.has(id) && (mine ? media.micOn : !media.mutedPeers.has(id));
  const mutedSelf = mine ? live && !media.micOn : Boolean(selfMuted);
  const mutedByMe = !mine && media.mutedPeers.has(id);
  const micOff = mine && !live;

  const title = mine
    ? micOff
      ? "Turn on your mic"
      : media.micOn
        ? "Mute your mic"
        : "Unmute your mic"
    : mutedByMe
      ? `Unmute ${name} (just for you)`
      : `Mute ${name} for you`;

  const onClick = async () => {
    if (mine) {
      if (!live) {
        await media.start();
        return;
      }
      const next = media.toggleMic();
      if (next !== null) onToggleMine?.(next);
    } else {
      media.togglePeerMute(id);
    }
  };

  return (
    <button
      type="button"
      className="dm-vp"
      style={{ ["--vp" as string]: `${size}px` }}
      data-speaking={speaking ? "1" : "0"}
      data-muted={mutedSelf ? "self" : mutedByMe ? "you" : micOff ? "off" : "0"}
      data-away={present ? "0" : "1"}
      data-me={mine ? "1" : "0"}
      aria-pressed={mine ? !media.micOn : mutedByMe}
      aria-label={title}
      title={title}
      onClick={() => void onClick()}
    >
      <span className="dm-vp-face">
        <PersonAvatar src={avatar} seed={id} alt="" />
      </span>
      {(mutedSelf || micOff) && (
        <span className="dm-vp-badge" data-kind={micOff ? "off" : "self"} aria-hidden="true">
          <Icon name="micOff" size={11} />
        </span>
      )}
      {mutedByMe && (
        <span className="dm-vp-badge" data-kind="you" aria-hidden="true">
          <Icon name="mute" size={11} />
        </span>
      )}
      {label && <span className="dm-vp-name">{mine ? "You" : name}</span>}
    </button>
  );
}

// ── Which microphone ─────────────────────────────────────────────────────────

export function MicPicker({ media, compact = false }: { media: DraftMedia; compact?: boolean }) {
  // Labels only exist once the mic has been granted; before that the list is
  // just "System default", which is still the right thing to show.
  useEffect(() => {
    void media.refreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.micState]);

  const inUse = media.micState === "live";

  return (
    <label className="dm-mic-pick" data-compact={compact ? "1" : "0"} title="Microphone">
      <Icon name="mic" size={14} />
      <select
        value={media.devices.some((d) => d.deviceId === media.deviceId) ? media.deviceId : ""}
        onChange={(e) => void media.setDevice(e.target.value)}
        onFocus={() => void media.refreshDevices()}
        aria-label="Microphone"
      >
        {media.devices.map((d) => (
          <option key={d.deviceId || "default"} value={d.deviceId}>
            {d.label}
            {d.deviceId === media.deviceId ? (inUse ? " (in use)" : " (selected)") : ""}
          </option>
        ))}
      </select>
      <Icon name="chevron" size={13} />
    </label>
  );
}

// ── No mic yet ───────────────────────────────────────────────────────────────

/**
 * The one line under the portraits when voice is not running.
 *
 * "Turn on voice" is a real button on purpose: the first time, the browser
 * will only show its permission prompt from a tap. After that the grant is
 * remembered and voice starts on its own, so most players never see this.
 */
export function VoiceHint({ media }: { media: DraftMedia }) {
  if (media.micState === "live") return null;
  if (media.micState === "asking") return <p className="dm-voice-hint">Waiting for mic permission…</p>;
  if (media.micState === "denied" || media.micState === "missing" || media.micState === "failed") {
    return (
      <p className="dm-voice-hint" data-bad="1">
        {media.error ?? "Voice is off."} You can still hear everyone and chat.
        {media.micState !== "missing" && (
          <button type="button" className="dm-linkish" onClick={() => void media.start()}>
            Try again
          </button>
        )}
      </p>
    );
  }
  return (
    <p className="dm-voice-hint">
      <button type="button" className="dm-btn dm-btn-primary dm-voice-go" onClick={() => void media.start()}>
        <Icon name="mic" size={15} /> Turn on voice
      </button>
      <span>Asked once — after that voice joins on its own.</span>
    </p>
  );
}
