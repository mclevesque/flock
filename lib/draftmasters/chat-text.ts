/**
 * What DraftMasters chat shows, out of the hub's direct messages.
 *
 * The friends chat reads the same message table as Great Souls, so it also
 * holds the hub's own tokens -- quiz challenges, party invites, chess and
 * poker rooms. None of those mean anything in this game, and a preview was
 * reading "You: [party:party_local_1773447897290_...]". They are left out of
 * this chat entirely. A GIF is ordinary chat, so it stays and is drawn.
 */
const HUB_ONLY = ["[image:", "[quiz:", "[chess:", "[poker:", "[watch:", "[voice:", "[snes:", "[party:"];

/** A Great Souls feature message that has no place in DraftMasters chat. */
export function isHubOnly(content: string): boolean {
  return content.endsWith("]") && HUB_ONLY.some((prefix) => content.startsWith(prefix));
}

/**
 * GIPHY's own image hosts, and nothing else.
 *
 * A GIF message is drawn as an <img>, so the address inside it is fetched by
 * whoever reads the chat. Anybody can type "[gif:https://...]" into the hub's
 * messages, and an arbitrary address there is a tracking pixel at best.
 */
const GIPHY = /^https:\/\/(?:media\d*|i)\.giphy\.com\/[^\s"'<>\]]+$/;

/** The image behind a GIF message, when it is one and it is GIPHY's. */
export function chatGif(content: string): string | null {
  if (!content.startsWith("[gif:") || !content.endsWith("]")) return null;
  const url = content.slice(5, -1);
  return GIPHY.test(url) ? url : null;
}

/**
 * The message a picked GIF is sent as.
 *
 * Built from GIPHY's id rather than the long signed URL the search returns:
 * about sixty characters, so it fits the room chat's length cap and the
 * friends chat's, and it is exactly the shape chatGif accepts. The hub's
 * messages page draws the same token, so a GIF sent here shows up there too.
 */
export function gifMessage(id: string): string | null {
  return /^[A-Za-z0-9]+$/.test(id) ? `[gif:https://media.giphy.com/media/${id}/giphy.gif]` : null;
}
