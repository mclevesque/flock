/**
 * The guard that stands between the model and the screen.
 *
 * Every one of these cases is something a player actually saw happen.
 */
import { sanitise, type Body, type Told } from "./tell-sanitise.ts";
import assert from "node:assert";

const board: Body = {
  sides: [
    {
      id: "A",
      name: "mclevesque",
      cards: [
        { name: "Majin Buu" }, { name: "Vegeta" }, { name: "Android 18" },
        { name: "Apocalypse" }, { name: "Vision" },
      ],
    },
    {
      id: "B",
      name: "The Shark",
      cards: [
        { name: "Iron Man" }, { name: "Venom" }, { name: "Kami" },
        { name: "Mysterio" }, { name: "Saibaman" },
      ],
    },
  ],
};

const beat = (text: string, kills?: string[]) => (kills ? { text, kills } : { text });
const run = (told: Partial<Told>, b: Body = board) =>
  sanitise({ winner: "A", verdict: "", mvp: null, beats: [], ...told } as Told, b);

let pass = 0;
const it = (name: string, fn: () => void) => {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { console.log("FAIL  " + name + "\n      " + (e as Error).message); process.exitCode = 1; }
};

// ── The one the player caught: the fight carried on after a wipe ────────────
it("stops one beat after a side is wiped, and drops the friendly fire after it", () => {
  const out = run({
    beats: [
      beat("walk-out"),
      beat("Iron Man falls", ["Iron Man"]),
      beat("Venom falls", ["Venom"]),
      beat("Kami falls", ["Kami"]),
      beat("Mysterio falls", ["Mysterio"]),
      beat("Saibaman falls -- B is wiped", ["Saibaman"]),
      beat("the field goes quiet"),
      beat("Vegeta turns on Apocalypse", ["Apocalypse"]),
      beat("Buu eats Vision", ["Vision"]),
      beat("and then there was one", ["Android 18"]),
    ],
  });
  assert.equal(out.beats.length, 7, "should keep 6 beats + one aftermath");
  assert.equal(out.beats[6].text, "the field goes quiet");
  const dead = out.beats.flatMap((x) => x.kills ?? []);
  assert.deepEqual(dead.sort(), ["Iron Man", "Kami", "Mysterio", "Saibaman", "Venom"]);
  for (const own of ["Apocalypse", "Vision", "Android 18"]) {
    assert.ok(!dead.includes(own), `${own} must survive - their side won`);
  }
  assert.equal(out.winner, "A");
});

// ── Casualties have to be real, and final ──────────────────────────────────
it("drops a casualty nobody drafted", () => {
  const out = run({ beats: [beat("x"), beat("y", ["Superman"])] });
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), []);
});

it("refuses to kill the same card twice", () => {
  const out = run({
    beats: [beat("a", ["Venom"]), beat("b", ["Venom"]), beat("c", ["Kami"])],
  });
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), ["Venom", "Kami"]);
});

// ── The variant-in-the-name case that silently ate the MVP ─────────────────
it("resolves a name carrying its drafted variant", () => {
  const dbz: Body = {
    sides: [
      { id: "A", name: "me", cards: [{ name: "Zeno" }] },
      { id: "B", name: "them", cards: [{ name: "Gohan", variant: "Ultimate Gohan" }] },
    ],
  };
  const out = run(
    { beats: [beat("x"), beat("y", ["Ultimate Gohan"])], mvp: { name: "Ultimate Gohan", note: "n" } },
    dbz
  );
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), ["Gohan"]);
  assert.equal(out.mvp?.name, "Gohan");
});

it("takes the exact name when one exists, even beside a near-twin", () => {
  const two: Body = {
    sides: [
      { id: "A", name: "me", cards: [{ name: "Goku" }, { name: "Goku (GT)" }] },
      { id: "B", name: "them", cards: [{ name: "Kami" }] },
    ],
  };
  const out = run({ beats: [beat("x"), beat("y", ["Goku"])] }, two);
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), ["Goku"]);
});

it("drops a name that could mean either of two cards", () => {
  // No bare "Goku" to match exactly, so "Goku" could be either one. Crossing
  // out the wrong card is worse than crossing out none.
  const twins: Body = {
    sides: [
      { id: "A", name: "me", cards: [{ name: "Goku (GT)" }, { name: "Goku (Z)" }] },
      { id: "B", name: "them", cards: [{ name: "Kami" }] },
    ],
  };
  const out = run({ beats: [beat("x"), beat("y", ["Goku"])] }, twins);
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), []);
});

// ── The winner is whoever is left, not whoever the model named ─────────────
it("recomputes the winner from survivors", () => {
  const out = run({
    winner: "B",
    beats: [beat("x"), beat("y", ["Iron Man", "Venom", "Kami", "Mysterio", "Saibaman"])],
  });
  assert.equal(out.winner, "A");
});

// ── "side B" is a label for the model, not a word a player has seen ────────
it("rewrites side labels to player names in verdict and mvp note", () => {
  const out = run({
    beats: [beat("x"), beat("y")],
    verdict: "Side A overwhelmed side B early.",
    mvp: { name: "Vegeta", note: "Carried side A." },
  });
  assert.equal(out.verdict, "mclevesque overwhelmed The Shark early.");
  assert.equal(out.mvp?.note, "Carried mclevesque.");
});

it("refuses an aftermath beat that is still killing people", () => {
  // Straight from a live battle: side B wiped, and the closing beat had Zeno
  // erasing Broly -- his own teammate. Dropping the kill but keeping the prose
  // would narrate a death the roster never shows, so the beat goes entirely.
  const out = run({
    beats: [
      beat("walk-out"),
      beat("all of B falls", ["Iron Man", "Venom", "Kami", "Mysterio", "Saibaman"]),
      beat("Vegeta erases Apocalypse", ["Apocalypse"]),
    ],
  });
  assert.equal(out.beats.length, 2, "the killing aftermath is dropped, not trimmed");
  assert.ok(!JSON.stringify(out.beats).includes("Apocalypse"));
});

it("keeps a genuine aftermath beat", () => {
  const out = run({
    beats: [
      beat("walk-out"),
      beat("all of B falls", ["Iron Man", "Venom", "Kami", "Mysterio", "Saibaman"]),
      beat("the field goes quiet"),
      beat("and then more killing", ["Vision"]),
    ],
  });
  assert.equal(out.beats.length, 3);
  assert.equal(out.beats[2].text, "the field goes quiet");
});

console.log(`\n${pass} passing`);
