"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { C, display, Smiley, useIsLandscape } from "./_ui";

const BYPASS_USERS = ["peanut", "babachoo", "thegreattester"];

export default function BudiAuth() {
  const router = useRouter();
  const landscape = useIsLandscape();
  const [tab, setTab] = useState<"register" | "signin">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isBypass = BYPASS_USERS.includes(username.trim().toLowerCase());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    if (tab === "register") {
      const res = await fetch("/api/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setLoading(false); setError(data.error ?? "Could not create account."); return; }
    }
    const result = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError(tab === "register" ? "Account made — log in below." : "Wrong username or password.");
      if (tab === "register") setTab("signin");
    } else {
      router.refresh();
    }
  }

  // Login is a portrait task — nudge upright in landscape
  if (landscape) {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: display, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>📱</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>rotate your phone upright</div>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>budi works best in portrait — turn sideways only to record.</p>
      </div>
    );
  }

  const input: React.CSSProperties = {
    width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
    padding: "15px 16px", color: C.text, fontSize: 16, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };
  const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 7 };

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: display, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "8vh 24px calc(40px + env(safe-area-inset-bottom))", overflowY: "auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <Smiley size={56} color={C.pink} />
        <h1 style={{
          margin: 0, fontWeight: 700, fontSize: "clamp(40px, 14vw, 60px)", lineHeight: 1, letterSpacing: "-0.02em",
          background: `linear-gradient(110deg, ${C.pink} 0%, ${C.violet} 45%, ${C.teal} 100%)`,
          WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>budi</h1>
        <p style={{ margin: 0, color: C.muted, fontSize: 14, fontWeight: 500 }}>record your day with friends.</p>
      </div>

      <div style={{ width: "100%", maxWidth: 360 }}>
        {/* Clear segmented toggle */}
        <div style={{ display: "flex", background: C.surface2, borderRadius: 14, padding: 5, marginBottom: 20 }}>
          {(["register", "signin"] as const).map(t => (
            <button key={t} type="button" onClick={() => { setTab(t); setError(""); }} style={{
              flex: 1, padding: 13, borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: 16, fontWeight: 700, minHeight: 48,
              background: tab === t ? "#fff" : "transparent", color: tab === t ? "#000" : C.muted,
            }}>{t === "register" ? "sign up" : "log in"}</button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={label}>username</label>
            <input type="text" value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="yourname" required autoFocus maxLength={20} autoComplete="username"
              enterKeyHint="next" style={input} />
          </div>
          {!isBypass && (
            <div>
              <label style={label}>password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required={!isBypass}
                autoComplete={tab === "register" ? "new-password" : "current-password"}
                enterKeyHint="go" style={input} />
            </div>
          )}
          {isBypass && <div style={{ fontSize: 13, color: C.teal, textAlign: "center" }}>✨ welcome back — no password needed.</div>}
          {error && <div style={{ background: "rgba(255,62,201,0.12)", border: `1px solid ${C.pinkDim}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#ff8fde" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: "100%", border: "none", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 700,
            cursor: loading ? "default" : "pointer", fontFamily: "inherit", color: "#000", minHeight: 52,
            background: loading ? C.surface2 : `linear-gradient(110deg, ${C.pink}, ${C.violet})`, opacity: loading ? 0.6 : 1,
          }}>{loading ? "…" : tab === "register" ? "create account" : "log in"}</button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          one account works across budi & greatsouls.net.
        </p>
      </div>
    </div>
  );
}
