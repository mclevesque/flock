/**
 * The guard that stands between the model and the screen.
 *
 * Every one of these cases is something a player actually saw happen.
 */
import { sanitise, finished, type Body, type Told } from "./tell-sanitise.ts";
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
/** A beat that names its own casualties, the way a real one has to. */
const kb = (...names: string[]) => ({ text: `${names.join(" and ")} go down.`, kills: names });
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
      kb("Iron Man"),
      kb("Venom"),
      kb("Kami"),
      kb("Mysterio"),
      kb("Saibaman"),
      beat("the field goes quiet"),
      kb("Apocalypse"),
      kb("Vision"),
      kb("Android 18"),
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
    beats: [kb("Venom"), kb("Venom"), kb("Kami")],
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
    { beats: [beat("x"), kb("Ultimate Gohan")], mvp: { name: "Ultimate Gohan", note: "n" } },
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
  const out = run({ beats: [beat("x"), kb("Goku")] }, two);
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
  const out = run({ beats: [beat("x"), kb("Goku")] }, twins);
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), []);
});

// ── The winner is whoever is left, not whoever the model named ─────────────
it("recomputes the winner from survivors", () => {
  const out = run({
    winner: "B",
    beats: [beat("x"), kb("Iron Man", "Venom", "Kami", "Mysterio", "Saibaman")],
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
      kb("Iron Man", "Venom", "Kami", "Mysterio", "Saibaman"),
      kb("Apocalypse"),
    ],
  });
  assert.equal(out.beats.length, 2, "the killing aftermath is dropped, not trimmed");
  assert.ok(!JSON.stringify(out.beats).includes("Apocalypse"));
});

it("keeps a genuine aftermath beat", () => {
  const out = run({
    beats: [
      beat("walk-out"),
      kb("Iron Man", "Venom", "Kami", "Mysterio", "Saibaman"),
      beat("the field goes quiet"),
      kb("Vision"),
    ],
  });
  assert.equal(out.beats.length, 3);
  assert.equal(out.beats[2].text, "the field goes quiet");
});

// ── Numbers are the identity; the prose can call them anything ────────────
it("kills the right portrait however the prose names them", () => {
  // The board is numbered 1..10 straight through: 1-5 are mclevesque's, 6-10
  // The Shark's. Card 8 is Kami, and the prose never says "Kami" once.
  const out = run({
    beats: [
      beat("walk-out"),
      { text: "The old green man never sees it coming, and the ring goes quiet.", kills: [8] },
    ],
  });
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), ["Kami"]);
});

it("takes a number sent as a string", () => {
  const out = run({ beats: [beat("x"), { text: "the overgrown monkey drops", kills: ["6"] }] });
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), ["Iron Man"]);
});

it("ignores a number nobody drafted", () => {
  const out = run({ beats: [beat("x"), { text: "somebody dies", kills: [11] }] });
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), []);
});

it("resolves the MVP by number", () => {
  const out = run({ beats: [beat("x"), beat("y")], mvp: { id: 2, note: "carried it" } });
  assert.equal(out.mvp?.name, "Vegeta");
});

// ── A death given by NAME still has to happen in the sentence you read ────
it("drops a casualty the beat's own text never names", () => {
  // The portraits grey out on the beat under the reader's eye, so a kill the
  // prose does not mention crosses somebody out mid-sentence about somebody
  // else -- which is exactly what a player reported seeing.
  const out = run({
    beats: [beat("x"), beat("Vegeta and Broly trade blows in the dust.", ["Kami"])],
  });
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), []);
});

it("accepts a death written with a surname", () => {
  const got: Body = {
    sides: [
      { id: "A", name: "me", cards: [{ name: "Brienne of Tarth" }] },
      { id: "B", name: "them", cards: [{ name: "Gregor Clegane" }, { name: "Otto Hightower" }] },
    ],
  };
  const out = run(
    {
      beats: [
        beat("x"),
        beat("Clegane swings once and Hightower folds into the frozen dirt.", [
          "Otto Hightower",
        ]),
      ],
    },
    got
  );
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), ["Otto Hightower"]);
});

