"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "register">("signin");
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
    // Auto sign in after register
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
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span className="flock-logo" style={{ fontSize: 48, letterSpacing: "-2px" }}>flock</span>
        </div>

        <div className="panel" style={{ overflow: "hidden" }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            <button style={tabStyle(tab === "signin")} onClick={() => { setTab("signin"); setError(""); }}>Sign In</button>
            <button style={tabStyle(tab === "register")} onClick={() => { setTab("register"); setError(""); }}>Create Account</button>
          </div>

          <div style={{ padding: 28 }}>
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

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>or continue with</div>
              <button onClick={() => signIn("github", { callbackUrl: "/profile" })}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                🐙 GitHub
              </button>
            </div>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>No ads. No tracking. No BS.</p>
      </div>
    </div>
  );
}
