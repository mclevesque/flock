/**
 * The guard that stands between the model and the screen.
 *
 * Every one of these cases is something a player actually saw happen.
 *
 * A card leaves the board by a marker in the prose -- "[6 dead]" -- which
 * this file lifts out of the sentence before anybody reads it. So most of
 * what used to be tested here cannot be expressed at all any more: there is
 * no list of casualties to disagree with the paragraph it came from, and no
 * name to match, because a number means one card and sits in one place.
 */
import { sanitise, finished, agreesOnWinner, type Body, type Told } from "./tell-sanitise.ts";
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

/** A paragraph. Numbers run 1..5 for side A, then 6..10 for side B. */
const p = (text: string) => ({ text });
/** Side B wiped, so a test can get on with its actual subject. */
const wipeB = [
  p("The first exchange takes two of them [6 dead] [7 dead]."),
  p("Two more go with the building [8 dead] [9 dead]."),
  p("The last one does not make the corner [10 dead]."),
  p("Quiet."),
];

const run = (told: Partial<Told>, b: Body = board) =>
  sanitise({ winner: "A", verdict: "", mvp: null, beats: [], ...told } as Told, b);
/** Every name the settled story took off the board, paragraph by paragraph. */
const out = (s: ReturnType<typeof run>) =>
  s.beats.map((x) => [...(x.kills ?? []), ...(x.turned ?? []), ...(x.nulled ?? [])]);

let pass = 0;
const it = (name: string, fn: () => void) => {
  try {
    fn();
    pass++;
    console.log("  ok  " + name);
  } catch (e) {
    console.log("FAIL  " + name + "\n      " + (e as Error).message);
    process.exitCode = 1;
  }
};

// -- The marker is the result ----------------------------------------------
it("crosses out the card the marker names, in the paragraph it sits in", () => {
  const s = run({
    beats: [
      p("The armour opens up and the street comes apart."),
      p("Majin Buu tears it open and the man inside does not get up [6 dead]."),
      p("The rest come at once and none of them last [7 dead] [8 dead] [9 dead] [10 dead]."),
      p("The street is quiet."),
    ],
  });
  assert.deepEqual(out(s), [
    ["Iron Man"],
    ["Venom", "Kami", "Mysterio", "Saibaman"],
    [],
  ]);
  assert.ok(finished(s, board));
});

it("lifts the bracket out before anybody reads the sentence", () => {
  const s = run({ beats: [p("The dwarf goes over the rail [7 dead]."), p("Quiet.")] });
  assert.equal(s.beats[0].text, "The dwarf goes over the rail.");
  assert.deepEqual(s.beats[0].kills, ["Venom"]);
});

it("takes a marker from the middle of a sentence without leaving a gap", () => {
  const s = run({ beats: [p("Kami [8 dead] falls where he stood, and it is over.")] });
  assert.equal(s.beats[0].text, "Kami falls where he stood, and it is over.");
});

it("reads dead, converted and nulled", () => {
  const s = run({
    beats: [
      p("Two go in the first exchange [6 dead] [7 dead]."),
      p("He is talked round and walks to the other line [8 converted]."),
      p("The illusion burns out [9 nulled] and the last of them dies with it [10 dead]."),
      p("Quiet."),
    ],
  });
  assert.deepEqual(s.beats[1].turned, ["Kami"]);
  assert.deepEqual(s.beats[2].nulled, ["Mysterio"]);
  assert.deepEqual(s.beats[2].kills, ["Saibaman"]);
  assert.ok(finished(s, board), "a roster emptied any mix of ways is still emptied");
});

it("takes a bare number as a death", () => {
  const s = run({ beats: [p("He does not get up [6]."), p("Quiet.")] });
  assert.deepEqual(s.beats[0].kills, ["Iron Man"]);
});

it("reads a raise as a conversion", () => {
  const s = run({
    beats: [
      p("Four of them go down in the godswood [6 dead] [7 dead] [8 dead] [9 dead]."),
      p("The last one opens his eyes and they are blue [10 raised]."),
      p("Quiet."),
    ],
  });
  assert.deepEqual(s.beats[1].turned, ["Saibaman"]);
  assert.ok(finished(s, board));
});

it("drops a number nobody drafted, and still cleans the sentence", () => {
  const s = run({ beats: [p("Something falls out of the sky [47 dead]."), p("Quiet.")] });
  assert.equal(s.beats[0].text, "Something falls out of the sky.");
  assert.equal(out(s).flat().length, 0);
});

it("never takes the same number twice", () => {
  const s = run({
    beats: [...wipeB.slice(0, 3), p("He is dead all over again [6 dead]."), p("Quiet.")],
  });
  assert.equal(out(s).flat().filter((x) => x === "Iron Man").length, 1);
});

it("marks the winning side's dead too", () => {
  const s = run({
    beats: [
      p("They go down together and neither one gets up [2 dead] [6 dead]."),
      p("The rest are gone inside a minute [7 dead] [8 dead] [9 dead] [10 dead]."),
      p("Quiet."),
    ],
  });
  assert.deepEqual(out(s)[0], ["Vegeta", "Iron Man"], "a winner who died is crossed out too");
  assert.equal(s.winner, "A", "and his side still wins");
  assert.ok(finished(s, board));
});

it("leaves a card standing when its number is never marked", () => {
  const s = run({
    beats: [p("Four of them go down [6 dead] [7 dead] [8 dead] [9 dead]."), p("Quiet.")],
  });
  assert.equal(finished(s, board), false);
  assert.ok(!out(s).flat().includes("Saibaman"));
});

