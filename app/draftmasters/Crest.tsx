/**
 * A drawn mark per board, replacing the emoji.
 *
 * Every board used to be introduced by an emoji in a circle — a dragon, a
 * lightning bolt, a shark. They rendered differently on every platform, they
 * were drawn in somebody else's house style, and beside Cinzel and brass they
 * read as a chat message rather than as a product.
 *
 * These are line marks on the same 24-unit grid as the icon set, in
 * `currentColor`, so a crest inherits whatever it sits in and needs no variant
 * per context. A board with no crest gets the generic one rather than nothing,
 * which matters because the boards a player invents will never have one.
 */

const CRESTS: Record<string, string> = {
  got: "M12 2l2.2 6.4L21 11l-6.8 2.6L12 20l-2.2-6.4L3 11l6.8-2.6z",
  marvel: "M12 2.6l7.5 3.2v6c0 5-3.2 8.4-7.5 9.6-4.3-1.2-7.5-4.6-7.5-9.6v-6z",
  dc: "M12 4c1.6 0 3 1.2 3.6 2.8.8-1 2-1.2 2.8-.4-.4-1.6.8-2.4 1.6-2 .4 2 0 4-1.2 5.6 1.6 1.6 2 4 1.2 6-2-1.6-4.4-2-6.4-.8h-3.2C8.4 14 6 14.4 4 16c-.8-2-.4-4.4 1.2-6C4 8.4 3.6 6.4 4 4.4c.8-.4 2 .4 1.6 2 .8-.8 2-.6 2.8.4C9 5.2 10.4 4 12 4Z",
  pokemon: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM3 12h6M15 12h6M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  animals:
    "M12 21c-4 0-7-2.6-7-6 0-2.6 1.8-4.2 3-5-.6-2 .2-4 1.6-5 .4 1.4 1.4 2.2 2.4 2.2s2-.8 2.4-2.2c1.4 1 2.2 3 1.6 5 1.2.8 3 2.4 3 5 0 3.4-3 6-7 6Z",
  starwars: "M12 2v20M2 12h20M5 5l14 14M19 5 5 19",
  horror:
    "M12 21c-4.4 0-7.5-3.2-7.5-7.6C4.5 8 12 3 12 3s7.5 5 7.5 10.4C19.5 17.8 16.4 21 12 21ZM9.5 12h.01M14.5 12h.01M10 16h4",
  bosses: "M4 20V9l8-6 8 6v11ZM9 20v-5h6v5M9.5 10h.01M14.5 10h.01",
  anime: "M4 8h16M6 5h12M7 8v11M17 8v11M4 12h16",
  lotr: "M12 21a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 11V3M9 6l3-3 3 3",
  myth: "M13.6 2 6 13h5l-2.6 9L18 11h-5l3-9z",
  greek: "M12 3l9 5H3ZM6 8v11M10 8v11M14 8v11M18 8v11M3 21h18",
  berserk: "M12 21V6M12 6 9.5 2 12 .8 14.5 2ZM7 8h10",
  tmnt: "M12 3c4.4 0 8 3.6 8 8s-3.6 8-8 8-8-3.6-8-8 3.6-8 8-8ZM8 8h8M7 12h10M8 16h8",
  rangers: "M12 2l4 4v10l-4 6-4-6V6ZM8 9h8",
  ppg: "M12 20.5 4 13a4.7 4.7 0 0 1 8-5 4.7 4.7 0 0 1 8 5Z",
  invincible: "M4 20c4-2 6.5-5 8-9 1.5 4 4 7 8 9M12 3v6M9 5.5 12 3l3 2.5",
  mk: "M12 3c-4.4 0-8 2.8-8 6.4 0 3 2.4 5.2 5.2 5.8-1.8-1.2-2.8-2.8-2.8-4.6 0-3 2.6-5.2 5.6-5.2s5.6 2.2 5.6 5.2c0 1.8-1 3.4-2.8 4.6 2.8-.6 5.2-2.8 5.2-5.8C20 5.8 16.4 3 12 3ZM8 18h8",
  sf: "M12 2l8 5H4ZM6 7v3M18 7v3M4 10h16l-2 4H6ZM8 14v7M16 14v7",
  smash: "M12 2.5l2.6 6.6 7 .4-5.4 4.4 1.8 6.9-6-3.8-6 3.8 1.8-6.9L2.4 9.5l7-.4Z",
  tvd: "M15.5 3.5a8.5 8.5 0 1 0 0 17 10.5 10.5 0 0 1 0-17ZM7 9.5l1.6 3.2L12 14l-3.4 1.3L7 18.5l-1.6-3.2L2 14l3.4-1.3Z",
  xmen: "M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19ZM7.5 7.5l9 9M16.5 7.5l-9 9",
  godzilla: "M3 20h18M6 20l2-5 1.6 5M10.5 20l2.5-7 2 7M16 20l1.6-4.4L19 20M12 13V5l1.5-1.5L15 5v8",
  yugioh: "M12 3l9 15H3ZM12 8l4.6 8H7.4ZM8.6 13.5a3.4 2.1 0 0 0 6.8 0 3.4 2.1 0 0 0-6.8 0Z",
  cw: "M12 3v7M12 3a7 7 0 0 1 7 7M12 3a7 7 0 0 0-7 7M13.6 10 8 17h3l-1.4 5L16 15h-3.4l2-5Z",
  spn: "M12 3l8.6 6.2-3.3 10.1H6.7L3.4 9.2ZM12 7.4l4.6 3.3-1.8 5.4H9.2l-1.8-5.4Z",
  /** Not a world — the doorway to any of them. */
  custom: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM12 7v10M7 12h10",
};

export default function Crest({
  pack,
  size = 18,
  className,
}: {
  pack: string;
  size?: number;
  className?: string;
}) {
  const d = CRESTS[pack] ?? CRESTS.custom;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

export const hasCrest = (pack: string) => pack in CRESTS;
