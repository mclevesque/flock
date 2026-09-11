"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice for DraftMasters — a room, or a chat between two friends.
 *
 * Signalling is whatever socket the caller already has open: the room's own
 * PartySocket in a draft, the `voice` party in a friends chat. Both relay the
 * same `rtc-signal` wire format (see party/voice.ts), so this hook does not
 * care which one it is talking through.
 *
 * Uses the perfect-negotiation pattern: the peer with the lower userId is
 * "polite" and rolls back on collision, so two people joining simultaneously
 * never deadlock on glare.
 *
 * Voice only. The camera path is gone: nobody asked for video mid-draft, and a
 * second track was one more thing to renegotiate on a phone that is already
 * holding a socket, a mic and a board of portraits.
 *
 * Three things this has to get right that the first version did not:
 *
 * PERMISSION ONCE. A granted mic is remembered (localStorage), so the next
 * room or chat starts voice without asking the player to do anything. The
 * browser still owns the actual prompt; this only decides whether to try.
 *
 * TRACKS THAT ARRIVE LATE. A peer that connects while the permission prompt is
 * still on screen used to be built with nothing to send, and nothing ever
 * added the mic afterwards — so one side of the call was silent for the whole
 * game. Starting the mic now hands its track to every peer already connected.
 *
 * THE MIC YOU CHOSE. The input device is picked from a list, remembered, and
 * swapped in place with replaceTrack, which does not renegotiate — the call
 * carries on without a gap. If the remembered device has gone (a headset
 * unplugged) the system default is used instead of failing.
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

const DEVICE_KEY = "dm_mic_device";
const GRANTED_KEY = "dm_mic_granted";
const MUTED_KEY = "dm_muted_peers";

/** Has this browser let us have the mic before? Decides whether voice starts on its own. */
export function rememberedMicGrant(): boolean {
  try {
    return localStorage.getItem(GRANTED_KEY) === "1";
  } catch {
    return false;
  }
}

function forgetMicGrant() {
  try {
    localStorage.removeItem(GRANTED_KEY);
  } catch {
    /* nothing remembered to forget */
  }
}

