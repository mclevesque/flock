"use client";

/**
 * Procedural fire audio for the hatching scene.
 *
 * Everything is synthesised with the Web Audio API — no .mp3 files to host on
 * R2, nothing to download, no CSP concerns, and the intensity can be driven
 * continuously as the fire grows rather than crossfading between clips.
 *
 * The bed is filtered white noise (the roar); crackle is a stream of short
 * filtered bursts at randomised intervals (the pops). Both scale with intensity.
 *
 * Browsers block audio until a user gesture, so start() must be called from a
 * click handler — which the "Stoke the flames" button is.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const MUTE_KEY = "emberkin_muted";

/** A few seconds of white noise, reused as a looping buffer source. */
function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 3;
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function useFireSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<AudioBufferSourceNode | null>(null);
  const bedGainRef = useRef<GainNode | null>(null);
  const bedFilterRef = useRef<BiquadFilterNode | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const crackleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intensityRef = useRef(0);
  const startedRef = useRef(false);

  const [muted, setMuted] = useState(false);

  // Deferred rather than read during render or synchronously in the effect:
  // localStorage isn't available server-side, and setting state synchronously
  // here would either cascade a render or risk a hydration mismatch on the icon.
  useEffect(() => {
    const id = setTimeout(() => {
      try { setMuted(localStorage.getItem(MUTE_KEY) === "1"); } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, []);

  /** One short filtered burst — a single pop in the fire. */
  const crackle = useCallback(() => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900 + Math.random() * 2600;
    bp.Q.value = 3 + Math.random() * 6;

    const g = ctx.createGain();
    const peak = (0.05 + Math.random() * 0.14) * (0.35 + intensityRef.current);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05 + Math.random() * 0.11);

    src.connect(bp).connect(g).connect(master);
    src.start(now);
    src.stop(now + 0.25);
  }, []);

  // Held in a ref so the self-rescheduling loop below never has to close over a
  // callback that hasn't been declared yet.
  const crackleRef = useRef(crackle);
  useEffect(() => { crackleRef.current = crackle; }, [crackle]);

  /** Starts the pop loop; pops get faster as the fire grows. */
  const scheduleCrackle = useCallback(() => {
    const tick = () => {
      const gap = (240 - intensityRef.current * 170) * (0.4 + Math.random());
      crackleTimer.current = setTimeout(() => {
        crackleRef.current();
        tick();
      }, gap);
    };
    tick();
  }, []);

  /** Must be called from a user gesture. Safe to call repeatedly. */
  const start = useCallback(() => {
    if (startedRef.current) {
      ctxRef.current?.resume().catch(() => {});
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as {
        webkitAudioContext?: typeof AudioContext
      }).webkitAudioContext;
      if (!Ctor) return;

      const ctx = new Ctor();
      ctxRef.current = ctx;

      const master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
      masterRef.current = master;

      // Low-passed noise bed = the roar.
      const noise = ctx.createBufferSource();
      noise.buffer = makeNoiseBuffer(ctx);
      noise.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      lp.Q.value = 0.7;
      bedFilterRef.current = lp;

      const bedGain = ctx.createGain();
      bedGain.gain.value = 0.02;
      bedGainRef.current = bedGain;

      noise.connect(lp).connect(bedGain).connect(master);
      noise.start();
      noiseRef.current = noise;

      startedRef.current = true;
      scheduleCrackle();
    } catch {
      // Audio is a nicety — never let it break the scene.
    }
  }, [muted, scheduleCrackle]);

  /** 0 = cold ash, 1 = roaring. Ramps smoothly rather than jumping. */
  const setIntensity = useCallback((v: number) => {
    const i = Math.max(0, Math.min(1, v));
    intensityRef.current = i;
    const ctx = ctxRef.current;
    if (!ctx || !bedGainRef.current || !bedFilterRef.current) return;

    const now = ctx.currentTime;
    bedGainRef.current.gain.cancelScheduledValues(now);
    bedGainRef.current.gain.linearRampToValueAtTime(0.02 + i * 0.16, now + 0.9);
    bedFilterRef.current.frequency.cancelScheduledValues(now);
    bedFilterRef.current.frequency.linearRampToValueAtTime(420 + i * 1500, now + 0.9);
  }, []);

  /** A whoosh — the fire leaping up when stoked, or the shell breaking. */
  const roar = useCallback((strength = 1) => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(180, now);
    bp.frequency.exponentialRampToValueAtTime(1400 * strength, now + 0.5);
    bp.Q.value = 1.1;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.34 * strength, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

    src.connect(bp).connect(g).connect(master);
    src.start(now);
    src.stop(now + 1.3);

    // A flurry of pops rides the whoosh.
    for (let i = 0; i < 9 * strength; i++) setTimeout(crackle, Math.random() * 620);
  }, [crackle]);

  const toggleMute = useCallback(() => {
    setMuted(m => {
      const next = !m;
      try { localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch {}
      const ctx = ctxRef.current;
      if (ctx && masterRef.current) {
        masterRef.current.gain.linearRampToValueAtTime(next ? 0 : 0.9, ctx.currentTime + 0.15);
      }
      return next;
    });
  }, []);

  /** Fades out and tears down — called when the scene ends or unmounts. */
  const stop = useCallback(() => {
    if (crackleTimer.current) { clearTimeout(crackleTimer.current); crackleTimer.current = null; }
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      masterRef.current?.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      setTimeout(() => {
        try { noiseRef.current?.stop(); } catch {}
        ctx.close().catch(() => {});
        ctxRef.current = null;
        startedRef.current = false;
      }, 700);
    } catch {}
  }, []);

  useEffect(() => () => { stop(); }, [stop]);

  return { start, stop, setIntensity, roar, muted, toggleMute };
}
