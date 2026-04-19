"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

interface Clip {
  id: string;
  user_id: string;
  side: "a" | "b";
  round_no: number;
  url: string;
  duration_ms: number;
  transcript: string;
  created_at: string;
}

interface Debate {
  id: string;
  custom_title: string | null;
  category: string | null;
  side_a_label: string;
  side_b_label: string;
  user_a: string;
  user_b: string | null;
  status: "open" | "active" | "voting" | "closed";
  round_limit: number;
  clip_len_s: number;
  current_round: number;
  current_turn: "a" | "b";
  voting_ends_at: string | null;
  winner_side: string | null;
  a_username: string;
  a_avatar: string | null;
  b_username: string | null;
  b_avatar: string | null;
}

interface Verdict {
  debate_id: string;
  ai_winner: string;
  score_a: number;
  score_b: number;
  roast_line: string;
  reasoning: string;
}

interface Payload {
  debate: Debate;
  clips: Clip[];
  votes: { a: number; b: number };
  myVote: string | null;
  verdict: Verdict | null;
  sessionUserId: string | null;
}

export default function DebateRoomClient({ debateId, sessionUserId }: { debateId: string; sessionUserId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/debate/${debateId}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [debateId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!data) return;
    if (data.debate.status === "closed") return; // stop polling once final
    const t = setInterval(refresh, data.debate.status === "active" ? 5000 : 12000);
    return () => clearInterval(t);
  }, [data, refresh]);

  // Trigger verdict generation once voting has started and we don't have one yet.
  useEffect(() => {
    if (!data) return;
    const { debate, verdict } = data;
    if ((debate.status === "voting" || debate.status === "closed") && !verdict) {
      fetch(`/api/debate/${debateId}/verdict`, { method: "POST" })
        .then(r => { if (r.ok) refresh(); })
        .catch(() => {});
    }
  }, [data, debateId, refresh]);

  if (loading || !data) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-primary)" }}>Loading…</div>;
  }

  const { debate, clips, votes, myVote, verdict } = data;
  const mySide: "a" | "b" | null =
    debate.user_a === sessionUserId ? "a" :
    debate.user_b === sessionUserId ? "b" : null;
  const itsMyTurn = debate.status === "active" && debate.current_turn === mySide && (
    // a goes first each round; b responds. make sure we haven't already dropped this round's clip.
    !clips.some(c => c.round_no === debate.current_round && c.side === mySide)
  );

  return (
    <div style={{
      minHeight: "100vh",
      padding: "max(12px, env(safe-area-inset-top)) 14px 160px",
      background: "var(--bg, #0f0d0a)",
      color: "var(--text-primary, #e8dcc8)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Link href="/debate" style={{ color: "inherit", textDecoration: "none", fontSize: 22 }}>←</Link>
        <StatusPill status={debate.status} />
      </div>

      <h1 style={{ fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 800, lineHeight: 1.25, margin: "4px 0 14px" }}>
        {debate.custom_title ?? "Debate"}
      </h1>

      <SideHeader debate={debate} />

      {debate.status === "open" && (
        <OpenState debate={debate} sessionUserId={sessionUserId} onUpdate={refresh} />
      )}

      {debate.status === "active" && (
        <ActiveState
          debate={debate}
          clips={clips}
          mySide={mySide}
          itsMyTurn={itsMyTurn}
          onUpdate={refresh}
        />
      )}

      {(debate.status === "voting" || debate.status === "closed") && (
        <VerdictState
          debate={debate}
          clips={clips}
          votes={votes}
          myVote={myVote}
          verdict={verdict}
          sessionUserId={sessionUserId}
          onUpdate={refresh}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, [string, string]> = {
    open: ["rgba(80,180,80,0.2)", "#8fe18f"],
    active: ["rgba(212,169,66,0.25)", "var(--accent-purple-bright, #e8c05a)"],
    voting: ["rgba(100,140,240,0.2)", "#a9c0ff"],
    closed: ["rgba(255,255,255,0.1)", "rgba(232,220,200,0.8)"],
  };
  const [bg, fg] = colors[status] ?? colors.closed;
  const label = status === "active" ? "Live debate" : status.charAt(0).toUpperCase() + status.slice(1);
  return <span style={{ padding: "4px 10px", borderRadius: 999, background: bg, color: fg, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>;
}

function SideHeader({ debate }: { debate: Debate }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <SideCard label={debate.side_a_label} user={debate.a_username} avatar={debate.a_avatar} />
      <div style={{ fontSize: 11, opacity: 0.5, fontWeight: 700 }}>VS</div>
      <SideCard
        label={debate.side_b_label}
        user={debate.b_username}
        avatar={debate.b_avatar}
        placeholder={!debate.user_b}
      />
    </div>
  );
}

function SideCard({ label, user, avatar, placeholder }: { label: string; user: string | null; avatar: string | null; placeholder?: boolean }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      padding: 10, borderRadius: 12,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid " + (placeholder ? "rgba(212,169,66,0.5)" : "rgba(255,255,255,0.08)"),
      borderStyle: placeholder ? "dashed" : "solid",
      textAlign: "center",
    }}>
      {avatar
        ? <img src={avatar} alt="" style={{ width: 36, height: 36, borderRadius: 18, objectFit: "cover", margin: "0 auto 6px", display: "block" }} />
        : <div style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.1)", margin: "0 auto 6px" }} />}
      <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{user ? `@${user}` : "waiting…"}</div>
    </div>
  );
}

function OpenState({ debate, sessionUserId, onUpdate }: { debate: Debate; sessionUserId: string; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isCreator = debate.user_a === sessionUserId;

  async function act(action: "accept" | "cancel") {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/debate/${debate.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) setErr(data.error ?? "Failed");
    setBusy(false);
    onUpdate();
  }

  return (
    <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {isCreator ? (
        <>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
            Waiting for someone to take the other side. Share this page — anyone logged in can accept from the lobby.
          </p>
          <button onClick={() => act("cancel")} disabled={busy} style={{
            marginTop: 14, padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent", color: "inherit", fontSize: 13, cursor: "pointer",
          }}>Cancel debate</button>
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
            Accept this challenge to take the <b>{debate.side_b_label}</b> side. Rounds: {debate.round_limit}, {debate.clip_len_s}s per clip.
          </p>
          <button onClick={() => act("accept")} disabled={busy} style={{
            marginTop: 14, width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
            background: "var(--accent-purple, #d4a942)", color: "#1a1408", fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}>
            {busy ? "…" : `Accept — argue ${debate.side_b_label}`}
          </button>
        </>
      )}
      {err && <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 10 }}>{err}</div>}
    </div>
  );
}

function ActiveState({ debate, clips, mySide, itsMyTurn, onUpdate }: {
  debate: Debate; clips: Clip[]; mySide: "a" | "b" | null; itsMyTurn: boolean; onUpdate: () => void;
}) {
  return (
    <>
      <TurnBanner debate={debate} mySide={mySide} itsMyTurn={itsMyTurn} />
      <RoundList clips={clips} debate={debate} />
      {itsMyTurn && <Recorder debate={debate} mySide={mySide!} onUploaded={onUpdate} />}
      {mySide && !itsMyTurn && (
        <div style={{ padding: 16, textAlign: "center", opacity: 0.7, fontSize: 13 }}>
          Waiting for the other side's clip…
        </div>
      )}
      {!mySide && (
        <div style={{ padding: 16, textAlign: "center", opacity: 0.7, fontSize: 13 }}>
          Spectating. Voting opens when the final clip drops.
        </div>
      )}
    </>
  );
}

function TurnBanner({ debate, mySide, itsMyTurn }: { debate: Debate; mySide: "a" | "b" | null; itsMyTurn: boolean }) {
  const turnUser = debate.current_turn === "a" ? debate.a_username : debate.b_username;
  const turnLabel = debate.current_turn === "a" ? debate.side_a_label : debate.side_b_label;
  return (
    <div style={{
      padding: 12, borderRadius: 12, marginBottom: 12,
      background: itsMyTurn ? "rgba(212,169,66,0.18)" : "rgba(255,255,255,0.04)",
      border: "1px solid " + (itsMyTurn ? "var(--accent-purple, #d4a942)" : "rgba(255,255,255,0.08)"),
      textAlign: "center",
    }}>
      <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5 }}>
        Round {debate.current_round} of {debate.round_limit}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
        {itsMyTurn
          ? `Your turn — argue ${mySide === "a" ? debate.side_a_label : debate.side_b_label}`
          : `Waiting on @${turnUser} (${turnLabel})`}
      </div>
    </div>
  );
}

