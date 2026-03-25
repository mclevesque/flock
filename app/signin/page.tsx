"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { SignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "register" | "oauth">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const result = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Wrong username or password.");
    } else {
      router.push("/profile");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Registration failed.");
      return;
    }
    const result = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Account created! Now sign in below.");
      setTab("signin");
    } else {
      router.push("/profile");
    }
  }

  const tabStyle = (active: boolean) => ({
    flex: 1, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer",
    background: active ? "var(--bg-elevated)" : "transparent",
    border: "none", color: active ? "var(--accent-purple-bright)" : "var(--text-muted)",
    borderBottom: active ? "2px solid var(--accent-purple)" : "2px solid transparent",
    transition: "all 0.15s",
  } as React.CSSProperties);

  return (
    <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          {/* RYFT wordmark with slash */}
          <div style={{ position: "relative", display: "inline-block", padding: "8px 16px" }}>
            {/* Glow orb — inline so it doesn't escape the flow */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 16,
              background: "radial-gradient(ellipse 120% 140% at 50% 50%, rgba(0,229,255,0.1) 0%, rgba(139,60,247,0.07) 55%, transparent 100%)",
            }} />
            <div style={{
              fontSize: 72, fontWeight: 900, fontStyle: "italic",
              letterSpacing: "1px", lineHeight: 1,
              background: "linear-gradient(120deg, #00e5ff 0%, #a855f7 55%, #d946ef 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 2px 20px rgba(0,229,255,0.45))",
              position: "relative",
            }}>
              RYFT
            </div>
            {/* Flash — through the center of the text */}
            <div style={{
              position: "absolute",
              top: "50%", left: "-14%",
              width: "128%", height: 2,
              background: "linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.4) 10%, #00e5ff 30%, #ffffff 48%, #ffffff 52%, #d946ef 70%, rgba(217,70,239,0.4) 90%, transparent 100%)",
              transform: "translateY(-50%) rotate(-4deg)",
              boxShadow: "0 0 6px rgba(0,229,255,0.7), 0 0 16px rgba(217,70,239,0.4)",
              pointerEvents: "none",
            }} />
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", fontWeight: 700 }}>
            Hop in
          </p>
        </div>

        {/* Tab selector */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
          <button style={tabStyle(tab === "signin")} onClick={() => { setTab("signin"); setError(""); }}>Sign In</button>
          <button style={tabStyle(tab === "register")} onClick={() => { setTab("register"); setError(""); }}>Create Account</button>
          <button style={tabStyle(tab === "oauth")} onClick={() => { setTab("oauth"); setError(""); }}>Google / Discord</button>
        </div>

        {tab === "oauth" ? (
          /* Clerk's built-in sign-in — handles Google + Discord */
          <div style={{ display: "flex", justifyContent: "center" }}>
            <SignIn
              fallbackRedirectUrl="/onboarding"
              appearance={{
                elements: {
                  rootBox: { width: "100%" },
                  card: { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "none" },
                  headerTitle: { color: "var(--text-primary)" },
                  headerSubtitle: { color: "var(--text-muted)" },
                  socialButtonsBlockButton: { border: "1px solid var(--border)", color: "var(--text-secondary)" },
                  footerActionText: { color: "var(--text-muted)" },
                  footerActionLink: { color: "var(--accent-purple-bright)" },
                },
              }}
            />
          </div>
        ) : (
          <div className="panel" style={{ padding: 28 }}>
            {tab === "signin" ? (
              <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.5px" }}>USERNAME</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="yourname" required autoFocus
                    style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 15, outline: "none", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.5px" }}>PASSWORD</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                    style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 15, outline: "none", fontFamily: "inherit" }} />
                </div>
                {error && <div style={{ background: "rgba(191,92,92,0.15)", border: "1px solid rgba(191,92,92,0.4)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#f08080" }}>{error}</div>}
                <button type="submit" disabled={loading}
                  style={{ width: "100%", background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, marginTop: 4 }}>
                  {loading ? "Signing in..." : "Sign In"}
                </button>
                <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
                  No account? <button type="button" onClick={() => { setTab("register"); setError(""); }} style={{ background: "none", border: "none", color: "var(--accent-purple-bright)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Create one →</button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Pick a username and password. Your profile goes live instantly.
                </p>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.5px" }}>USERNAME</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="yourname" required autoFocus
                    style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 15, outline: "none", fontFamily: "inherit" }} />
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Letters, numbers, underscores only. This becomes your URL.</div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.5px" }}>PASSWORD</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                    style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 15, outline: "none", fontFamily: "inherit" }} />
                </div>
                {error && <div style={{ background: "rgba(191,92,92,0.15)", border: "1px solid rgba(191,92,92,0.4)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#f08080" }}>{error}</div>}
                <button type="submit" disabled={loading}
                  style={{ width: "100%", background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, marginTop: 4 }}>
                  {loading ? "Creating account..." : "Create Account"}
                </button>
              </form>
            )}
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>No ads. No tracking. No BS.</p>
      </div>
    </div>
  );
}
