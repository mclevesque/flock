/**
 * DraftMasters sound design.
 *
 * Everything is synthesised with WebAudio — no asset files, nothing to load,
 * nothing to 404 on a cold deploy. The brief was "subtle": the master gain is
 * deliberately low, tones are short, and the countdown tick is quiet enough to
 * feel like tension rather than an alarm.
 *
 * The context is created lazily on the first gesture, because browsers won't
 * let us make noise before the player has touched something anyway.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

const STORAGE_KEY = "dm_muted";

export function initAudio(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    // Was 0.26, on the theory that this plays under conversation. It does, but
    // it also plays when somebody presses a button, and at that level a press
    // read as nothing happening. Loud enough to feel, quiet enough to talk over.
    master.gain.value = 0.42;
    master.connect(ctx.destination);
    try {
      muted = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      /* private mode — default to unmuted */
    }
  } catch {
    ctx = null;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* nothing to persist to — fine */
  }
}

// ── Primitives ───────────────────────────────────────────────────────────────

interface ToneOpts {
  freq: number;
  /** Glide to this frequency over the note */
  to?: number;
  type?: OscillatorType;
  dur?: number;
  gain?: number;
  /** Seconds to wait before the note starts */
  delay?: number;
}

function tone({ freq, to, type = "sine", dur = 0.12, gain = 0.5, delay = 0 }: ToneOpts) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);

  // Fast attack, exponential tail — reads as a "tick" rather than a "beep".
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(env);
  env.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

interface NoiseOpts {
  dur?: number;
  gain?: number;
  /** Lowpass cutoff — lower is duller/woodier */
  cutoff?: number;
  /**
   * Sweep the cutoff to this frequency across the note.
   *
   * A static lowpass on decaying noise is a knock. Sweeping it downward is
   * something moving past you — which is the difference between a hiss and a
   * schwoop.
   */
  to?: number;
  delay?: number;
}

function noise({ dur = 0.09, gain = 0.35, cutoff = 1400, to, delay = 0 }: NoiseOpts = {}) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Decaying noise — the shape is what makes it a knock, not a hiss.
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2.5);
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, t0);
  if (to) filter.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + dur);

  const env = ctx.createGain();
  env.gain.value = gain;

  src.connect(filter);
  filter.connect(env);
  env.connect(master);
  src.start(t0);
}

// ── The kit ──────────────────────────────────────────────────────────────────

export const sfx = {
  /**
   * A pack slides under the thumb — the shelf's "schwoop".
   *
   * Filtered noise sweeping downward is foil sliding past foil; the short
   * pitched blip under it gives the movement a landing so it reads as arriving
   * at a pack rather than passing one. Quiet on purpose: this fires on every
   * snap, and anything with a tail turns a fast swipe into a smear.
   */
  swipe() {
    noise({ dur: 0.13, gain: 0.075, cutoff: 5200, to: 700 });
    tone({ freq: 660, to: 330, type: "sine", dur: 0.075, gain: 0.05 });
  },

  /** A new lot slides onto the block — soft upward swell. */
  lotIn() {
    tone({ freq: 220, to: 440, type: "sine", dur: 0.26, gain: 0.16 });
    tone({ freq: 330, to: 660, type: "sine", dur: 0.22, gain: 0.08, delay: 0.04 });
  },

  /** You placed a bid. Pitch climbs with the bid so a bidding war rises. */
  bid(step = 0) {
    const base = 520 + Math.min(step, 12) * 26;
    tone({ freq: base, to: base * 1.25, type: "triangle", dur: 0.09, gain: 0.3 });
    noise({ dur: 0.035, gain: 0.12, cutoff: 3200 });
  },

  /** The other side raised you — lower, blunter, a little rude. */
  outbid(step = 0) {
    const base = 300 + Math.min(step, 12) * 14;
    tone({ freq: base, to: base * 0.82, type: "sawtooth", dur: 0.11, gain: 0.16 });
    noise({ dur: 0.05, gain: 0.14, cutoff: 900 });
  },

  /** Gavel: wooden knock, then a small warm confirmation chime. */
  sold() {
    noise({ dur: 0.11, gain: 0.5, cutoff: 700 });
    noise({ dur: 0.08, gain: 0.28, cutoff: 520, delay: 0.075 });
    tone({ freq: 587.33, type: "sine", dur: 0.2, gain: 0.16, delay: 0.13 }); // D5
    tone({ freq: 880, type: "sine", dur: 0.26, gain: 0.12, delay: 0.19 }); // A5
  },

  /** Nobody wanted them. Dry, flat, slightly sad. */
  passed() {
    noise({ dur: 0.13, gain: 0.3, cutoff: 420 });
    tone({ freq: 196, to: 165, type: "sine", dur: 0.2, gain: 0.12, delay: 0.03 });
  },

  /** Countdown tick — only the last few seconds, and very quiet. */
  tick(urgent = false) {
    tone({
      freq: urgent ? 1180 : 940,
      type: "square",
      dur: 0.022,
      gain: urgent ? 0.075 : 0.045,
    });
  },

  /** Ready-up confirm. */
  ready() {
    tone({ freq: 523.25, type: "sine", dur: 0.1, gain: 0.2 });
    tone({ freq: 783.99, type: "sine", dur: 0.16, gain: 0.16, delay: 0.07 });
  },

  /** Board finished building. */
  boardReady() {
    tone({ freq: 392, type: "sine", dur: 0.14, gain: 0.14 });
    tone({ freq: 523.25, type: "sine", dur: 0.14, gain: 0.14, delay: 0.09 });
    tone({ freq: 659.25, type: "sine", dur: 0.24, gain: 0.14, delay: 0.18 });
  },

  /** Verdict lands. Short major swell — celebratory, not a fanfare. */
  verdict() {
    tone({ freq: 261.63, type: "triangle", dur: 0.36, gain: 0.14 });
    tone({ freq: 392, type: "triangle", dur: 0.36, gain: 0.13, delay: 0.1 });
    tone({ freq: 523.25, type: "triangle", dur: 0.44, gain: 0.15, delay: 0.2 });
    tone({ freq: 783.99, type: "sine", dur: 0.5, gain: 0.11, delay: 0.3 });
    noise({ dur: 0.3, gain: 0.06, cutoff: 5200, delay: 0.2 });
  },

  /** Generic UI press. */
  click() {
    // Two tones, the lower one a beat behind, so the press has a body under
    // it rather than just a tick on top.
    tone({ freq: 880, type: "triangle", dur: 0.04, gain: 0.2 });
    tone({ freq: 440, type: "triangle", dur: 0.075, gain: 0.16, delay: 0.012 });
  },
};