function RoundList({ clips, debate }: { clips: Clip[]; debate: Debate }) {
  if (clips.length === 0) {
    return <div style={{ padding: 20, textAlign: "center", opacity: 0.5, fontSize: 13 }}>No clips yet. First opener drops next.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
      {clips.map(c => (
        <div key={c.id} style={{
          padding: 10, borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderLeft: `4px solid ${c.side === "a" ? "var(--accent-purple, #d4a942)" : "#8db0ff"}`,
        }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
            Round {c.round_no} · {c.side === "a" ? debate.side_a_label : debate.side_b_label}
          </div>
          <audio controls src={c.url} style={{ width: "100%", height: 36 }} preload="metadata" />
          {c.transcript && (
            <details style={{ marginTop: 6 }}>
              <summary style={{ fontSize: 11, opacity: 0.6, cursor: "pointer" }}>Transcript</summary>
              <p style={{ fontSize: 12, opacity: 0.85, margin: "6px 0 0", lineHeight: 1.4 }}>{c.transcript}</p>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

function Recorder({ debate, mySide, onUploaded }: { debate: Debate; mySide: "a" | "b"; onUploaded: () => void }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationMsRef = useRef<number>(0);

  const maxMs = debate.clip_len_s * 1000;

  const mimeType = useMemo(() => {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    return candidates.find(c => MediaRecorder.isTypeSupported(c)) ?? "";
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach(t => t.stop());
    recorderRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    durationMsRef.current = Date.now() - startedAtRef.current;
    setRecording(false);
  }, []);

  async function start() {
    setErr(null); setBlob(null); setBlobUrl(null); setElapsed(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        setBlob(b);
        setBlobUrl(URL.createObjectURL(b));
      };
      rec.start();
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      setRecording(true);
      timerRef.current = setInterval(() => {
        const e = Date.now() - startedAtRef.current;
        setElapsed(e);
        if (e >= maxMs) stop();
      }, 200);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Mic access denied");
    }
  }

  async function upload() {
    if (!blob) return;
    setUploading(true); setErr(null);
    try {
      const form = new FormData();
      const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
      form.append("file", new File([blob], `clip.${ext}`, { type: blob.type || "audio/webm" }));
      form.append("durationMs", String(Math.round(durationMsRef.current || elapsed)));
      const res = await fetch(`/api/debate/${debate.id}/clips`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Upload failed"); setUploading(false); return; }
      setBlob(null); setBlobUrl(null); setElapsed(0);
      onUploaded();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const sec = Math.floor(elapsed / 1000);
  const maxSec = Math.floor(maxMs / 1000);
  const pct = Math.min(100, (elapsed / maxMs) * 100);

  return (
    <div style={{
      position: "sticky", bottom: 0, left: 0, right: 0,
      padding: 14, borderRadius: 14,
      background: "rgba(20,16,12,0.95)",
      border: "1px solid var(--accent-purple, #d4a942)",
      boxShadow: "0 -8px 30px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontSize: 11, textAlign: "center", opacity: 0.7, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
        Your turn · {mySide === "a" ? debate.side_a_label : debate.side_b_label}
      </div>

      {!blob ? (
        <>
          <button onClick={recording ? stop : start} style={{
            width: "100%", padding: "18px 0", borderRadius: 14, border: "none",
            background: recording ? "#d64545" : "var(--accent-purple, #d4a942)",
            color: recording ? "#fff" : "#1a1408",
            fontSize: 16, fontWeight: 800, cursor: "pointer",
          }}>
            {recording ? `⏹ Stop (${sec}s / ${maxSec}s)` : `🎙 Record up to ${maxSec}s`}
          </button>
          {recording && (
            <div style={{ marginTop: 8, height: 6, borderRadius: 3, overflow: "hidden", background: "rgba(255,255,255,0.1)" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "#d64545", transition: "width 0.2s linear" }} />
            </div>
          )}
        </>
      ) : (
        <>
          {blobUrl && <audio controls src={blobUrl} style={{ width: "100%", height: 38 }} />}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => { setBlob(null); setBlobUrl(null); setElapsed(0); }} disabled={uploading} style={{
              flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent", color: "inherit", cursor: "pointer", fontSize: 13,
            }}>Retake</button>
            <button onClick={upload} disabled={uploading} style={{
              flex: 2, padding: "12px 0", borderRadius: 10, border: "none",
              background: "var(--accent-purple, #d4a942)", color: "#1a1408", fontWeight: 800, cursor: "pointer", fontSize: 14,
            }}>{uploading ? "Sending…" : "Send clip"}</button>
          </div>
        </>
      )}

      {err && <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8, textAlign: "center" }}>{err}</div>}
    </div>
  );
}

function VerdictState({ debate, clips, votes, myVote, verdict, sessionUserId, onUpdate }: {
  debate: Debate; clips: Clip[]; votes: { a: number; b: number }; myVote: string | null;
  verdict: Verdict | null; sessionUserId: string; onUpdate: () => void;
}) {
  const [voting, setVoting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isDebater = debate.user_a === sessionUserId || debate.user_b === sessionUserId;
  const total = votes.a + votes.b;
  const aPct = total > 0 ? Math.round((votes.a / total) * 100) : 50;
  const bPct = 100 - aPct;
  const votingEnds = debate.voting_ends_at ? new Date(debate.voting_ends_at) : null;
  const timeLeft = votingEnds ? Math.max(0, votingEnds.getTime() - Date.now()) : 0;
  const hoursLeft = Math.floor(timeLeft / 3600000);
  const minsLeft = Math.floor((timeLeft % 3600000) / 60000);

  async function castVote(side: "a" | "b") {
    setVoting(true); setErr(null);
    const res = await fetch(`/api/debate/${debate.id}/vote`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side }),
    });
    const data = await res.json();
    if (!res.ok) setErr(data.error ?? "Vote failed");
    setVoting(false);
    onUpdate();
  }

  const winnerLabel = debate.winner_side === "a" ? debate.side_a_label : debate.winner_side === "b" ? debate.side_b_label : "Tie";

  return (
    <>
      {debate.status === "voting" && votingEnds && (
        <div style={{ padding: 10, borderRadius: 10, background: "rgba(100,140,240,0.1)", border: "1px solid rgba(100,140,240,0.3)", fontSize: 12, textAlign: "center", marginBottom: 12 }}>
          Voting closes in {hoursLeft}h {minsLeft}m
        </div>
      )}
      {debate.status === "closed" && (
        <div style={{ padding: 14, borderRadius: 12, background: "rgba(212,169,66,0.15)", border: "1px solid var(--accent-purple, #d4a942)", textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5 }}>Community Verdict</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "var(--accent-purple-bright, #e8c05a)" }}>
            🏆 {winnerLabel}
          </div>
        </div>
      )}

      <RoundList clips={clips} debate={debate} />

      <section style={{ marginTop: 4, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1.5, opacity: 0.8, marginBottom: 10 }}>Vote</h3>
        {isDebater ? (
          <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.04)", fontSize: 13, opacity: 0.7, textAlign: "center" }}>
            Debaters can't vote on their own debate.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => castVote("a")} disabled={voting || debate.status === "closed"} style={voteBtnStyle(myVote === "a")}>
              {debate.side_a_label} {total > 0 ? `· ${aPct}%` : ""}
            </button>
            <button onClick={() => castVote("b")} disabled={voting || debate.status === "closed"} style={voteBtnStyle(myVote === "b")}>
              {debate.side_b_label} {total > 0 ? `· ${bPct}%` : ""}
            </button>
          </div>
        )}
        {err && <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8 }}>{err}</div>}
        <div style={{ marginTop: 8, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${aPct}%`, background: "var(--accent-purple, #d4a942)" }} />
          <div style={{ width: `${bPct}%`, background: "#8db0ff" }} />
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6, textAlign: "center" }}>{total} vote{total === 1 ? "" : "s"}</div>
      </section>

      {verdict && (
        <section style={{
          padding: 16, borderRadius: 14,
          background: "linear-gradient(135deg, rgba(212,169,66,0.1), rgba(141,176,255,0.08))",
          border: "1px solid rgba(212,169,66,0.4)",
        }}>
          <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>AI Cohost</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--accent-purple-bright, #e8c05a)", marginBottom: 10 }}>
            🎙 Winner: {verdict.ai_winner === "a" ? debate.side_a_label : verdict.ai_winner === "b" ? debate.side_b_label : "Tie"}
          </div>
          {verdict.roast_line && (
            <blockquote style={{ margin: "0 0 10px", padding: "8px 12px", borderLeft: "3px solid var(--accent-purple, #d4a942)", fontStyle: "italic", fontSize: 14, opacity: 0.95 }}>
              “{verdict.roast_line}”
            </blockquote>
          )}
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, opacity: 0.9 }}>{verdict.reasoning}</p>
          <div style={{ marginTop: 10, display: "flex", gap: 12, fontSize: 12, opacity: 0.8 }}>
            <span>{debate.side_a_label}: <b>{verdict.score_a}</b></span>
            <span>{debate.side_b_label}: <b>{verdict.score_b}</b></span>
          </div>
        </section>
      )}

      {!verdict && (debate.status === "voting" || debate.status === "closed") && (
        <div style={{ padding: 14, textAlign: "center", opacity: 0.6, fontSize: 13 }}>
          AI cohost is cooking up a verdict…
        </div>
      )}
    </>
  );
}

function voteBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "14px 10px", borderRadius: 12,
    border: "1px solid " + (active ? "var(--accent-purple, #d4a942)" : "rgba(255,255,255,0.1)"),
    background: active ? "rgba(212,169,66,0.25)" : "rgba(255,255,255,0.04)",
    color: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer",
  };
}
