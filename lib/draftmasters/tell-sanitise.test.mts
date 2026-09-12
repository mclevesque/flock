/**
 * The guard that stands between the model and the screen.
 *
 * Every one of these cases is something a player actually saw happen.
 *
 * The model writes prose and a roll-call. It does not tag paragraphs any
 * more, so most of what this file used to defend against -- a number with
 * nobody named, an ally killed by an ally, a card dying twice -- cannot be
 * expressed at all. What is left to get wrong is which paragraph a name
 * belongs to, and whether the story wrote them down at all.
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

/** Roster numbers run straight through both sides: 1..5 then 6..10. */
const dead = (...ids: (number | string)[]) => ids.map((id) => ({ id, how: "dead" }));
/** A paragraph. */
const p = (text: string) => ({ text });
/** The whole of side B, wiped, so a test can get on with its actual subject. */
const wipeB = [
  p("Iron Man and Venom fall."),
  p("Kami and Mysterio fall."),
  p("Saibaman falls."),
  p("Quiet."),
];
const fellB = dead(6, 7, 8, 9, 10);

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

// -- The roll-call lands where the prose put it ----------------------------
it("takes each name off at the paragraph that names them last", () => {
  const s = run({
    beats: [
      p("Iron Man opens up on Majin Buu and the street comes apart."),
      p("Majin Buu tears the armour open. Iron Man does not get up."),
      p("Venom, Kami, Mysterio and Saibaman rush him together and none of them last."),
      p("The street is quiet."),
    ],
    fallen: fellB,
  });
  // The opening paragraph takes nobody, so it folds into the blow it sets up.
  assert.deepEqual(out(s), [["Iron Man"], ["Venom", "Kami", "Mysterio", "Saibaman"], []]);
  assert.ok(s.beats[0].text.startsWith("Iron Man opens up"));
  assert.ok(finished(s, board));
});

it("does not hang a death on the closing summary", () => {
  const s = run({
    beats: [...wipeB.slice(0, 3), p("Saibaman and Mysterio are counted among the dead.")],
    fallen: fellB,
  });
  assert.deepEqual(out(s)[3], [], "the closing paragraph stays quiet");
  assert.deepEqual(out(s)[1], ["Kami", "Mysterio"]);
  assert.deepEqual(out(s)[2], ["Saibaman"]);
});

it("uses the last paragraph when the fight itself never named them", () => {
  const s = run({
    beats: [
      p("Iron Man, Venom, Kami and Mysterio fall."),
      p("Saibaman is dead too, and the street is quiet."),
    ],
    fallen: fellB,
  });
  assert.deepEqual(out(s)[1], ["Saibaman"]);
  assert.ok(finished(s, board));
});

it("leaves a card standing when the prose never writes them", () => {
  const s = run({
    beats: [p("Iron Man, Venom, Kami and Mysterio fall."), p("Quiet.")],
    fallen: fellB,
  });
  assert.equal(finished(s, board), false, "a roll-call alone never crosses anybody out");
  assert.ok(!out(s).flat().includes("Saibaman"));
});

it("takes the winning side's dead as well", () => {
  const s = run({
    beats: [
      p("Vegeta and Iron Man go down together, neither one getting up."),
      p("Venom, Kami, Mysterio and Saibaman are gone inside a minute."),
      p("Quiet."),
    ],
    fallen: [...fellB, ...dead(2)],
  });
  assert.deepEqual(out(s)[0], ["Iron Man", "Vegeta"], "a winner who died is crossed out too");
  assert.equal(s.winner, "A", "and his side still wins");
  assert.ok(finished(s, board));
});

it("drops a casualty nobody drafted", () => {
  const s = run({ beats: [...wipeB], fallen: [...fellB, ...dead(47)] });
  assert.equal(out(s).flat().length, 5);
});

it("never removes the same card twice", () => {
  const s = run({ beats: [...wipeB], fallen: [...fellB, ...dead(6)] });
  assert.equal(out(s).flat().filter((x) => x === "Iron Man").length, 1);
});

