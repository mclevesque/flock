"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setError(""); setLoading(true);
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
    setSuccess(true);
    setTimeout(() => router.push("/signin"), 2000);
  }

  if (!token) {
    return <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Invalid reset link. <a href="/signin" style={{ color: "var(--accent-purple-bright)" }}>Back to sign in →</a></p>;
  }

  if (success) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <p style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Password updated!</p>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Redirecting to sign in...</p>
      </div>
    );
  }

  const inputStyle = { width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 15, outline: "none", fontFamily: "inherit" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.5px" } as React.CSSProperties;

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>Set New Password</h2>
      <div>
        <label style={labelStyle}>NEW PASSWORD</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoFocus style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>CONFIRM PASSWORD</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required style={inputStyle} />
      </div>
      {error && <div style={{ background: "rgba(191,92,92,0.15)", border: "1px solid rgba(191,92,92,0.4)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#f08080" }}>{error}</div>}
      <button type="submit" disabled={loading}
        style={{ width: "100%", background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, marginTop: 4 }}>
        {loading ? "Updating..." : "Reset Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div className="panel" style={{ padding: 28 }}>
          <Suspense fallback={<p style={{ color: "var(--text-muted)" }}>Loading...</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
