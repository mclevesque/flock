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
it("ends the story on the paragraph that wipes a side", () => {
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
  assert.equal(out.beats.length, 5, "one paragraph per kill, and nothing after the wipe");
  assert.equal(out.beats[0].text, "walk-out Iron Man go down.");
  assert.deepEqual(out.beats[4].kills, ["Saibaman"]);
  assert.ok(!JSON.stringify(out.beats).includes("the field goes quiet"));
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
  assert.equal(out.beats.length, 1, "the killing aftermath is dropped, not trimmed");
  assert.ok(!JSON.stringify(out.beats).includes("Apocalypse"));
});

it("drops a quiet aftermath too: the wipe is the last paragraph", () => {
  const out = run({
    beats: [
      beat("walk-out"),
      kb("Iron Man", "Venom", "Kami", "Mysterio", "Saibaman"),
      beat("the field goes quiet"),
      kb("Vision"),
    ],
  });
  assert.equal(out.beats.length, 1);
  assert.ok(!JSON.stringify(out.beats).includes("the field goes quiet"));
});

// ── Every paragraph changes a portrait ────────────────────────────────────
it("folds a set-up paragraph into the kill it sets up", () => {
  const out = run({ beats: [beat("Vegeta charges."), kb("Iron Man")] });
  assert.equal(out.beats.length, 1);
  assert.equal(out.beats[0].text, "Vegeta charges. Iron Man go down.");
});

it("never ships a paragraph that removes nobody", () => {
  const out = run({
    beats: [
      beat("a"),
      kb("Iron Man"),
      beat("b"),
      beat("c"),
      kb("Venom"),
      { text: "the dead get up", converts: [8] },
      beat("d"),
      { text: "the curse burns out", nulls: [9] },
    ],
  });
  assert.equal(out.beats.length, 4);
  for (const x of out.beats) {
    const gone = (x.kills?.length ?? 0) + (x.turned?.length ?? 0) + (x.nulled?.length ?? 0);
    assert.ok(gone > 0, `"${x.text}" removes nobody`);
  }
  assert.equal(out.beats[1].text, "b c Venom go down.");
});

it("cuts a set-up that would turn the paragraph into a wall", () => {
  // Live: a 34-word set-up folded onto a 28-word kill made a 62-word block.
  const setup = Array.from({ length: 34 }, (_, i) => `w${i}`).join(" ");
  const kill = { text: `${Array.from({ length: 25 }, (_, i) => `k${i}`).join(" ")} Iron Man falls.`, kills: ["Iron Man"] };
  const out = run({ beats: [beat(setup), kill] });
  assert.equal(out.beats.length, 1);
  assert.equal(out.beats[0].text, kill.text, "the kill stands alone");
});

it("keeps set-up the model never paid off, on the last paragraph", () => {
  const out = run({ beats: [kb("Iron Man"), beat("Vegeta circles.")] });
  assert.equal(out.beats.length, 1);
  assert.equal(out.beats[0].text, "Iron Man go down. Vegeta circles.");
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

// ── Allies do not attack allies ───────────────────────────────────────────
// Board A is 1-5 (mclevesque), board B is 6-10 (The Shark).
it("refuses friendly fire the paragraph does not headline", () => {
  // Meleys burning her own line with nothing in the prose saying why. The
  // portrait stays up, and the paragraph narrating it goes with the kill.
  const out = run({
    beats: [kb("Iron Man"), { text: "Buu turns and blasts Vegeta", by: 1, kills: [2] }, kb("Venom")],
  });
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), ["Iron Man", "Venom"]);
  assert.ok(!JSON.stringify(out.beats).includes("Buu turns"));
});

it("honours one own goal that opens FRIENDLY FIRE!", () => {
  const out = run({
    beats: [kb("Iron Man"), { text: "FRIENDLY FIRE! Buu turns on Vegeta", by: 1, kills: [2] }],
  });
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), ["Iron Man", "Vegeta"]);
  assert.equal(out.beats[1].text, "FRIENDLY FIRE! Buu turns on Vegeta");
});

it("reads BETRAYAL! in any case and prints it one way", () => {
  const out = run({
    beats: [kb("Iron Man"), { text: "Betrayal: Vision cuts Vegeta down", by: 5, kills: [2] }],
  });
  assert.equal(out.beats[1].text, "BETRAYAL! Vision cuts Vegeta down");
});

