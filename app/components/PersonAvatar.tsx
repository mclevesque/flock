"use client";

import { useState } from "react";
import { avatarSrc, defaultPortraitFor } from "@/lib/avatars";

/**
 * A person's face, anywhere on the site.
 *
 * Their photo if they have one; their drawn portrait if they do not; and the
 * drawn portrait again if the photo fails to load — so a dead R2 link shows a
 * knight, not a broken-image glyph or an initial.
 *
 * Deliberately unstyled beyond filling its box: the hub sizes things with
 * inline styles and DraftMasters with classes, and both pass through.
 */
export default function PersonAvatar({
  src,
  seed,
  size,
  className,
  style,
  alt = "",
  speaking,
}: {
  src: string | null | undefined;
  /** User id where there is one, username otherwise. Picks the fallback drawing. */
  seed: string | null | undefined;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
  /** Rendered as data-speaking, for stylesheets that ring a talking face. */
  speaking?: boolean;
}) {
  const wanted = avatarSrc(src, seed);
  const fallback = defaultPortraitFor(seed);
  // Remember which URL failed rather than what to show instead: a new photo
  // arriving later is a different URL, so it gets its own chance to load.
  const [failed, setFailed] = useState<string | null>(null);
  const shown = failed === wanted ? fallback : wanted;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={shown}
      alt={alt}
      className={className}
      data-speaking={speaking === undefined ? undefined : speaking ? "1" : "0"}
      width={size}
      height={size}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (shown !== fallback) setFailed(wanted);
      }}
      style={{
        objectFit: "cover",
        ...(size ? { width: size, height: size } : null),
        ...style,
      }}
    />
  );
}
