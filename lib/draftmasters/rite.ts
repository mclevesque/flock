/**
 * The opening rite -- its script, and the clock that reads it.
 *
 * Kept out of the component so the timing is a pure function of elapsed
 * milliseconds, which is the only part that can be wrong in a way nobody
 * notices until it is on screen. See rite-step.test.mts.
 */

/**
 * The opening rite.
 *
 * A battle takes fifteen to forty-five seconds to write, and three breathing
 * dots make that feel like a page that has failed to load. This is the same
 * wait spent well: the announcer settling the room before the fight, which is
 * what the moment actually is.
 *
 * Each step REPLACES what is on screen: one line at a time, the last one
 * gone before the next arrives. `at` is milliseconds from the screen opening.
 * Nothing here is ever cut off mid-line -- the crawl waits for the closing
 * line to land and then fades it out; see `rolling`.
 */
export function riteFor(a: string, b: string): { at: number; lines: string[] }[] {
  return [
    { at: 300, lines: ["The combatants gather\u2026"] },
    { at: 3000, lines: ["\u2026and the crowd goes silent in anticipation."] },
    { at: 6600, lines: ["Who will be victorious?"] },
    { at: 8600, lines: [`Team ${a} \u2014 or Team ${b}?`] },
    { at: 12000, lines: [] },
    { at: 13000, lines: ["May The Warrior grant strength to the righteous,"] },
    { at: 15800, lines: ["May The Mother grant mercy to the innocent\u2026"] },
    { at: 19600, lines: [] },
    { at: 20600, lines: ["And may death sustain life."] },
  ];
}

/**
 * Which step of the rite belongs on screen at `ms`.
 *
 * The last step whose time has come, or -1 before the first. Derived rather
 * than remembered, so a throttled tab that wakes up late lands on the right
 * line instead of catching up through the ones it missed.
 */
export function stepAt(rite: { at: number }[], ms: number): number {
  let i = -1;
  while (i + 1 < rite.length && rite[i + 1].at <= ms) i += 1;
  return i;
}

/** How long the closing line holds before the story is allowed to start. */
export const RITE_HOLD = 2400;
/** The handover fade, so the rite dissolves into the story rather than cutting. */
export const RITE_FADE = 1100;
