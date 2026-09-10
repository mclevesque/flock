/**
 * The rite's clock: given a moment, which line belongs on screen?
 *
 * The nine-timer version could paint a step from the middle of the sequence
 * for a frame when the tab had been throttled and several fired at once. This
 * derives the answer instead, so a late wake-up lands on the right line rather
 * than catching up through the ones it missed.
 */
import { stepAt } from "./rite.ts";
import assert from "node:assert";

const RITE = [
  { at: 300 }, { at: 3000 }, { at: 6600 }, { at: 8600 }, { at: 12000 },
  { at: 13000 }, { at: 15800 }, { at: 19600 }, { at: 20600 },
];

let pass = 0;
const it = (name: string, fn: () => void) => {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { console.log("FAIL  " + name + "\n      " + (e as Error).message); process.exitCode = 1; }
};

it("shows nothing before the first line is due", () => {
  assert.equal(stepAt(RITE, 0), -1);
  assert.equal(stepAt(RITE, 299), -1);
});

it("lands exactly on a step at its own moment", () => {
  assert.equal(stepAt(RITE, 300), 0);
  assert.equal(stepAt(RITE, 6600), 2);
  assert.equal(stepAt(RITE, 20600), 8);
});

it("holds a line until the next one is due", () => {
  // The window the glitch was reported in: between "Who will be victorious?"
  // and the team names, nothing else may appear.
  for (let ms = 6600; ms < 8600; ms += 37) {
    assert.equal(stepAt(RITE, ms), 2, `ms=${ms} should still be step 2`);
  }
});

it("skips straight to the right line after a long stall", () => {
  // A throttled tab wakes up 14 seconds late. The nine-timer version fired
  // every missed step in a burst; this one simply answers correctly.
  assert.equal(stepAt(RITE, 14000), 5);
  assert.equal(stepAt(RITE, 99000), 8);
});

it("never runs off the end", () => {
  assert.equal(stepAt(RITE, Number.MAX_SAFE_INTEGER), RITE.length - 1);
});

console.log(`\n${pass} passing`);
