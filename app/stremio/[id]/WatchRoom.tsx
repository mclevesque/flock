"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface Member {
  user_id: string;
  username: string;
  avatar_url: string | null;
  last_seen: number;
}

interface RoomState {
  id: string;
  name: string;
  host_id: string;
  is_screen_sharing?: boolean;
  invite_only?: boolean;
}

interface Props {
  roomId: string;
  sessionUserId: string | null;
  sessionUsername: string | null;
  sessionAvatar: string | null;
}

const ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  // TURN servers — required for mobile and strict NAT networks
  { urls: "turn:openrelay.metered.ca:80",               username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443",              username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

export default function WatchRoom({ roomId, sessionUserId, sessionUsername }: Props) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Screen share state
  const [isSharing, setIsSharing] = useState(false);       // I am the host sharing
  const [screenActive, setScreenActive] = useState(false); // A share is in progress (host or viewer)
  const [shareError, setShareError] = useState("");
  const [videoReady, setVideoReady] = useState(false);     // ontrack fired + video playing
  const [audioMuted, setAudioMuted] = useState(true);      // viewer is muted (needs tap)

  // UI state
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<{ user: string; msg: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [theaterMode, setTheaterMode] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [inviteOnly, setInviteOnly] = useState(false);
  const [togglingInvite, setTogglingInvite] = useState(false);

  // Refs
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const screenSignalIdRef = useRef(0);
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const isSharingRef = useRef(false);
  const screenPollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const hasRequestedRef = useRef(false);
  const membersRef = useRef<Member[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const videoReadyRef = useRef(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── WebRTC helpers ─────────────────────────────────────────────────────

  async function postSignal(toUser: string, type: string, payload: unknown) {
    await fetch(`/api/watch-room/${roomId}/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUser, type, payload }),
    }).catch(() => {});
  }

  function createPeer(peerId: string): RTCPeerConnection {
    // Always close + recreate so retries work
    screenPeersRef.current.get(peerId)?.close();
    const pc = new RTCPeerConnection({ iceServers: ICE });
    screenPeersRef.current.set(peerId, pc);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) postSignal(peerId, "screen-ice", candidate.toJSON());
    };

    // Viewer receives track from host
    pc.ontrack = (e) => {
      const vid = screenVideoRef.current;
      if (!vid || !e.streams[0]) return;
      vid.srcObject = e.streams[0];
      vid.muted = true;
      vid.playsInline = true;
      setScreenActive(true);

      // On mobile: show tap-to-play overlay — do NOT call play() here at all.
      // Any play() without a fresh user gesture on Android Chrome results in a black video.
      // The tap-to-play overlay's onClick calls play() with a real user gesture.
      // On desktop: auto-play muted immediately, fall back to overlay if blocked.
      const mobile = window.innerWidth < 768;
      if (mobile) {
        setVideoReady(false);
        setAudioMuted(true);
        // Do nothing — wait for user tap
      } else {
        setTimeout(() => {
          vid.muted = true;
          vid.play()
            .then(() => { setVideoReady(true); setAudioMuted(true); })
            .catch(() => { setVideoReady(false); setAudioMuted(true); });
        }, 50);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        // Auto-retry: viewer re-requests the stream
        if (!isSharingRef.current && hasRequestedRef.current) {
          screenPeersRef.current.delete(peerId);
          setTimeout(() => {
            if (!isSharingRef.current) {
              postSignal(peerId, "screen-want", {});
            }
          }, 2000);
        }
      }
    };

    return pc;
  }

  async function sendOfferTo(viewerId: string) {
    const stream = screenStreamRef.current;
    if (!stream) return;
    const pc = createPeer(viewerId); // always fresh peer
    for (const track of stream.getTracks()) pc.addTrack(track, stream);

    // Force H.264 codec preference — iOS Safari hardware-decodes H.264 but VP9
    // is unreliable. Chrome desktop defaults to VP9 for window capture specifically,
    // which breaks on iPhone. Prefer H.264 so all surface types work on iOS.
    try {
      const videoCapabilities = RTCRtpSender.getCapabilities?.("video");
      if (videoCapabilities) {
        const h264 = videoCapabilities.codecs.filter(c => c.mimeType.toLowerCase() === "video/h264");
        const rest  = videoCapabilities.codecs.filter(c => c.mimeType.toLowerCase() !== "video/h264");
        for (const tc of pc.getTransceivers()) {
          if (tc.sender.track?.kind === "video") {
            tc.setCodecPreferences([...h264, ...rest]);
          }
        }
      }
    } catch { /* unsupported browser — ignore */ }

    // Bitrate + framerate (keep 16 Mbps for desktop quality, but cap fps for iOS)
    pc.onnegotiationneeded = async () => {
      try {
        for (const sender of pc.getSenders()) {
          if (sender.track?.kind === "video") {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
            params.encodings[0].maxBitrate = 8_000_000; // 8 Mbps — H.264 at this bitrate looks great
            params.encodings[0].maxFramerate = 30;
            await sender.setParameters(params).catch(() => {});
          }
        }
      } catch { /* ignore */ }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await postSignal(viewerId, "screen-offer", offer);
  }

  // ── Start / Stop share ─────────────────────────────────────────────────

  async function startScreenShare() {
    if (!sessionUserId) return;
    setShareError("");
    try {
      const stream = await (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia: (c: object) => Promise<MediaStream>;
      }).getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2,
        },
      });

      // Maximize video bitrate by bumping the sender's encoding params
      // This runs after tracks are added to peer connections below

      screenStreamRef.current = stream;
      isSharingRef.current = true;
      setIsSharing(true);
      setScreenActive(true);
      setVideoReady(true);
      setAudioMuted(false);

      // Local preview — muted so host doesn't hear echo
      const vid = screenVideoRef.current;
      if (vid) {
        vid.srcObject = stream;
        vid.muted = true;
        vid.play().catch(() => {});
      }

      // Mark room as sharing in DB
      await fetch(`/api/watch-room/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "screen-share-start" }),
      });

      // Offer to all current members
      for (const m of membersRef.current) {
        if (m.user_id !== sessionUserId) await sendOfferTo(m.user_id);
      }

      // If browser stop-sharing button is clicked
      stream.getVideoTracks()[0]?.addEventListener("ended", stopScreenShare);

      startPoll();
    } catch (e: unknown) {
      const err = e as Error;
      if (err?.name !== "NotAllowedError") {
        setShareError("Couldn't start screen share. Check browser permissions and try again.");
        setTimeout(() => setShareError(""), 5000);
      }
    }
  }

  async function stopScreenShare() {
    if (!isSharingRef.current) return;
    isSharingRef.current = false;
    setIsSharing(false);
    setScreenActive(false);
    setVideoReady(false);
    setAudioMuted(true);

    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    screenPeersRef.current.forEach(pc => pc.close());
    screenPeersRef.current.clear();

    const vid = screenVideoRef.current;
    if (vid) vid.srcObject = null;

    stopPoll();

    await fetch(`/api/watch-room/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "screen-share-stop" }),
    }).catch(() => {});
  }

  // ── Signal polling ────────────────────────────────────────────────────

  function startPoll() {
    if (screenPollRef.current) return;
    screenPollRef.current = setInterval(processSignals, 1500); // fast poll for reliability
  }
  function stopPoll() {
    clearInterval(screenPollRef.current);
    screenPollRef.current = undefined;
  }

  const processSignals = useCallback(async () => {
    try {
      const res = await fetch(`/api/watch-room/${roomId}/signals?after=${screenSignalIdRef.current}`);
      if (!res.ok) return;
      const { signals } = await res.json();

      for (const sig of signals as {
        id: number; from_user: string; type: string; payload: Record<string, unknown>;
      }[]) {
        if (sig.id > screenSignalIdRef.current) screenSignalIdRef.current = sig.id;

        if (sig.type === "screen-want") {
          // A viewer wants my stream
          if (isSharingRef.current && screenStreamRef.current) {
            await sendOfferTo(sig.from_user);
          }

        } else if (sig.type === "screen-offer") {
          // I'm a viewer receiving the host's offer
          const pc = createPeer(sig.from_user);
          await pc.setRemoteDescription(
            new RTCSessionDescription(sig.payload as unknown as RTCSessionDescriptionInit)
          );
          // Apply any buffered ICE candidates
          const buffered = pendingIceRef.current.get(sig.from_user) ?? [];
          for (const c of buffered) await pc.addIceCandidate(c).catch(() => {});
          pendingIceRef.current.delete(sig.from_user);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await postSignal(sig.from_user, "screen-answer", answer);

        } else if (sig.type === "screen-answer") {
          // I'm the host receiving a viewer's answer
          const pc = screenPeersRef.current.get(sig.from_user);
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(
              new RTCSessionDescription(sig.payload as unknown as RTCSessionDescriptionInit)
            );
            const buffered = pendingIceRef.current.get(sig.from_user) ?? [];
            for (const c of buffered) await pc.addIceCandidate(c).catch(() => {});
            pendingIceRef.current.delete(sig.from_user);
          }

        } else if (sig.type === "screen-ice") {
          const pc = screenPeersRef.current.get(sig.from_user);
          if (pc) {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(
                new RTCIceCandidate(sig.payload as RTCIceCandidateInit)
              ).catch(() => {});
            } else {
              const buf = pendingIceRef.current.get(sig.from_user) ?? [];
              buf.push(sig.payload as RTCIceCandidateInit);
              pendingIceRef.current.set(sig.from_user, buf);
            }
          }

        } else if (sig.type === "screen-stop") {
          // Host stopped sharing
          setScreenActive(false);
          setVideoReady(false);
          setAudioMuted(true);
          hasRequestedRef.current = false;
          stopPoll();
          const vid = screenVideoRef.current;
          if (vid) vid.srcObject = null;
          screenPeersRef.current.forEach(pc => pc.close());
          screenPeersRef.current.clear();
        }
      }

      // Auto-offer any new member who joined while we're sharing
      if (isSharingRef.current && screenStreamRef.current) {
        for (const m of membersRef.current) {
          if (m.user_id !== sessionUserId && !screenPeersRef.current.has(m.user_id)) {
            await sendOfferTo(m.user_id);
          }
        }
      }
    } catch { /* network error, retry next tick */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, sessionUserId]);

  // ── Room poll ──────────────────────────────────────────────────────────

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/watch-room/${roomId}`, { cache: "no-store" });
      if (!res.ok) return;
      const { room: r, members: m } = await res.json();
      setRoom(r);
      if (r?.invite_only !== undefined) setInviteOnly(!!r.invite_only);
      const memberList: Member[] = m ?? [];
      setMembers(memberList);
      membersRef.current = memberList;
      setLoading(false);
      if (!r) return;

      // Viewer: request stream when host starts sharing
      if (r.is_screen_sharing && r.host_id !== sessionUserId && !hasRequestedRef.current) {
        hasRequestedRef.current = true;
        setScreenActive(true);
        await postSignal(r.host_id, "screen-want", {});
        startPoll();

        // Stuck-viewer guard: if no video arrives in 10s, re-send screen-want
        clearTimeout(stuckTimerRef.current);
        stuckTimerRef.current = setTimeout(() => {
          if (hasRequestedRef.current && !videoReadyRef.current && !isSharingRef.current) {
            postSignal(r.host_id, "screen-want", {});
          }
        }, 10000);
      }

      // Host stopped sharing externally (e.g. page close)
      if (!r.is_screen_sharing && !isSharingRef.current) {
        setScreenActive(prev => {
          if (prev) {
            hasRequestedRef.current = false;
            const vid = screenVideoRef.current;
            if (vid) vid.srcObject = null;
            setVideoReady(false);
            setAudioMuted(true);
          }
          return false;
        });
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, sessionUserId]);

  useEffect(() => {
    if (sessionUserId) {
      fetch(`/api/watch-room/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      }).catch(() => {});
    }
    fetchRoom();
    pollRef.current = setInterval(fetchRoom, 4000);
    return () => {
      clearInterval(pollRef.current);
      clearTimeout(stuckTimerRef.current);
      stopPoll();
      if (isSharingRef.current) {
        isSharingRef.current = false;
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenPeersRef.current.forEach(pc => pc.close());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRoom, roomId, sessionUserId]);

  // Keep videoReadyRef in sync for use inside timeouts/callbacks
  useEffect(() => {
    videoReadyRef.current = videoReady;
    if (videoReady) {
      // Video is playing — cancel stuck timer
      clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = undefined;
    }
  }, [videoReady]);

  // ── UI helpers ──────────────────────────────────────────────────────────

  function handleTapVideo(e?: React.MouseEvent | React.TouchEvent) {
    // Block native browser behavior (stops Android Chrome from showing search/lens)
    e?.stopPropagation();
    (e as React.MouseEvent)?.preventDefault?.();

    const vid = screenVideoRef.current;
    if (!vid) return;

    if (!videoReady) {
      // Check if stream is dead — re-request if so
      const stream = vid.srcObject as MediaStream | null;
      const streamDead = !stream || !stream.active ||
        stream.getVideoTracks().every(t => t.readyState === "ended");
      if (streamDead && room?.is_screen_sharing && room.host_id !== sessionUserId) {
        hasRequestedRef.current = true;
        postSignal(room.host_id, "screen-want", {});
        if (!screenPollRef.current) startPoll();
        return;
      }
      // Call play() DIRECTLY within the user-gesture context.
      // Do NOT null/reassign srcObject — that breaks the gesture chain on Android Chrome
      // and causes the tap to fall through to the browser (which opens Google search).
      vid.muted = true;
      vid.playsInline = true;
      vid.play()
        .then(() => { setVideoReady(true); setAudioMuted(true); })
        .catch(() => {
          // play() rejected — still within gesture context, try once more
          vid.play()
            .then(() => { setVideoReady(true); setAudioMuted(true); })
            .catch(() => { setVideoReady(false); });
        });
    } else if (audioMuted) {
      // Second tap: unmute
      vid.muted = false;
      vid.volume = 1;
      vid.play().catch(() => {});
      setAudioMuted(false);
    }
  }

  async function enterFullscreen() {
    const vid = screenVideoRef.current;
    if (!vid || !videoReady) return;
    try {
      // Use document fullscreen (most reliable on Android Chrome).
      // webkitEnterFullscreen is iOS-only and shows grey on Android.
      await document.documentElement.requestFullscreen();
      // Re-play after entering fullscreen — Android Chrome can drop the frame
      setTimeout(() => { vid.play().catch(() => {}); }, 150);
    } catch {
      // Fallback: try fullscreen on the video element directly
      try {
        await vid.requestFullscreen();
        setTimeout(() => { vid.play().catch(() => {}); }, 150);
      } catch {
        const ea = (window as unknown as { electronAPI?: { setFullScreen: (v: boolean) => void } }).electronAPI;
        if (ea) ea.setFullScreen(true);
      }
    }
  }

  function showControls() {
    setControlsVisible(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }

  function copyRoomLink() {
    navigator.clipboard.writeText(`${window.location.origin}/stremio/${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function toggleInviteOnly() {
    if (!isHost || togglingInvite) return;
    const newVal = !inviteOnly;
    setTogglingInvite(true);
    setInviteOnly(newVal);
    await fetch(`/api/watch-room/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-invite-only", inviteOnly: newVal }),
    }).catch(() => {});
    setTogglingInvite(false);
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !sessionUsername) return;
    setChatLog(l => [...l.slice(-99), { user: sessionUsername, msg: chatInput.trim() }]);
    setChatInput("");
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0f14", color: "#e8eaf6", fontSize: 18 }}>
      Loading room…
    </div>
  );
  if (!room) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0f14", color: "#e8eaf6" }}>
      Room not found.
    </div>
  );

  const isHost = room.host_id === sessionUserId;
  const hostName = members.find(m => m.user_id === room.host_id)?.username ?? "Host";
  // Show overlay for viewers AND for host if their preview isn't playing
  const showUnmuteOverlay = screenActive && (audioMuted || !videoReady);

  // ── Video block ──────────────────────────────────────────────────────────

  const videoBlock = (
    <div style={{
      background: "#000",
      position: "relative",
      // Mobile: fixed 16:9 aspect ratio box. Desktop: fill all available height.
      ...(isMobile
        ? { width: "100%", paddingBottom: "56.25%" }
        : { flex: 1, minHeight: 0, alignSelf: "stretch" }),
    }}>

      {/* LIVE badge */}
      {screenActive && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10, display: "flex", gap: 8, alignItems: "center", pointerEvents: "none" }}>
          <div style={{ background: "rgba(220,38,38,0.9)", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "inline-block", animation: "pulse 1s infinite" }} />
            LIVE
          </div>
          <div style={{ background: "rgba(0,0,0,0.7)", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#94a3b8" }}>
            {isSharing ? "You are sharing" : `${hostName}'s screen`}
          </div>
        </div>
      )}

      {/* Waiting / idle state */}
      {!screenActive && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
          {isHost ? (
            <>
              <div style={{ fontSize: 60, opacity: 0.13 }}>🎬</div>
              <div style={{ color: "#4b5563", fontSize: 17, fontWeight: 800 }}>Ready to Stream</div>
              <div style={{ color: "#374151", fontSize: 13, textAlign: "center" as const, maxWidth: 320, lineHeight: 1.75 }}>
                Hit <strong style={{ color: "#0ea5e9" }}>🎬 Go Live</strong> above to start streaming.<br />
                Pick any window, app, or your whole screen — audio included.<br />
                <span style={{ color: "#6b7280", fontSize: 11 }}>⚡ 16 Mbps · 60fps · 48kHz audio · direct P2P</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 60, opacity: 0.13 }}>📡</div>
              <div style={{ color: "#4b5563", fontSize: 17, fontWeight: 800 }}>Waiting for host to go live…</div>
              <div style={{ color: "#374151", fontSize: 13 }}>Stream will appear instantly when they start sharing.</div>
            </>
          )}
        </div>
      )}

      {/* Tap-to-play / tap-to-unmute overlay for viewers */}
      {showUnmuteOverlay && (
        <div
          onClick={handleTapVideo}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleTapVideo(e); }}
          style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            zIndex: 8, cursor: "pointer", touchAction: "manipulation",
            background: "rgba(0,0,0,0.55)",
          }}
        >
          <div style={{
            background: "rgba(13,15,20,0.92)", borderRadius: 18, padding: "24px 36px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            border: "1px solid rgba(124,58,237,0.4)",
            boxShadow: "0 0 40px rgba(124,58,237,0.15)",
          }}>
            <div style={{ fontSize: 44 }}>{!videoReady ? "▶" : "🔇"}</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
              {!videoReady ? (isSharing ? "Tap to preview your stream" : "Tap to play") : "Tap to unmute"}
            </div>
            <div style={{ color: "#6b7280", fontSize: 12, textAlign: "center" }}>
              {!videoReady
                ? (isSharing ? "See your own stream — muted so there's no echo" : "Tap anywhere to start video")
                : "Audio muted — tap to hear"}
            </div>
          </div>
        </div>
      )}

      {/* The actual video — pointer-events: none so taps always go to the overlay above */}
      <video
        ref={screenVideoRef}
        autoPlay
        playsInline
        muted
        onMouseMove={screenActive ? showControls : undefined}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "contain", background: "#000",
          display: screenActive ? "block" : "none",
          cursor: controlsVisible ? "default" : "none",
          pointerEvents: "none", // never receive taps — overlay handles all interaction
        }}
      />

      {/* Floating controls bar — auto-hides after 3s on desktop, always on mobile */}
      {screenActive && (controlsVisible || isMobile) && (
        <div
          onClick={showControls}
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 9,
            background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
            padding: "32px 14px 12px",
            display: "flex", alignItems: "center", gap: 8,
            transition: "opacity 0.3s",
            pointerEvents: "auto",
          }}
        >
          {/* Unmute button (viewer) */}
          {!isSharing && audioMuted && videoReady && (
            <button
              onClick={(e) => { e.stopPropagation(); handleTapVideo(e); }}
              style={{
                background: "rgba(239,68,68,0.85)", border: "none", borderRadius: 8,
                padding: "6px 14px", color: "#fff", fontSize: 12, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                touchAction: "manipulation",
              }}
            >
              🔇 Unmute
            </button>
          )}
          <div style={{ flex: 1 }} />
          {/* Theater mode toggle — desktop only */}
          {!isMobile && (
            <button
              onClick={() => setTheaterMode(m => !m)}
              title={theaterMode ? "Exit theater mode" : "Theater mode"}
              style={{
                background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8, padding: "6px 10px", color: "#e8eaf6",
                cursor: "pointer", fontSize: 14,
              }}
            >{theaterMode ? "⊡" : "⊟"}</button>
          )}
          {/* Fullscreen button */}
          <button
            onClick={(e) => { e.stopPropagation(); enterFullscreen(); }}
            disabled={!videoReady}
            title={videoReady ? "Fullscreen" : "Waiting for video…"}
            style={{
              background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8, padding: "6px 10px",
              color: videoReady ? "#e8eaf6" : "#4b5563",
              cursor: videoReady ? "pointer" : "not-allowed",
              fontSize: 16, opacity: videoReady ? 1 : 0.4,
              touchAction: "manipulation",
            }}
          >⛶</button>
        </div>
      )}
    </div>
  );

  // ── Sidebar ──────────────────────────────────────────────────────────────

  const sidebarContent = (
    <>
      <div style={{ padding: 14, borderBottom: "1px solid #1e2130" }}>
        <div style={{ fontSize: 11, color: "#8890a4", fontWeight: 700, marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: 1 }}>
          👥 Watching ({members.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
          {members.map(m => (
            <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative" as const }}>
                <img
                  src={m.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${m.username}`}
                  alt={m.username}
                  style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #2a2d3a" }}
                />
                {m.user_id === room.host_id && (
                  <span style={{ position: "absolute" as const, bottom: -2, right: -2, background: "#7c3aed", borderRadius: "50%", width: 10, height: 10, display: "block" }} />
                )}
              </div>
              <span style={{ fontSize: 12, color: m.user_id === sessionUserId ? "#a78bfa" : "#e8eaf6", fontWeight: 600 }}>
                @{m.username}
                {m.user_id === sessionUserId ? " (you)" : ""}
                {m.user_id === room.host_id ? " 👑" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e2130" }}>
        {screenActive ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", flexShrink: 0, animation: "pulse 1s infinite" }} />
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {isSharing ? "You're sharing" : "Watching live"}
            </div>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#4b5563" }}>P2P • private</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#374151", flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: "#4b5563" }}>No active share</div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: "auto" as const, padding: 10, minHeight: 60 }}>
          {chatLog.length === 0
            ? <div style={{ color: "#374151", fontSize: 12, textAlign: "center" as const, marginTop: 16 }}>Chat with your watch party 💬</div>
            : chatLog.slice(-50).map((c, i) => (
              <div key={i} style={{ marginBottom: 5 }}>
                <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>@{c.user}: </span>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>{c.msg}</span>
              </div>
            ))
          }
        </div>
        {sessionUserId ? (
          <form onSubmit={sendChat} style={{ display: "flex", borderTop: "1px solid #1e2130" }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Chat…"
              maxLength={200}
              style={{ flex: 1, background: "transparent", border: "none", padding: "10px 12px", color: "#e8eaf6", fontSize: 12, outline: "none", fontFamily: "inherit" }}
            />
            <button type="submit" style={{ background: "none", border: "none", padding: "0 12px", color: "#8890a4", cursor: "pointer", fontSize: 16 }}>→</button>
          </form>
        ) : (
          <div style={{ padding: 12, fontSize: 12, color: "#4b5563", textAlign: "center" as const }}>Sign in to chat</div>
        )}
      </div>

      <div style={{ padding: 10, borderTop: "1px solid #1e2130", background: "rgba(124,58,237,0.04)" }}>
        <div style={{ fontSize: 10, color: "#4b5563", lineHeight: 1.7 }}>
          💡 Screen share is <b style={{ color: "#6b7280" }}>P2P</b> — goes directly from host to viewers, no server relay. Works with any app, tab, or game.
        </div>
      </div>
    </>
  );

  // ── Share button ──────────────────────────────────────────────────────────

  const shareButton = isHost ? (
    isSharing ? (
      <button
        onClick={stopScreenShare}
        style={{
          background: "rgba(220,38,38,0.15)", border: "1px solid #ef4444",
          borderRadius: 8, padding: isMobile ? "5px 10px" : "6px 14px",
          color: "#ef4444", fontSize: isMobile ? 11 : 12, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          whiteSpace: "nowrap" as const,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "pulse 1s infinite" }} />
        {isMobile ? "Stop" : "⏹ End Stream"}
      </button>
    ) : (
      <button
        onClick={startScreenShare}
        style={{
          background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
          border: "none", borderRadius: 8,
          padding: isMobile ? "5px 10px" : "6px 14px",
          color: "#fff", fontSize: isMobile ? 11 : 12, fontWeight: 700,
          cursor: "pointer", whiteSpace: "nowrap" as const,
        }}
      >
        {isMobile ? "🎬 Live" : "🎬 Go Live"}
      </button>
    )
  ) : screenActive ? (
    <div style={{
      background: "rgba(220,38,38,0.15)", border: "1px solid #ef4444",
      borderRadius: 8, padding: isMobile ? "5px 10px" : "6px 14px",
      fontSize: isMobile ? 11 : 12, fontWeight: 700, color: "#ef4444",
      display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" as const,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "pulse 1s infinite" }} />
      {isMobile ? "Live" : "🔴 Live"}
    </div>
  ) : null;

  // ── MOBILE LAYOUT ────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{ minHeight: "100svh", background: "#0d0f14", display: "flex", flexDirection: "column", fontFamily: "inherit" }}>
        {/* Header — kept minimal on mobile to avoid crowding */}
        <div style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", borderBottom: "1px solid #1e2130", padding: "8px 10px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ color: "#e8eaf6", fontWeight: 800, fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            📺 {room.name}
          </span>
          {shareButton}
          <button
            onClick={copyRoomLink}
            style={{ background: copied ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${copied ? "#4ade80" : "#2a2d3a"}`, borderRadius: 7, padding: "5px 8px", color: copied ? "#4ade80" : "#8890a4", fontSize: 11, cursor: "pointer", fontWeight: 700, flexShrink: 0 }}
          >
            {copied ? "✓" : "🔗"}
          </button>
          {/* Chat toggle — in header so it's never covered by bottom widgets */}
          <button
            onClick={() => setPanelOpen(v => !v)}
            style={{ background: panelOpen ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${panelOpen ? "#7c3aed" : "#2a2d3a"}`, borderRadius: 7, padding: "5px 8px", color: panelOpen ? "#a78bfa" : "#8890a4", fontSize: 11, cursor: "pointer", fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}
          >
            💬 <span style={{ fontSize: 10 }}>{members.length}</span>
            {screenActive && <span style={{ color: "#ef4444", fontSize: 9, marginLeft: 2 }}>●</span>}
          </button>
        </div>

        {shareError && (
          <div style={{ background: "rgba(239,68,68,0.15)", borderBottom: "1px solid #ef4444", padding: "8px 14px", fontSize: 12, color: "#f87171", flexShrink: 0 }}>
            {shareError}
          </div>
        )}

        {videoBlock}

        {/* Collapsible chat/members — slides up when open */}
        {panelOpen && (
          <div style={{ maxHeight: "40vh", display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto", borderTop: "1px solid #1e2130", background: "rgba(0,0,0,0.6)" }}>
            {sidebarContent}
          </div>
        )}

        <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }`}</style>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ───────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", display: "flex", flexDirection: "column", fontFamily: "inherit" }}>
      {/* Header */}
      <div style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", borderBottom: "1px solid #1e2130", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 20 }}>📺</span>
          <span style={{ color: "#e8eaf6", fontWeight: 800, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {room.name}
          </span>
          <span style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {members.length} watching
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {shareButton}
          {/* Invite-only toggle (host only) */}
          {isHost && (
            <button
              onClick={toggleInviteOnly}
              disabled={togglingInvite}
              title={inviteOnly ? "Room is invite-only — click to make public" : "Room is public — click to make invite-only"}
              style={{
                background: inviteOnly ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
                border: `1px solid ${inviteOnly ? "rgba(239,68,68,0.4)" : "#2a2d3a"}`,
                borderRadius: 8, padding: "6px 12px",
                color: inviteOnly ? "#f87171" : "#8890a4",
                fontSize: 12, cursor: "pointer", fontWeight: 700,
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              {inviteOnly ? "🔒 Invite Only" : "🌐 Public"}
            </button>
          )}
          {!isHost && inviteOnly && (
            <span style={{ fontSize: 11, color: "#f87171", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "3px 8px" }}>🔒 Invite Only</span>
          )}
          <button
            onClick={copyRoomLink}
            style={{ background: copied ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.08)", border: `1px solid ${copied ? "#4ade80" : "#2a2d3a"}`, borderRadius: 8, padding: "6px 14px", color: copied ? "#4ade80" : "#8890a4", fontSize: 12, cursor: "pointer", fontWeight: 700 }}
          >
            {copied ? "✓ Copied!" : "🔗 Invite"}
          </button>
        </div>
      </div>

      {shareError && (
        <div style={{ background: "rgba(239,68,68,0.1)", borderBottom: "1px solid #ef4444", padding: "8px 20px", fontSize: 13, color: "#f87171" }}>
          {shareError}
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
        {/* Video area — fills all remaining height */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          {videoBlock}
        </div>
        {/* Sidebar — hidden in theater mode */}
        {!theaterMode && (
          <div style={{ width: 260, background: "rgba(0,0,0,0.5)", borderLeft: "1px solid #1e2130", display: "flex", flexDirection: "column", minHeight: 0 }}>
            {sidebarContent}
          </div>
        )}
        {/* Theater mode: floating chat bubble button */}
        {theaterMode && (
          <button
            onClick={() => setTheaterMode(false)}
            title="Exit theater mode"
            style={{
              position: "absolute", top: 10, right: 10, zIndex: 20,
              background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8, padding: "6px 12px", color: "#8890a4",
              cursor: "pointer", fontSize: 12, fontWeight: 700,
            }}
          >⊡ Exit Theater</button>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }`}</style>
    </div>
  );
}
