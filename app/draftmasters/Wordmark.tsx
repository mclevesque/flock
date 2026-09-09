/**
 * The DraftMasters lockup.
 *
 * The painted mark, not a redrawing of it. I tried rebuilding the emblem in
 * SVG and it was never going to match — the facets and the lighting on the D
 * are painted, and geometry only approximates them.
 *
 * It ships as an opaque crop on its original black and is knocked out with
 * `mix-blend-mode: screen`, which drops black to nothing against any dark
 * ground. That is deliberate: keying transparency from luminance instead
 * reconstructs every anti-aliased edge from a guess, and the first attempt
 * came back with a grey halo and washed-out gold. Screen blending preserves
 * the artwork exactly as painted.
 *
 * The one constraint: it needs a DARK surface behind it. On DraftMasters that
 * is always true.
 */
export default function Wordmark({ height = 46 }: { height?: number }) {
  return (
    <img
      className="dm-logo"
      src="/draftmasters/logo.png"
      alt="DraftMasters"
      style={{ height }}
      width={786}
      height={186}
    />
  );
}