// -- Which card a number means ---------------------------------------------
it("takes a number sent as a string", () => {
  const s = run({ beats: [p("Iron Man falls."), p("Quiet.")], fallen: dead("6") });
  assert.deepEqual(out(s)[0], ["Iron Man"]);
});

it("resolves a name carrying its drafted variant", () => {
  const got: Body = {
    sides: [
      { id: "A", name: "me", cards: [{ name: "Gohan", variant: "Ultimate Gohan" }] },
      { id: "B", name: "them", cards: [{ name: "Cell" }] },
    ],
  };
  const s = run(
    {
      beats: [p("Ultimate Gohan puts Cell through the plateau.")],
      fallen: [{ id: "Cell", how: "dead" }],
    },
    got
  );
  assert.deepEqual(out(s)[0], ["Cell"]);
});

it("drops a name that could mean either of two cards", () => {
  const twins: Body = {
    sides: [
      { id: "A", name: "me", cards: [{ name: "Goku (Z)" }, { name: "Goku (GT)" }] },
      { id: "B", name: "them", cards: [{ name: "Frieza" }] },
    ],
  };
  const s = run({ beats: [p("Goku falls.")], fallen: [{ id: "Goku", how: "dead" }] }, twins);
  assert.deepEqual(out(s)[0] ?? [], [], "crossing out the wrong card is worse than crossing out none");
});

it("finds a death written with a surname", () => {
  const got: Body = {
    sides: [
      { id: "A", name: "me", cards: [{ name: "Brienne of Tarth" }] },
      { id: "B", name: "them", cards: [{ name: "Gregor Clegane" }, { name: "Otto Hightower" }] },
    ],
  };
  const s = run(
    {
      beats: [
        p("Steel meets steel in the yard."),
        p("Clegane swings once and Hightower folds into the dirt."),
        p("Brienne kills Clegane where he stands."),
        p("Quiet."),
      ],
      fallen: [{ id: "Otto Hightower", how: "dead" }, { id: "Gregor Clegane", how: "dead" }],
    },
    got
  );
  // The scene-setting first paragraph folds into the one that lands a blow.
  assert.deepEqual(out(s)[0], ["Otto Hightower"]);
  assert.deepEqual(out(s)[1], ["Gregor Clegane"]);
  assert.ok(finished(s, got));
});

// -- The three ways off the board ------------------------------------------
it("reads converted as changing sides and nulled as stopping", () => {
  const s = run({
    beats: [
      p("Iron Man and Venom are gone in the first exchange."),
      p("Kami is talked round and turns on his own line."),
      p("The illusion around Mysterio is nulled, and Saibaman dies with it."),
      p("Quiet."),
    ],
    fallen: [...dead(6, 7), { id: 8, how: "converted" }, { id: 9, how: "nulled" }, ...dead(10)],
  });
  assert.deepEqual(s.beats[1].turned, ["Kami"]);
  assert.deepEqual(s.beats[2].nulled, ["Mysterio"]);
  assert.deepEqual(s.beats[2].kills, ["Saibaman"]);
  assert.ok(finished(s, board), "a roster emptied any mix of ways is still emptied");
});

it("reads a raise as a conversion", () => {
  const s = run({
    beats: [
      p("Iron Man, Venom, Kami and Mysterio fall."),
      p("The Night King raises Saibaman, and he gets up wearing blue."),
      p("Quiet."),
    ],
    fallen: [...dead(6, 7, 8, 9), { id: 10, how: "raised" }],
  });
  assert.deepEqual(s.beats[1].turned, ["Saibaman"]);
});

// -- Who won ---------------------------------------------------------------
it("recomputes the winner from who is still standing", () => {
  const s = run({ winner: "B", beats: [...wipeB], fallen: fellB });
  assert.equal(s.winner, "A", "the bench is the one thing a player can check");
});

