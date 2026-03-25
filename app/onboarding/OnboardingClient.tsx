"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import Image from "next/image";

interface Props {
  userId: string;
  displayName: string;
  isDiscord: boolean;
  discordAvatar: string | null;
}

export default function OnboardingClient({ userId, displayName, isDiscord, discordAvatar }: Props) {
  const router = useRouter();
  const { session } = useClerk();
  const [username, setUsername] = useState(
    displayName.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20)
  );
  const [useDiscordAvatar, setUseDiscordAvatar] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        avatarUrl: isDiscord && useDiscordAvatar ? discordAvatar : null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    // Force Clerk to refetch the session token so publicMetadata.username is included
    await session?.reload();
    window.location.href = "/profile";
  }

  return (
    <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32, position: "relative" }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 300, height: 150, pointerEvents: "none",
            background: "radial-gradient(ellipse, rgba(0,229,255,0.13) 0%, rgba(139,60,247,0.09) 50%, transparent 80%)",
          }} />
          <div style={{
            fontSize: 58, fontWeight: 900, fontStyle: "italic",
            letterSpacing: "-3px", lineHeight: 1,
            background: "linear-gradient(120deg, #00e5ff 0%, #a855f7 55%, #d946ef 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 2px 14px rgba(0,229,255,0.4))",
            position: "relative",
          }}>
            RYFT
          </div>
          <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", fontSize: 15 }}>
            {isDiscord ? "We grabbed your Discord info — confirm or change below." : "One last step — set up your profile."}
          </p>
        </div>

        <div className="panel" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Discord avatar — shown prominently with preview */}
            {isDiscord && discordAvatar && (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.5px" }}>
                  PROFILE PICTURE
                </label>
                {/* Live preview of selected avatar */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <div style={{ position: "relative" }}>
                    {useDiscordAvatar ? (
                      <Image src={discordAvatar} alt="Discord avatar" width={80} height={80}
                        style={{ borderRadius: "50%", objectFit: "cover", border: "3px solid #5865F2" }} unoptimized />
                    ) : (
                      <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--bg-sunken)", border: "3px solid var(--accent-purple)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🎨</div>
                    )}
                    <div style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: "50%", background: useDiscordAvatar ? "#5865F2" : "var(--accent-purple)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                      {useDiscordAvatar ? "D" : "✦"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setUseDiscordAvatar(true)}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
                      background: useDiscordAvatar ? "#5865F2" : "var(--bg-elevated)",
                      border: useDiscordAvatar ? "2px solid #5865F2" : "2px solid var(--border)",
                      color: useDiscordAvatar ? "#fff" : "var(--text-secondary)" }}>
                    Discord avatar
                  </button>
                  <button type="button" onClick={() => setUseDiscordAvatar(false)}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
                      background: !useDiscordAvatar ? "rgba(160,100,255,0.15)" : "var(--bg-elevated)",
                      border: !useDiscordAvatar ? "2px solid var(--accent-purple)" : "2px solid var(--border)",
                      color: !useDiscordAvatar ? "var(--accent-purple-bright)" : "var(--text-secondary)" }}>
                    Set up my own
                  </button>
                </div>
                {!useDiscordAvatar && (
                  <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                    Upload or create an avatar from Edit Profile after joining.
                  </p>
                )}
              </div>
            )}

            {/* Username — pre-filled from Discord */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.5px" }}>
                USERNAME {isDiscord && <span style={{ color: "#5865F2", fontWeight: 400, textTransform: "none", fontSize: 11 }}>· from Discord</span>}
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                placeholder="yourname"
                required
                autoFocus
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 15, outline: "none", fontFamily: "inherit" }}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Letters, numbers, underscores only. Becomes your profile URL. You can change this later.
              </div>
            </div>

            {error && (
              <div style={{ background: "rgba(191,92,92,0.15)", border: "1px solid rgba(191,92,92,0.4)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#f08080" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || username.length < 2}
              style={{ width: "100%", background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Setting up..." : "Enter Ryft →"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>
          No ads. No tracking. No BS.
        </p>
      </div>
    </div>
  );
}