it("puts waiting set-up before the headline, not under it", () => {
  const out = run({
    beats: [
      kb("Iron Man"),
      beat("Buu's eyes go wrong."),
      { text: "FRIENDLY FIRE! Buu swats Vegeta", by: 1, kills: [2] },
    ],
  });
  assert.equal(out.beats[0].text, "Iron Man go down. Buu's eyes go wrong.");
  assert.equal(out.beats[1].text, "FRIENDLY FIRE! Buu swats Vegeta");
});

it("drops a headline the paragraph does not earn", () => {
  const out = run({ beats: [{ text: "BETRAYAL! Vegeta blasts Iron Man", by: 2, kills: [6] }] });
  assert.equal(out.beats[0].text, "Vegeta blasts Iron Man");
});

it("refuses a second own goal, headline or not", () => {
  const out = run({
    beats: [
      beat("x"),
      { text: "FRIENDLY FIRE! Buu turns on Vegeta", by: 1, kills: [2] },
      { text: "BETRAYAL! and then on Android 18", by: 1, kills: [3] },
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
      { text: "BETRAYAL! and Vision turns on the last of them", by: 5, kills: [5] },
    ],
  });
  const dead = out.beats.flatMap((b) => b.kills ?? []);
  assert.equal(dead.length, 4, "the last card on a side never falls to its own");
  assert.ok(!dead.includes("Vision"));
});

it("lets one blow from the other side take two at once", () => {
  // Krillin's Destructo Disc through two of them. The own-goal cap must not
  // touch this: it only ever looks at kills whose killer shares their side.
  const out = run({
    beats: [beat("x"), { text: "the disc goes through both of them", by: 1, kills: [6, 7] }],
  });
  assert.deepEqual(out.beats.flatMap((b) => b.kills ?? []), ["Iron Man", "Venom"]);
});

it("takes a whole line down in one beat when the action earns it", () => {
  const out = run({
    beats: [beat("x"), { text: "the blast takes the line", by: 1, kills: [6, 7, 8, 9, 10] }],
  });
  assert.equal(out.beats.flatMap((b) => b.kills ?? []).length, 5);
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

// ── Three ways off the board ──────────────────────────────────────────────
it("counts a conversion as gone from the side that drafted them", () => {
  const out = run({ beats: [beat("x"), { text: "the dead get up wearing his colours", converts: [6] }] });
  assert.deepEqual(out.beats[0].turned, ["Iron Man"]);
  assert.deepEqual(out.beats[0].kills ?? [], []);
});

it("counts a nulled thing as gone", () => {
  const out = run({ beats: [beat("x"), { text: "the greyscale burns out", nulls: [7] }] });
  assert.deepEqual(out.beats[0].nulled, ["Venom"]);
});

it("finishes a battle by any mix of dead, converted and nulled", () => {
  // Your rule: the losing team must ALL be one of the three. Here side B is
  // three dead, one turned, one nulled -- and that is a finished game.
  const told = {
    beats: [
      beat("x"),
      kb("Iron Man", "Venom", "Kami"),
      { text: "Mysterio takes the other side's coin", converts: [9] },
      { text: "the wight host is put down to the last", nulls: [10] },
    ],
  };
  const out = run(told);
  assert.equal(finished(out, board), true);
  const gone = out.beats.flatMap((b) => [...(b.kills ?? []), ...(b.turned ?? []), ...(b.nulled ?? [])]);
  assert.equal(gone.length, 5);
});

it("does not call it finished while one card is still standing", () => {
  const out = run({ beats: [beat("x"), kb("Iron Man", "Venom", "Kami"), { text: "and one turns", converts: [9] }] });
  assert.equal(finished(out, board), false);
});

it("lets the last card on a side be turned or nulled", () => {
  // A team CAN end by defecting or by simply stopping -- both are endings the
  // game has, so neither may be refused the way a friendly KILL is.
  const out = run({
    beats: [beat("x"), kb("Iron Man", "Venom", "Kami", "Mysterio"), { text: "the last of them turns", converts: [10] }],
  });
  assert.equal(finished(out, board), true);
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
