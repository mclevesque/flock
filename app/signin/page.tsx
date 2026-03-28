"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const BYPASS_USERS = ["peanut", "babachoo"];

export default function SignInPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "register" | "forgot">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("")
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const isBypass = BYPASS_USERS.includes(username.trim().toLowerCase());

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const result = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (result?.error) setError("Wrong username or password.");
    else router.push("/");
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, email: email || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setLoading(false); setError(data.error ?? "Registration failed."); return; }
    const result = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (result?.error) { setError("Account created! Sign in below."); setTab("signin"); }
    else router.push("/");
  }

  const input: React.CSSProperties = {
    width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8,
    padding: "11px 14px", color: "#e8dcc8", fontSize: 15, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };
  const label: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "#8a6d2b",
    marginBottom: 6, letterSpacing: "0.12em",
  };

  return (
    <div style={{
      minHeight: "100dvh", background: "#0d0d0d", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, position: "relative", overflow: "hidden",
    }}>
      {/* Ember particles */}
      {[18, 35, 52, 68, 24, 41, 59, 75].map((left, i) => (
        <div key={i} style={{
          position: "absolute", left: `${left}%`, bottom: `${10 + i * 3}%`,
          width: 3, height: 3, borderRadius: "50%", background: "#c4531a",
          boxShadow: "0 0 6px #c4531a",
          animation: `ember ${3 + (i % 3) * 0.7}s ease-in infinite`,
          animationDelay: `${i * 0.4}s`, pointerEvents: "none",
        }} />
      ))}

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🔥</div>
        <h1 style={{
          fontFamily: "'Cinzel', serif", fontWeight: 900, fontSize: "clamp(28px, 8vw, 42px)",
          color: "#d4a942", margin: 0, letterSpacing: "0.12em", textTransform: "uppercase",
        }}>
          GREAT SOULS
        </h1>
        <p style={{ margin: "6px 0 0", color: "#555", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase" }}>
          A GATHERING OF LEGENDS
        </p>
      </div>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #2a2a2a", marginBottom: 24 }}>
          {(["signin", "register"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); }} style={{
              flex: 1, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: "transparent", border: "none",
              color: tab === t ? "#d4a942" : "#444",
              borderBottom: tab === t ? "2px solid #d4a942" : "2px solid transparent",
              fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", transition: "all 0.15s",
            }}>
              {t === "signin" ? "ENTER THE HALL" : "JOIN THE RANKS"}
            </button>
          ))}
        </div>

        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: 28 }}>
          {tab === "signin" ? (
            <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={label}>YOUR NAME</label>
                <input type="text" value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="warrior" required autoFocus style={input} maxLength={20} />
              </div>
              {!isBypass && (
                <div>
                  <label style={label}>PASSWORD</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required={!isBypass} style={input} />
                </div>
              )}
              {isBypass && (
                <div style={{ fontSize: 12, color: "#8a6d2b", textAlign: "center", padding: "4px 0" }}>
                  ⚔️ Welcome back, legend. No password needed.
                </div>
              )}
              {error && <div style={{ background: "rgba(196,83,26,0.15)", border: "1px solid rgba(196,83,26,0.4)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#e07050" }}>{error}</div>}
              <button type="submit" disabled={loading} style={{
                width: "100%", background: loading ? "#2a2a2a" : "linear-gradient(135deg, #8a6d2b, #d4a942)",
                color: loading ? "#555" : "#0d0d0d", border: "none", borderRadius: 8,
                padding: 13, fontSize: 13, fontWeight: 900, cursor: loading ? "default" : "pointer",
                fontFamily: "'Cinzel', serif", letterSpacing: "0.1em", marginTop: 4,
              }}>
                {loading ? "ENTERING..." : "ENTER THE HALL"}
              </button>
              <p style={{ margin: "4px 0 0", textAlign: "center", fontSize: 12, color: "#444" }}>
                <button type="button" onClick={() => { setTab("forgot"); setError(""); }}
                  style={{ background: "none", border: "none", color: "#8a6d2b", cursor: "pointer", fontSize: 12 }}>
                  Forgot password?
                </button>
              </p>
            </form>
          ) : tab === "register" ? (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                Choose your name, warrior. Your legend begins now.
              </p>
              <div>
                <label style={label}>YOUR NAME</label>
                <input type="text" value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="warrior" required autoFocus style={input} maxLength={20} />
                <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>Letters, numbers, underscores only.</div>
              </div>
              <div>
                <label style={label}>EMAIL <span style={{ color: "#444", fontWeight: 400 }}>(optional)</span></label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com" style={input} />
                <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>For password resets only.</div>
              </div>
              <div>
                <label style={label}>PASSWORD</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required style={input} />
              </div>
              {error && <div style={{ background: "rgba(196,83,26,0.15)", border: "1px solid rgba(196,83,26,0.4)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#e07050" }}>{error}</div>}
              <button type="submit" disabled={loading} style={{
                width: "100%", background: loading ? "#2a2a2a" : "linear-gradient(135deg, #8a6d2b, #d4a942)",
                color: loading ? "#555" : "#0d0d0d", border: "none", borderRadius: 8,
                padding: 13, fontSize: 13, fontWeight: 900, cursor: loading ? "default" : "pointer",
                fontFamily: "'Cinzel', serif", letterSpacing: "0.1em", marginTop: 4,
              }}>
                {loading ? "FORGING LEGEND..." : "JOIN THE RANKS"}
              </button>
            </form>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {forgotSent ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
                  <p style={{ color: "#e8dcc8", fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>Check your email</p>
                  <p style={{ color: "#666", fontSize: 13, margin: 0, lineHeight: 1.5 }}>If an account exists, we sent a reset link.</p>
                  <button onClick={() => { setTab("signin"); setForgotSent(false); setError(""); }}
                    style={{ marginTop: 16, background: "none", border: "none", color: "#8a6d2b", cursor: "pointer", fontSize: 13 }}>
                    ← Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault(); setError(""); setLoading(true);
                  const res = await fetch("/api/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: username }) });
                  setLoading(false);
                  if (res.ok) setForgotSent(true);
                  else { const d = await res.json(); setError(d.error ?? "Something went wrong."); }
                }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#666", lineHeight: 1.5 }}>Enter your username or email for a reset link.</p>
                  <div>
                    <label style={label}>USERNAME OR EMAIL</label>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                      placeholder="warrior or you@email.com" required autoFocus style={input} />
                  </div>
                  {error && <div style={{ background: "rgba(196,83,26,0.15)", border: "1px solid rgba(196,83,26,0.4)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#e07050" }}>{error}</div>}
                  <button type="submit" disabled={loading} style={{
                    width: "100%", background: loading ? "#2a2a2a" : "linear-gradient(135deg, #8a6d2b, #d4a942)",
                    color: loading ? "#555" : "#0d0d0d", border: "none", borderRadius: 8,
                    padding: 13, fontSize: 13, fontWeight: 900, cursor: loading ? "default" : "pointer",
                    fontFamily: "'Cinzel', serif", letterSpacing: "0.1em",
                  }}>
                    {loading ? "SENDING..." : "SEND RESET LINK"}
                  </button>
                  <button type="button" onClick={() => { setTab("signin"); setError(""); }}
                    style={{ background: "none", border: "none", color: "#8a6d2b", cursor: "pointer", fontSize: 12 }}>
                    ← Back to sign in
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#333" }}>
          🔥 No ads. No tracking. Just legends.
        </p>
      </div>

      <style>{`
        @keyframes ember {
          0% { transform: translateY(0) scale(1); opacity: 0.8; }
          50% { transform: translateY(-40px) scale(1.2) translateX(8px); opacity: 0.5; }
          100% { transform: translateY(-90px) scale(0.4) translateX(-4px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