it("catches a story that declares the side the bench just wiped out", () => {
  const s = run({ winner: "B", beats: [...wipeB], fallen: fellB });
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
    fallen: fellB,
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
      p("Iron Man falls."),
      p("The dust settles over the street."),
      p("Nobody moves for a long moment."),
      p("Venom, Kami, Mysterio and Saibaman are gone."),
      p("Quiet."),
    ],
    fallen: fellB,
  });
  const quiet = out(s).map((x) => x.length === 0);
  assert.ok(!quiet.some((q, i) => q && quiet[i + 1]), "no two quiet paragraphs in a row");
});

it("folds a set-up paragraph into the blow it sets up", () => {
  const s = run({
    beats: [
      p("Iron Man lines up the shot."),
      p("Majin Buu is faster, and Iron Man comes apart."),
      p("Venom, Kami, Mysterio and Saibaman follow."),
      p("Quiet."),
    ],
    fallen: fellB,
  });
  assert.ok(s.beats[0].text.startsWith("Iron Man lines up the shot."));
  assert.deepEqual(s.beats[0].kills, ["Iron Man"], "the set-up and its blow are one paragraph");
});

it("cuts a set-up that would turn the paragraph into a wall", () => {
  const long = "He waits " + "and the street holds its breath ".repeat(12);
  const s = run({
    beats: [
      p(long),
      p("Iron Man comes apart."),
      p("Venom, Kami, Mysterio and Saibaman follow."),
      p("Quiet."),
    ],
    fallen: fellB,
  });
  assert.ok(!s.beats[0].text.includes("holds its breath"), "past the cap the set-up is cut");
});

// -- Stopping --------------------------------------------------------------
it("stops one closing paragraph after the last card is down", () => {
  const s = run({
    beats: [...wipeB, p("The winners turn on each other."), p("And on it goes.")],
    fallen: fellB,
  });
  assert.equal(s.beats.length, 4);
  assert.ok(!s.beats.some((x) => x.text.includes("turn on each other")));
});

it("keeps the closing paragraph itself", () => {
  const s = run({ beats: [...wipeB], fallen: fellB });
  assert.equal(s.beats[s.beats.length - 1].text, "Quiet.");
  assert.equal(s.beats[s.beats.length - 1].kills, undefined);
});

// -- Headlines -------------------------------------------------------------
it("keeps a headline over somebody changing sides", () => {
  const s = run({
    beats: [
      p("Iron Man, Venom, Mysterio and Saibaman fall."),
      p("betrayal: Kami turns and walks to the other line."),
      p("Quiet."),
    ],
    fallen: [...dead(6, 7, 9, 10), { id: 8, how: "converted" }],
  });
  assert.ok(s.beats[1].text.startsWith("BETRAYAL! Kami turns"), s.beats[1].text);
});

it("drops a headline the paragraph does not earn", () => {
  const s = run({
    beats: [
      p("FRIENDLY FIRE! Iron Man falls."),
      p("Venom, Kami, Mysterio and Saibaman follow."),
      p("Quiet."),
    ],
    fallen: fellB,
  });
  assert.ok(!s.beats[0].text.includes("FRIENDLY FIRE"), "a headline over an ordinary blow is shouting");
});

// -- Finishing -------------------------------------------------------------
it("does not call it finished while one card is still standing", () => {
  const s = run({
    beats: [p("Iron Man, Venom, Kami and Mysterio fall."), p("Quiet.")],
    fallen: dead(6, 7, 8, 9),
  });
  assert.equal(finished(s, board), false);
});

it("lets the last card on a side be turned or nulled", () => {
  const s = run({
    beats: [
      p("Iron Man, Venom, Kami and Mysterio fall."),
      p("Saibaman is talked round and leaves with them."),
      p("Quiet."),
    ],
    fallen: [...dead(6, 7, 8, 9), { id: 10, how: "converted" }],
  });
  assert.ok(finished(s, board));
});

it("keeps the prose when the roll-call is empty", () => {
  const s = run({ beats: [p("They circle each other."), p("Nobody swings.")], fallen: [] });
  assert.equal(s.beats.length, 2, "a story with no result is still a story");
  assert.equal(finished(s, board), false);
});

console.log("\n" + pass + " passing");
