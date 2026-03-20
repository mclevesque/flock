"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface FriendUser {
  id: string; username: string; display_name: string; avatar_url: string;
  is_online?: boolean; last_seen?: string | null;
}

function OnlineDot({ online }: { online?: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 10, height: 10, borderRadius: "50%",
      background: online ? "#4ade80" : "rgba(255,255,255,0.2)",
      border: `2px solid ${online ? "#0d0f14" : "rgba(255,255,255,0.08)"}`,
      flexShrink: 0,
    }} />
  );
}

function UserRow({ u, actions, showOnline }: { u: FriendUser; actions: React.ReactNode; showOnline?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Link href={`/profile/${u.username}`}>
          <img
            src={`/api/avatar/${u.id}?v=2`}
            alt={u.username}
            style={{ width: 38, height: 38, borderRadius: 10, display: "block" }}
          />
        </Link>
        {showOnline && (
          <span style={{
            position: "absolute", bottom: -1, right: -1,
            width: 11, height: 11, borderRadius: "50%",
            background: u.is_online ? "#4ade80" : "rgba(120,120,140,0.7)",
            border: "2px solid var(--bg-surface)",
          }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/profile/${u.username}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textDecoration: "none" }}>
          {u.display_name || u.username}
        </Link>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          @{u.username}
          {showOnline && (
            <span style={{ marginLeft: 6, color: u.is_online ? "#4ade80" : "var(--text-muted)" }}>
              {u.is_online ? "● Online" : u.last_seen ? `Last seen ${timeAgo(u.last_seen)}` : "● Offline"}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>{actions}</div>
    </div>
  );
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FriendsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<FriendUser[]>([]);
  const [outgoing, setOutgoing] = useState<FriendUser[]>([]);
  const [suggested, setSuggested] = useState<FriendUser[]>([]);
  const [addInput, setAddInput] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  const load = useCallback(() => {
    fetch("/api/friends").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setFriends(d);
    }).catch(() => {});
    fetch("/api/friend-requests").then(r => r.json()).then(d => {
      if (d.incoming) setIncoming(d.incoming);
      if (d.outgoing) setOutgoing(d.outgoing);
      if (d.suggested) setSuggested(d.suggested);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-poll online status every 30s
  useEffect(() => {
    const iv = setInterval(() => {
      fetch("/api/friends").then(r => r.json()).then(d => {
        if (Array.isArray(d)) setFriends(d);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  async function act(action: string, targetId: string, requesterId?: string) {
    setBusy(b => ({ ...b, [targetId]: true }));
    await fetch("/api/friend-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetId, requesterId }),
    });
    load();
    setBusy(b => ({ ...b, [targetId]: false }));
  }

  async function sendByUsername() {
    if (!addInput.trim()) return;
    setAddLoading(true); setAddMsg("");
    const res = await fetch("/api/friend-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", targetUsername: addInput.trim() }),
    });
    const d = await res.json();
    setAddMsg(d.error ?? "Friend request sent!");
    if (!d.error) { setAddInput(""); load(); }
    setAddLoading(false);
  }

  const btn = (label: string, onClick: () => void, variant: "primary" | "ghost" | "danger" = "ghost", disabled = false) => (
    <button onClick={onClick} disabled={disabled} style={{
      background: variant === "primary" ? "var(--accent-purple)" : variant === "danger" ? "rgba(191,92,92,0.15)" : "transparent",
      color: variant === "primary" ? "#fff" : variant === "danger" ? "#f08080" : "var(--text-secondary)",
      border: `1px solid ${variant === "primary" ? "var(--accent-purple)" : variant === "danger" ? "rgba(191,92,92,0.4)" : "var(--border)"}`,
      borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 700,
      cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap",
    }}>{label}</button>
  );

  if (status === "loading") return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-muted)" }}>Loading...</div>;

  const onlineCount = friends.filter(f => f.is_online).length;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px 80px" }}>
      <h1 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 800 }}>Friends</h1>

      {/* Your Friends */}
      <div className="panel" style={{ padding: 18, marginBottom: 16 }}>
        <div className="panel-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span>
            Your Friends
            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>
              {friends.length} total · <span style={{ color: "#4ade80" }}>{onlineCount} online</span>
            </span>
          </span>
        </div>
        {friends.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0" }}>No friends yet — add some!</div>
        ) : (
          <div>
            {[...friends.filter(f => f.is_online), ...friends.filter(f => !f.is_online)].map(u => (
              <UserRow key={u.id} u={u} showOnline actions={
                <Link href={`/messages?with=${u.id}`} style={{
                  background: "rgba(124,92,191,0.15)", border: "1px solid rgba(124,92,191,0.3)",
                  borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700,
                  color: "var(--accent-purple-bright)", textDecoration: "none",
                }}>💬 DM</Link>
              } />
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Add by username */}
          <div className="panel" style={{ padding: 18 }}>
            <div className="panel-header" style={{ marginBottom: 12 }}>Add Friend</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={addInput}
                onChange={e => setAddInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendByUsername(); } }}
                placeholder="Enter username..."
                style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" }}
              />
              <button onClick={sendByUsername} disabled={addLoading || !addInput.trim()} style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {addLoading ? "..." : "Add"}
              </button>
            </div>
            {addMsg && (
              <div style={{ fontSize: 12, marginTop: 8, color: addMsg.includes("sent") ? "var(--accent-green, #4ad990)" : "#f08080" }}>
                {addMsg}
              </div>
            )}
          </div>

          {/* Incoming requests */}
          <div className="panel" style={{ padding: 18 }}>
            <div className="panel-header" style={{ marginBottom: 4 }}>
              Incoming Requests
              {incoming.length > 0 && (
                <span style={{ marginLeft: 8, background: "var(--accent-purple)", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{incoming.length}</span>
              )}
            </div>
            {incoming.length === 0
              ? <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "10px 0" }}>No pending requests</div>
              : incoming.map(u => <UserRow key={u.id} u={u} actions={<>
                  {btn("Accept", () => act("accept", u.id, u.id), "primary", busy[u.id])}
                  {btn("Decline", () => act("decline", u.id, u.id), "danger", busy[u.id])}
                </>} />)
            }
          </div>

          {/* Outgoing requests */}
          <div className="panel" style={{ padding: 18 }}>
            <div className="panel-header" style={{ marginBottom: 4 }}>Sent Requests</div>
            {outgoing.length === 0
              ? <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "10px 0" }}>No pending outgoing requests</div>
              : outgoing.map(u => <UserRow key={u.id} u={u} actions={<>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Pending</span>
                  {btn("Cancel", () => act("cancel", u.id), "danger", busy[u.id])}
                </>} />)
            }
          </div>
        </div>

        {/* Right column: Suggested */}
        <div className="panel" style={{ padding: 18 }}>
          <div className="panel-header" style={{ marginBottom: 4 }}>People You May Know</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>New members on FLOCK</div>
          {suggested.length === 0
            ? <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "10px 0" }}>No suggestions right now</div>
            : suggested.map(u => <UserRow key={u.id} u={u} actions={
                btn(busy[u.id] ? "..." : "Add Friend", () => act("send", u.id), "primary", busy[u.id])
              } />)
          }
        </div>
      </div>
    </div>
  );
}
