"use client";

/**
 * Emberkin — the keeper's screen.
 *
 * All state lives on the server; this component posts an action and re-renders
 * from whatever comes back. That keeps the tab honest if you leave it open for
 * a day (meters decay server-side) and makes the game safe to play on two
 * devices at once.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/use-session";

// ── Types (mirror of the API projections) ────────────────────────────────────

interface Trait { name: string; desc: string; effect: string }
interface Move { name: string; kind: string; power: number; cost: number; desc: string }

interface Creature {
  id: string; name: string; species: string; description: string;
  stage: string; rarity: string; rarityColor: string;
  element: string; temperament: string; appearance: string; sprite: string;
  level: number; xp: number; xpNeeded: number;
  base: { hp: number; atk: number; def: number; spd: number; focus: number };
  effective: { hp: number; atk: number; def: number; spd: number; focus: number; careMult: number };
  hunger: number; energy: number; mood: number; bond: number; moodLabel: string;
  traits: Trait[]; moves: Move[]; wins: number; losses: number;
}

interface EggState { id: string; name: string; stage: "egg"; sprite: string; bond: number; hatchBond: number; canHatch: boolean }
interface GameEvent { id: number; kind: string; text: string; createdAt: string }
interface Rival { id: string; name: string; species: string; sprite: string; level: number; rarity: string; ownerName: string; wins: number; losses: number }
interface BoardRow { id: string; name: string; species: string; sprite: string; stage: string; rarity: string; level: number; wins: number; losses: number; bond: number; ownerName: string }
interface Food { id: string; label: string; emoji: string; hunger: number; mood: number; energy: number; blurb: string }
interface TrainFocus { id: string; label: string; stat: string; emoji: string }
interface NpcTier { id: string; label: string; levelOffset: number; xp: number; blurb: string }
interface Beat { side: "a" | "b"; move: string; kind: string; damage: number; crit: boolean; missed: boolean; note: string; hpA: number; hpB: number }

interface BattleOutcome {
  won: boolean; xpGained: number; levels: number;
  narration: { opening: string; closing: string };
  opponent: { name: string; species: string; sprite: string; level: number; hp: number; label: string };
  battle: { beats: Beat[]; rounds: number; myMaxHp: number; foeMaxHp: number; finalHpMine: number; finalHpFoe: number };
  evolution: { narration: string; species: string; sprite: string } | null;
}

// ── Palette ──────────────────────────────────────────────────────────────────

const GOLD = "#d4a942";
const DIM = "#8a6d2b";
const INK = "#0d0d0d";
const PANEL = "#151515";
const EDGE = "#2a2a2a";
const TEXT = "#e8dcc8";
const MUTED = "#8f8677";

type Tab = "care" | "train" | "talk" | "fight" | "journal";

export default function EmberkinClient() {
  const { data: session, status } = useSession();

  const [creature, setCreature] = useState<Creature | null>(null);
  const [egg, setEgg] = useState<EggState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [training, setTraining] = useState<TrainFocus[]>([]);
  const [npcTiers, setNpcTiers] = useState<NpcTier[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("care");

  // Transient narration surfaced under the portrait.
  const [flash, setFlash] = useState<{ text: string; gains: string[] } | null>(null);
  const [evolveCard, setEvolveCard] = useState<{ narration: string; species: string; sprite: string } | null>(null);
  const [battle, setBattle] = useState<BattleOutcome | null>(null);

  // Egg creation form
  const [eggName, setEggName] = useState("");
  const [whisper, setWhisper] = useState("");

  // Action inputs
  const [focusId, setFocusId] = useState("atk");
  const [instruction, setInstruction] = useState("");
  const [saying, setSaying] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/emberkin");
      const d = await res.json();
      setFoods(d.catalog?.foods ?? []);
      setTraining(d.catalog?.training ?? []);
      setNpcTiers(d.catalog?.npcTiers ?? []);
      setBoard(d.leaderboard ?? []);
      setEvents(d.events ?? []);
      setRivals(d.rivals ?? []);
      if (d.creature?.stage === "egg") { setEgg(d.creature); setCreature(null); }
      else { setCreature(d.creature ?? null); setEgg(null); }
    } catch {
      setError("Couldn't reach the bonfire. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (status !== "loading") load(); }, [status, load]);

  /** Single funnel for every action so busy/error handling stays in one place. */
  const act = useCallback(async (payload: Record<string, unknown>, endpoint = "/api/emberkin") => {
    if (busy) return null;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "That didn't work."); return null; }

      if (d.creature) setCreature(d.creature);
      if (d.message) setFlash({ text: d.message, gains: d.gains ?? [] });
      if (d.evolution) setEvolveCard(d.evolution);
      return d;
    } catch {
      setError("Connection lost.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  // ── Gates ──────────────────────────────────────────────────────────────────

  if (status === "loading" || loading) return <Shell><Centered>Stoking the fire…</Centered></Shell>;

  if (!session?.user) {
    return (
      <Shell>
        <Centered>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🥚</div>
            <h1 style={{ fontFamily: "serif", color: GOLD, fontSize: 32, margin: "0 0 12px", letterSpacing: "0.1em" }}>EMBERKIN</h1>
            <p style={{ color: MUTED, maxWidth: 380, margin: "0 auto 24px", lineHeight: 1.6 }}>
              Something is waiting in the ash. You&apos;ll need a name before it will come out.
            </p>
            <Link href="/greatsouls" style={btnStyle(true)}>Sign in at the bonfire</Link>
          </div>
        </Centered>
      </Shell>
    );
  }

  // ── No creature: lay an egg ────────────────────────────────────────────────

  if (!creature && !egg) {
    return (
      <Shell>
        <TopBar />
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px 80px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 72, marginBottom: 12 }}>🥚</div>
            <h1 style={{ fontFamily: "serif", color: GOLD, fontSize: 30, margin: "0 0 10px", letterSpacing: "0.12em" }}>
              FIND AN EGG
            </h1>
            <p style={{ color: MUTED, lineHeight: 1.65, fontSize: 14 }}>
              Whatever you whisper over the shell shapes what climbs out of it — but never
              the way you meant. Nobody gets the same creature twice.
            </p>
          </div>

          <Panel>
            <Label>Name it</Label>
            <input
              value={eggName}
              onChange={e => setEggName(e.target.value.slice(0, 24))}
              placeholder="Cinder, Mote, Bad Idea…"
              style={inputStyle}
            />

            <Label style={{ marginTop: 20 }}>Whisper something over the shell</Label>
            <textarea
              value={whisper}
              onChange={e => setWhisper(e.target.value.slice(0, 200))}
              placeholder="be fast. be cruel. be something with too many eyes. be gentle, for once."
              rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            />
            <div style={{ color: "#5f5a52", fontSize: 11, marginTop: 6 }}>
              {whisper.length}/200 — it listens, it doesn&apos;t obey.
            </div>

            {error && <ErrorLine>{error}</ErrorLine>}

            <button
              disabled={busy || !eggName.trim()}
              onClick={async () => {
                const d = await act({ action: "lay", name: eggName.trim(), whisper: whisper.trim() });
                if (d?.ok) await load();
              }}
              style={{ ...btnStyle(true), width: "100%", marginTop: 22, opacity: !eggName.trim() ? 0.45 : 1 }}
            >
              {busy ? "…" : "SET IT IN THE ASH"}
            </button>
          </Panel>

          {board.length > 0 && <Leaderboard rows={board} />}
        </div>
      </Shell>
    );
  }

  // ── Egg stage ──────────────────────────────────────────────────────────────

  if (egg) {
    const pct = Math.min(100, (egg.bond / egg.hatchBond) * 100);
    return (
      <Shell>
        <TopBar />
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 20px 80px", textAlign: "center" }}>
          <div
            style={{
              fontSize: 96, marginBottom: 8,
              animation: egg.canHatch ? "ekShake 0.9s ease-in-out infinite" : "ekBreathe 3.2s ease-in-out infinite",
            }}
          >
            🥚
          </div>
          <h1 style={{ fontFamily: "serif", color: GOLD, fontSize: 26, margin: "0 0 4px", letterSpacing: "0.1em" }}>
            {egg.name}
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginBottom: 28 }}>
            {egg.canHatch ? "It's pushing against the shell." : "Cold shells don't open. Keep it close."}
          </p>

          <Meter label="Warmth" value={pct} color={GOLD} showPct />

          {flash && (
            <p style={{ color: TEXT, fontSize: 14, lineHeight: 1.7, margin: "24px 0 0", fontStyle: "italic" }}>
              {flash.text}
            </p>
          )}
          {error && <ErrorLine>{error}</ErrorLine>}

          <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
            <button
              disabled={busy || egg.canHatch}
              onClick={async () => {
                const d = await act({ action: "warm" });
                if (d?.ok) setEgg(e => e && { ...e, bond: d.bond, canHatch: d.canHatch });
              }}
              style={{ ...btnStyle(false), flex: 1, opacity: egg.canHatch ? 0.4 : 1 }}
            >
              {busy ? "…" : "🔥 WARM IT"}
            </button>
            <button
              disabled={busy || !egg.canHatch}
              onClick={async () => {
                const d = await act({ action: "hatch" });
                if (d?.hatched) { setEgg(null); await load(); }
              }}
              style={{ ...btnStyle(true), flex: 1, opacity: !egg.canHatch ? 0.4 : 1 }}
            >
              {busy ? "…" : "OPEN IT"}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!creature) return <Shell><Centered>…</Centered></Shell>;

  const c = creature;

  // ── Main keeper screen ─────────────────────────────────────────────────────

  return (
    <Shell>
      <TopBar />

      {evolveCard && (
        <Modal onClose={() => setEvolveCard(null)}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 72, marginBottom: 10, animation: "ekPulse 1.8s ease-in-out infinite" }}>{evolveCard.sprite}</div>
            <div style={{ color: DIM, fontSize: 11, letterSpacing: "0.2em", marginBottom: 6 }}>IT CHANGED</div>
            <h2 style={{ fontFamily: "serif", color: GOLD, fontSize: 24, margin: "0 0 16px" }}>{evolveCard.species}</h2>
            <p style={{ color: TEXT, lineHeight: 1.75, fontSize: 14.5, fontStyle: "italic" }}>{evolveCard.narration}</p>
            <button onClick={() => setEvolveCard(null)} style={{ ...btnStyle(true), marginTop: 24 }}>GOOD</button>
          </div>
        </Modal>
      )}

      {battle && (
        <BattleReplay
          outcome={battle}
          creature={c}
          onClose={() => { setBattle(null); load(); }}
        />
      )}

      <div style={{ maxWidth: 940, margin: "0 auto", padding: "20px 16px 90px" }}>
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr", alignItems: "start" }} className="ek-layout">

          {/* ── Portrait + vitals ─────────────────────────────────────────── */}
          <Panel>
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
              <div style={{
                width: 92, height: 92, flexShrink: 0, borderRadius: 12,
                border: `1px solid ${c.rarityColor}`, background: "rgba(212,169,66,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46,
                animation: "ekBreathe 3.6s ease-in-out infinite",
              }}>
                {c.sprite}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h1 style={{ fontFamily: "serif", color: GOLD, fontSize: 24, margin: 0, letterSpacing: "0.04em" }}>
                    {c.name}
                  </h1>
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", padding: "2px 7px",
                    borderRadius: 4, color: c.rarityColor, border: `1px solid ${c.rarityColor}`,
                    textTransform: "uppercase",
                  }}>
                    {c.rarity}
                  </span>
                </div>
                <div style={{ color: MUTED, fontSize: 13, marginTop: 3 }}>
                  {c.species} · {c.stage} · lvl {c.level} · <span style={{ color: DIM }}>{c.moodLabel}</span>
                </div>
                <div style={{ color: "#6f6a61", fontSize: 12, marginTop: 8, lineHeight: 1.55 }}>
                  {c.appearance}
                </div>
                <div style={{ marginTop: 12 }}>
                  <Meter label={`XP  ${c.xp}/${c.xpNeeded}`} value={(c.xp / c.xpNeeded) * 100} color={DIM} thin />
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px 18px", marginTop: 20 }}>
              <Meter label="Hunger" value={c.hunger} color={c.hunger < 25 ? "#c4531a" : "#4caf7d"} />
              <Meter label="Energy" value={c.energy} color={c.energy < 25 ? "#c4531a" : "#4a9fd4"} />
              <Meter label="Mood" value={c.mood} color={c.mood < 25 ? "#c4531a" : GOLD} />
              <Meter label="Bond" value={c.bond} color="#b06ad4" />
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6,
              marginTop: 18, paddingTop: 16, borderTop: `1px solid ${EDGE}`,
            }}>
              <Stat label="HP" base={c.base.hp} eff={c.effective.hp} />
              <Stat label="ATK" base={c.base.atk} eff={c.effective.atk} />
              <Stat label="DEF" base={c.base.def} eff={c.effective.def} />
              <Stat label="SPD" base={c.base.spd} eff={c.effective.spd} />
              <Stat label="WIL" base={c.base.focus} eff={c.effective.focus} />
            </div>
            {c.effective.careMult < 0.95 && (
              <div style={{ color: "#c4531a", fontSize: 11, marginTop: 10, textAlign: "center" }}>
                Neglect is costing it {Math.round((1 - c.effective.careMult) * 100)}% of its strength.
              </div>
            )}

            <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 11.5, color: MUTED, justifyContent: "center" }}>
              <span>⚔ {c.wins}W</span>
              <span>· {c.losses}L</span>
              <span>· {c.element}</span>
              <span>· {c.temperament}</span>
            </div>
          </Panel>

          {/* ── Traits + moves ────────────────────────────────────────────── */}
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr 1fr" }} className="ek-cards">
            <Panel>
              <SectionTitle>TRAITS</SectionTitle>
              {c.traits.length === 0 && <Empty>Nothing has taken hold yet.</Empty>}
              {c.traits.map((t, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ color: GOLD, fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ color: MUTED, fontSize: 11.5, lineHeight: 1.45 }}>{t.desc}</div>
                </div>
              ))}
            </Panel>

            <Panel>
              <SectionTitle>MOVES</SectionTitle>
              {c.moves.length === 0 && <Empty>It only knows how to flinch.</Empty>}
              {c.moves.map((m, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ color: GOLD, fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                    <span style={{ color: DIM, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0 }}>
                      {m.kind} {m.power}
                    </span>
                  </div>
                  <div style={{ color: MUTED, fontSize: 11.5, lineHeight: 1.45 }}>{m.desc}</div>
                </div>
              ))}
            </Panel>
          </div>

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <Panel style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${EDGE}`, overflowX: "auto" }}>
              {(["care", "train", "talk", "fight", "journal"] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1, minWidth: 84, padding: "13px 8px", background: tab === t ? "rgba(212,169,66,0.08)" : "transparent",
                    border: "none", borderBottom: `2px solid ${tab === t ? GOLD : "transparent"}`,
                    color: tab === t ? GOLD : MUTED, fontSize: 11, fontWeight: 700,
                    letterSpacing: "0.14em", cursor: "pointer", textTransform: "uppercase",
                    fontFamily: "inherit",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <div style={{ padding: 18 }}>
              {error && <ErrorLine>{error}</ErrorLine>}

              {flash && tab !== "journal" && (
                <div style={{
                  background: "rgba(212,169,66,0.06)", border: `1px solid rgba(212,169,66,0.25)`,
                  borderRadius: 8, padding: "13px 15px", marginBottom: 16,
                }}>
                  <p style={{ color: TEXT, fontSize: 14, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>{flash.text}</p>
                  {flash.gains.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {flash.gains.map((g, i) => (
                        <span key={i} style={{
                          fontSize: 10.5, color: GOLD, border: `1px solid ${DIM}`,
                          borderRadius: 4, padding: "2px 7px", letterSpacing: "0.05em",
                        }}>{g}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CARE */}
              {tab === "care" && (
                <>
                  <SectionTitle>FEED IT</SectionTitle>
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", marginBottom: 22 }}>
                    {foods.map(f => (
                      <button
                        key={f.id}
                        disabled={busy}
                        onClick={() => act({ action: "feed", foodId: f.id })}
                        style={{
                          textAlign: "left", background: PANEL, border: `1px solid ${EDGE}`,
                          borderRadius: 8, padding: "10px 12px", cursor: busy ? "wait" : "pointer",
                          color: TEXT, fontFamily: "inherit",
                        }}
                        className="ek-hover"
                      >
                        <div style={{ fontSize: 13, color: GOLD }}>{f.emoji} {f.label}</div>
                        <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3, lineHeight: 1.4 }}>{f.blurb}</div>
                      </button>
                    ))}
                  </div>

                  <SectionTitle>SPEND TIME</SectionTitle>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button disabled={busy} onClick={() => act({ action: "play" })} style={{ ...btnStyle(false), flex: 1 }}>
                      🎈 PLAY
                    </button>
                    <button disabled={busy} onClick={() => act({ action: "rest" })} style={{ ...btnStyle(false), flex: 1 }}>
                      🌙 REST
                    </button>
                  </div>
                </>
              )}

              {/* TRAIN */}
              {tab === "train" && (
                <>
                  <SectionTitle>WHAT ARE YOU BUILDING?</SectionTitle>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                    {training.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setFocusId(t.id)}
                        style={{
                          flex: "1 1 100px", padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                          background: focusId === t.id ? "rgba(212,169,66,0.12)" : PANEL,
                          border: `1px solid ${focusId === t.id ? GOLD : EDGE}`,
                          color: focusId === t.id ? GOLD : MUTED, fontSize: 12, fontFamily: "inherit",
                        }}
                      >
                        <div style={{ fontSize: 18, marginBottom: 3 }}>{t.emoji}</div>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <Label>Tell it what you want (optional)</Label>
                  <textarea
                    value={instruction}
                    onChange={e => setInstruction(e.target.value.slice(0, 200))}
                    placeholder="hit harder than you should be able to. learn to wait. stop flinching."
                    rows={2}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />

                  <button
                    disabled={busy}
                    onClick={() => act({ action: "train", focusId, instruction })}
                    style={{ ...btnStyle(true), width: "100%", marginTop: 14 }}
                  >
                    {busy ? "…" : "TRAIN  (−22 energy)"}
                  </button>
                  <p style={{ color: "#5f5a52", fontSize: 11, marginTop: 10, lineHeight: 1.5, textAlign: "center" }}>
                    Most sessions are ordinary. A few are not. You will not be warned which.
                  </p>
                </>
              )}

              {/* TALK */}
              {tab === "talk" && (
                <>
                  <SectionTitle>SAY SOMETHING</SectionTitle>
                  <p style={{ color: MUTED, fontSize: 12, marginBottom: 12, lineHeight: 1.55 }}>
                    It doesn&apos;t understand words. It understands you.
                  </p>
                  <textarea
                    value={saying}
                    onChange={e => setSaying(e.target.value.slice(0, 300))}
                    placeholder="where do you go when I'm not here?"
                    rows={2}
                    style={{ ...inputStyle, resize: "vertical" }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (saying.trim()) { act({ action: "speak", message: saying.trim() }); setSaying(""); }
                      }
                    }}
                  />
                  <button
                    disabled={busy || !saying.trim()}
                    onClick={() => { act({ action: "speak", message: saying.trim() }); setSaying(""); }}
                    style={{ ...btnStyle(true), width: "100%", marginTop: 12, opacity: !saying.trim() ? 0.45 : 1 }}
                  >
                    {busy ? "…" : "SPEAK"}
                  </button>
                </>
              )}

              {/* FIGHT */}
              {tab === "fight" && (
                <>
                  <SectionTitle>THE ASH PITS</SectionTitle>
                  <div style={{ display: "grid", gap: 8, marginBottom: 22 }}>
                    {npcTiers.map(t => (
                      <button
                        key={t.id}
                        disabled={busy}
                        onClick={async () => {
                          const d = await act({ mode: "npc", tierId: t.id }, "/api/emberkin/battle");
                          if (d?.ok) setBattle(d as BattleOutcome);
                        }}
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                          background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 8,
                          padding: "12px 14px", cursor: busy ? "wait" : "pointer", textAlign: "left",
                          color: TEXT, fontFamily: "inherit",
                        }}
                        className="ek-hover"
                      >
                        <span>
                          <span style={{ color: GOLD, fontSize: 14 }}>{t.label}</span>
                          <span style={{ display: "block", color: MUTED, fontSize: 11.5, marginTop: 2 }}>{t.blurb}</span>
                        </span>
                        <span style={{ color: DIM, fontSize: 11, flexShrink: 0 }}>
                          lvl {Math.max(1, c.level + t.levelOffset)} · {t.xp}xp
                        </span>
                      </button>
                    ))}
                  </div>

                  <SectionTitle>OTHER KEEPERS</SectionTitle>
                  {rivals.length === 0 && <Empty>Nobody else has hatched anything yet.</Empty>}
                  <div style={{ display: "grid", gap: 8 }}>
                    {rivals.map(r => (
                      <button
                        key={r.id}
                        disabled={busy}
                        onClick={async () => {
                          const d = await act({ mode: "rival", rivalId: r.id }, "/api/emberkin/battle");
                          if (d?.ok) setBattle(d as BattleOutcome);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 8,
                          padding: "10px 14px", cursor: busy ? "wait" : "pointer", textAlign: "left",
                          color: TEXT, fontFamily: "inherit",
                        }}
                        className="ek-hover"
                      >
                        <span style={{ fontSize: 24 }}>{r.sprite}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ color: GOLD, fontSize: 13.5 }}>{r.name}</span>
                          <span style={{ display: "block", color: MUTED, fontSize: 11, marginTop: 1 }}>
                            {r.species} · lvl {r.level} · kept by {r.ownerName}
                          </span>
                        </span>
                        <span style={{ color: DIM, fontSize: 11, flexShrink: 0 }}>{r.wins}W {r.losses}L</span>
                      </button>
                    ))}
                  </div>
                  <p style={{ color: "#5f5a52", fontSize: 11, marginTop: 14, lineHeight: 1.5 }}>
                    Duels are fought against a snapshot. Nobody loses progress while they&apos;re away.
                  </p>
                </>
              )}

              {/* JOURNAL */}
              {tab === "journal" && (
                <>
                  <SectionTitle>WHAT YOU&apos;VE DONE TOGETHER</SectionTitle>
                  {events.length === 0 && <Empty>Nothing yet.</Empty>}
                  <div style={{ display: "grid", gap: 12 }}>
                    {events.map(ev => (
                      <div key={ev.id} style={{ borderLeft: `2px solid ${EDGE}`, paddingLeft: 12 }}>
                        <div style={{ color: DIM, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                          {ev.kind}
                        </div>
                        <div style={{ color: TEXT, fontSize: 13.5, lineHeight: 1.65, marginTop: 3, whiteSpace: "pre-wrap" }}>
                          {ev.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={load}
                    style={{ ...btnStyle(false), width: "100%", marginTop: 18 }}
                  >
                    REFRESH
                  </button>
                </>
              )}
            </div>
          </Panel>

          {board.length > 0 && <Leaderboard rows={board} />}
        </div>
      </div>
    </Shell>
  );
}

// ── Battle replay ────────────────────────────────────────────────────────────

function BattleReplay({ outcome, creature, onClose }: {
  outcome: BattleOutcome; creature: Creature; onClose: () => void;
}) {
  const [shown, setShown] = useState(0);
  const beats = outcome.battle.beats;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      setShown(n => {
        if (n >= beats.length) {
          if (timer.current) clearInterval(timer.current);
          return n;
        }
        return n + 1;
      });
    }, 420);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [beats.length]);

  const done = shown >= beats.length;
  const last = shown > 0 ? beats[shown - 1] : null;
  const hpMine = last ? last.hpA : outcome.battle.myMaxHp;
  const hpFoe = last ? last.hpB : outcome.battle.foeMaxHp;

  return (
    <Modal onClose={onClose} wide>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 6 }}>
        <Fighter sprite={creature.sprite} name={creature.name} level={creature.level}
                 hp={hpMine} max={outcome.battle.myMaxHp} color={GOLD} />
        <div style={{ color: DIM, fontSize: 11, letterSpacing: "0.2em", flexShrink: 0 }}>VS</div>
        <Fighter sprite={outcome.opponent.sprite} name={outcome.opponent.name} level={outcome.opponent.level}
                 hp={hpFoe} max={outcome.battle.foeMaxHp} color="#c4531a" align="right" />
      </div>

      <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.65, fontStyle: "italic", margin: "18px 0 14px", textAlign: "center" }}>
        {outcome.narration.opening}
      </p>

      <div style={{
        background: INK, border: `1px solid ${EDGE}`, borderRadius: 8,
        padding: 12, maxHeight: 190, overflowY: "auto", fontSize: 12.5, lineHeight: 1.9,
      }}>
        {beats.slice(0, shown).map((b, i) => (
          <div key={i} style={{ color: b.side === "a" ? TEXT : "#a89b88" }}>
            <span style={{ color: b.side === "a" ? GOLD : "#c4531a" }}>
              {b.side === "a" ? creature.name : outcome.opponent.name}
            </span>
            {" "}used <span style={{ color: DIM }}>{b.move}</span>
            {b.missed
              ? " — and missed."
              : ` — ${b.damage} damage${b.crit ? " (critical)" : ""}.`}
          </div>
        ))}
        {!done && <div style={{ color: DIM }}>…</div>}
      </div>

      {done && (
        <>
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <div style={{
              fontFamily: "serif", fontSize: 22, letterSpacing: "0.14em",
              color: outcome.won ? GOLD : "#c4531a",
            }}>
              {outcome.won ? "VICTORY" : "DEFEAT"}
            </div>
            <p style={{ color: TEXT, fontSize: 13.5, lineHeight: 1.7, fontStyle: "italic", marginTop: 10 }}>
              {outcome.narration.closing}
            </p>
            <div style={{ color: DIM, fontSize: 12, marginTop: 12 }}>
              +{outcome.xpGained} XP{outcome.levels > 0 ? ` · reached level ${creature.level}` : ""}
            </div>
          </div>

          {outcome.evolution && (
            <div style={{
              marginTop: 16, padding: 14, borderRadius: 8,
              background: "rgba(212,169,66,0.07)", border: `1px solid rgba(212,169,66,0.3)`,
            }}>
              <div style={{ color: DIM, fontSize: 10, letterSpacing: "0.2em", marginBottom: 6 }}>IT CHANGED</div>
              <div style={{ color: GOLD, fontFamily: "serif", fontSize: 17 }}>
                {outcome.evolution.sprite} {outcome.evolution.species}
              </div>
              <p style={{ color: TEXT, fontSize: 13, lineHeight: 1.7, marginTop: 8, fontStyle: "italic" }}>
                {outcome.evolution.narration}
              </p>
            </div>
          )}

          <button onClick={onClose} style={{ ...btnStyle(true), width: "100%", marginTop: 20 }}>
            BACK TO THE FIRE
          </button>
        </>
      )}
    </Modal>
  );
}

function Fighter({ sprite, name, level, hp, max, color, align = "left" }: {
  sprite: string; name: string; level: number; hp: number; max: number; color: string; align?: "left" | "right";
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: align }}>
      <div style={{ fontSize: 34 }}>{sprite}</div>
      <div style={{ color, fontSize: 13, fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </div>
      <div style={{ color: MUTED, fontSize: 10.5 }}>lvl {level}</div>
      <div style={{ height: 5, background: EDGE, borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${Math.max(0, (hp / max) * 100)}%`,
          background: color, transition: "width 0.35s ease",
        }} />
      </div>
    </div>
  );
}