// -- Who won ---------------------------------------------------------------
it("recomputes the winner from who is still standing", () => {
  const s = run({ winner: "B", beats: [...wipeB] });
  assert.equal(s.winner, "A", "the bench is the one thing a player can check");
});

it("catches a story that declares the side the bench just wiped out", () => {
  const s = run({ winner: "B", beats: [...wipeB] });
  assert.equal(agreesOnWinner({ winner: "B" }, s, board), false);
  assert.equal(agreesOnWinner({ winner: "mclevesque" }, s, board), true, "by player name too");
  assert.equal(
    agreesOnWinner({ winner: "Gandalf" }, s, board),
    true,
    "a winner we cannot place is not a contradiction"
  );
});

it("rewrites side labels to player names in verdict and mvp note", () => {
  const s = run({
    beats: [...wipeB],
    verdict: "Side A had the range.",
    mvp: { id: 1, note: "Side A never needed a second plan." },
  });
  assert.ok(s.verdict.includes("mclevesque") && !s.verdict.includes("Side A"));
  assert.ok(s.mvp?.note.includes("mclevesque"));
  assert.equal(s.mvp?.name, "Majin Buu", "and the MVP resolves by number");
});

// -- Pacing ----------------------------------------------------------------
it("allows a quiet paragraph, but never two running", () => {
  const s = run({
    beats: [
      p("The first one goes down [6 dead]."),
      p("The dust settles over the street."),
      p("Nobody moves for a long moment."),
      p("Then the rest of them [7 dead] [8 dead] [9 dead] [10 dead]."),
      p("Quiet."),
    ],
  });
  const quiet = out(s).map((x) => x.length === 0);
  assert.ok(!quiet.some((q, i) => q && quiet[i + 1]), "no two quiet paragraphs in a row");
});

it("folds a set-up paragraph into the blow it sets up", () => {
  const s = run({
    beats: [
      p("He lines up the shot."),
      p("Majin Buu is faster, and the armour comes apart [6 dead]."),
      p("The rest follow [7 dead] [8 dead] [9 dead] [10 dead]."),
      p("Quiet."),
    ],
  });
  assert.ok(s.beats[0].text.startsWith("He lines up the shot."));
  assert.deepEqual(s.beats[0].kills, ["Iron Man"], "the set-up and its blow are one paragraph");
});

it("cuts a set-up that would turn the paragraph into a wall", () => {
  const long = "He waits " + "and the street holds its breath ".repeat(12);
  const s = run({
    beats: [
      p(long),
      p("The armour comes apart [6 dead]."),
      p("The rest follow [7 dead] [8 dead] [9 dead] [10 dead]."),
      p("Quiet."),
    ],
  });
  assert.ok(!s.beats[0].text.includes("holds its breath"), "past the cap the set-up is cut");
});

// -- Stopping --------------------------------------------------------------
it("stops one closing paragraph after the last card is down", () => {
  const s = run({
    beats: [...wipeB, p("The winners turn on each other [1 dead]."), p("And on it goes.")],
  });
  assert.equal(s.beats.length, 4);
  assert.ok(!s.beats.some((x) => x.text.includes("turn on each other")));
  assert.ok(!out(s).flat().includes("Majin Buu"), "nobody dies after the fight is over");
});

it("keeps the closing paragraph itself", () => {
  const s = run({ beats: [...wipeB] });
  assert.equal(s.beats[s.beats.length - 1].text, "Quiet.");
  assert.equal(s.beats[s.beats.length - 1].kills, undefined);
});

// -- Headlines -------------------------------------------------------------
it("keeps a headline over somebody changing sides", () => {
  const s = run({
    beats: [
      p("Four of them fall [6 dead] [7 dead] [9 dead] [10 dead]."),
      p("betrayal: he turns and walks to the other line [8 converted]."),
      p("Quiet."),
    ],
  });
  assert.ok(s.beats[1].text.startsWith("BETRAYAL! he turns"), s.beats[1].text);
});

it("drops a headline the paragraph does not earn", () => {
  const s = run({
    beats: [
      p("FRIENDLY FIRE! The armour comes apart [6 dead]."),
      p("The rest follow [7 dead] [8 dead] [9 dead] [10 dead]."),
      p("Quiet."),
    ],
  });
  assert.ok(!s.beats[0].text.includes("FRIENDLY FIRE"), "a headline over an ordinary blow is shouting");
});

// -- Finishing -------------------------------------------------------------
it("does not call it finished while one card is still standing", () => {
  const s = run({ beats: [p("Four fall [6 dead] [7 dead] [8 dead] [9 dead]."), p("Quiet.")] });
  assert.equal(finished(s, board), false);
});

it("lets the last card on a side be turned or nulled", () => {
  const s = run({
    beats: [
      p("Four fall [6 dead] [7 dead] [8 dead] [9 dead]."),
      p("The last one is talked round and leaves with them [10 converted]."),
      p("Quiet."),
    ],
  });
  assert.ok(finished(s, board));
});

it("keeps the prose when nothing is marked at all", () => {
  const s = run({ beats: [p("They circle each other."), p("Nobody swings.")] });
  assert.equal(s.beats.length, 2, "a story with no result is still a story");
  assert.equal(finished(s, board), false);
});

console.log("\n" + pass + " passing");
