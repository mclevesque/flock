/**
 * One line-drawn icon set, replacing the emoji.
 *
 * Emoji were doing a lot of work here — the mute button, the tabs, the arena
 * pin, the photo prompts, the verdict marks — and they undercut everything
 * else about the look: each one is a full-colour illustration in somebody
 * else's style, they render differently on every platform, and next to Cinzel
 * and brass they read as a chat message rather than a product.
 *
 * These are all one system: a 24-unit grid, 1.9 stroke, round caps and joins,
 * `currentColor` throughout — so an icon inherits the colour of whatever it
 * sits in and needs no variant per context.
 *
 * The board marks are deliberately NOT here. A universe's crest is artwork,
 * not UI, and belongs with the board data — see `crest` in packs.
 */

export type IconName =
  | "sound" | "mute" | "mic" | "micOff"
  | "pin" | "eye" | "camera" | "search"
  | "up" | "down" | "check" | "close" | "arrow"
  | "trophy" | "crown" | "scales" | "swords" | "flame"
  | "friends" | "profile" | "cards" | "dice" | "bot" | "chevron";

const PATHS: Record<IconName, string> = {
  // ── Audio ────────────────────────────────────────────────────────────────
  sound: "M4 9v6h4l5 4V5L8 9H4Z M16.5 8.5a5 5 0 0 1 0 7 M19.5 5.5a9 9 0 0 1 0 13",
  mute: "M4 9v6h4l5 4V5L8 9H4Z M17 9.5l5 5 M22 9.5l-5 5",
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z M5 11a7 7 0 0 0 14 0 M12 18v3",
  micOff: "M9 9v3a3 3 0 0 0 4.6 2.5 M15 11V6a3 3 0 0 0-5.6-1.5 M5 11a7 7 0 0 0 10.5 6 M12 18v3 M4 4l16 16",

  // ── Objects ──────────────────────────────────────────────────────────────
  pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  eye: "M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  camera: "M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z M12 16a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4",

  // ── Marks ────────────────────────────────────────────────────────────────
  up: "M7 21V10l5-7c1.4 0 2.2 1 2 2.4L13.3 9H19a2 2 0 0 1 2 2.3l-1.2 7A2.4 2.4 0 0 1 17.4 21H7Z M7 10H4v11h3",
  down: "M17 3v11l-5 7c-1.4 0-2.2-1-2-2.4l.7-3.6H5a2 2 0 0 1-2-2.3l1.2-7A2.4 2.4 0 0 1 6.6 3H17Z M17 14h3V3h-3",
  check: "M4.5 12.5 10 18 19.5 6.5",
  close: "M6 6l12 12 M18 6 6 18",
  arrow: "M4 12h15 M13 6l6 6-6 6",
  chevron: "M6 9.5 12 15.5 18 9.5",

  // ── Game ─────────────────────────────────────────────────────────────────
  trophy: "M7 4h10v5a5 5 0 0 1-10 0V4Z M17 5h3v2a3 3 0 0 1-3 3 M7 5H4v2a3 3 0 0 0 3 3 M12 14v4 M8.5 21h7",
  crown: "M4 18h16 M4 18 3 7l5 3.5L12 4l4 6.5L21 7l-1 11",
  scales: "M12 4v16 M7 20h10 M4 9h16 M4 9 1.5 15a3.2 3.2 0 0 0 5 0L4 9Z M20 9l-2.5 6a3.2 3.2 0 0 0 5 0L20 9Z",
  swords: "M3 3h4l11 11-4 4L3 7V3Z M15 15l6 6 M21 3h-4L6 14l4 4L21 7V3Z M9 15l-6 6",
  flame: "M12 22a6 6 0 0 0 6-6c0-5-6-10-6-10S6 11 6 16a6 6 0 0 0 6 6Z M12 22a2.6 2.6 0 0 0 2.6-2.6c0-2.2-2.6-4.4-2.6-4.4s-2.6 2.2-2.6 4.4A2.6 2.6 0 0 0 12 22Z",

  // ── People and places ────────────────────────────────────────────────────
  friends: "M9 11a3.6 3.6 0 1 0 0-7.2A3.6 3.6 0 0 0 9 11Z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.3a3.6 3.6 0 0 1 0 6.9 M17.5 14.4a6.5 6.5 0 0 1 4 5.6",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 20.5a8 8 0 0 1 16 0",
  cards: "M8 6h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z M3.5 16.5V6a2 2 0 0 1 2-2h10",
  dice: "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-11Z M8.5 9h.01 M15.5 9h.01 M12 12h.01 M8.5 15h.01 M15.5 15h.01",
  bot: "M7 9h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z M12 6V9 M12 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z M9.5 13.5h.01 M14.5 13.5h.01 M9.5 16.5h5 M2.5 12v3 M21.5 12v3",
};

export default function Icon({
  name,
  size = 18,
  className,
  title,
}: {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative unless it is the only label — a button with visible text
      // beside it must not have the icon read out again.
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {PATHS[name].split(" M").map((d, i) => (
        <path key={i} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}
