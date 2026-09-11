/**
 * What a person looks like on the site when they have not uploaded a photo.
 *
 * It used to be one of three things depending on the page: the first letter of
 * their name in a circle, a dicebear pixel face fetched from somebody else's
 * server, or an emoji. None of them looked like this site, and the letter in
 * particular reads as "picture failed to load" rather than as a person.
 *
 * Now there is one answer everywhere: a drawn portrait from a small set of
 * silhouettes in the house style (see public/avatars/portraits). Anyone who
 * has not chosen one gets one assigned from their id, so the same person is
 * the same knight on every page and every device without anything being
 * stored.
 */

/**
 * The heroines lead the picker, then the original cast of twelve. The default
 * below draws from every entry, so a player who never chooses is as likely to
 * be a queen as a knight.
 *
 * The order is part of the assignment: moving or inserting an entry reassigns
 * the default portrait of everyone who has not chosen one. Append new
 * portraits at the end once this has shipped.
 */
export const PORTRAITS = [
  { id: "priestess", name: "Priestess" },
  { id: "shieldmaiden", name: "Shieldmaiden" },
  { id: "sorceress", name: "Sorceress" },
  { id: "huntress", name: "Huntress" },
  { id: "assassin", name: "Assassin" },
  { id: "queen", name: "Warrior Queen" },
  { id: "knight", name: "Knight" },
  { id: "mage", name: "Mage" },
  { id: "rogue", name: "Rogue" },
  { id: "ranger", name: "Ranger" },
  { id: "paladin", name: "Paladin" },
  { id: "valkyrie", name: "Valkyrie" },
  { id: "samurai", name: "Samurai" },
  { id: "necromancer", name: "Necromancer" },
  { id: "druid", name: "Druid" },
  { id: "barbarian", name: "Barbarian" },
  { id: "monk", name: "Monk" },
  { id: "bard", name: "Bard" },
  { id: "warlock", name: "Warlock" },
  { id: "pirate", name: "Pirate" },
  { id: "dwarf", name: "Dwarf" },
  { id: "ninja", name: "Ninja" },
] as const;

export type PortraitId = (typeof PORTRAITS)[number]["id"];

export const PORTRAIT_DIR = "/avatars/portraits";

export function portraitUrl(id: PortraitId): string {
  return `${PORTRAIT_DIR}/${id}.svg`;
}

/** True for one of the drawn defaults, as opposed to an uploaded photo. */
export function isPortraitUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith(`${PORTRAIT_DIR}/`);
}

/** FNV-1a. Small, stable across runtimes, and good enough to spread ids over twelve drawings. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The portrait someone gets when they have not picked one. Same seed, same drawing. */
export function defaultPortraitFor(seed: string | null | undefined): string {
  const key = (seed ?? "").trim().toLowerCase() || "anon";
  return portraitUrl(PORTRAITS[hash(key) % PORTRAITS.length].id);
}

/**
 * Whether a stored avatar URL is worth trying at all.
 *
 * Old Vercel Blob URLs died in the move to R2 and will never load, so they are
 * treated as absent rather than rendered as a broken image first.
 */
function usable(url: string | null | undefined): url is string {
  if (typeof url !== "string") return false;
  const u = url.trim();
  if (!u) return false;
  if (u.includes("vercel-storage.com")) return false;
  return u.startsWith("/") || u.startsWith("https://") || u.startsWith("http://") || u.startsWith("data:image/");
}

/**
 * The one call sites should use: their stored avatar if they have one, their
 * assigned portrait if not. Seed with the user id where there is one — a
 * username can change, an id cannot.
 */
export function avatarSrc(url: string | null | undefined, seed: string | null | undefined): string {
  return usable(url) ? url.trim() : defaultPortraitFor(seed);
}
