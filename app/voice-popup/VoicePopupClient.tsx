"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface VoiceParticipant {
  user_id: string; username: string; avatar_url: string | null;
  is_muted: boolean; is_video: boolean;
}
interface RoomMessage {
  id: number; sender_id: string; username: string; avatar_url: string | null;
  content: string; created_at: string;
}
interface DmFriend { id: string; username: string; display_name: string | null; avatar_url: string | null; }
interface DmMessage { id: number; sender_id: string; content: string; created_at: string; avatar_url?: string | null; }

type SizeMode = "mini" | "normal" | "maxi";

const SIZE_DIMS: Record<SizeMode, [number, number]> = {
  mini:   [340, 108],
  normal: [360, 580],
  maxi:   [520, 800],
};

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// ─── BroadcastChannel protocol ────────────────────────────────────────────────
// main → popup: { type:"join", roomId, roomName }
//               { type:"leave" }
//               { type:"heartbeat" }
// popup → main: { type:"ready" }
//               { type:"state", roomId, roomName, participants, speaking }
//               { type:"closing", roomId }

// ─── Main component ────────────────────────────────────────────────────────────
export default function VoicePopupClient() {
  const { data: session, status } = useSession();
  const userId    = session?.user?.id   ?? null;
  const username  = session?.user?.name ?? "User";
  const avatarUrl = session?.user?.image ?? null;

  // ── Size / layout ────────────────────────────────────────────────────────────
  const [sizeMode, setSizeMode] = useState<SizeMode>("normal");

  function applySize(mode: SizeMode) {
    setSizeMode(mode);
    const [w, h] = SIZE_DIMS[mode];
    try { window.resizeTo(w, h); } catch { /* ignore */ }
  }

  // ── Voice state ───────────────────────────────────────────────────────────────
  const [currentRoomId,   setCurrentRoomId]   = useState<string | null>(null);
  const [currentRoomName, setCurrentRoomName] = useState("");
  const [participants,    setParticipants]    = useState<VoiceParticipant[]>([]);
  const [isMuted,         setIsMuted]         = useState(false);
  const [isConnecting,    setIsConnecting]    = useState(false);
  const [speakingUsers,   setSpeakingUsers]   = useState<Set<string>>(new Set());
  const [localSpeaking,   setLocalSpeaking]   = useState(false);

  // ── Room chat ─────────────────────────────────────────────────────────────────
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const [roomInput,    setRoomInput]    = useState("");
  const [sendingMsg,   setSendingMsg]   = useState(false);
  const msgBottomRef = useRef<HTMLDivElement>(null);

  // ── DM panel ──────────────────────────────────────────────────────────────────
  const [dmOpen,       setDmOpen]       = useState(false);
  const [dmFriends,    setDmFriends]    = useState<DmFriend[]>([]);
  const [dmActiveUser, setDmActiveUser] = useState<DmFriend | null>(null);
  const [dmMessages,   setDmMessages]   = useState<DmMessage[]>([]);
  const [dmInput,      setDmInput]      = useState("");
  const [dmSending,    setDmSending]    = useState(false);
  const dmMsgBottomRef = useRef<HTMLDivElement>(null);
  const dmPollRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const currentRoomRef  = useRef<string | null>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const peersRef        = useRef<Map<string, { pc: RTCPeerConnection; audioEl: HTMLAudioElement; }>>(new Map());
  const pendingIce      = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const signalAfterRef  = useRef<number>(0);
  const signalTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const participantTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const bcRef           = useRef<BroadcastChannel | null>(null);
  const localAnalyserRef = useRef<{ analyser: AnalyserNode; data: Uint8Array } | null>(null);
  const localAnimRef    = useRef<number | null>(null);

  // ── BroadcastChannel setup ────────────────────────────────────────────────────
  useEffect(() => {
    const bc = new BroadcastChannel("flock-voice");
    bcRef.current = bc;
    // Tell the main window we're alive
    bc.postMessage({ type: "ready" });

    bc.onmessage = (e) => {
      const msg = e.data as { type: string; roomId?: string; roomName?: string };
      if (msg.type === "join" && msg.roomId && msg.roomName) {
        joinRoom(msg.roomId, msg.roomName);
      } else if (msg.type === "leave") {
        doLeave();
      }
    };
    return () => bc.close();
  }, [userId]); // eslint-disable-line

  // ── Broadcast state back to main window ───────────────────────────────────────
  function broadcastState(roomId: string | null, parts: VoiceParticipant[], speaking: Set<string>) {
    bcRef.current?.postMessage({
      type: "state",
      roomId,
      roomName: currentRoomName,
      participants: parts,
      speaking: [...speaking],
    });
  }

  // Notify main window on close
  useEffect(() => {
    const onBeforeUnload = () => {
      bcRef.current?.postMessage({ type: "closing", roomId: currentRoomRef.current });
      doLeave();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []); // eslint-disable-line

  // ── Read room from URL / sessionStorage on load ───────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const params = new URLSearchParams(window.location.search);
    const roomId   = params.get("roomId");
    const roomName = params.get("roomName") ?? "Voice";
    if (roomId) {
      setTimeout(() => joinRoom(roomId, roomName), 500);
      return;
    }
    // fallback: check sessionStorage
    const saved = sessionStorage.getItem("flock_voice_room");
    if (saved) {
      try {
        const { id, name } = JSON.parse(saved) as { id: string; name: string };
        if (id) setTimeout(() => joinRoom(id, name ?? "Voice"), 500);
      } catch { /* ignore */ }
    }
  }, [userId]); // eslint-disable-line

  // ── Resume audio on visibility change ────────────────────────────────────────
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      peersRef.current.forEach(({ audioEl }) => {
        if (audioEl.paused && audioEl.srcObject) audioEl.play().catch(() => {});
      });
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, []);

  // ── Get local stream ──────────────────────────────────────────────────────────
  async function getLocalStream(): Promise<MediaStream> {
    if (localStreamRef.current?.active) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    localStreamRef.current = stream;
    // Local speaker detection
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      localAnalyserRef.current = { analyser, data };
      let frame = 0;
      function checkLocal() {
        frame++;
        if (frame % 4 === 0) {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((s, v) => s + v, 0) / data.length;
          setLocalSpeaking(avg > 8);
        }
        localAnimRef.current = requestAnimationFrame(checkLocal);
      }
      requestAnimationFrame(checkLocal);
    } catch { /* optional */ }
    return stream;
  }

  // ── Create peer connection ────────────────────────────────────────────────────
  function createPC(peerId: string, roomId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const audioEl = new Audio();
    audioEl.autoplay = true;
    peersRef.current.set(peerId, { pc, audioEl });

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      fetch("/api/voice/signals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, toUserId: peerId, type: "ice", payload: ev.candidate.toJSON() }),
      });
    };

    pc.ontrack = (e) => {
      if (e.track.kind === "video") return;
      audioEl.srcObject = e.streams[0];
      try {
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(e.streams[0]);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let frame = 0;
        function checkSpeaking() {
          frame++;
          if (frame % 4 === 0) {
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((s, v) => s + v, 0) / data.length;
            setSpeakingUsers(prev => {
              const next = new Set(prev);
              avg > 8 ? next.add(peerId) : next.delete(peerId);
              return next;
            });
          }
          requestAnimationFrame(checkSpeaking);
        }
        requestAnimationFrame(checkSpeaking);
      } catch { /* optional */ }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        peersRef.current.delete(peerId);
        setSpeakingUsers(prev => { const n = new Set(prev); n.delete(peerId); return n; });
      }
    };

    pc.onnegotiationneeded = async () => {
      if (!currentRoomRef.current) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await fetch("/api/voice/signals", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: currentRoomRef.current, toUserId: peerId, type: "offer", payload: { sdp: offer.sdp, type: offer.type } }),
        });
      } catch { /* ignore */ }
    };

    return pc;
  }

  // ── Join room ─────────────────────────────────────────────────────────────────
  const joinRoom = useCallback(async (roomId: string, roomName: string) => {
    if (!userId) return;
    if (currentRoomRef.current) await doLeave();
    setIsConnecting(true);
    setCurrentRoomId(roomId);
    setCurrentRoomName(roomName);
    currentRoomRef.current = roomId;
    sessionStorage.setItem("flock_voice_room", JSON.stringify({ id: roomId, name: roomName }));

    try {
      const stream = await getLocalStream();
      await fetch(`/api/voice/${roomId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join" }) });
      const res   = await fetch(`/api/voice/${roomId}`);
      const data  = await res.json();
      const existing: Array<{ user_id: string }> = Array.isArray(data.participants) ? data.participants : [];

      for (const p of existing) {
        if (p.user_id === userId) continue;
        const pc = createPC(p.user_id, roomId);
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await fetch("/api/voice/signals", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, toUserId: p.user_id, type: "offer", payload: { sdp: offer.sdp, type: offer.type } }),
        });
      }

      signalAfterRef.current = Date.now();
      fetchRoomMessages(roomId);
      setIsConnecting(false);

      // Start signal + participant polls
      if (signalTimerRef.current) clearInterval(signalTimerRef.current);
      signalTimerRef.current = setInterval(() => processSignals(), 1200);

      if (participantTimer.current) clearInterval(participantTimer.current);
      participantTimer.current = setInterval(() => refreshParticipants(roomId), 3000);

    } catch (e) {
      console.error("Voice popup join error:", e);
      setIsConnecting(false);
    }
  }, [userId]); // eslint-disable-line

  // ── Process signals ───────────────────────────────────────────────────────────
  const processSignals = useCallback(async () => {
    const roomId = currentRoomRef.current;
    if (!roomId || !userId) return;
    const after = signalAfterRef.current;
    const res = await fetch(`/api/voice/signals?roomId=${roomId}&after=${after}`);
    if (!res.ok) return;
    const signals = await res.json();
    if (!Array.isArray(signals) || signals.length === 0) return;
    signalAfterRef.current = Date.now();
    const stream = localStreamRef.current;

    for (const sig of signals) {
      const from = sig.from_user_id as string;
      const type = sig.type as string;
      let payload: Record<string, unknown>;
      try { payload = JSON.parse(sig.payload as string); } catch { continue; }

      if (type === "offer") {
        let peerState = peersRef.current.get(from);
        if (!peerState) {
          const pc = createPC(from, roomId);
          if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
          peerState = peersRef.current.get(from)!;
        }
        const { pc } = peerState;
        if (pc.signalingState === "stable" || pc.signalingState === "have-remote-offer") {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload as unknown as RTCSessionDescriptionInit));
            const buffered = pendingIce.current.get(from) ?? [];
            for (const c of buffered) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            pendingIce.current.delete(from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await fetch("/api/voice/signals", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roomId, toUserId: from, type: "answer", payload: { sdp: answer.sdp, type: answer.type } }),
            });
          } catch (e) { console.error("Answer error", e); }
        }
      } else if (type === "answer") {
        const peerState = peersRef.current.get(from);
        if (peerState?.pc.signalingState === "have-local-offer") {
          try {
            await peerState.pc.setRemoteDescription(new RTCSessionDescription(payload as unknown as RTCSessionDescriptionInit));
            const buffered = pendingIce.current.get(from) ?? [];
            for (const c of buffered) await peerState.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            pendingIce.current.delete(from);
          } catch (e) { console.error("setRemoteDescription error", e); }
        }
      } else if (type === "ice") {
        const peerState = peersRef.current.get(from);
        if (peerState) {
          if (peerState.pc.remoteDescription !== null) {
            peerState.pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit)).catch(() => {});
          } else {
            const buf = pendingIce.current.get(from) ?? [];
            buf.push(payload as RTCIceCandidateInit);
            pendingIce.current.set(from, buf);
          }
        }
      }
    }
  }, [userId]); // eslint-disable-line

  // ── Refresh participants ──────────────────────────────────────────────────────
  async function refreshParticipants(roomId: string) {
    const res = await fetch(`/api/voice/${roomId}`);
    if (!res.ok) return;
    const data = await res.json();
    const parts: VoiceParticipant[] = Array.isArray(data.participants) ? data.participants : [];
    setParticipants(parts);
    broadcastState(roomId, parts, speakingUsers);
    // Also load new messages
    await fetchRoomMessages(roomId);
  }

  // ── Room chat ─────────────────────────────────────────────────────────────────
  async function fetchRoomMessages(roomId: string) {
    const res = await fetch(`/api/voice/${roomId}/messages`).catch(() => null);
    if (!res?.ok) return;
    const msgs = await res.json();
    if (Array.isArray(msgs)) setRoomMessages(msgs.slice(-60));
  }

  async function sendRoomMessage() {
    const roomId = currentRoomRef.current;
    if (!roomId || !roomInput.trim()) return;
    setSendingMsg(true);
    const text = roomInput.trim();
    setRoomInput("");
    try {
      await fetch(`/api/voice/${roomId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      await fetchRoomMessages(roomId);
    } catch { /* ignore */ } finally { setSendingMsg(false); }
  }

  useEffect(() => { msgBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [roomMessages]);

  // ── Leave ─────────────────────────────────────────────────────────────────────
  const doLeave = useCallback(async () => {
    const roomId = currentRoomRef.current;
    if (signalTimerRef.current)  { clearInterval(signalTimerRef.current);  signalTimerRef.current = null; }
    if (participantTimer.current){ clearInterval(participantTimer.current); participantTimer.current = null; }
    if (localAnimRef.current)    { cancelAnimationFrame(localAnimRef.current); localAnimRef.current = null; }

    if (roomId && userId) {
      fetch(`/api/voice/${roomId}`, { method: "POST", body: JSON.stringify({ action: "leave" }) }).catch(() => {});
    }
    peersRef.current.forEach(({ pc, audioEl }) => { pc.close(); audioEl.srcObject = null; });
    peersRef.current.clear();
    pendingIce.current.clear();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    localAnalyserRef.current = null;
    currentRoomRef.current = null;
    setCurrentRoomId(null);
    setCurrentRoomName("");
    setParticipants([]);
    setSpeakingUsers(new Set());
    setLocalSpeaking(false);
    setRoomMessages([]);
    sessionStorage.removeItem("flock_voice_room");
    bcRef.current?.postMessage({ type: "state", roomId: null, participants: [], speaking: [] });
  }, [userId]); // eslint-disable-line

  // ── Mute toggle ───────────────────────────────────────────────────────────────
  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
    if (currentRoomRef.current) {
      fetch(`/api/voice/${currentRoomRef.current}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isMuted ? "unmute" : "mute" }),
      }).catch(() => {});
    }
  }

  // ── DM helpers ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dmOpen || !userId) return;
    fetch("/api/friends").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setDmFriends(data);
    }).catch(() => {});
  }, [dmOpen, userId]);

  useEffect(() => {
    if (!dmActiveUser) return;
    const load = async () => {
      const msgs = await fetch(`/api/messages?with=${dmActiveUser.id}`).then(r => r.json()).catch(() => []);
      if (Array.isArray(msgs)) setDmMessages(msgs.slice(-40));
    };
    load();
    dmPollRef.current = setInterval(load, 3000);
    return () => { if (dmPollRef.current) clearInterval(dmPollRef.current); };
  }, [dmActiveUser]);

  useEffect(() => { dmMsgBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [dmMessages]);

  async function sendDm() {
    if (!dmActiveUser || !dmInput.trim() || !userId) return;
    setDmSending(true);
    const text = dmInput.trim();
    setDmInput("");
    try {
      await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiverId: dmActiveUser.id, content: text }) });
      const msgs = await fetch(`/api/messages?with=${dmActiveUser.id}`).then(r => r.json()).catch(() => []);
      if (Array.isArray(msgs)) setDmMessages(msgs.slice(-40));
    } catch { /* ignore */ } finally { setDmSending(false); }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return <div style={{ background: "#0d0f14", color: "#e8eaf6", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "monospace" }}>Loading…</div>;
  }

  if (!userId) {
    return <div style={{ background: "#0d0f14", color: "#e8eaf6", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "monospace", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 20 }}>🔒</div>
      <div>Sign in to use voice chat</div>
    </div>;
  }

  const inVoice = !!currentRoomId;
  const myParticipant = participants.find(p => p.user_id === userId);
  const amSpeaking = localSpeaking && !isMuted;

  // ── MINI mode ─────────────────────────────────────────────────────────────────
  if (sizeMode === "mini") {
    return (
      <div style={{ background: "rgba(13,15,20,0.98)", height: "100vh", display: "flex", alignItems: "center", padding: "0 12px", gap: 10, fontFamily: "monospace", userSelect: "none" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: inVoice ? (amSpeaking ? "#4ade80" : "#7c3aed") : "#374151", boxShadow: amSpeaking ? "0 0 8px #4ade80" : "none", flexShrink: 0 }} />
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e8eaf6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {inVoice ? currentRoomName : "No voice"}
          </div>
          {inVoice && <div style={{ fontSize: 10, color: "#6b7280" }}>{participants.length} in room</div>}
        </div>
        {/* Speaking indicators */}
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          {participants.slice(0, 5).map(p => {
            const speaking = speakingUsers.has(p.user_id) || (p.user_id === userId && amSpeaking);
            return (
              <div key={p.user_id} style={{ position: "relative" }}>
                <img src={p.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${p.username}`} alt="" style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${speaking ? "#4ade80" : "rgba(255,255,255,0.1)"}`, boxShadow: speaking ? "0 0 6px rgba(74,222,128,0.8)" : "none" }} />
              </div>
            );
          })}
        </div>
        {inVoice && (
          <button onClick={toggleMute} style={{ background: isMuted ? "rgba(239,68,68,0.2)" : "rgba(74,222,128,0.15)", border: `1px solid ${isMuted ? "rgba(239,68,68,0.4)" : "rgba(74,222,128,0.3)"}`, borderRadius: 6, padding: "4px 8px", color: isMuted ? "#f87171" : "#4ade80", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>
            {isMuted ? "🔇" : "🎙️"}
          </button>
        )}
        <button onClick={() => applySize("normal")} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, padding: "2px 4px", flexShrink: 0 }} title="Expand">⬆</button>
      </div>
    );
  }

  // ── NORMAL + MAXI shared layout ───────────────────────────────────────────────
  const isMaxi = sizeMode === "maxi";

  return (
    <div style={{ background: "#0d0f14", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "monospace", overflow: "hidden", color: "#e8eaf6" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(13,15,20,0.98)", flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: inVoice ? "#7c3aed" : "#374151", flexShrink: 0 }} />
        <span style={{ flex: 1, fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {inVoice ? `🔊 ${currentRoomName}` : "Voice Chat"}
        </span>
        {/* Size controls */}
        <button onClick={() => applySize("mini")}   title="Mini"   style={sizeBtn((sizeMode as SizeMode) === "mini")}>▬</button>
        <button onClick={() => applySize("normal")} title="Normal" style={sizeBtn(sizeMode === "normal")}>⬜</button>
        <button onClick={() => applySize("maxi")}   title="Full"   style={sizeBtn(sizeMode === "maxi")}>⛶</button>
        <button onClick={() => window.close()} title="Close" style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16, padding: "2px 6px", marginLeft: 2 }}>×</button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: isMaxi ? "row" : "column", overflow: "hidden" }}>

        {/* ── Left: participants + controls ── */}
        <div style={{ width: isMaxi ? 220 : "100%", display: "flex", flexDirection: "column", borderRight: isMaxi ? "1px solid rgba(255,255,255,0.08)" : "none", overflow: "hidden" }}>

          {/* Connection status / Join prompt */}
          {!inVoice && !isConnecting && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 28 }}>🔊</div>
              <div style={{ color: "#6b7280", fontSize: 12 }}>Join a voice room from the main window to get started. The connection will live here, safely away from any page you navigate to.</div>
            </div>
          )}
          {isConnecting && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid #7c3aed", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
              <div style={{ color: "#6b7280", fontSize: 12 }}>Connecting…</div>
            </div>
          )}

          {inVoice && (
            <>
              {/* Participants list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                <div style={{ padding: "4px 14px 6px", fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                  In Voice · {participants.length}
                </div>
                {participants.map(p => {
                  const isSelf = p.user_id === userId;
                  const isSpeaking = isSelf ? amSpeaking : (speakingUsers.has(p.user_id) && !p.is_muted);
                  return (
                    <div key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 14px", transition: "background 0.15s" }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <img src={p.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${p.username}`} alt="" style={{ width: 30, height: 30, borderRadius: "50%", border: `2px solid ${isSpeaking ? "#4ade80" : "rgba(255,255,255,0.1)"}`, boxShadow: isSpeaking ? "0 0 10px rgba(74,222,128,0.7)" : "none", transition: "all 0.15s" }} />
                        {isSpeaking && <div style={{ position: "absolute", inset: -3, borderRadius: "50%", border: "2px solid rgba(74,222,128,0.4)", animation: "pulse 1s ease infinite" }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: isSpeaking ? "#4ade80" : "#e8eaf6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.username}{isSelf ? " (you)" : ""}
                        </div>
                        {isSpeaking && <div style={{ fontSize: 10, color: "#4ade80" }}>speaking…</div>}
                      </div>
                      {p.is_muted && <span style={{ fontSize: 12, opacity: 0.5 }}>🔇</span>}
                    </div>
                  );
                })}
              </div>

              {/* Controls bar */}
              <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={toggleMute} style={{ flex: 1, background: isMuted ? "rgba(239,68,68,0.15)" : "rgba(74,222,128,0.1)", border: `1px solid ${isMuted ? "rgba(239,68,68,0.35)" : "rgba(74,222,128,0.25)"}`, borderRadius: 8, padding: "8px", color: isMuted ? "#f87171" : "#4ade80", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {isMuted ? "🔇" : "🎙️"}
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{isMuted ? "Unmute" : "Mute"}</span>
                </button>
                <button onClick={doLeave} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", color: "#f87171", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Leave</button>
              </div>
            </>
          )}
        </div>

        {/* ── Right: Chat + DMs (maxi only, or full-width chat in normal) ── */}
        {(inVoice) && (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderTop: isMaxi ? "none" : "1px solid rgba(255,255,255,0.08)" }}>

            {/* Tab bar (maxi: Room Chat / DMs) */}
            {isMaxi && (
              <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
                <button onClick={() => setDmOpen(false)} style={{ flex: 1, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: !dmOpen ? "rgba(124,58,237,0.15)" : "none", border: "none", borderBottom: !dmOpen ? "2px solid #7c3aed" : "2px solid transparent", color: !dmOpen ? "#c4b5fd" : "#6b7280" }}>💬 Room</button>
                <button onClick={() => { setDmOpen(true); }} style={{ flex: 1, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: dmOpen ? "rgba(124,58,237,0.15)" : "none", border: "none", borderBottom: dmOpen ? "2px solid #7c3aed" : "2px solid transparent", color: dmOpen ? "#c4b5fd" : "#6b7280" }}>✉️ DMs</button>
              </div>
            )}

            {/* Room Chat */}
            {!dmOpen && (
              <>
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                  {roomMessages.length === 0 && <div style={{ textAlign: "center", color: "#374151", fontSize: 12, padding: 20 }}>No messages yet</div>}
                  {roomMessages.map(msg => {
                    const isMine = msg.sender_id === userId;
                    return (
                      <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", gap: 2 }}>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: isMine ? "row-reverse" : "row" }}>
                          {!isMine && <img src={msg.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${msg.username}`} alt="" style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0 }} />}
                          <div style={{ maxWidth: "80%", padding: "6px 10px", borderRadius: isMine ? "10px 10px 3px 10px" : "10px 10px 10px 3px", background: isMine ? "linear-gradient(135deg, rgba(124,58,237,0.5), rgba(79,70,229,0.4))" : "rgba(255,255,255,0.08)", color: "#e8eaf6", fontSize: 12, lineHeight: 1.45, wordBreak: "break-word", border: isMine ? "1px solid rgba(124,58,237,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                            {!isMine && <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{msg.username}</div>}
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={msgBottomRef} />
                </div>
                <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6, flexShrink: 0 }}>
                  <input value={roomInput} onChange={e => setRoomInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendRoomMessage(); }} placeholder="Chat in room…" style={{ flex: 1, background: "#1a1d26", border: "1px solid #2a2d3a", borderRadius: 8, padding: "7px 10px", color: "#e8eaf6", fontSize: "13px", outline: "none", fontFamily: "monospace" } as React.CSSProperties} />
                  <button onClick={sendRoomMessage} disabled={!roomInput.trim() || sendingMsg} style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: 8, padding: "0 12px", color: "#fff", cursor: "pointer", opacity: roomInput.trim() ? 1 : 0.4 }}>→</button>
                </div>
              </>
            )}

            {/* DM panel (maxi only) */}
            {dmOpen && isMaxi && (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {!dmActiveUser ? (
                  <>
                    <div style={{ flex: 1, overflowY: "auto" }}>
                      {dmFriends.length === 0 ? (
                        <div style={{ padding: 20, textAlign: "center", color: "#4b5563", fontSize: 12 }}>Loading contacts…</div>
                      ) : dmFriends.map(f => (
                        <div key={f.id} onClick={() => setDmActiveUser(f)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <img src={f.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${f.username}`} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#e8eaf6" }}>{f.display_name ?? f.username}</div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>@{f.username}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => { setDmActiveUser(null); setDmMessages([]); if (dmPollRef.current) clearInterval(dmPollRef.current); }} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16 }}>←</button>
                      <img src={dmActiveUser.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${dmActiveUser.username}`} alt="" style={{ width: 24, height: 24, borderRadius: "50%" }} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#e8eaf6" }}>@{dmActiveUser.username}</span>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                      {dmMessages.length === 0 && <div style={{ textAlign: "center", color: "#4b5563", fontSize: 12, padding: 16 }}>No messages yet</div>}
                      {dmMessages.map(msg => {
                        const isMine = msg.sender_id === userId;
                        return (
                          <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
                            <div style={{ maxWidth: "80%", padding: "6px 10px", borderRadius: isMine ? "10px 10px 3px 10px" : "10px 10px 10px 3px", background: isMine ? "linear-gradient(135deg, rgba(124,58,237,0.5),rgba(79,70,229,0.4))" : "rgba(255,255,255,0.08)", color: "#e8eaf6", fontSize: 12, lineHeight: 1.45, wordBreak: "break-word", border: isMine ? "1px solid rgba(124,58,237,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                              {msg.content}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={dmMsgBottomRef} />
                    </div>
                    <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6, flexShrink: 0 }}>
                      <input value={dmInput} onChange={e => setDmInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendDm(); }} placeholder={`Message @${dmActiveUser.username}…`} style={{ flex: 1, background: "#1a1d26", border: "1px solid #2a2d3a", borderRadius: 8, padding: "7px 10px", color: "#e8eaf6", fontSize: "13px", outline: "none", fontFamily: "monospace" } as React.CSSProperties} />
                      <button onClick={sendDm} disabled={!dmInput.trim() || dmSending} style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: 8, padding: "0 12px", color: "#fff", cursor: "pointer", opacity: dmInput.trim() ? 1 : 0.4 }}>→</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes pulse  { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.15); } }
        * { box-sizing: border-box; }
        body { margin: 0; background: #0d0f14; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}

function sizeBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? "rgba(124,58,237,0.2)" : "none",
    border: `1px solid ${active ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 5, padding: "3px 7px", color: active ? "#c4b5fd" : "#6b7280",
    cursor: "pointer", fontSize: 12,
  };
}
