"use client";

// ── Budi neon design system ──────────────────────────────────────────────────
export const C = {
  bg: "#000000",
  surface: "#141416",
  surface2: "#1c1c1e",
  pink: "#ff3ec9",
  pinkDim: "#c026a3",
  teal: "#2de0d0",
  yellow: "#f6d23b",
  violet: "#9b5cff",
  text: "#ffffff",
  muted: "#8a8a8e",
  border: "rgba(255,255,255,0.09)",
};

export const display = "var(--font-budi-display), system-ui, -apple-system, sans-serif";

export interface BudiLog {
  id: string;
  kind: string;                 // 'group' | 'solo'
  name: string;
  owner_id: string;
  invite_code: string | null;
  max_members: number;
  clip_max_seconds: number;
  created_at: string;
  role?: string;
  streak_count?: number;
  last_post_date?: string | null;
  member_count?: number;
  clips_today?: number;
  last_clip_at?: string | null;
}

export interface BudiMember {
  user_id: string;
  role: string;
  streak_count: number;
  last_post_date: string | null;
  joined_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

const MEMBER_COLORS = [
  "#ff3ec9", "#2de0d0", "#f6d23b", "#9b5cff", "#56d364",
  "#ff8c42", "#4aa8ff", "#ff6b9d", "#c084fc", "#34d399",
];

export function memberColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return MEMBER_COLORS[h % MEMBER_COLORS.length];
}

// Pink smiley mascot — the Budi default avatar
export function Smiley({ size = 36, color = C.pink }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden="true">
        <circle cx="13" cy="15" r="1.9" fill="#101012" />
        <circle cx="23" cy="15" r="1.9" fill="#101012" />
        <path d="M11.5 21 q6.5 5.5 13 0" fill="none" stroke="#101012" strokeWidth="2.1" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function Avatar({ url, seed, size = 36 }: { url?: string | null; seed?: string; size?: number }) {
  if (url) {
    return <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return <Smiley size={size} color={memberColor(seed ?? "budi")} />;
}

export function ago(dateStr?: string | null): string {
  if (!dateStr) return "";
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "";
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); return `${d}d`;
}