// ── Small presentational pieces ──────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: INK, color: TEXT }}>
      <style>{`
        @keyframes ekBreathe { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-4px) scale(1.03); } }
        @keyframes ekShake { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
        @keyframes ekPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
        @keyframes ekEmber { 0% { transform: translateY(0); opacity: 0.35; } 100% { transform: translateY(-70px); opacity: 0; } }
        .ek-hover:hover { border-color: ${GOLD} !important; background: rgba(212,169,66,0.06) !important; }
        .ek-layout { grid-template-columns: 1fr; }
        @media (min-width: 900px) { .ek-cards { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 620px) { .ek-cards { grid-template-columns: 1fr !important; } }
        input:focus, textarea:focus { outline: none; border-color: ${GOLD} !important; }
      `}</style>
      {[14, 31, 48, 66, 82].map((left, i) => (
        <div key={i} style={{
          position: "fixed", bottom: "8%", left: `${left}%`, width: 3, height: 3,
          borderRadius: "50%", background: GOLD, pointerEvents: "none", zIndex: 0,
          animation: `ekEmber ${4 + i * 0.8}s ease-out infinite`, animationDelay: `${i * 0.9}s`,
        }} />
      ))}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

function TopBar() {
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center",
      gap: 14, padding: "10px 16px", background: "rgba(13,13,13,0.95)",
      backdropFilter: "blur(8px)", borderBottom: `1px solid ${EDGE}`,
    }}>
      <Link href="/greatsouls/hub" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
        <span style={{ fontSize: 18 }}>🔥</span>
        <span style={{ fontFamily: "serif", color: GOLD, fontWeight: 700, fontSize: 15, letterSpacing: "0.08em" }}>
          GREAT SOULS
        </span>
      </Link>
      <span style={{ color: EDGE }}>/</span>
      <span style={{ fontFamily: "serif", color: DIM, fontSize: 13, letterSpacing: "0.14em" }}>EMBERKIN</span>
      <Link href="/greatsouls/hub" style={{
        marginLeft: "auto", color: DIM, fontSize: 11, fontWeight: 700,
        letterSpacing: "0.1em", textDecoration: "none",
      }}>
        ← HUB
      </Link>
    </nav>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ color: DIM, fontFamily: "serif", fontSize: 18 }}>{children}</div>
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#1a1a1a", border: `1px solid ${EDGE}`, borderRadius: 12, padding: 20, ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: DIM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.18em",
      textTransform: "uppercase", marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ color: DIM, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 7, ...style }}>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#5f5a52", fontSize: 12.5, fontStyle: "italic" }}>{children}</div>;
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: "#c4531a", fontSize: 12.5, marginTop: 12, marginBottom: 12,
      padding: "8px 11px", background: "rgba(196,83,26,0.08)",
      border: "1px solid rgba(196,83,26,0.3)", borderRadius: 6,
    }}>
      {children}
    </div>
  );
}

