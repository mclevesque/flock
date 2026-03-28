"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/use-session";

interface AvatarConfig {
  class: string;
  emoji: string;
  bodyColor: string;
  hairColor: string;
  accentColor: string;
}

const CLASSES = [
  { id: "warrior",     emoji: "⚔️",  name: "Warrior",     desc: "Fearless frontliner",       bodyColor: "#9ca3af", hairColor: "#374151", accentColor: "#ef4444" },
  { id: "mage",        emoji: "🔮",  name: "Mage",         desc: "Master of arcane arts",      bodyColor: "#7c3aed", hairColor: "#1e1b4b", accentColor: "#c084fc" },
  { id: "ranger",      emoji: "🏹",  name: "Ranger",       desc: "Swift and precise",          bodyColor: "#16a34a", hairColor: "#14532d", accentColor: "#86efac" },
  { id: "rogue",       emoji: "🗡️",  name: "Rogue",        desc: "Strikes from the shadows",   bodyColor: "#1f2937", hairColor: "#111827", accentColor: "#fbbf24" },
  { id: "healer",      emoji: "✨",  name: "Healer",       desc: "Light in the darkness",      bodyColor: "#fef3c7", hairColor: "#d97706", accentColor: "#ffffff" },
  { id: "berserker",   emoji: "🪓",  name: "Berserker",    desc: "Rage fuels every strike",    bodyColor: "#dc2626", hairColor: "#7f1d1d", accentColor: "#f97316" },
  { id: "necromancer", emoji: "💀",  name: "Necromancer",  desc: "Commands the undead",        bodyColor: "#4b5563", hairColor: "#111827", accentColor: "#a78bfa" },
  { id: "explorer",    emoji: "🧭",  name: "Explorer",     desc: "Goes where none dare",       bodyColor: "#d97706", hairColor: "#78350f", accentColor: "#fde68a" },
] as const;

export default function CustomizePage() {
  const { status } = useSession();
  const router = useRouter();

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [bodyColor, setBodyColor] = useState("#7c3aed");
  const [hairColor, setHairColor] = useState("#1e1b4b");
  const [accentColor, setAccentColor] = useState("#c084fc");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Redirect unauthenticated
  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  // Load existing config
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/avatar-config")
      .then(r => r.json())
      .then(({ config }) => {
        if (config) {
          setSelectedClass(config.class);
          setBodyColor(config.bodyColor);
          setHairColor(config.hairColor);
          setAccentColor(config.accentColor);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [status]);

  // When class is selected, apply its default colors (only if first pick)
  function pickClass(cls: typeof CLASSES[number]) {
    setSelectedClass(cls.id);
    setBodyColor(cls.bodyColor);
    setHairColor(cls.hairColor);
    setAccentColor(cls.accentColor);
  }

  async function save(dest: string) {
    if (!selectedClass) return;
    const cls = CLASSES.find(c => c.id === selectedClass)!;
    setSaving(true);
    await fetch("/api/user/avatar-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class: selectedClass, emoji: cls.emoji, bodyColor, hairColor, accentColor } satisfies AvatarConfig),
    });
    setSaving(false);
    router.push(dest);
  }

  if (status === "loading" || status === "unauthenticated" || !loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", color: "var(--text-muted)", fontFamily: "monospace" }}>
        Loading…
      </div>
    );
  }

  const activeCls = CLASSES.find(c => c.id === selectedClass);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "32px 16px 80px",
    }}>
      <style>{`
        .cls-card {
          cursor: pointer;
          border-radius: 14px;
          border: 2px solid var(--border);
          background: var(--bg-surface);
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
          user-select: none;
        }
        .cls-card:hover { border-color: var(--accent-purple); transform: translateY(-2px); }
        .cls-card.selected {
          border-color: var(--accent-cyan);
          box-shadow: 0 0 18px rgba(0,229,255,0.18);
          background: rgba(0,229,255,0.06);
        }
        .color-swatch {
          width: 36px; height: 36px;
          border-radius: 50%;
          border: 3px solid var(--border);
          cursor: pointer;
          transition: border-color 0.15s, transform 0.1s;
        }
        .color-swatch:hover { border-color: var(--accent-cyan); transform: scale(1.1); }
        .color-swatch.active { border-color: var(--accent-cyan); }
        @media (max-width: 480px) {
          .cls-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32, maxWidth: 520 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎭</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 6px" }}>
          Choose Your Character
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
          Your avatar appears in Moonhaven and is shown to other players.
        </p>
      </div>

      {/* Class grid */}
      <div style={{ width: "100%", maxWidth: 640 }}>
        <div style={{ color: "var(--accent-purple-bright)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
          CLASS
        </div>
        <div className="cls-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 32,
        }}>
          {CLASSES.map(cls => (
            <div
              key={cls.id}
              className={`cls-card${selectedClass === cls.id ? " selected" : ""}`}
              onClick={() => pickClass(cls)}
            >
              <span style={{ fontSize: 28 }}>{cls.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{cls.name}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.3 }}>{cls.desc}</span>
            </div>
          ))}
        </div>

        {/* Color pickers */}
        {selectedClass && (
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "20px 24px",
            marginBottom: 32,
          }}>
            <div style={{ color: "var(--accent-purple-bright)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>
              COLORS
            </div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              {[
                { label: "Body / Armor", key: "body", value: bodyColor, set: setBodyColor },
                { label: "Hair / Secondary", key: "hair", value: hairColor, set: setHairColor },
                { label: "Accent / Glow", key: "accent", value: accentColor, set: setAccentColor },
              ].map(({ label, key, value, set }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                  <label style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>{label}</label>
                  <div style={{ position: "relative" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: value, border: "3px solid var(--border)", cursor: "pointer" }}
                      onClick={() => (document.getElementById(`color-${key}`) as HTMLInputElement)?.click()}
                    />
                    <input
                      id={`color-${key}`}
                      type="color"
                      value={value}
                      onChange={e => set(e.target.value)}
                      style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
                    />
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {selectedClass && activeCls && (
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "20px 24px",
            marginBottom: 32,
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {/* Avatar preview circle */}
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: `radial-gradient(circle, ${accentColor}44 0%, ${bodyColor}99 60%, ${hairColor}cc 100%)`,
                border: `3px solid ${accentColor}`,
                boxShadow: `0 0 20px ${accentColor}66`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36,
              }}>
                {activeCls.emoji}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 16, marginBottom: 2 }}>
                {activeCls.name}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 8 }}>
                {activeCls.desc}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[bodyColor, hairColor, accentColor].map((c, i) => (
                  <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c, border: "1px solid var(--border)" }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => save("/moonhaven")}
            disabled={!selectedClass || saving}
            style={{
              flex: 1, minWidth: 160,
              padding: "14px 24px",
              background: !selectedClass || saving
                ? "var(--bg-surface)"
                : "linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))",
              color: !selectedClass || saving ? "var(--text-muted)" : "#fff",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              cursor: !selectedClass || saving ? "default" : "pointer",
              letterSpacing: "0.05em",
              transition: "all 0.15s",
            }}
          >
            {saving ? "Saving…" : "✨ Enter Moonhaven"}
          </button>
          <button
            onClick={() => save("/profile/edit")}
            disabled={!selectedClass || saving}
            style={{
              padding: "14px 20px",
              background: "var(--bg-surface)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 13,
              cursor: !selectedClass || saving ? "default" : "pointer",
            }}
          >
            Save to Profile
          </button>
          <button
            onClick={() => router.back()}
            style={{
              padding: "14px 16px",
              background: "transparent",
              color: "var(--text-muted)",
              border: "none",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
