"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared mic / camera for a DraftMasters room.
 *
 * Signalling piggybacks on the room's existing PartySocket (same `rtc-signal`
 * wire format as party/voice.ts) rather than opening a second connection —
 * one socket, one source of truth about who's in the room.
 *
 * Uses the perfect-negotiation pattern: the peer with the lower userId is
 * "polite" and rolls back on collision, so two people joining simultaneously
 * never deadlock on glare.
 */

const FALLBACK_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

let cachedIce: RTCIceServer[] | null = null;

async function getIceServers(): Promise<RTCIceServer[]> {
  if (cachedIce) return cachedIce;
  try {
    const res = await fetch("/api/ice-servers");
    const data = await res.json();
    if (Array.isArray(data.iceServers) && data.iceServers.length) {
      cachedIce = data.iceServers as RTCIceServer[];
      return cachedIce;
    }
  } catch {
    /* STUN-only fallback below */
  }
  cachedIce = FALLBACK_ICE;
  return cachedIce;
}

interface Peer {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;
}

export interface DraftMedia {
  localStream: MediaStream | null;
  peerStreams: Map<string, MediaStream>;
  speaking: Set<string>;
  micOn: boolean;
  camOn: boolean;
  ready: boolean;
  error: string | null;
  start: (opts: { mic: boolean; cam: boolean }) => Promise<void>;
  toggleMic: () => void;
  toggleCam: () => Promise<void>;
  connectTo: (peerId: string) => Promise<void>;
  dropPeer: (peerId: string) => void;
  handleSignal: (msg: RtcSignal) => Promise<void>;
  teardown: () => void;
}

export interface RtcSignal {
  fromUserId: string;
  signalType: "offer" | "answer" | "ice";
  payload: Record<string, unknown>;
}

