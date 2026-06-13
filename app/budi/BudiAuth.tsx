"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { C, display, Smiley } from "./_ui";

const BYPASS_USERS = ["peanut", "babachoo", "thegreattester"];

export default function BudiAuth() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "register">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isBypass = BYPASS_USERS.includes(username.trim().toLowerCase());

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const result = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (result?.error) setError("Wrong username or password.");
    else router.refresh(); // session cookie set → re-render server page into the home
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setLoading(false); setError(data.error ?? "Could not create account."); return; }
    // This also creates the matching greatsouls.net account if it didn't exist.
    const result = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (result?.error) { setError("Account made — sign in below."); setTab("signin"); }
    else router.refresh();
  }

  const input: React.CSSProperties = {
    width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
    padding: "14px 16px", color: C.text, fontSize: 16, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };
  const label: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 700, color: C.muted,
    marginBottom: 7, letterSpacing: "0.04em",
  };

  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: display,
    }}>
      {/* Wordmark + mascot */}
      <div style={{ textAlign: "center", marginBottom: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <Smiley size={64} color={C.pink} />
        <h1 style={{
          margin: 0, fontWeight: 700, fontSize: "clamp(44px, 16vw, 72px)", lineHeight: 1,
          letterSpacing: "-0.02em",
          background: `linear-gradient(110deg, ${C.pink} 0%, ${C.violet} 45%, ${C.teal} 100%)`,
          WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>budi</h1>
        <p style={{ margin: 0, color: C.muted, fontSize: 14, fontWeight: 500 }}>
          record your day with friends.
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 360 }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["signin", "register"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); }} style={{
              flex: 1, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer",
              background: tab === t ? C.surface2 : "transparent",
              border: `1px solid ${tab === t ? C.border : "transparent"}`,
              color: tab === t ? C.text : C.muted, borderRadius: 12, fontFamily: "inherit",
              minHeight: 44,
            }}>
              {t === "signin" ? "log in" : "sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={tab === "signin" ? handleSignIn : handleRegister}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={label}>username</label>
            <input type="text" value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="yourname" required autoFocus style={input} maxLength={20} />
          </div>
          {!isBypass && (
            <div>
              <label style={label}>password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required={!isBypass} style={input} />
            </div>
          )}
          {isBypass && (
            <div style={{ fontSize: 13, color: C.teal, textAlign: "center", padding: "2px 0" }}>
              ✨ welcome back — no password needed.
            </div>
          )}
          {error && (
            <div style={{ background: "rgba(255,62,201,0.12)", border: `1px solid ${C.pinkDim}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#ff8fde" }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            width: "100%", border: "none", borderRadius: 14, padding: 15,
            fontSize: 16, fontWeight: 700, cursor: loading ? "default" : "pointer",
            fontFamily: "inherit", color: "#000", minHeight: 50,
            background: loading ? C.surface2 : `linear-gradient(110deg, ${C.pink}, ${C.violet})`,
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "..." : tab === "signin" ? "enter" : "create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 22, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          one account works across budi & greatsouls.net.
        </p>
      </div>
    </div>
  );
}
