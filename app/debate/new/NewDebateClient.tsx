"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PresetTopic, DebateCategory } from "@/lib/debate-topics";

interface Friend { id: string; username: string; avatar_url: string | null }

interface Props {
  presets: PresetTopic[];
  categories: Record<string, string>;
  friends: Friend[];
}

export default function NewDebateClient({ presets, categories, friends }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"preset" | "custom">("preset");
  const [activeCat, setActiveCat] = useState<DebateCategory>("star_wars");
  const [selectedPreset, setSelectedPreset] = useState<PresetTopic | null>(null);

  // Custom topic inputs
  const [customTitle, setCustomTitle] = useState("");
  const [customCategory, setCustomCategory] = useState<DebateCategory>("wild");
  const [customSideA, setCustomSideA] = useState("");
  const [customSideB, setCustomSideB] = useState("");

  // Format
  const [rounds, setRounds] = useState(3);
  const [clipLen, setClipLen] = useState(60);
  const [inviteeId, setInviteeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredPresets = useMemo(() => presets.filter(p => p.category === activeCat), [presets, activeCat]);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        rounds,
        clipLenS: clipLen,
        visibility: inviteeId ? "private" : "public",
        inviteeId: inviteeId ?? undefined,
      };
      if (tab === "preset") {
        if (!selectedPreset) { setError("Pick a topic first."); setSubmitting(false); return; }
        body.presetTopicId = selectedPreset.id;
        // Let user override side labels via preset defaults only for now
      } else {
        if (!customTitle.trim()) { setError("Write a topic to debate."); setSubmitting(false); return; }
        if (!customSideA.trim() || !customSideB.trim()) {
          setError("Label both sides of the argument.");
          setSubmitting(false); return;
        }
        body.customTitle = customTitle.trim();
        body.category = customCategory;
        body.sideALabel = customSideA.trim();
        body.sideBLabel = customSideB.trim();
      }
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create debate"); setSubmitting(false); return; }
      router.push(`/debate/${data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      padding: "max(16px, env(safe-area-inset-top)) 16px 160px",
      background: "var(--bg, #0f0d0a)",
      color: "var(--text-primary, #e8dcc8)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Link href="/debate" style={{ color: "inherit", textDecoration: "none", fontSize: 22 }}>←</Link>
        <h1 style={{ fontFamily: "Cinzel, serif", fontSize: 22, margin: 0 }}>New Debate</h1>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["preset", "custom"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "10px 0", borderRadius: 10,
            border: "1px solid " + (tab === t ? "var(--accent-purple, #d4a942)" : "rgba(255,255,255,0.12)"),
            background: tab === t ? "rgba(212,169,66,0.15)" : "transparent",
            color: "inherit", fontWeight: 700, cursor: "pointer", fontSize: 14,
          }}>{t === "preset" ? "Preset topics" : "My own topic"}</button>
        ))}
      </div>

      {tab === "preset" && (
        <>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
            {Object.entries(categories).map(([k, label]) => (
              <button key={k} onClick={() => setActiveCat(k as DebateCategory)} style={{
                flex: "0 0 auto", padding: "6px 12px", borderRadius: 999,
                border: "1px solid " + (activeCat === k ? "var(--accent-purple, #d4a942)" : "rgba(255,255,255,0.12)"),
                background: activeCat === k ? "rgba(212,169,66,0.18)" : "transparent",
                color: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {filteredPresets.map(p => {
              const isSel = selectedPreset?.id === p.id;
              return (
                <button key={p.id} onClick={() => setSelectedPreset(p)} style={{
                  textAlign: "left", padding: "12px 14px", borderRadius: 12,
                  border: "1px solid " + (isSel ? "var(--accent-purple, #d4a942)" : "rgba(255,255,255,0.08)"),
                  background: isSel ? "rgba(212,169,66,0.12)" : "rgba(255,255,255,0.04)",
                  color: "inherit", cursor: "pointer",
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{p.title}</div>
                  {p.sideA && p.sideB && (
                    <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
                      {p.sideA} <span style={{ opacity: 0.5 }}>vs</span> {p.sideB}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {tab === "custom" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <label style={{ fontSize: 12, opacity: 0.7 }}>Topic question or hot take</label>
          <textarea
            value={customTitle}
            onChange={e => setCustomTitle(e.target.value)}
            placeholder="e.g. Was The Last Jedi actually good?"
            rows={2}
            maxLength={180}
            style={inputStyle}
          />
          <label style={{ fontSize: 12, opacity: 0.7 }}>Category</label>
          <select value={customCategory} onChange={e => setCustomCategory(e.target.value as DebateCategory)} style={inputStyle}>
            {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 12, opacity: 0.7 }}>Side A</label>
              <input value={customSideA} onChange={e => setCustomSideA(e.target.value)} placeholder="Your stance" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, opacity: 0.7 }}>Side B</label>
              <input value={customSideB} onChange={e => setCustomSideB(e.target.value)} placeholder="Opposing stance" style={inputStyle} />
            </div>
          </div>
          <p style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.4 }}>
            Heads up: custom topics run through a moderator. Political, electoral, or real-world geopolitical takes will be rejected. Pop-culture only.
          </p>
        </div>
      )}

      <section style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, margin: "0 0 10px", opacity: 0.8, textTransform: "uppercase", letterSpacing: 1 }}>Format</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, opacity: 0.7 }}>Rounds</label>
            <input type="number" min={1} max={5} value={rounds} onChange={e => setRounds(Math.max(1, Math.min(5, Number(e.target.value) || 3)))} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, opacity: 0.7 }}>Clip length (s)</label>
            <input type="number" min={30} max={90} step={5} value={clipLen} onChange={e => setClipLen(Math.max(30, Math.min(90, Number(e.target.value) || 60)))} style={inputStyle} />
          </div>
        </div>
        <p style={{ fontSize: 11, opacity: 0.55, marginTop: 8, marginBottom: 0 }}>
          Each round = one clip per side. {rounds} rounds × 2 × {clipLen}s = max {rounds * 2 * clipLen}s of audio.
        </p>
      </section>

      <section style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, margin: "0 0 10px", opacity: 0.8, textTransform: "uppercase", letterSpacing: 1 }}>Opponent</h3>
        <button onClick={() => setInviteeId(null)} style={{ ...chipStyle(inviteeId === null), marginRight: 6, marginBottom: 6 }}>
          🌐 Open to anyone
        </button>
        {friends.length > 0 && <div style={{ fontSize: 11, opacity: 0.6, margin: "6px 0" }}>Or challenge a friend:</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {friends.map(f => (
            <button key={f.id} onClick={() => setInviteeId(f.id)} style={chipStyle(inviteeId === f.id)}>
              @{f.username}
            </button>
          ))}
        </div>
      </section>

      {error && <div style={{ padding: 12, borderRadius: 8, background: "rgba(220,60,60,0.15)", color: "#ffb3b3", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <button onClick={submit} disabled={submitting} style={{
        width: "100%", padding: "16px 0", borderRadius: 14, border: "none",
        background: "var(--accent-purple, #d4a942)", color: "#1a1408",
        fontWeight: 800, fontSize: 16, cursor: submitting ? "default" : "pointer",
        opacity: submitting ? 0.6 : 1,
      }}>
        {submitting ? "Creating…" : inviteeId ? "Send challenge" : "Post debate"}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.3)", color: "inherit", fontSize: 14,
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 999,
    border: "1px solid " + (active ? "var(--accent-purple, #d4a942)" : "rgba(255,255,255,0.12)"),
    background: active ? "rgba(212,169,66,0.2)" : "transparent",
    color: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
  };
}