function Meter({ label, value, color, thin, showPct }: {
  label: string; value: number; color: string; thin?: boolean; showPct?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: MUTED, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
        {showPct && <span style={{ color: DIM, fontSize: 10.5 }}>{Math.round(pct)}%</span>}
      </div>
      <div style={{ height: thin ? 4 : 7, background: EDGE, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function Stat({ label, base, eff }: { label: string; base: number; eff: number }) {
  const down = eff < base;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ color: MUTED, fontSize: 9.5, letterSpacing: "0.12em" }}>{label}</div>
      <div style={{ color: down ? "#c4531a" : GOLD, fontSize: 17, fontFamily: "serif", fontWeight: 700, marginTop: 2 }}>
        {eff}
      </div>
      {eff !== base && <div style={{ color: "#5f5a52", fontSize: 9.5 }}>({base})</div>}
    </div>
  );
}

function Leaderboard({ rows }: { rows: BoardRow[] }) {
  return (
    <Panel>
      <SectionTitle>THE LONGEST-KEPT</SectionTitle>
      <div style={{ display: "grid", gap: 7 }}>
        {rows.slice(0, 10).map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
            <span style={{ color: DIM, width: 18, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
            <span style={{ fontSize: 17 }}>{r.sprite}</span>
            <span style={{ color: GOLD, flexShrink: 0 }}>{r.name}</span>
            <span style={{ color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.species} · {r.ownerName}
            </span>
            <span style={{ marginLeft: "auto", color: DIM, flexShrink: 0 }}>lvl {r.level} · {r.wins}W</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.82)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#1a1a1a", border: `1px solid ${DIM}`, borderRadius: 14,
          padding: 24, maxWidth: wide ? 560 : 440, width: "100%",
          maxHeight: "88vh", overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Shared inline styles ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", background: INK, border: `1px solid ${EDGE}`, borderRadius: 8,
  padding: "11px 13px", color: TEXT, fontSize: 14, fontFamily: "inherit",
};

function btnStyle(primary: boolean): React.CSSProperties {
  return {
    display: "inline-block", textAlign: "center", padding: "12px 18px", borderRadius: 8,
    cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em",
    textDecoration: "none", fontFamily: "inherit",
    background: primary ? "rgba(212,169,66,0.14)" : PANEL,
    border: `1px solid ${primary ? GOLD : EDGE}`,
    color: primary ? GOLD : TEXT,
  };
}
