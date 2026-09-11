/**
 * The invite card, as it travels.
 *
 * An invite is an ordinary direct message whose whole content is one token,
 * the same convention the hub already uses for quiz, chess and SNES invites
 * (`[quiz:id]`). That means it lands in the same table, shows up in the hub's
 * messages page as well as DraftMasters' own chat, and needs no second
 * delivery system — the chat IS the invite channel.
 *
 * Client-safe: no database import, so the drawer and the room can both use it.
 */

/** Room codes are 5 characters from an unambiguous alphabet; typed codes may be 4-6. */
export const ROOM_CODE = /^[A-Z0-9]{4,6}$/;

export function normaliseRoomCode(raw: string | null | undefined): string | null {
  const code = String(raw ?? "").trim().toUpperCase();
  return ROOM_CODE.test(code) ? code : null;
}

export function inviteToken(code: string): string {
  return `[draftmasters:${code}]`;
}

/** The room code if this message is an invite, null if it is just words. */
export function parseInvite(content: string | null | undefined): string | null {
  const m = /^\[draftmasters:([A-Z0-9]{4,6})\]$/.exec(String(content ?? "").trim());
  return m ? m[1] : null;
}

/** The link that lands a player in a room. Relative, so it works on both domains. */
export function roomPath(code: string): string {
  return `/draftmasters?room=${encodeURIComponent(code)}`;
}
