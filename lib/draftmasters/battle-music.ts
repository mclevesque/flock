/**
 * Procedural battle music for the DraftMasters battle cinematic.
 *
 * Synthesised, not streamed — same reasoning as sfx.ts. There is no audio file
 * to load, nothing to 404 on a cold deploy, and the track can react to the
 * fight: `setIntensity` adds layers as the battle escalates, and `hit` punches
 * a taiko accent on a clash so the music lands with the picture.
 *
 * A lookahead scheduler (not setInterval-per-note) keeps timing solid when the
 * main thread is busy animating — timers drift, the audio clock doesn't.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bus: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

let nextNoteTime = 0;
let step = 0;
let intensity = 0.35;
let running = false;

const BPM = 96;
const STEP = 60 / BPM / 2; // eighth notes
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

// D minor — dark, and it sits under speech without fighting it.
const ROOT = 73.42; // D2
const FIFTH = 110.0; // A2
const MINOR_THIRD = 87.31; // F2

function now(): number {
  return ctx?.currentTime ?? 0;
}

function ensure(): boolean {
  if (ctx) return true;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0;
    // Gentle bus compression so drums don't swamp the caption voiceover feel.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
    return true;
  } catch {
    ctx = null;
    return false;
  }
}

// ── Voices ───────────────────────────────────────────────────────────────────

function kick(t: number, gain = 1) {
  if (!ctx || !bus) return;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.11);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.9 * gain, t + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  osc.connect(env);
  env.connect(bus);
  osc.start(t);
  osc.stop(t + 0.36);
}

function noiseHit(t: number, dur: number, gain: number, cutoff: number, type: BiquadFilterType = "bandpass") {
  if (!ctx || !bus) return;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = cutoff;
  filter.Q.value = 0.8;
  const env = ctx.createGain();
  env.gain.value = gain;
  src.connect(filter);
  filter.connect(env);
  env.connect(bus);
  src.start(t);
}

/** Big war-drum accent — also used for on-screen impacts. */
function taiko(t: number, gain = 1) {
  if (!ctx || !bus) return;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(210, t);
  osc.frequency.exponentialRampToValueAtTime(62, t + 0.18);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.75 * gain, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  osc.connect(env);
  env.connect(bus);
  osc.start(t);
  osc.stop(t + 0.52);
  noiseHit(t, 0.09, 0.18 * gain, 1800);
}

