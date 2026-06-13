"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { C, display, Avatar, Smiley, ago, memberColor, type BudiLog } from "./_ui";
import BudiRecorder from "./BudiRecorder";

type Me = { id: string; username: string; avatarUrl: string | null };

export default function BudiHome({ initialLogs, me }: { initialLogs: BudiLog[]; me: Me }) {
  const router = useRouter();
  const [logs] = useState<BudiLog[]>(initialLogs);
  const [tab, setTab] = useState<"logs" | "camera">("logs");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"create" | "join" | null>(null);

  const solo = logs.find(l => l.kind === "solo");
  const groups = logs.filter(l => l.kind !== "solo");

  function openLog(id: string) { router.push(`/budi/${id}`); }

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: display, paddingBottom: "calc(96px + env(safe-area-inset-bottom))" }}>
      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "max(14px, env(safe-area-inset-top)) 18px 10px", position: "relative",
      }}>
        <span style={{
          fontWeight: 700, fontSize: 30, letterSpacing: "-0.02em",
          background: `linear-gradient(110deg, ${C.pink}, ${C.violet} 55%, ${C.teal})`,
          WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>budi</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setMenuOpen(o => !o)} aria-label="create or join" style={{
          width: 44, height: 44, borderRadius: "50%", background: C.surface2, border: `1px solid ${C.border}`,
          color: C.text, fontSize: 24, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>+</button>
        <button onClick={() => router.push("/")} aria-label="profile" style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Avatar url={me.avatarUrl} seed={me.id} size={42} />
        </button>

        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
            <div style={{
              position: "absolute", top: 60, right: 64, zIndex: 41, background: C.surface2,
              border: `1px solid ${C.border}`, borderRadius: 16, padding: 8, minWidth: 168,
              boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            }}>
              {([["create", "create a party"], ["join", "join a party"]] as const).map(([m, lbl]) => (
                <button key={m} onClick={() => { setMenuOpen(false); setModal(m); }} style={{
                  display: "block", width: "100%", textAlign: "left", background: "transparent",
                  border: "none", color: C.text, fontSize: 16, fontWeight: 500, padding: "12px 14px",
                  borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                }}>{lbl}</button>
              ))}
            </div>
          </>
        )}
      </header>

      {tab === "logs" ? (
        <main style={{ padding: "4px 14px 0" }}>
          {/* rotate-to-capture hint */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 6px 16px", color: C.muted }}>
            <Smiley size={26} color={C.pink} />
            <span style={{ fontSize: 14 }}>rotate to capture</span>
          </div>

          {/* Solo "vlog" space */}
          {solo && (
            <LogCard log={solo} onClick={() => openLog(solo.id)} solo />
          )}

          {/* Group logs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            {groups.map(l => <LogCard key={l.id} log={l} onClick={() => openLog(l.id)} />)}
          </div>

          {groups.length === 0 && (
            <div style={{ textAlign: "center", color: C.muted, padding: "28px 16px", fontSize: 14, lineHeight: 1.6 }}>
              no parties yet.<br />tap <b style={{ color: C.text }}>+</b> to create one or join with a friend&apos;s code.
            </div>
          )}
        </main>
      ) : (
        <BudiRecorder onClose={() => setTab("logs")} onPosted={() => { setTab("logs"); router.refresh(); }} />
      )}

      {/* Bottom camera / logs toggle */}
      <nav style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30,
        display: "flex", justifyContent: "center",
        padding: "10px 0 calc(12px + env(safe-area-inset-bottom))",
        background: "linear-gradient(to top, rgba(0,0,0,0.95) 60%, transparent)",
      }}>
        <div style={{ display: "flex", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 999, padding: 4 }}>
          {(["camera", "logs"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "10px 26px", borderRadius: 999, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 15, fontWeight: 700, minHeight: 44,
              background: tab === t ? C.text : "transparent",
              color: tab === t ? "#000" : C.muted,
            }}>{t}</button>
          ))}
        </div>
      </nav>

      {modal && (
        <ActionModal
          mode={modal}
          onClose={() => setModal(null)}
          onDone={(logId) => { setModal(null); openLog(logId); }}
        />
      )}
    </div>
  );
}

function LogCard({ log, onClick, solo }: { log: BudiLog; onClick: () => void; solo?: boolean }) {
  const members = log.member_count ?? 1;
  const streak = log.streak_count ?? 0;
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
      padding: 16, display: "flex", alignItems: "center", gap: 14, color: C.text,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 19, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.name}</span>
          {streak > 0 && <span style={{ fontSize: 13, color: C.yellow, fontWeight: 700 }}>🔥{streak}</span>}
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
          {solo
            ? "your space. each day runs 4am to 4am."
            : <>
                <span style={{ color: C.pink }}>{(log.clips_today ?? 0) > 0 ? `${log.clips_today} today` : "new party"}</span>
                {log.last_clip_at ? ` · ${ago(log.last_clip_at)}` : ""} · {members}/{log.max_members} people
              </>
          }
        </div>
      </div>
      {solo ? (
        <span style={{ fontSize: 26 }}>⭐</span>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex" }}>
            {Array.from({ length: Math.min(members, 3) }).map((_, i) => (
              <div key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <Smiley size={26} color={memberColor(log.id + i)} />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 22 }}>📷</span>
        </div>
      )}
    </button>
  );
}

function ActionModal({ mode, onClose, onDone }: { mode: "create" | "join"; onClose: () => void; onDone: (logId: string) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/budi/logs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: value }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setErr(data.error ?? "Could not create log."); setBusy(false); return; }
        onDone(data.log.id);
      } else {
        const res = await fetch("/api/budi/logs/join", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: value }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setErr(data.error ?? "Could not join."); setBusy(false); return; }
        onDone(data.log.id);
      }
    } catch {
      setErr("Something went wrong."); setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} style={{
        width: "100%", maxWidth: 460, background: C.surface, borderTop: `1px solid ${C.border}`,
        borderRadius: "24px 24px 0 0", padding: "22px 20px calc(24px + env(safe-area-inset-bottom))",
        display: "flex", flexDirection: "column", gap: 16, fontFamily: display,
      }}>
        <div style={{ width: 40, height: 4, background: C.border, borderRadius: 99, margin: "0 auto 4px" }} />
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>
          {mode === "create" ? "create a party" : "join a party"}
        </h2>
        <input
          value={value}
          onChange={e => setValue(mode === "join" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") : e.target.value)}
          placeholder={mode === "create" ? "party name (e.g. the crew)" : "invite code"}
          autoFocus maxLength={mode === "create" ? 40 : 8}
          style={{
            width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: "14px 16px", color: C.text, fontSize: 16, outline: "none", fontFamily: "inherit",
            boxSizing: "border-box", letterSpacing: mode === "join" ? "0.2em" : "normal",
          }}
        />
        {err && <div style={{ fontSize: 13, color: "#ff8fde" }}>{err}</div>}
        <button type="submit" disabled={busy || !value.trim()} style={{
          width: "100%", border: "none", borderRadius: 14, padding: 15, fontSize: 16, fontWeight: 700,
          cursor: busy ? "default" : "pointer", fontFamily: "inherit", color: "#000", minHeight: 50,
          background: `linear-gradient(110deg, ${C.pink}, ${C.violet})`, opacity: (busy || !value.trim()) ? 0.5 : 1,
        }}>
          {busy ? "..." : mode === "create" ? "create" : "join"}
        </button>
      </form>
    </div>
  );
}
