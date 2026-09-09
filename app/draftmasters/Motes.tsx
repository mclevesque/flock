"use client";

import { useEffect, useRef } from "react";

/**
 * The air in the room.
 *
 * The first version of this was two boxes of CSS radial-gradients pinned to
 * the case — 190% of its width, which on a wide screen is a 684px rectangle
 * of sparkle sitting in the middle of a black page with a visible edge. It
 * read as a box, because it was one.
 *
 * This is the whole viewport instead, and the light falls off from the case
 * rather than stopping at a border: thickest and brightest where you are
 * looking, thinning into the corners without ever reaching nothing. Canvas
 * rather than more gradients, because a hundred and forty independently
 * drifting specks is not something CSS should be asked to do, and because
 * intensity-by-distance is one line of arithmetic here and impossible there.
 */

interface Mote {
  x: number;        // 0..1 of the viewport
  y: number;
  r: number;        // px at dpr 1
  drift: number;    // px per second, sideways
  rise: number;     // px per second, upward
  phase: number;    // where in its own twinkle it starts
  speed: number;    // how fast it twinkles
  alpha: number;    // its own brightness before the falloff
}

/** Where the light is coming from, as a fraction of the viewport. */
const FOCUS_X = 0.5;
const FOCUS_Y = 0.42;

function seedMotes(n: number): Mote[] {
  // A fixed sequence, so the field does not reshuffle itself on every render.
  let s = 0x2f6e2b1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: n }, () => ({
    x: rnd(),
    y: rnd(),
    r: 0.4 + rnd() * rnd() * 2.1,      // squared, so most are small and a few are not
    drift: (rnd() - 0.5) * 11,
    rise: 3 + rnd() * 15,
    phase: rnd() * Math.PI * 2,
    speed: 0.25 + rnd() * 0.5,
    alpha: 0.25 + rnd() * 0.75,
  }));
}

export default function Motes() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1;
    let motes: Mote[] = [];

    const size = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Denser on a big screen, so the field reads the same at any width
      // instead of thinning out into a few lonely specks.
      motes = seedMotes(Math.round(Math.min(300, Math.max(90, (w * h) / 5600))));
    };

    /**
     * How much of its brightness a mote keeps, by distance from the case.
     *
     * Never returns zero: the far field has to stay alive or the page grows
     * an edge again, just a softer one. The floor is what makes it ambient
     * rather than a spotlight.
     */
    const falloff = (x: number, y: number): number => {
      const dx = (x - FOCUS_X) * 1.35;   // wider than tall — the case is a portrait
      const dy = y - FOCUS_Y;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 0.78);
      const near = (1 - d) ** 2;
      // The floor is what keeps the far field alive. Drop it and the page
      // grows a soft edge instead of a hard one, which is no better.
      return 0.22 + near * 0.78;
    };

    let raf = 0;
    let t0 = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      ctx.clearRect(0, 0, w, h);

      // ── The bloom ───────────────────────────────────────────────────────
      // Painted here rather than on the case, because the case sits in a
      // scroll container that clips it into a rectangle. This is fixed to the
      // viewport and reaches the corners.
      const fx = FOCUS_X * w;
      const fy = FOCUS_Y * h;
      const reach = Math.max(w, h) * (still ? 0.78 : 0.78 + Math.sin(now * 0.00013) * 0.05);
      const bloom = ctx.createRadialGradient(fx, fy, 0, fx, fy, reach);
      bloom.addColorStop(0, "rgba(217, 178, 106, 0.16)");
      bloom.addColorStop(0.22, "rgba(217, 178, 106, 0.085)");
      bloom.addColorStop(0.52, "rgba(217, 178, 106, 0.028)");
      bloom.addColorStop(1, "rgba(217, 178, 106, 0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "lighter";

      for (const m of motes) {
        if (!still) {
          m.x += (m.drift * dt) / Math.max(1, w);
          m.y -= (m.rise * dt) / Math.max(1, h);
          if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
          if (m.x < -0.02) m.x = 1.02;
          if (m.x > 1.02) m.x = -0.02;
        }

        const twinkle = still ? 0.8 : 0.55 + 0.45 * Math.sin(m.phase + now * 0.001 * m.speed);
        const a = m.alpha * twinkle * falloff(m.x, m.y);
        if (a <= 0.012) continue;

        const px = m.x * w;
        const py = m.y * h;
        const r = m.r;

        // A soft halo under a hard core — one gradient per mote is expensive,
        // so the halo is a shadow instead, which the compositor does for free.
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(233, 205, 150, ${a.toFixed(3)})`;
        ctx.shadowColor = `rgba(217, 178, 106, ${(a * 0.75).toFixed(3)})`;
        ctx.shadowBlur = r * 6;
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
      if (!still) raf = requestAnimationFrame(draw);
    };

    size();
    raf = requestAnimationFrame(draw);

    const onResize = () => { size(); if (still) draw(performance.now()); };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="dm-motes-field" aria-hidden="true" />;
}
