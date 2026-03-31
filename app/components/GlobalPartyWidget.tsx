"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/use-session";
import { useRouter, usePathname } from "next/navigation";
import { useVoice } from "./VoiceWidget";
import { useNotifications, type PushNotification } from "@/lib/useNotifications";

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

interface Friend { id: string; username: string; avatar_url: string | null; }
interface IncomingPartyInvite { partyId: string; inviterName: string; inviterAvatar: string | null; }

export default function GlobalPartyWidget() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { isInVoice, isMuted, toggleMute, openMaxi, joinRoom, leaveRoom, currentRoomId } = useVoice();
  const { onNotification, notifications } = useNotifications();
  const [party, setParty] = useState<Party | null>(null);
  const [open, setOpen] = useState(false);
  const [chatLog, setChatLog] = useState<PartyChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<IncomingPartyInvite | null>(null);
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState(30);
  // Track partyIds that have been acted on (joined, declined, expired) so snapshot fallback won't re-show them
  const handledInviteIds = useRef<Set<string>>(new Set());
  const [moonhavenPull, setMoonhavenPull] = useState<{ leaderName: string } | null>(null);
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

  const transferLead = async (targetId: string) => {
    if (!party) return;
    await fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "transfer-lead", targetId }) });
    // Party will refresh via WS party_membership event
  };

  const createParty = async () => {
    const r = await fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create" }) });
    const d = await r.json();
    if (d.party) setParty(d.party);
  };

  // Send a party invite to a friend
  const sendInvite = async (targetId: string) => {
    if (!party) return;
    setInviteSentTo(targetId);
    await fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invite", targetId }) }).catch(() => {});
    setTimeout(() => { setInviteSentTo(null); setShowInvite(false); }, 1500);
  };

  // Load friends list when invite panel opens
  useEffect(() => {
    if (!showInvite) return;
    fetch("/api/friends").then(r => r.json()).then((data: Friend[]) => {
      if (Array.isArray(data)) setFriends(data);
    }).catch(() => {});
  }, [showInvite]);

  // Dismiss an invite permanently (decline, expire, or accept) — prevents snapshot fallback from re-showing it
  const dismissInvite = useCallback((partyId: string) => {
    handledInviteIds.current.add(partyId);
    setIncomingInvite(null);
  }, []);

  // Listen for incoming party invites + moonhaven-pull via real-time callback
  useEffect(() => {
    if (!userId) return;
    const unsub = onNotification((n: PushNotification) => {
      const d = n as unknown as Record<string, unknown>;
      if (n.type === "party-invite" && d.partyId) {
        const pid = d.partyId as string;
        if (!handledInviteIds.current.has(pid)) {
          setIncomingInvite(prev => prev?.partyId === pid ? prev : { partyId: pid, inviterName: (d.inviterName as string) ?? "Someone", inviterAvatar: (d.inviterAvatar as string | null) ?? null });
        }
      }
      if (n.type === "moonhaven-pull") {
        setMoonhavenPull({ leaderName: (d.leaderName as string) ?? "Your leader" });
      }
    });
    return unsub;
  }, [userId, onNotification]);

  // Catch party invites that arrived as snapshot (queued before WS connected + callback registered)
  useEffect(() => {
    if (incomingInvite) return; // already have one showing
    const recent = notifications.find(n => {
      const d = n as unknown as Record<string, unknown>;
      return n.type === "party-invite" && d.partyId
        && !handledInviteIds.current.has(d.partyId as string)
        && n.ts && Date.now() - (n.ts as number) < 5 * 60 * 1000;
    });
    if (recent) {
      const d = recent as unknown as Record<string, unknown>;
      setIncomingInvite({ partyId: d.partyId as string, inviterName: (d.inviterName as string) ?? "Someone", inviterAvatar: (d.inviterAvatar as string | null) ?? null });
    }
  }, [notifications, incomingInvite]);

  // Auto-dismiss invite after 30 s + countdown ticker (no DB calls)
  useEffect(() => {
    if (!incomingInvite) { setInviteSecondsLeft(30); return; }
    setInviteSecondsLeft(30);
    const tick = setInterval(() => {
      setInviteSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(tick);
          dismissInvite(incomingInvite.partyId); // mark handled so it won't re-show
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [incomingInvite, dismissInvite]);

  // Accept incoming party invite
  const acceptInvite = async () => {
    if (!incomingInvite) return;
    const partyId = incomingInvite.partyId;
    dismissInvite(partyId); // mark handled immediately so no re-show on any path
    const r = await fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", partyId }) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (d?.ok || d?.party) {
      const fresh = await fetch("/api/party?action=my-party").then(r2 => r2.json()).catch(() => ({}));
      setParty(fresh.party ?? null);
      if (pathname === "/moonhaven") { router.refresh(); return; }
    }
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
                  <span style={{ flex: 1, fontSize: 12, color: m.isLeader ? "#ffd700" : "rgba(255,255,255,0.75)", fontWeight: m.isLeader ? 700 : 400 }}>
                    @{m.username}{m.userId === userId ? " (you)" : ""}{m.isLeader ? " 👑" : ""}
                  </span>
                  {party.leaderId === userId && !m.isLeader && (
                    <button
                      onClick={() => transferLead(m.userId)}
                      title="Make party leader"
                      style={{ background: "none", border: "1px solid rgba(255,215,0,0.25)", borderRadius: 5, padding: "1px 5px", color: "#ffd700", fontSize: 10, cursor: "pointer", fontFamily: "monospace", flexShrink: 0 }}
                    >
                      👑
                    </button>
                  )}
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

              {/* Invite button (leader only, party not full) */}
              {party.leaderId === userId && party.members.length < party.maxSize && (
                <button
                  onClick={() => { setShowInvite(v => !v); setInviteSearch(""); }}
                  style={{
                    width: "100%", marginTop: 4, padding: "6px 0",
                    background: showInvite ? "rgba(160,180,255,0.15)" : "rgba(100,120,255,0.08)",
                    border: `1px solid ${showInvite ? "rgba(160,180,255,0.4)" : "rgba(100,120,255,0.2)"}`,
                    borderRadius: 8, color: "#a0b4ff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
                  }}
                >
                  👥 Invite Friend
                </button>
              )}

              {/* Friend picker */}
              {showInvite && (
                <div style={{ marginTop: 6, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 8 }}>
                  <input
                    value={inviteSearch}
                    onChange={e => setInviteSearch(e.target.value)}
                    placeholder="Search friends…"
                    style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "monospace", marginBottom: 4 }}
                  />
                  <div style={{ maxHeight: 120, overflowY: "auto" }}>
                    {friends
                      .filter(f => !party.members.some(m => m.userId === f.id) && (!inviteSearch || f.username.toLowerCase().includes(inviteSearch.toLowerCase())))
                      .map(f => (
                        <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <img src={f.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${f.username}`} alt={f.username} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                          <span style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.75)" }}>@{f.username}</span>
                          <button
                            onClick={() => sendInvite(f.id)}
                            style={{
                              padding: "2px 8px", fontSize: 10, fontWeight: 700,
                              background: inviteSentTo === f.id ? "rgba(74,222,128,0.2)" : "rgba(100,200,100,0.15)",
                              border: `1px solid ${inviteSentTo === f.id ? "rgba(74,222,128,0.5)" : "rgba(100,200,100,0.35)"}`,
                              borderRadius: 5, color: inviteSentTo === f.id ? "#4ade80" : "#88dd99", cursor: "pointer", fontFamily: "monospace",
                            }}
                          >{inviteSentTo === f.id ? "✓ Sent!" : "Invite"}</button>
                        </div>
                      ))
                    }
                    {friends.filter(f => !party.members.some(m => m.userId === f.id)).length === 0 && (
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>All friends are in party</div>
                    )}
                  </div>
                </div>
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

      {/* Incoming party invite popup */}
      {incomingInvite && (
        <div style={{
          position: "fixed", bottom: 90, left: 16, zIndex: 9900,
          background: "rgba(8,14,28,0.97)", backdropFilter: "blur(14px)",
          animation: "invite-slide-in 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          border: "1px solid rgba(160,100,255,0.45)", borderRadius: 14,
          padding: "14px 16px", minWidth: 220, maxWidth: 260,
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)", fontFamily: "monospace",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Party Invite!</div>
            <div style={{ fontSize: 11, color: inviteSecondsLeft <= 5 ? "#f87171" : "rgba(255,255,255,0.3)", fontWeight: 700, fontFamily: "monospace" }}>{inviteSecondsLeft}s</div>
          </div>
          {/* Countdown progress bar */}
          <div style={{ height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${(inviteSecondsLeft / 30) * 100}%`,
              background: inviteSecondsLeft <= 5 ? "#f87171" : inviteSecondsLeft <= 10 ? "#fbbf24" : "#4ade80",
              transition: "width 1s linear, background 0.3s",
            }} />
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 12 }}>
            <span style={{ color: "#ffd070", fontWeight: 700 }}>@{incomingInvite.inviterName}</span> wants you in their party!
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={acceptInvite} style={{ flex: 1, padding: "6px 0", background: "rgba(100,200,100,0.15)", border: "1px solid rgba(100,200,100,0.4)", borderRadius: 8, color: "#4ade80", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}>⚔️ Join</button>
            <button onClick={() => dismissInvite(incomingInvite.partyId)} style={{ flex: 1, padding: "6px 0", background: "rgba(200,50,50,0.1)", border: "1px solid rgba(200,50,50,0.3)", borderRadius: 8, color: "#f87171", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>Decline</button>
          </div>
        </div>
      )}

      {/* Moonhaven pull popup */}
      {moonhavenPull && (
        <div style={{
          position: "fixed", bottom: incomingInvite ? 180 : 90, left: 16, zIndex: 9900,
          background: "rgba(8,14,28,0.97)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(100,80,220,0.4)", borderRadius: 14,
          padding: "14px 16px", minWidth: 220, maxWidth: 280,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)", fontFamily: "monospace",
        }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>🌙 Moonhaven</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 12 }}>
            <span style={{ color: "#c4b5ff", fontWeight: 700 }}>@{moonhavenPull.leaderName}</span> entered Moonhaven — join your party?
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => { setMoonhavenPull(null); router.push("/moonhaven"); }}
              style={{ flex: 1, padding: "6px 0", background: "rgba(100,80,220,0.2)", border: "1px solid rgba(130,110,255,0.5)", borderRadius: 8, color: "#c4b5ff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}
            >🌙 Enter</button>
            <button
              onClick={() => setMoonhavenPull(null)}
              style={{ flex: 1, padding: "6px 0", background: "rgba(200,50,50,0.1)", border: "1px solid rgba(200,50,50,0.3)", borderRadius: 8, color: "#f87171", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}
            >Later</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes gpw-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes invite-slide-in { 0%{transform:translateX(-110%) scale(0.9);opacity:0} 100%{transform:translateX(0) scale(1);opacity:1} }
      `}</style>
    </div>
  );
}
