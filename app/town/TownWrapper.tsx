"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";

const TownClient = dynamic(() => import("./TownClient"), { ssr: false, loading: () => (
  <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, background: "#0d1117" }}>
    <div style={{ fontSize: 36 }}>🏘️</div>
    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>Entering your adventure…</div>
  </div>
) });

const MoonhavenClient = dynamic(() => import("@/app/moonhaven/MoonhavenClient"), { ssr: false, loading: () => (
  <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, background: "#0a0a1a" }}>
    <div style={{ fontSize: 36 }}>🌙</div>
    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>Loading Moonhaven…</div>
  </div>
) });

interface PartyMember { userId: string; username: string; avatarUrl: string; isLeader: boolean }
interface Party {
  id: string;
  leaderId: string;
  leaderName: string;
  leaderAvatar: string;
  members: PartyMember[];
  maxSize: number;
}

type Phase = "loading" | "lobby" | "town";

export default function TownWrapper(props: { userId: string; username: string; avatarUrl: string }) {
  const [tab, setTab] = useState<"town" | "moonhaven">("town");
  const [moonhavenLoaded, setMoonhavenLoaded] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [myParty, setMyParty] = useState<Party | null>(null);
  const [joinableParties, setJoinableParties] = useState<Party[]>([]);
  const [showJoin, setShowJoin] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    // If arriving via invite link (?joinParty=ID), auto-join and skip lobby
    const urlPartyId = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("joinParty")
      : null;

    if (urlPartyId) {
      // Join the party, then go straight to town
      fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", partyId: urlPartyId }) })
        .then(r => r.json()).catch(() => ({ ok: false }))
        .then(async () => {
          const res = await fetch("/api/party?action=my-party").then(r => r.json()).catch(() => ({ party: null }));
          setMyParty(res.party ?? null);
          // Clean the URL param so refresh doesn't re-join
          window.history.replaceState({}, "", "/town");
          setPhase("town");
        });
      return;
    }

    // Resolve my-party first — unblocks the UI immediately
    fetch("/api/party?action=my-party").then(r => r.json()).catch(() => ({ party: null }))
      .then(mp => {
        const party = mp.party ?? null;
        setMyParty(party);
        setPhase(party ? "town" : "lobby");
      });
    // Load joinable parties in background — doesn't block loading
    fetch("/api/party?action=friend-parties").then(r => r.json()).catch(() => ({ parties: [] }))
      .then(fp => setJoinableParties(fp.parties ?? []));
  }, []);

  async function handleStart() {
    if (creating) return;
    setCreating(true);
    try {
      const r = await fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create" }) });
      const d = await r.json();
      if (d.ok || d.party) {
        setMyParty(d.party ?? null);
        setPhase("town");
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(partyId: string) {
    if (joiningId) return;
    setJoiningId(partyId);
    try {
      const r = await fetch("/api/party", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", partyId }) });
      const d = await r.json();
      if (d.ok || d.party) {
        const res = await fetch("/api/party?action=my-party");
        const md = await res.json();
        setMyParty(md.party ?? null);
        setPhase("town");
      } else {
        alert(d.error ?? "Could not join. Party may be full or closed.");
      }
    } finally {
      setJoiningId(null);
    }
  }

  const tabBar = (
    <div style={{ position: "fixed", top: 56, left: 0, right: 0, zIndex: 9200, display: "flex", background: "rgba(6,10,14,0.95)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(10px)" }}>
      {(["town", "moonhaven"] as const).map(t => (
        <button key={t} onClick={() => { setTab(t); if (t === "moonhaven") setMoonhavenLoaded(true); }}
          style={{ flex: 1, padding: "10px 0", border: "none", background: "transparent", cursor: "pointer", fontWeight: 700, fontSize: 13, letterSpacing: 0.5,
            color: tab === t ? "#88ff99" : "rgba(255,255,255,0.4)",
            borderBottom: tab === t ? "2px solid #88ff99" : "2px solid transparent",
            transition: "color 0.15s, border-color 0.15s" }}>
          {t === "town" ? "🏘️ Town" : "🌙 Moonhaven"}
        </button>
      ))}
    </div>
  );

  if (phase === "loading") {
    return (
      <>
        {tabBar}
        <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#060a0e" }}>
          <div style={{ fontSize: 32, animation: "pulse 1.2s ease-in-out infinite", opacity: 0.7 }}>⚔️</div>
          <style>{`@keyframes pulse { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }`}</style>
        </div>
      </>
    );
  }

  if (phase === "town") {
    if (tab === "moonhaven") return <>{tabBar}<MoonhavenClient {...props} /></>;
    return <>{tabBar}<TownClient {...props} partyId={myParty?.id ?? null} /></>;
  }

  // LOBBY
  if (tab === "moonhaven") return <>{tabBar}<MoonhavenClient {...props} /></>;

  return (
    <>
    {tabBar}
    <div style={{
      minHeight: "100dvh",
      background: "radial-gradient(ellipse at 50% 0%, rgba(20,50,30,0.5) 0%, #060a0e 60%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "80px 16px 20px", fontFamily: "monospace",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 100%, rgba(40,120,60,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Crest */}
      <div style={{ fontSize: 56, marginBottom: 10, filter: "drop-shadow(0 0 30px rgba(80,220,80,0.3))", userSelect: "none" }}>⚔️</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#88ff99", letterSpacing: 4, marginBottom: 6, textShadow: "0 0 20px rgba(80,200,80,0.4)" }}>
        KINGDOM OF FLOCK
      </div>
      <div style={{ fontSize: 12, color: "rgba(100,180,100,0.5)", marginBottom: 48, letterSpacing: 1 }}>
        What will you do today?
      </div>

      <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* START AN ADVENTURE — Primary CTA */}
        <button
          onClick={handleStart}
          disabled={creating}
          onMouseEnter={() => setHoveredBtn("start")}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{
            width: "100%", padding: "18px 0",
            background: hoveredBtn === "start"
              ? "linear-gradient(135deg, rgba(60,200,80,0.35), rgba(30,150,60,0.35))"
              : "linear-gradient(135deg, rgba(40,160,60,0.25), rgba(20,100,40,0.25))",
            border: "1.5px solid rgba(80,220,100,0.55)",
            borderRadius: 14, color: "#66ff88", fontSize: 16, cursor: creating ? "not-allowed" : "pointer",
            fontWeight: 800, letterSpacing: 2, transition: "all 0.18s ease",
            boxShadow: hoveredBtn === "start" ? "0 4px 24px rgba(40,200,60,0.2)" : "none",
            opacity: creating ? 0.6 : 1,
            fontFamily: "monospace",
          }}
        >
          {creating ? "⌛ Starting…" : "🗡️ Start an Adventure"}
        </button>
        <div style={{ fontSize: 10, color: "rgba(80,160,80,0.5)", textAlign: "center", marginTop: -8, letterSpacing: 0.5 }}>
          Host your own party — friends can join you
        </div>

        {/* JOIN AN ADVENTURE — Secondary CTA */}
        <button
          onClick={() => setShowJoin(v => !v)}
          onMouseEnter={() => setHoveredBtn("join")}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{
            width: "100%", padding: "16px 0", marginTop: 4,
            background: hoveredBtn === "join"
              ? "rgba(255,255,255,0.07)"
              : "rgba(255,255,255,0.03)",
            border: "1.5px solid rgba(255,255,255,0.15)",
            borderRadius: 14, color: "rgba(255,255,255,0.75)", fontSize: 15,
            cursor: "pointer", fontWeight: 700, letterSpacing: 1,
            transition: "all 0.18s ease", fontFamily: "monospace",
          }}
        >
          🤝 Join an Adventure
          <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.5, display: "inline-block", transform: showJoin ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
        </button>
        <div style={{ fontSize: 10, color: "rgba(120,120,120,0.5)", textAlign: "center", marginTop: -8, letterSpacing: 0.5 }}>
          Join a friend's party via invite link
        </div>

        {/* Join panel */}
        {showJoin && (
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "14px 16px", marginTop: -4,
          }}>
            {joinableParties.length === 0 ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                  No open parties from friends right now.<br />
                  Ask a friend to send you an invite link, or start your own!
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 10 }}>FRIEND PARTIES</div>
                {joinableParties.map(p => (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
                    background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    {p.leaderAvatar
                      ? <img src={p.leaderAvatar} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,215,0,0.3)" }} />
                      : <span style={{ fontSize: 22 }}>👑</span>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#fff", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.leaderName}&apos;s Adventure
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                        {p.members.length}/{p.maxSize} adventurers
                      </div>
                    </div>
                    {p.members.length < p.maxSize && (
                      <button
                        onClick={() => handleJoin(p.id)}
                        disabled={!!joiningId}
                        style={{
                          padding: "6px 14px", background: "rgba(80,200,100,0.15)",
                          border: "1px solid rgba(80,200,100,0.4)", borderRadius: 8,
                          color: "#66dd88", fontSize: 12, cursor: "pointer", fontWeight: 700,
                          opacity: joiningId === p.id ? 0.5 : 1, fontFamily: "monospace",
                        }}
                      >
                        {joiningId === p.id ? "…" : "Join"}
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

      </div>

      <div style={{ position: "absolute", bottom: 24, fontSize: 10, color: "rgba(255,255,255,0.15)", letterSpacing: 1 }}>
        RYFT · KINGDOM OF FLOCK
      </div>
    </div>
    </>
  );
}