it("accepts a death written without the parenthetical", () => {
  const dbz: Body = {
    sides: [
      { id: "A", name: "me", cards: [{ name: "Zeno" }] },
      { id: "B", name: "them", cards: [{ name: "Goku (GT)" }] },
    ],
  };
  const out = run(
    { beats: [beat("x"), beat("Zeno raises a finger and Goku is simply gone.", ["Goku (GT)"])] },
    dbz
  );
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), ["Goku (GT)"]);
});

// ── A team may not lose to itself ─────────────────────────────────────────
// Board A is 1-5 (mclevesque), board B is 6-10 (The Shark).
it("allows one own goal", () => {
  const out = run({ beats: [beat("x"), { text: "Buu turns", by: 1, kills: [2] }] });
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), ["Vegeta"]);
});

it("refuses a second own goal", () => {
  const out = run({
    beats: [
      beat("x"),
      { text: "Buu turns on Vegeta", by: 1, kills: [2] },
      { text: "and then on Android 18", by: 1, kills: [3] },
      { text: "Iron Man falls", by: 2, kills: [6] },
    ],
  });
  const dead = out.beats.flatMap((b) => b.kills ?? []);
  assert.deepEqual(dead, ["Vegeta", "Iron Man"]);
  assert.ok(!dead.includes("Android 18"), "only one own goal per battle");
});

it("never lets a side finish itself off", () => {
  // Four of A already gone to the other side; the fifth may not fall to a
  // teammate. A player lost a battle to their own Mountain killing their own
  // Drogon, and that is the shape this exists to prevent.
  const out = run({
    beats: [
      beat("x"),
      { text: "four of A fall", by: 6, kills: [1, 2, 3, 4] },
      { text: "and Vision turns on the last of them", by: 5, kills: [5] },
    ],
  });
  const dead = out.beats.flatMap((b) => b.kills ?? []);
  assert.equal(dead.length, 4, "the last card on a side never falls to its own");
  assert.ok(!dead.includes("Vision"));
});

it("still lets the other side land the finishing blow", () => {
  const out = run({
    beats: [
      beat("x"),
      { text: "four of A fall", by: 6, kills: [1, 2, 3, 4] },
      { text: "and Iron Man takes the last", by: 6, kills: [5] },
    ],
  });
  assert.equal(out.beats.flatMap((b) => b.kills ?? []).length, 5);
});

// ── A battle has to actually end ───────────────────────────────────────────
it("calls a battle unfinished when both sides still have players", () => {
  // Straight off production: 17 beats, three of B dead, and a winner declared
  // on a head-count. That is not a fight anybody watched.
  const out = run({
    beats: [beat("x"), kb("Iron Man", "Venom", "Kami")],
  });
  assert.equal(finished(out, board), false);
});

it("calls a battle finished when one roster is entirely down", () => {
  const out = run({
    beats: [beat("x"), kb("Iron Man", "Venom", "Kami", "Mysterio", "Saibaman")],
  });
  assert.equal(finished(out, board), true);
});

it("sees a finish through a name that carried its variant", () => {
  // The check runs on the CLEANED story, so "Ultimate Gohan" has already been
  // resolved to "Gohan" -- otherwise a finished battle reads as unfinished and
  // we pay for a second one for nothing.
  const dbz: Body = {
    sides: [
      { id: "A", name: "me", cards: [{ name: "Zeno" }] },
      { id: "B", name: "them", cards: [{ name: "Gohan", variant: "Ultimate Gohan" }] },
    ],
  };
  const out = run({ beats: [beat("x"), kb("Ultimate Gohan")] }, dbz);
  assert.equal(finished(out, dbz), true);
});

console.log(`\n${pass} passing`);