export function useDraftMedia(
  userId: string,
  sendSignal: (toUserId: string, signalType: string, payload: unknown) => void
): DraftMedia {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerStreams, setPeerStreams] = useState<Map<string, MediaStream>>(new Map());
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peersRef = useRef(new Map<string, Peer>());
  const localRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const sendRef = useRef(sendSignal);
  sendRef.current = sendSignal;

  // ── Local capture ──────────────────────────────────────────────────────────

  const start = useCallback(async ({ mic, cam }: { mic: boolean; cam: boolean }) => {
    if (localRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: mic ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
        // Front camera on phones, and a modest resolution so two tiles stay smooth.
        video: cam ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
      });
      localRef.current = stream;
      setLocalStream(stream);
      setMicOn(mic);
      setCamOn(cam);
      setReady(true);
      setError(null);
      watchSpeaking(stream, userId, setSpeaking);
    } catch (err) {
      const name = (err as DOMException)?.name;
      setError(
        name === "NotAllowedError"
          ? "Mic blocked — allow access in your browser to talk."
          : name === "NotFoundError"
            ? "No microphone found."
            : "Couldn't start your mic."
      );
      setReady(false);
    }
  }, [userId]);

  const toggleMic = useCallback(() => {
    const stream = localRef.current;
    if (!stream) return;
    const tracks = stream.getAudioTracks();
    if (!tracks.length) return;
    const next = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, []);

  /** Camera is added on demand — the room starts audio-only. */
  const toggleCam = useCallback(async () => {
    const stream = localRef.current;
    if (!stream) return;

    const existing = stream.getVideoTracks();
    if (existing.length) {
      const next = !existing[0].enabled;
      existing.forEach((t) => (t.enabled = next));
      setCamOn(next);
      return;
    }

    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const track = camStream.getVideoTracks()[0];
      if (!track) return;
      stream.addTrack(track);
      // Renegotiation fires onnegotiationneeded on each pc and re-offers.
      peersRef.current.forEach((peer) => peer.pc.addTrack(track, stream));
      setCamOn(true);
      setLocalStream(new MediaStream(stream.getTracks()));
    } catch {
      setError("Couldn't start your camera.");
    }
  }, []);

  // ── Peer connections ───────────────────────────────────────────────────────

  const ensurePeer = useCallback(
    async (peerId: string): Promise<Peer> => {
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;

      const iceServers = await getIceServers();
      const hasTurn = iceServers.some((s) =>
        (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => u.startsWith("turn:"))
      );
      const pc = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: hasTurn ? "relay" : "all",
      });

      const peer: Peer = {
        pc,
        stream: null,
        makingOffer: false,
        ignoreOffer: false,
        // Lower id is polite — deterministic on both ends, no coin flip needed.
        polite: userId < peerId,
      };
      peersRef.current.set(peerId, peer);

      pc.onicecandidate = (e) => {
        if (e.candidate) sendRef.current(peerId, "ice", e.candidate.toJSON());
      };

      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (!stream) return;
        peer.stream = stream;
        setPeerStreams((prev) => new Map(prev).set(peerId, stream));
        if (e.track.kind === "audio") watchSpeaking(stream, peerId, setSpeaking);
      };

      pc.onnegotiationneeded = async () => {
        try {
          peer.makingOffer = true;
          await pc.setLocalDescription();
          if (pc.localDescription) {
            sendRef.current(peerId, "offer", {
              sdp: pc.localDescription.sdp,
              type: pc.localDescription.type,
            });
          }
        } catch {
          /* renegotiation races are recovered by the next offer */
        } finally {
          peer.makingOffer = false;
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          dropPeerInternal(peerId);
        }
      };

      const local = localRef.current;
      if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));

      return peer;
    },
    [userId]
  );

  const dropPeerInternal = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      try {
        peer.pc.close();
      } catch {
        /* already closed */
      }
    }
    peersRef.current.delete(peerId);
    pendingIce.current.delete(peerId);
    setPeerStreams((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
    setSpeaking((prev) => {
      const next = new Set(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  /** Called for the peer we should offer to (the one with the higher id offers). */
  const connectTo = useCallback(
    async (peerId: string) => {
      if (peerId === userId) return;
      await ensurePeer(peerId);
      // onnegotiationneeded fires from addTrack and drives the offer.
    },
    [ensurePeer, userId]
  );

  const handleSignal = useCallback(
    async (msg: RtcSignal) => {
      const { fromUserId, signalType, payload } = msg;
      if (!fromUserId || fromUserId === userId) return;
      const peer = await ensurePeer(fromUserId);
      const { pc } = peer;

      try {
        if (signalType === "offer" || signalType === "answer") {
          const description = payload as unknown as RTCSessionDescriptionInit;
          const offerCollision =
            description.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");

          peer.ignoreOffer = !peer.polite && offerCollision;
          if (peer.ignoreOffer) return;

          if (offerCollision) await pc.setRemoteDescription({ type: "rollback" });
          await pc.setRemoteDescription(description);

          const buffered = pendingIce.current.get(fromUserId) ?? [];
          for (const c of buffered) await pc.addIceCandidate(c).catch(() => {});
          pendingIce.current.delete(fromUserId);

          if (description.type === "offer") {
            await pc.setLocalDescription();
            if (pc.localDescription) {
              sendRef.current(fromUserId, "answer", {
                sdp: pc.localDescription.sdp,
                type: pc.localDescription.type,
              });
            }
          }
        } else if (signalType === "ice") {
          const candidate = payload as RTCIceCandidateInit;
          if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate).catch(() => {});
          } else {
            const buf = pendingIce.current.get(fromUserId) ?? [];
            buf.push(candidate);
            pendingIce.current.set(fromUserId, buf);
          }
        }
      } catch {
        /* a failed negotiation self-heals on the next offer */
      }
    },
    [ensurePeer, userId]
  );

  const teardown = useCallback(() => {
    peersRef.current.forEach((p) => {
      try {
        p.pc.close();
      } catch {
        /* already closed */
      }
    });
    peersRef.current.clear();
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setPeerStreams(new Map());
    setSpeaking(new Set());
    setReady(false);
    setMicOn(false);
    setCamOn(false);
  }, []);

  useEffect(() => teardown, [teardown]);

  return {
    localStream,
    peerStreams,
    speaking,
    micOn,
    camOn,
    ready,
    error,
    start,
    toggleMic,
    toggleCam,
    connectTo,
    dropPeer: dropPeerInternal,
    handleSignal,
    teardown,
  };
}

// ── Speaking detection ───────────────────────────────────────────────────────
// Drives the glow on the avatar tiles. Cheap: samples every 4th frame.

function watchSpeaking(
  stream: MediaStream,
  id: string,
  setSpeaking: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  if (!stream.getAudioTracks().length) return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    let live = true;
    stream.getAudioTracks()[0]?.addEventListener("ended", () => {
      live = false;
      ctx.close().catch(() => {});
    });

    const tick = () => {
      if (!live) return;
      frame++;
      if (frame % 4 === 0) {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        setSpeaking((prev) => {
          const has = prev.has(id);
          if (avg > 9 && !has) return new Set(prev).add(id);
          if (avg <= 9 && has) {
            const next = new Set(prev);
            next.delete(id);
            return next;
          }
          return prev;
        });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch {
    /* AudioContext unavailable — tiles just won't glow */
  }
}
