"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/use-session";
import { useRouter, usePathname } from "next/navigation";
import { useVoice } from "./VoiceWidget";
import { useNotifications, type PushNotification } from "@/lib/useNotifications";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PartyMember { userId: string; username: string; avatarUrl: string; isLeader: boolean; }
interface Party { id: string; leaderId: string; leaderName: string; leaderAvatar: string; members: PartyMember[]; maxSize: number; }
interface PartyChatMsg { userId: string; username: string; text: string; area: string; ts: number; }
interface Friend { id: string; username: string; avatar_url: string | null; }
interface IncomingInvite { partyId: string; inviterName: string; inviterAvatar: string | null; }

const LS_KEY = "gs_party_id";

// ── Component ─────────────────────────────────────────────────────────────────

export default function GlobalPartyWidget() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { isInVoice, isMuted, toggleMute, openMaxi, joinRoom } = useVoice();
  const { onNotification, notifications } = useNotifications();

  const userId = (session?.user as { id?: string })?.id ?? "";
  const myUsername = (session?.user as { name?: string })?.name ?? "";

  // ── State ──────────────────────────────────────────────────────────────────
  const [party, setParty] = useState<Party | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"roster" | "chat">("roster");
  const [chatLog, setChatLog] = useState<PartyChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null);
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState(30);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const partyRef = useRef<Party | null>(null);
  const openRef = useRef(false);
  const wsRef = useRef<{ send: (d: string) => void; close: () => void } | null>(null);
  const handledInviteIds = useRef<Set<string>>(new Set());
  const prevPartyIdRef = useRef<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const draggedRef = useRef(false);

  useEffect(() => { partyRef.current = party; }, [party]);
  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // When leaving a party, un-block its partyId so future re-invites can show
  useEffect(() => {
    const prev = prevPartyIdRef.current;
    prevPartyIdRef.current = party?.id ?? null;
    if (prev && !party) {
      handledInviteIds.current.delete(prev);
      localStorage.removeItem(LS_KEY);
    }
    if (party?.id) localStorage.setItem(LS_KEY, party.id);
  }, [party]);

  // ── Initial load — DB read once, then WS takes over ──────────────────────
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;

    async function load() {
      let data = await fetch("/api/party?action=mine").then(r => r.json()).catch(() => ({}));
      if (!cancelled && data.party) { setParty(data.party); return; }

      const storedId = localStorage.getItem(LS_KEY);
      if (storedId) {
        data = await fetch(`/api/party?action=get&id=${storedId}`).then(r => r.json()).catch(() => ({}));
        if (!cancelled && data.party) { setParty(data.party); return; }
        if (!cancelled) localStorage.removeItem(LS_KEY);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [session]);

  // ── Periodic refresh — keep roster in sync even if WS misses a message ───
  useEffect(() => {
    if (!session?.user) return;
    const timer = setInterval(async () => {
      const data = await fetch("/api/party?action=mine").then(r => r.json()).catch(() => ({}));
      if (data.party) setParty(data.party);
      else if (partyRef.current) {
        const retry = await fetch("/api/party?action=mine").then(r => r.json()).catch(() => ({}));
        if (!retry.party) setParty(null);
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Party WebSocket — connects on partyId change ──────────────────────────
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
        const msg = JSON.parse(e.data) as Record<string, unknown>;
        switch (msg.type) {
          case "party_state":
            if (msg.party) setParty(msg.party as Party);
            break;
          case "member_left":
            setParty(prev => {
              if (!prev) return null;
              if (msg.userId === userId) return null;
              return { ...prev, members: prev.members.filter(m => m.userId !== msg.userId) };
            });
            break;
          case "party_disbanded":
            setParty(null);
            setOpen(false);
            break;
          case "party_chat": {
            const entry: PartyChatMsg = {
              userId: msg.userId as string,
              username: msg.username as string,
              text: msg.text as string,
              area: (msg.area as string) ?? "?",
              ts: (msg.ts as number) ?? Date.now(),
            };
            setChatLog(prev => [...prev.slice(-99), entry]);
            if (!openRef.current || tab !== "chat") setUnread(n => n + 1);
            setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            break;
          }
        }
      } catch { /* ignore */ }
    };

    wsRef.current = ws;
  }, [userId, tab]);

  useEffect(() => {
    if (party?.id) connectPartyWS(party.id);
    else { wsRef.current?.close(); wsRef.current = null; }
    return () => { wsRef.current?.close(); wsRef.current = null; };
  }, [party?.id, connectPartyWS]);

  useEffect(() => {
    if (open && tab === "chat") setUnread(0);
    if (open) setTimeout(() => chatBottomRef.current?.scrollIntoView(), 50);
  }, [open, tab]);

  // ── Party chat ─────────────────────────────────────────────────────────────
  const sendPartyChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text || !partyRef.current || !wsRef.current || !userId) return;
    const area = typeof window !== "undefined"
      ? (window.location.pathname.replace(/^\//, "") || "home")
      : "?";
    wsRef.current.send(JSON.stringify({ type: "party_chat", userId, username: myUsername, text, area, ts: Date.now() }));
    setChatLog(prev => [...prev.slice(-99), { userId, username: myUsername, text, area, ts: Date.now() }]);
    setChatInput("");
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [chatInput, userId, myUsername]);

  // ── Party API calls ────────────────────────────────────────────────────────
  const api = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch("/api/party", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    return r?.json().catch(() => ({})) ?? {};
  }, []);

  const createParty = async () => {
    const d = await api({ action: "create" });
    if (d.party) setParty(d.party);
  };

  const leaveOrDisband = async () => {
    if (!party) return;
    await api({ action: party.leaderId === userId ? "disband" : "leave" });
    setParty(null);
    setOpen(false);
  };

  const sendInvite = async (targetId: string) => {
    setInviteSentTo(targetId);
    await api({ action: "invite", targetId });
    setTimeout(() => { setInviteSentTo(null); setShowFriendPicker(false); }, 1500);
  };

  const kickMember = async (targetId: string) => {
    await api({ action: "kick", targetId });
    setParty(prev => prev ? { ...prev, members: prev.members.filter(m => m.userId !== targetId) } : null);
  };

  const promoteMember = async (targetId: string) => {
    await api({ action: "promote", targetId });
  };

  // Load friends when picker opens
  useEffect(() => {
    if (!showFriendPicker) return;
    fetch("/api/friends").then(r => r.json()).then((data: Friend[]) => {
      if (Array.isArray(data)) setFriends(data);
    }).catch(() => {});
  }, [showFriendPicker]);

  // ── Incoming invite ────────────────────────────────────────────────────────
  const dismissInvite = useCallback((partyId: string) => {
    handledInviteIds.current.add(partyId);
    setIncomingInvite(null);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsub = onNotification((n: PushNotification) => {
      const d = n as unknown as Record<string, unknown>;
      if (n.type === "party-invite" && d.partyId) {
        const pid = d.partyId as string;
        if (!handledInviteIds.current.has(pid) && partyRef.current?.id !== pid) {
          setIncomingInvite(prev =>
            prev?.partyId === pid ? prev
              : { partyId: pid, inviterName: (d.inviterName as string) ?? "Someone", inviterAvatar: (d.inviterAvatar as string | null) ?? null }
          );
        }
      }
      if (n.type === "party-kicked") {
        setParty(prev => prev?.id === (d.partyId as string) ? null : prev);
      }
    });
    return unsub;
  }, [userId, onNotification]);

  // Snapshot fallback — invites that arrived before WS connected
  useEffect(() => {
    if (incomingInvite) return;
    const recent = notifications.find(n => {
      const d = n as unknown as Record<string, unknown>;
      return n.type === "party-invite"
        && d.partyId
        && !handledInviteIds.current.has(d.partyId as string)
        && partyRef.current?.id !== d.partyId as string
        && n.ts && Date.now() - (n.ts as number) < 5 * 60 * 1000;
    });
    if (recent) {
      const d = recent as unknown as Record<string, unknown>;
      setIncomingInvite({ partyId: d.partyId as string, inviterName: (d.inviterName as string) ?? "Someone", inviterAvatar: (d.inviterAvatar as string | null) ?? null });
    }
  }, [notifications, incomingInvite]);

  // 30s auto-dismiss countdown
  useEffect(() => {
    if (!incomingInvite) { setInviteSecondsLeft(30); return; }
    setInviteSecondsLeft(30);
    const tick = setInterval(() => {
      setInviteSecondsLeft(s => {
        if (s <= 1) { clearInterval(tick); dismissInvite(incomingInvite.partyId); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [incomingInvite, dismissInvite]);

  const acceptInvite = async () => {
    if (!incomingInvite) return;
    const { partyId } = incomingInvite;
    setIncomingInvite(null);
    const d = await api({ action: "join", partyId });
    if (d.ok && d.party) {
      setParty(d.party);
      if (pathname === "/moonhaven") router.refresh();
    }
  };

  // ── Drag ──────────────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = pillRef.current?.getBoundingClientRect();
    if (!rect) return;
    draggedRef.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = me.clientX - dragRef.current.startX, dy = me.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggedRef.current = true;
      setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!session?.user) return null;

  const memberCount = party?.members.length ?? 0;
  const amLeader = party?.leaderId === userId;

  const containerStyle: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, zIndex: 9800 }
    : { position: "fixed", bottom: isMobile ? "calc(56px + env(safe-area-inset-bottom) + 8px)" : 16, left: 16, zIndex: 9800 };

  return (
    <div ref={pillRef} style={containerStyle}>

      {/* Pill */}
      <button
        onMouseDown={onMouseDown}
        onClick={() => { if (!draggedRef.current) setOpen(v => !v); draggedRef.current = false; }}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: party ? "rgba(8,14,24,0.93)" : "rgba(8,14,24,0.85)",
          border: `1px solid ${party ? (isInVoice ? "rgba(74,222,128,0.5)" : "rgba(100,200,100,0.4)") : "rgba(255,255,255,0.12)"}`,
          borderRadius: 50, padding: "8px 14px", cursor: "pointer",
          color: party ? "#66dd88" : "rgba(255,255,255,0.45)",
          fontSize: 13, fontWeight: 700, fontFamily: "monospace",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)", touchAction: "none", whiteSpace: "nowrap",
        }}
      >
        {isInVoice && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", animation: "gpw-pulse 1.5s infinite" }} />}
        <span>⚔️</span>
        <span>{party ? `${memberCount}/${party.maxSize} Party` : "Party"}</span>
        {unread > 0 && <span style={{ background: "#ff4444", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{unread}</span>}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0,
          background: "rgba(8,14,24,0.97)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(100,200,100,0.2)", borderRadius: 14,
          padding: 12, width: 260, boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          fontFamily: "monospace", zIndex: 9801,
        }}>
          {party ? (
            <>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                {(["roster", "chat"] as const).map(t => (
                  <button key={t} onClick={() => { setTab(t); if (t === "chat") setUnread(0); }} style={{
                    flex: 1, padding: "5px 0", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                    background: tab === t ? "rgba(100,200,100,0.15)" : "transparent",
                    border: `1px solid ${tab === t ? "rgba(100,200,100,0.35)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 7, color: tab === t ? "#66dd88" : "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "monospace",
                  }}>
                    {t === "chat" && unread > 0 ? `Chat (${unread})` : t === "roster" ? "⚔️ Roster" : "💬 Chat"}
                  </button>
                ))}
              </div>

              {/* ── ROSTER TAB ── */}
              {tab === "roster" && (
                <>
                  {/* Member list */}
                  <div style={{ marginBottom: 10 }}>
                    {party.members.map(m => (
                      <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                        <img
                          src={m.avatarUrl || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${m.username}`}
                          alt={m.username}
                          style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: m.isLeader ? "1px solid #ffd700" : "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}
                        />
                        <span style={{ flex: 1, fontSize: 12, color: m.isLeader ? "#ffd070" : "rgba(255,255,255,0.8)", fontWeight: m.isLeader ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          @{m.username}{m.userId === userId ? " (you)" : ""}{m.isLeader ? " 👑" : ""}
                        </span>
                        {amLeader && m.userId !== userId && (
                          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                            <button onClick={() => promoteMember(m.userId)} title="Make leader" style={{ background: "none", border: "1px solid rgba(255,215,0,0.25)", borderRadius: 4, padding: "1px 5px", color: "#ffd700", fontSize: 9, cursor: "pointer", fontFamily: "monospace" }}>👑</button>
                            <button onClick={() => kickMember(m.userId)} title="Kick" style={{ background: "none", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 4, padding: "1px 5px", color: "#f87171", fontSize: 9, cursor: "pointer", fontFamily: "monospace" }}>✕</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Voice */}
                  <button onClick={() => isInVoice ? openMaxi() : joinRoom(`party_${party.id}`, `⚔️ ${party.leaderName}'s Party`)} style={{
                    width: "100%", padding: "7px 0", marginBottom: 4,
                    background: isInVoice ? "rgba(74,222,128,0.15)" : "rgba(100,200,100,0.08)",
                    border: `1px solid ${isInVoice ? "rgba(74,222,128,0.4)" : "rgba(100,200,100,0.2)"}`,
                    borderRadius: 8, color: isInVoice ? "#4ade80" : "#66dd88",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
                  }}>
                    {isInVoice ? "🎙️ In Voice" : "🎙️ Join Party Voice"}
                  </button>
                  {isInVoice && (
                    <button onClick={toggleMute} style={{
                      width: "100%", padding: "6px 0", marginBottom: 4,
                      background: isMuted ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${isMuted ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: 8, color: isMuted ? "#f87171" : "rgba(255,255,255,0.5)",
                      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
                    }}>{isMuted ? "🔇 Unmute" : "🎙️ Mute"}</button>
                  )}

                  {/* Invite friend */}
                  {amLeader && memberCount < party.maxSize && (
                    <div style={{ marginTop: 8 }}>
                      <button onClick={() => { setShowFriendPicker(v => !v); setFriendSearch(""); }} style={{
                        width: "100%", padding: "6px 0",
                        background: showFriendPicker ? "rgba(160,180,255,0.15)" : "rgba(100,120,255,0.08)",
                        border: `1px solid ${showFriendPicker ? "rgba(160,180,255,0.4)" : "rgba(100,120,255,0.2)"}`,
                        borderRadius: 8, color: "#a0b4ff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
                      }}>👥 Invite Friend</button>
                      {showFriendPicker && (
                        <div style={{ marginTop: 5, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 7 }}>
                          <input
                            value={friendSearch}
                            onChange={e => setFriendSearch(e.target.value)}
                            placeholder="Search friends…"
                            style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "monospace", marginBottom: 4 }}
                          />
                          <div style={{ maxHeight: 110, overflowY: "auto" }}>
                            {friends
                              .filter(f => !party.members.some(m => m.userId === f.id) && (!friendSearch || f.username.toLowerCase().includes(friendSearch.toLowerCase())))
                              .map(f => (
                                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                  <img src={f.avatar_url || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${f.username}`} alt={f.username} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                                  <span style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{f.username}</span>
                                  <button onClick={() => sendInvite(f.id)} style={{
                                    padding: "2px 8px", fontSize: 10, fontWeight: 700,
                                    background: inviteSentTo === f.id ? "rgba(74,222,128,0.2)" : "rgba(100,200,100,0.15)",
                                    border: `1px solid ${inviteSentTo === f.id ? "rgba(74,222,128,0.5)" : "rgba(100,200,100,0.3)"}`,
                                    borderRadius: 5, color: inviteSentTo === f.id ? "#4ade80" : "#88dd99", cursor: "pointer", fontFamily: "monospace", flexShrink: 0,
                                  }}>{inviteSentTo === f.id ? "✓ Sent!" : "Invite"}</button>
                                </div>
                              ))}
                            {friends.filter(f => !party.members.some(m => m.userId === f.id)).length === 0 && (
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>All friends are in the party</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Leave / Disband */}
                  <button onClick={leaveOrDisband} style={{
                    width: "100%", marginTop: 8, padding: "5px 0",
                    background: "rgba(200,50,50,0.12)", border: "1px solid rgba(200,50,50,0.3)",
                    borderRadius: 7, color: "#ff8888", fontSize: 11, cursor: "pointer", fontFamily: "monospace",
                  }}>{amLeader ? "✕ Disband Party" : "🚪 Leave Party"}</button>
                </>
              )}

              {/* ── CHAT TAB ── */}
              {tab === "chat" && (
                <>
                  <div style={{ height: 180, overflowY: "auto", fontSize: 11, lineHeight: 1.6, marginBottom: 7 }}>
                    {chatLog.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>No messages yet…</div>}
                    {chatLog.map((m, i) => (
                      <div key={i}>
                        <span style={{ color: m.userId === userId ? "#66dd88" : "#a0b4ff", fontWeight: 700 }}>@{m.username}</span>
                        {" "}<span style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>[{m.area}]</span>
                        {" "}<span style={{ color: "rgba(255,255,255,0.8)" }}>{m.text}</span>
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
                    <button onClick={sendPartyChat} style={{ background: "rgba(100,200,100,0.15)", border: "1px solid rgba(100,200,100,0.3)", borderRadius: 7, padding: "5px 9px", color: "#66dd88", fontSize: 13, cursor: "pointer", fontFamily: "monospace" }}>→</button>
                  </div>
                </>
              )}
            </>
          ) : (
            /* No party */
            <>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>No Party</div>
              <button onClick={createParty} style={{
                width: "100%", padding: "9px 0",
                background: "rgba(100,200,100,0.12)", border: "1px solid rgba(100,200,100,0.3)",
                borderRadius: 8, color: "#66dd88", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
              }}>⚔️ Create Party</button>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>
                Invite friends to voice chat and play games together
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Incoming party invite ── */}
      {incomingInvite && (
        <div style={{
          position: "fixed", bottom: 90, left: 16, zIndex: 9900,
          background: "rgba(8,14,28,0.97)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(160,100,255,0.45)", borderRadius: 14,
          padding: "14px 16px", minWidth: 220, maxWidth: 260,
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)", fontFamily: "monospace",
          animation: "invite-slide-in 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Party Invite</div>
            <div style={{ fontSize: 11, color: inviteSecondsLeft <= 5 ? "#f87171" : "rgba(255,255,255,0.3)", fontWeight: 700 }}>{inviteSecondsLeft}s</div>
          </div>
          <div style={{ height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, width: `${(inviteSecondsLeft / 30) * 100}%`, background: inviteSecondsLeft <= 5 ? "#f87171" : inviteSecondsLeft <= 10 ? "#fbbf24" : "#4ade80", transition: "width 1s linear, background 0.3s" }} />
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

      <style>{`
        @keyframes gpw-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes invite-slide-in { 0%{transform:translateX(-110%) scale(0.9);opacity:0} 100%{transform:translateX(0) scale(1);opacity:1} }
      `}</style>
    </div>
  );
}
