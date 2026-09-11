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

/** The image behind a GIF message, when it is one and the link is https. */
export function chatGif(content: string): string | null {
  if (!content.startsWith("[gif:https://") || !content.endsWith("]")) return null;
  return content.slice(5, -1);
}