function readDevice(): string {
  try {
    return localStorage.getItem(DEVICE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDevice(id: string) {
  try {
    if (id) localStorage.setItem(DEVICE_KEY, id);
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    /* the choice just will not survive a reload */
  }
}

/**
 * People you have muted, for this tab. Session-scoped on purpose: muting
 * someone in a draft should still hold if the chat reconnects, but not follow
 * you into next week.
 */
function readMuted(): Set<string> {
  try {
    const raw = sessionStorage.getItem(MUTED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeMuted(ids: Set<string>) {
  try {
    sessionStorage.setItem(MUTED_KEY, JSON.stringify([...ids]));
  } catch {
    /* mutes last until the tab closes either way */
  }
}

/**
 * off      not started
 * asking   the browser's permission prompt is (probably) on screen
 * live     capturing
 * denied   the player or the browser said no
 * missing  no microphone, or no mic API in this context (http, old webview)
 * failed   anything else
 */
export type MicState = "off" | "asking" | "live" | "denied" | "missing" | "failed";

export interface MicDevice {
  /** "" is the system default, whatever that currently is. */
  deviceId: string;
  label: string;
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
  /** Your outgoing audio is live — capturing and not self-muted. */
  micOn: boolean;
  /** Capture is running, muted or not. */
  ready: boolean;
  micState: MicState;
  error: string | null;
  devices: MicDevice[];
  /** The chosen input; "" means the system default. */
  deviceId: string;
  /** People you have muted for yourself. They are not told. */
  mutedPeers: Set<string>;
  start: () => Promise<boolean>;
  /** Flip your own mic. Returns the new state, or null if there is no mic to flip. */
  toggleMic: () => boolean | null;
  setDevice: (deviceId: string) => Promise<void>;
  togglePeerMute: (peerId: string) => void;
  refreshDevices: () => Promise<void>;
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

const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

function capture(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { ...AUDIO, deviceId: { exact: deviceId } } : AUDIO,
    video: false,
  });
}

export function useDraftMedia(
  userId: string,
  sendSignal: (toUserId: string, signalType: string, payload: unknown) => void
): DraftMedia {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerStreams, setPeerStreams] = useState<Map<string, MediaStream>>(new Map());
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const [micOn, setMicOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [micState, setMicState] = useState<MicState>("off");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MicDevice[]>([{ deviceId: "", label: "System default" }]);
  const [deviceId, setDeviceId] = useState("");
  const [mutedPeers, setMutedPeers] = useState<Set<string>>(new Set());

  const peersRef = useRef(new Map<string, Peer>());
  const localRef = useRef<MediaStream | null>(null);
  const deviceRef = useRef("");
  const startingRef = useRef<Promise<boolean> | null>(null);
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const speakStops = useRef(new Map<string, () => void>());
  const sendRef = useRef(sendSignal);
  sendRef.current = sendSignal;

  // Read the remembered choices after mount — storage is not there on the server.
  useEffect(() => {
    deviceRef.current = readDevice();
    setDeviceId(deviceRef.current);
    setMutedPeers(readMuted());
  }, []);

  const watch = useCallback((stream: MediaStream, id: string) => {
    speakStops.current.get(id)?.();
    const stop = watchSpeaking(stream, id, setSpeaking);
    if (stop) speakStops.current.set(id, stop);
  }, []);

  const unwatch = useCallback((id: string) => {
    speakStops.current.get(id)?.();
    speakStops.current.delete(id);
    setSpeaking((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // ── Devices ────────────────────────────────────────────────────────────────

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
      // Labels are blank until the mic has been granted once; the ids are
      // placeholders until then too, so nothing below is trustworthy yet.
      const labelled = inputs.some((d) => d.label);

      // Chrome lists a pseudo-device called "default" whose label names the
      // real one; Safari and Firefox put the default first instead.
      const chromeDefault = inputs.find((d) => d.deviceId === "default");
      const defaultName = (chromeDefault?.label ?? inputs[0]?.label ?? "").replace(/^Default\s*-\s*/i, "");

      const list: MicDevice[] = [
        { deviceId: "", label: defaultName ? `System default (${defaultName})` : "System default" },
      ];
      if (labelled) {
        inputs
          .filter((d) => d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications")
          .forEach((d, i) => list.push({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
      }
      setDevices(list);

      // The remembered mic has gone away. Say so by showing the default as
      // selected; the live track falls over to it on the next capture.
      const chosen = deviceRef.current;
      if (labelled && chosen && !inputs.some((d) => d.deviceId === chosen)) {
        deviceRef.current = "";
        setDeviceId("");
      }
    } catch {
      /* the list just stays as it was */
    }
  }, []);

  useEffect(() => {
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md?.addEventListener) return;
    const onChange = () => void refreshDevices();
    md.addEventListener("devicechange", onChange);
    return () => md.removeEventListener("devicechange", onChange);
  }, [refreshDevices]);

  // ── Local capture ──────────────────────────────────────────────────────────

  const start = useCallback(async (): Promise<boolean> => {
    if (localRef.current) return true;
    if (startingRef.current) return startingRef.current;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicState("missing");
      setError("Voice needs a secure connection and a browser that allows microphones.");
      return false;
    }

    const run = async (): Promise<boolean> => {
      setMicState("asking");
      let stream: MediaStream;
      try {
        try {
          stream = await capture(deviceRef.current);
        } catch (err) {
          const name = (err as DOMException)?.name;
          if (!deviceRef.current || (name !== "OverconstrainedError" && name !== "NotFoundError")) throw err;
          // The remembered device is gone. The default is better than silence.
          deviceRef.current = "";
          setDeviceId("");
          writeDevice("");
          stream = await capture("");
        }
      } catch (err) {
        const name = (err as DOMException)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          forgetMicGrant();
          setMicState("denied");
          setError("Mic blocked. Allow it for this site in your browser settings to talk.");
        } else if (name === "NotFoundError") {
          setMicState("missing");
          setError("No microphone found.");
        } else {
          setMicState("failed");
          setError("Couldn't start your mic.");
        }
        setReady(false);
        return false;
      }

      localRef.current = stream;
      setLocalStream(stream);
      setMicOn(true);
      setReady(true);
      setMicState("live");
      setError(null);
      try {
        localStorage.setItem(GRANTED_KEY, "1");
      } catch {
        /* the next room will just ask again */
      }
      watch(stream, userId);

      // Anyone who connected while the prompt was up has nothing to send yet.
      // addTrack reuses their receive-only transceiver and renegotiates.
      peersRef.current.forEach((peer) => {
        if (peer.pc.signalingState === "closed") return;
        if (peer.pc.getSenders().some((s) => s.track)) return;
        stream.getTracks().forEach((t) => peer.pc.addTrack(t, stream));
      });

      void refreshDevices();
      return true;
    };

    startingRef.current = run();
    try {
      return await startingRef.current;
    } finally {
      startingRef.current = null;
    }
  }, [refreshDevices, userId, watch]);

  const toggleMic = useCallback((): boolean | null => {
    const stream = localRef.current;
    const tracks = stream?.getAudioTracks() ?? [];
    if (!tracks.length) return null;
    const next = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = next));
    setMicOn(next);
    return next;
  }, []);

  const setDevice = useCallback(
    async (id: string) => {
      deviceRef.current = id;
      setDeviceId(id);
      writeDevice(id);

      const old = localRef.current;
      if (!old) return; // used on the next start

      let fresh: MediaStream;
      try {
        fresh = await capture(id);
      } catch {
        setError("Couldn't switch to that microphone.");
        return;
      }
      const track = fresh.getAudioTracks()[0];
      if (!track) return;
      const oldTrack = old.getAudioTracks()[0];
      // A muted player stays muted on the new mic.
      track.enabled = oldTrack ? oldTrack.enabled : true;

      // replaceTrack does not renegotiate: the other side keeps the same
      // receiver and simply starts hearing the new microphone.
      await Promise.all(
        [...peersRef.current.values()].map(async (peer) => {
          if (peer.pc.signalingState === "closed") return;
          const sender = peer.pc.getSenders().find((s) => s.track?.kind === "audio");
          if (sender) await sender.replaceTrack(track).catch(() => {});
          else peer.pc.addTrack(track, fresh);
        })
      );

      old.getTracks().forEach((t) => t.stop());
      localRef.current = fresh;
      setLocalStream(fresh);
      setError(null);
      watch(fresh, userId);
      void refreshDevices();
    },
    [refreshDevices, userId, watch]
  );

  const togglePeerMute = useCallback((peerId: string) => {
    setMutedPeers((prev) => {
      const next = new Set(prev);
      if (next.has(peerId)) next.delete(peerId);
      else next.add(peerId);
      writeMuted(next);
      return next;
    });
  }, []);

  // ── Peer connections ───────────────────────────────────────────────────────

  const dropPeerInternal = useCallback(
    (peerId: string) => {
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
      unwatch(peerId);
      setPeerStreams((prev) => {
        if (!prev.has(peerId)) return prev;
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
    },
    [unwatch]
  );

  const ensurePeer = useCallback(
    async (peerId: string): Promise<Peer> => {
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;

      const iceServers = await getIceServers();
      // Another call may have built it while the ICE config was loading.
      const raced = peersRef.current.get(peerId);
      if (raced) return raced;

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
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        peer.stream = stream;
        setPeerStreams((prev) => new Map(prev).set(peerId, stream));
        if (e.track.kind === "audio") watch(stream, peerId);
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
          // Only drop the connection this handler belongs to — a replacement
          // may already be sitting in the map under the same id.
          if (peersRef.current.get(peerId) === peer) dropPeerInternal(peerId);
        }
      };

      const local = localRef.current;
      if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));

      return peer;
    },
    [dropPeerInternal, userId, watch]
  );

  /** Called for everyone else in the room. Whoever has a track to send makes the offer. */
  const connectTo = useCallback(
    async (peerId: string) => {
      if (!peerId || peerId === userId) return;
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
    pendingIce.current.clear();
    speakStops.current.forEach((stop) => stop());
    speakStops.current.clear();
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setPeerStreams(new Map());
    setSpeaking(new Set());
    setReady(false);
    setMicOn(false);
    setMicState((s) => (s === "denied" || s === "missing" ? s : "off"));
  }, []);

  useEffect(() => teardown, [teardown]);

  return {
    localStream,
    peerStreams,
    speaking,
    micOn,
    ready,
    micState,
    error,
    devices,
    deviceId,
    mutedPeers,
    start,
    toggleMic,
    setDevice,
    togglePeerMute,
    refreshDevices,
    connectTo,
    dropPeer: dropPeerInternal,
    handleSignal,
    teardown,
  };
}

// ── Speaking detection ───────────────────────────────────────────────────────
// Drives the ring on the portraits. Cheap: one analyser per voice, sampled
// every fourth frame, and it stops when told to — the old loop only stopped on
// a track's "ended" event, which stop() never fires, so every call that ever
// happened kept an AudioContext spinning until the tab closed.

function watchSpeaking(
  stream: MediaStream,
  id: string,
  setSpeaking: React.Dispatch<React.SetStateAction<Set<string>>>
): (() => void) | null {
  if (!stream.getAudioTracks().length) return null;
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
    let raf = 0;

    // A context made outside a tap starts suspended on iOS; the first tap anywhere wakes it.
    const wake = () => void ctx.resume().catch(() => {});
    if (ctx.state === "suspended") window.addEventListener("pointerdown", wake, { once: true });

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
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      live = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", wake);
      try {
        source.disconnect();
      } catch {
        /* already disconnected */
      }
      ctx.close().catch(() => {});
    };
  } catch {
    /* AudioContext unavailable — portraits just won't glow */
    return null;
  }
}
