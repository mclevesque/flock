"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/use-session";
import { useVoice } from "./VoiceWidget";

interface PartyChatMsg {
  userId: string;
  username: string;
  text: string;
  area: string; // where the message was sent from
  ts: number;
}

interface PartyMember {
  userId: string;
  username: string;
  avatarUrl: string;
  isLeader: boolean;
}

interface Party {
  id: string;
  leaderId: string;
  members: PartyMember[];
  maxSize: number;
}

export default function GlobalPartyWidget() {
  const { data: session } = useSession();
  const { isInVoice, isMuted, toggleMute, openMaxi, joinRoom, leaveRoom, currentRoomId } = useVoice();
  const [party, setParty] = useState<Party | null>(null);
  const [open, setOpen] = useState(false);
  const [chatLog, setChatLog] = useState<PartyChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const draggedRef = useRef(false);
  const pillRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<{ send: (d: string) => void; close: () => void } | null>(null);
  const partyRef = useRef<Party | null>(null);
  const openRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  const userId = (session?.user as { id?: string })?.id;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Keep refs in sync
  useEffect(() => { partyRef.current = party; }, [party]);
  useEffect(() => { openRef.current = open; }, [open]);

  // Party chat WebSocket — connects/reconnects when partyId changes
  const connectPartyWS = useCallback(async (partyId: string) => {
    wsRef.current?.close();
    wsRef.current = null;
    const { PartySocket } = await import("partysocket");
    const ws = new PartySocket({
      host: process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999",
      room: `party-${partyId}`,
    }) as unknown as { send: (d: string) => void; close: () => void; onmessage: (e: MessageEvent) => void };
    ws.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "party_chat") {
          const entry: PartyChatMsg = { userId: msg.userId, username: msg.username, text: msg.text, area: msg.area ?? "?", ts: msg.ts ?? Date.now() };
          setChatLog(prev => [...prev.slice(-49), entry]);
          if (!openRef.current) setUnread(n => n + 1);
          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        } else if (msg.type === "party_membership") {
          // Party membership changed — re-fetch fresh state
          fetch("/api/party?action=my-party").then(r => r.json()).then(d => {
            setParty(d.party ?? null);
          }).catch(() => {});
        }
      } catch { /* ignore */ }
    };
    wsRef.current = ws;
  }, []);

  useEffect(() => {
    if (party?.id) { connectPartyWS(party.id); }
    else { wsRef.current?.close(); wsRef.current = null; }
    return () => { wsRef.current?.close(); wsRef.current = null; };
  }, [party?.id, connectPartyWS]);

  // Clear unread when panel opens
  useEffect(() => { if (open) { setUnread(0); setTimeout(() => chatBottomRef.current?.scrollIntoView(), 50); } }, [open]);

  const sendPartyChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text || !partyRef.current || !wsRef.current || !userId) return;
    const username = (session?.user as { name?: string })?.name ?? "?";
    const area = typeof window !== "undefined" ? (window.location.pathname.replace(/^\//, "") || "home") : "?";
    const msg = { type: "party_chat", userId, username, text, area, ts: Date.now() };
    wsRef.current.send(JSON.stringify(msg));
    setChatLog(prev => [...prev.slice(-49), { userId, username, text, area, ts: Date.now() }]);
    setChatInput("");
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [chatInput, userId, session]);

  // Poll party state every 12 seconds
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    const poll = () => {
      if (document.hidden || cancelled) return;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      fetch("/api/party?action=my-party", { signal: ctrl.signal })
        .then(r => r.json())
        .then(d => { if (!cancelled) setParty(d.party ?? null); })
        .catch(() => {})
        .finally(() => clearTimeout(t));
    };
    poll();
    const iv = setInterval(poll, 60000); // 60s fallback — PartyKit WS handles real-time updates
    return () => { cancelled = true; clearInterval(iv); };
  }, [session]);

  const disbandOrLeave = async () => {
    if (!party) return;
    const action = party.leaderId === userId ? "disband" : "leave";
    await fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, partyId: party.id }) });
    setParty(null);
    setOpen(false);
  };

  const createParty = async () => {
    const r = await fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create" }) });
    const d = await r.json();
    if (d.party) setParty(d.party);
  };

  // Join party voice room when in a party
  const joinPartyVoice = () => {
    if (!party) return;
    if (isInVoice) { openMaxi(); return; }
    joinRoom(`party_${party.id}`, `⚔️ ${party.members[0]?.username ?? "Party"}'s Party`);
  };

  const containerStyle: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, zIndex: 9800 }
    : { position: "fixed", bottom: isMobile ? "calc(56px + env(safe-area-inset-bottom) + 8px)" : 16, left: 16, zIndex: 9800 };

  // Drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = pillRef.current?.getBoundingClientRect();
    if (!rect) return;
    draggedRef.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = me.clientX - dragRef.current.startX;
      const dy = me.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggedRef.current = true;
      setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = pillRef.current?.getBoundingClientRect();
    if (!rect) return;
    draggedRef.current = false;
    dragRef.current = { startX: touch.clientX, startY: touch.clientY, origX: rect.left, origY: rect.top };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragRef.current.startX;
    const dy = touch.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggedRef.current = true;
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  };
  const onTouchEnd = () => { dragRef.current = null; };

  if (!session?.user) return null;

  const memberCount = party?.members.length ?? 0;

  return (
    <div ref={pillRef} style={containerStyle}>
      {/* Pill button */}
      <button
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (!draggedRef.current) setOpen(v => !v); draggedRef.current = false; }}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: party
            ? (isInVoice ? "linear-gradient(135deg,rgba(74,222,128,0.25),rgba(100,200,100,0.2))" : "rgba(8,14,24,0.93)")
            : "rgba(8,14,24,0.85)",
          border: `1px solid ${party ? (isInVoice ? "rgba(74,222,128,0.5)" : "rgba(100,200,100,0.4)") : "rgba(255,255,255,0.12)"}`,
          borderRadius: 50, padding: "8px 14px", cursor: "pointer",
          color: party ? "#66dd88" : "rgba(255,255,255,0.45)",
          fontSize: 13, fontWeight: 700, fontFamily: "monospace",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          touchAction: "none",
          whiteSpace: "nowrap",
        }}
      >
        {isInVoice && (
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", display: "inline-block", animation: "gpw-pulse 1.5s infinite" }} />
        )}
        <span>⚔️</span>
        {party ? (
          <span>{memberCount}/{party.maxSize} Party</span>
        ) : (
          <span>Party</span>
        )}
        {unread > 0 && (
          <span style={{ background: "#ff4444", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{unread}</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0,
          background: "rgba(8,14,24,0.97)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(100,200,100,0.25)", borderRadius: 14,
          padding: "12px", minWidth: 200, maxWidth: 260,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          fontFamily: "monospace",
          zIndex: 9801,
        }}>
          {party ? (
            <>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                ⚔️ Party · {memberCount}/{party.maxSize}
              </div>
              {party.members.map(m => (
                <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <img
                    src={m.avatarUrl || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${m.username}`}
                    alt={m.username}
                    style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: m.isLeader ? "1px solid #ffd700" : "1px solid rgba(255,255,255,0.15)" }}
                  />
                  <span style={{ fontSize: 12, color: m.isLeader ? "#ffd700" : "rgba(255,255,255,0.75)", fontWeight: m.isLeader ? 700 : 400 }}>
                    @{m.username}{m.userId === userId ? " (you)" : ""}{m.isLeader ? " 👑" : ""}
                  </span>
                </div>
              ))}

              {/* Voice button */}
              <button
                onClick={joinPartyVoice}
                style={{
                  width: "100%", marginTop: 8, padding: "7px 0",
                  background: isInVoice ? "rgba(74,222,128,0.15)" : "rgba(100,200,100,0.08)",
                  border: `1px solid ${isInVoice ? "rgba(74,222,128,0.4)" : "rgba(100,200,100,0.2)"}`,
                  borderRadius: 8, color: isInVoice ? "#4ade80" : "#66dd88",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
                }}
              >
                {isInVoice ? "🎙️ In Voice" : "🎙️ Join Party Voice"}
              </button>

              {/* Mute button when in voice */}
              {isInVoice && (
                <button
                  onClick={toggleMute}
                  style={{
                    width: "100%", marginTop: 4, padding: "6px 0",
                    background: isMuted ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isMuted ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 8, color: isMuted ? "#f87171" : "rgba(255,255,255,0.5)",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
                  }}
                >
                  {isMuted ? "🔇 Unmute" : "🎙️ Mute"}
                </button>
              )}

              {/* Party chat log */}
              <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>PARTY CHAT</div>
                <div style={{ maxHeight: 100, overflowY: "auto", fontSize: 11, lineHeight: 1.5, marginBottom: 6 }}>
                  {chatLog.length === 0 && (
                    <div style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>No messages yet…</div>
                  )}
                  {chatLog.map((m, i) => (
                    <div key={i}>
                      <span style={{ color: m.userId === userId ? "#66dd88" : "#a0b4ff", fontWeight: 700 }}>@{m.username}</span>
                      {" "}<span style={{ color: "rgba(255,255,255,0.55)", fontSize: 9 }}>[{m.area}]</span>
                      {" "}<span style={{ color: "rgba(255,255,255,0.85)" }}>{m.text}</span>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendPartyChat(); } }}
                    placeholder="Party chat…"
                    style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 8px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "monospace" }}
                  />
                  <button onClick={sendPartyChat} style={{ background: "rgba(100,200,100,0.15)", border: "1px solid rgba(100,200,100,0.3)", borderRadius: 7, padding: "5px 9px", color: "#66dd88", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>→</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  onClick={disbandOrLeave}
                  style={{ flex: 1, padding: "5px 0", background: "rgba(200,50,50,0.15)", border: "1px solid rgba(200,50,50,0.35)", borderRadius: 7, color: "#ff8888", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}
                >
                  {party.leaderId === userId ? "⚔️ Disband Party" : "🚪 Leave Party"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>No Party</div>
              <button
                onClick={createParty}
                style={{ width: "100%", padding: "8px 0", background: "rgba(100,200,100,0.12)", border: "1px solid rgba(100,200,100,0.3)", borderRadius: 8, color: "#66dd88", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}
              >
                ⚔️ Create Party
              </button>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 8, textAlign: "center", lineHeight: 1.4 }}>
                Invite friends from town or messages to start a party
              </p>
            </>
          )}
        </div>
      )}

      <style>{`@keyframes gpw-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
