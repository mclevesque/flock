/**
 * Server-side text moderation.
 * Blocks slurs, hate speech, and severe profanity.
 * Applied to: share posts, wall posts, captions, titles.
 */

// Hard-blocked terms — racial slurs, severe hate speech
// Using encoded fragments to avoid this source file itself being a slur list
const BLOCKED: RegExp[] = [
  // Racial slurs
  /\bn+[i1!|]+g+[e3]+r+s?\b/i,
  /\bn+[i1!|]+g+[ga]+\b/i,
  /\bc+[o0]+[o0]+n+s?\b/i,
  /\bs+p+[i1]+c+s?\b/i,
  /\bc+h+[i1]+n+k+s?\b/i,
  /\bg+[o0]+[o0]+k+s?\b/i,
  /\bk+[i1]+k+[e3]+s?\b/i,
  /\bw+[e3]+t+b+[a@]+c+k+s?\b/i,
  /\bs+[a@]+n+d+n+[i1]+g+g+[e3]+r+s?\b/i,
  // Slurs targeting gender / sexuality
  /\bf+[a@4]+g+[gs]?\b/i,
  /\bf+[a@4]+g+[go0]+t+s?\b/i,
  /\bd+[y]+k+[e3]+s?\b/i,
  /\bt+r+[a@4]+n+n+[yi]+\b/i,
  // General severe profanity directed at people
  /\bc+[u]+n+t+s?\b/i,
];

// Contextually blocked patterns (hate speech phrases)
const HATE_PHRASES: RegExp[] = [
  /\b(kill|gas|exterminate|lynch)\s+(all\s+)?(the\s+)?(jews?|blacks?|whites?|muslims?|gays?|trans)\b/i,
  /\b(white|black|asian|jewish)\s+(people|race|woman|man)\s+(are|is)\s+(inferior|subhuman|apes?|animals?|trash)\b/i,
  /\b14\s*words?\b/i,
  /\bheil\s+hitler\b/i,
  /\b88\b.*\bheil\b/i,
];

export interface ModerationResult {
  ok: boolean;
  reason?: string;
}

export function moderateText(text: string): ModerationResult {
  if (!text || typeof text !== "string") return { ok: true };
  const trimmed = text.trim();
  if (!trimmed) return { ok: true };

  for (const re of BLOCKED) {
    if (re.test(trimmed)) {
      return { ok: false, reason: "Content contains language that is not allowed on Ryft." };
    }
  }

  for (const re of HATE_PHRASES) {
    if (re.test(trimmed)) {
      return { ok: false, reason: "Content contains hate speech that is not allowed on Ryft." };
    }
  }

  return { ok: true };
}

/** Check multiple text fields at once */
export function moderateFields(...fields: (string | null | undefined)[]): ModerationResult {
  for (const field of fields) {
    if (!field) continue;
    const result = moderateText(field);
    if (!result.ok) return result;
  }
  return { ok: true };
}
