/**
 * What DraftMasters chat draws: GIFs from GIPHY, never the hub's feature tokens.
 */
import { chatGif, gifMessage, isHubOnly } from "./chat-text.ts";
import assert from "node:assert";

let pass = 0;
const it = (name: string, fn: () => void) => {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { console.log("FAIL  " + name + "\n      " + (e as Error).message); process.exitCode = 1; }
};

it("builds a short GIF message from a GIPHY id, and chatGif reads it back", () => {
  const msg = gifMessage("lnlAifQdenMxW");
  assert.equal(msg, "[gif:https://media.giphy.com/media/lnlAifQdenMxW/giphy.gif]");
  assert.ok(msg!.length < 300, "fits the room chat's 300-character cap");
  assert.equal(chatGif(msg!), "https://media.giphy.com/media/lnlAifQdenMxW/giphy.gif");
});

it("refuses an id that is not plain letters and digits", () => {
  assert.equal(gifMessage("abc/../evil"), null);
  assert.equal(gifMessage(""), null);
});

it("still draws the long signed URLs the hub's picker sent", () => {
  const old = "[gif:https://media4.giphy.com/media/v1.Y2lk/xyz/giphy.gif?cid=abc&rid=giphy.gif&ct=g]";
  assert.ok(chatGif(old));
});

it("draws nothing from a host that is not GIPHY", () => {
  assert.equal(chatGif("[gif:https://example.com/pixel.gif]"), null);
  assert.equal(chatGif("[gif:http://media.giphy.com/media/x/giphy.gif]"), null, "https only");
  assert.equal(chatGif("[gif:https://media.giphy.com.evil.com/x.gif]"), null);
});

it("keeps quiz and party tokens out, and leaves ordinary text alone", () => {
  assert.equal(isHubOnly("[party:party_local_1773447897290_x]"), true);
  assert.equal(isHubOnly("[quiz:jkelzoikzni0]"), true);
  assert.equal(isHubOnly("[gif:https://media.giphy.com/media/x/giphy.gif]"), false);
  assert.equal(isHubOnly("gg [party] next time"), false);
});

console.log(`\n${pass} passing`);
