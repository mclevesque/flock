/**
 * The rite's clock: given a moment, which line belongs on screen?
 *
 * The nine-timer version could paint a step from the middle of the sequence
 * for a frame when the tab had been throttled and several fired at once. This
 * derives the answer instead, so a late wake-up lands on the right line rather
 * than catching up through the ones it missed.
 */
import { riteFor, skipFrom, stepAt, RITE_HOLD } from "./rite.ts";
import assert from "node:assert";

const RITE = riteFor("mclevesque", "The Shark");
const END = RITE[RITE.length - 1].at + RITE_HOLD;

let pass = 0;
const it = (name: string, fn: () => void) => {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { console.log("FAIL  " + name + "\n      " + (e as Error).message); process.exitCode = 1; }
};

it("opens on the first line, with nothing before it", () => {
  assert.equal(stepAt(RITE, -1), -1);
  assert.equal(stepAt(RITE, 0), 0);
});

it("lands exactly on a step at its own moment", () => {
  assert.equal(stepAt(RITE, 2600), 1);
  assert.equal(stepAt(RITE, 8800), 4);
});

it("holds a line until the next one is due", () => {
  for (let ms = 2600; ms < 5400; ms += 37) {
    assert.equal(stepAt(RITE, ms), 1, `ms=${ms} should still be step 1`);
  }
});

it("skips straight to the right line after a long stall", () => {
  assert.equal(stepAt(RITE, 6000), 2);
  assert.equal(stepAt(RITE, 99000), RITE.length - 1);
});

it("is over in about ten seconds", () => {
  // The whole point of the rewrite: the old one ran past twenty-three.
  assert.ok(END > 8000 && END < 11000, `rite runs ${END}ms`);
});

it("says both team names, and both blessings", () => {
  const said = RITE.flatMap((s) => s.lines).join(" ");
  for (const want of ["mclevesque", "The Shark", "The Warrior", "The Mother", "death sustain life"]) {
    assert.ok(said.includes(want), `the rite never says "${want}"`);
  }
});

// ── A tap moves it on a line ──────────────────────────────────────────────
it("a tap moves to the next line that speaks", () => {
  assert.equal(skipFrom(RITE, 0), 2600);
  assert.equal(skipFrom(RITE, 2600), 5400);
});

it("a tap steps over the blank breath before the last line", () => {
  assert.equal(skipFrom(RITE, 5400), 8800);
  assert.equal(skipFrom(RITE, 8300), 8800);
});

it("a tap on the last line ends the hold", () => {
  assert.equal(skipFrom(RITE, 9000), END);
});

it("a tap never winds the clock back", () => {
  assert.equal(skipFrom(RITE, END + 5000), END + 5000);
});

console.log(`\n${pass} passing`);