function drone(t: number, freq: number, dur: number, gain: number) {
  if (!ctx || !bus) return;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = "sawtooth";
  osc.frequency.value = freq;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(320, t);
  filter.frequency.linearRampToValueAtTime(900, t + dur * 0.5);
  filter.frequency.linearRampToValueAtTime(320, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
  env.gain.linearRampToValueAtTime(0.0001, t + dur);
  osc.connect(filter);
  filter.connect(env);
  env.connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// ── Pattern ──────────────────────────────────────────────────────────────────

/** One 16-step bar. Layers switch on as intensity climbs. */
function scheduleStep(s: number, t: number) {
  const i = intensity;

  // Heartbeat kick — always there.
  if (s % 8 === 0) kick(t, 1);
  else if (s % 8 === 6) kick(t, 0.55);
  if (i > 0.55 && s % 8 === 3) kick(t, 0.4);

  // Backbeat.
  if (s % 8 === 4) noiseHit(t, 0.16, 0.3 + i * 0.25, 1400);

  // Driving eighths once things heat up.
  if (i > 0.55 && s % 4 === 3) noiseHit(t, 0.035, 0.04 + i * 0.03, 3800, "bandpass");

  // War drums.
  if (i > 0.6 && (s === 12 || s === 14)) taiko(t, 0.5);

  // Bass drone, one per bar; the third climbs in at high intensity.
  if (s === 0) {
    drone(t, ROOT, STEP * 16, 0.1 + i * 0.09);
    if (i > 0.7) drone(t, MINOR_THIRD, STEP * 16, 0.05);
  }
  if (s === 8 && i > 0.45) drone(t, FIFTH, STEP * 8, 0.07 + i * 0.05);
}

function tick() {
  if (!ctx) return;
  while (nextNoteTime < now() + SCHEDULE_AHEAD) {
    scheduleStep(step % 16, nextNoteTime);
    nextNoteTime += STEP;
    step++;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function startBattleMusic(volume = 0.5): void {
  if (!ensure() || !ctx || !master) return;
  if (ctx.state === "suspended") void ctx.resume();
  if (running) {
    master.gain.cancelScheduledValues(now());
    master.gain.linearRampToValueAtTime(volume, now() + 0.4);
    return;
  }
  running = true;
  step = 0;
  nextNoteTime = now() + 0.06;
  master.gain.cancelScheduledValues(now());
  master.gain.setValueAtTime(0.0001, now());
  master.gain.linearRampToValueAtTime(volume, now() + 1.2);
  timer = setInterval(tick, LOOKAHEAD_MS);
}

export function stopBattleMusic(fade = 0.8): void {
  if (!ctx || !master) return;
  master.gain.cancelScheduledValues(now());
  master.gain.setValueAtTime(master.gain.value, now());
  master.gain.linearRampToValueAtTime(0.0001, now() + fade);
  const t = timer;
  timer = null;
  running = false;
  setTimeout(() => {
    if (t) clearInterval(t);
  }, fade * 1000 + 100);
}

/** 0–1. Layers thicken as the fight escalates. */
export function setBattleIntensity(next: number): void {
  intensity = Math.max(0, Math.min(1, next));
}

/** Punch an accent so a clash on screen lands in the music too. */
export function battleHit(strength = 1): void {
  if (!ensure() || !ctx) return;
  const t = now() + 0.01;
  taiko(t, 0.55 + strength * 0.45);
  // A crack over the drum, not a hiss behind it. Bandpassed low so it has a
  // body, and short enough that it reads as impact rather than as texture.
  if (strength > 0.75) noiseHit(t + 0.015, 0.07, 0.1, 900, "bandpass");
}

/** Steel on steel, for a clash beat. */
export function swordClash(): void {
  if (!ensure() || !ctx || !bus) return;
  const t = now() + 0.01;
  noiseHit(t, 0.16, 0.3, 4200, "bandpass");
  noiseHit(t + 0.015, 0.09, 0.07, 5200, "bandpass");
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(2400, t);
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.16);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.12, t + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(env);
  env.connect(bus);
  osc.start(t);
  osc.stop(t + 0.22);
}

/** Short triumphant swell for the final beat. */
/**
 * The end of a fight, on the winner's screen.
 *
 * F major -- the relative major of the battle's D minor -- so it is the same
 * world resolving rather than a key change nobody asked for. Long enough to
 * hold a screen: a swelling chord, a rising figure over the top, and two
 * taiko hits to put a floor under it.
 */
export function victoryFanfare(): void {
  if (!ensure() || !ctx || !bus) return;
  const t = now() + 0.03;

  // The chord underneath: F major, wide, swelling in rather than struck.
  [87.31, 174.61, 261.63, 349.23].forEach((f) => {
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.1, t + 0.5);
    env.gain.setValueAtTime(0.1, t + 2.2);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    osc.connect(env);
    env.connect(bus);
    osc.start(t);
    osc.stop(t + 4.3);
  });

  // The figure over the top. Dotted, so it reads as a fanfare and not a scale.
  const line: [number, number][] = [
    [349.23, 0.0], [523.25, 0.22], [698.46, 0.44],
    [659.25, 0.86], [698.46, 1.06], [880.0, 1.32],
  ];
  for (const [f, at] of line) {
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    env.gain.setValueAtTime(0.0001, t + at);
    env.gain.exponentialRampToValueAtTime(0.17, t + at + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, t + at + 1.5);
    osc.connect(env);
    env.connect(bus);
    osc.start(t + at);
    osc.stop(t + at + 1.6);
  }

  taiko(t, 1);
  taiko(t + 0.44, 0.75);
  taiko(t + 1.32, 0.9);
}

export function victorySting(): void {
  if (!ensure() || !ctx || !bus) return;
  const t = now() + 0.02;
  [146.83, 220, 293.66, 440].forEach((f, i) => {
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = i > 2 ? "sine" : "triangle";
    osc.frequency.value = f;
    env.gain.setValueAtTime(0.0001, t + i * 0.09);
    env.gain.exponentialRampToValueAtTime(0.16, t + i * 0.09 + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 1.1);
    osc.connect(env);
    env.connect(bus);
    osc.start(t + i * 0.09);
    osc.stop(t + i * 0.09 + 1.15);
  });
  taiko(t, 1);
  taiko(t + 0.28, 0.7);
}
