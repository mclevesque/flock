/**
 * flock sound design — Web Audio API, zero dependencies, zero network
 * All sounds are synthetic, theme-appropriate, and non-intrusive.
 */

function ctx(): AudioContext | null {
  try { return new AudioContext(); } catch { return null; }
}

function noteFreq(note: string): number {
  const notes: Record<string, number> = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,
    A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
    G5: 783.99, A5: 880.0, C6: 1046.5, G3: 196.0, A3: 220.0,
  };
  return notes[note] ?? 440;
}

/** Quick soft swipe — navbar hover */
export function navHover() {
  const c = ctx(); if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(680, c.currentTime + 0.06);
  gain.gain.setValueAtTime(0.06, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.08);
  osc.onended = () => c.close();
}

/** Soft click — generic button press */
export function click() {
  const c = ctx(); if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(400, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(260, c.currentTime + 0.07);
  gain.gain.setValueAtTime(0.1, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.1);
  osc.onended = () => c.close();
}

/** Happy three-note chord — add friend / accept */
export function friendAdded() {
  const c = ctx(); if (!c) return;
  [[noteFreq("C5"), 0], [noteFreq("E5"), 0.07], [noteFreq("G5"), 0.14]].forEach(([freq, delay]) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, c.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0.12, c.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.35);
    osc.start(c.currentTime + delay); osc.stop(c.currentTime + delay + 0.35);
  });
  setTimeout(() => c.close(), 700);
}

/** Rising sparkle — like / positive action */
export function sparkle() {
  const c = ctx(); if (!c) return;
  [noteFreq("G5"), noteFreq("A5"), noteFreq("C6")].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = c.currentTime + i * 0.05;
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.start(t); osc.stop(t + 0.22);
  });
  setTimeout(() => c.close(), 600);
}

/** Satisfying thunk — drag-drop release */
export function drop() {
  const c = ctx(); if (!c) return;
  // low thud
  const buf = c.createBuffer(1, c.sampleRate * 0.15, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.04));
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  src.connect(gain); gain.connect(c.destination);
  gain.gain.value = 0.35;
  src.start(c.currentTime);
  // click on top
  const osc = c.createOscillator();
  const og = c.createGain();
  osc.connect(og); og.connect(c.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(160, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.1);
  og.gain.setValueAtTime(0.2, c.currentTime);
  og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.1);
  setTimeout(() => c.close(), 300);
}

/** Soft pop — toggle / chip select */
export function pop() {
  const c = ctx(); if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(700, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(350, c.currentTime + 0.05);
  gain.gain.setValueAtTime(0.12, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.08);
  osc.onended = () => c.close();
}

/** Swoosh — panel open / dropdown */
export function swoosh() {
  const c = ctx(); if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(300, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.12);
  gain.gain.setValueAtTime(0.07, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.07, c.currentTime + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.15);
  osc.onended = () => c.close();
}

/** Error buzz */
export function error() {
  const c = ctx(); if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc.type = "sawtooth";
  osc.frequency.value = 120;
  gain.gain.setValueAtTime(0.08, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.18);
  osc.onended = () => c.close();
}
