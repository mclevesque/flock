import { NextResponse } from "next/server";
import { getPack } from "@/lib/draftmasters/packs";
import { offlineVerdict, type Side } from "@/lib/draftmasters/engine";

/**
 * POST /api/draftmasters/judge
 *
 * The "Calculate Winner" button. Hands both rosters to Llama (via Groq — free
 * tier, per house rules) with the pack's scenario and judging criteria, and
 * asks for a verdict it has to justify.
 *
 * Falls back to the deterministic tier scorer if Groq is unset or misbehaves,
 * so the button always resolves the game.
 */

export const maxDuration = 30;

interface JudgeRequest {
  /** Preset pack id — or send `pack` directly for an AI-generated board */
  packId?: string;
  pack?: { name: string; scenario: string; criteria: string };
  sides: Side[];
}

interface Verdict {
  winnerId: string;
  headline: string;
  reasoning: string;
  sideNotes: { sideId: string; score: number; mvp: string; bust: string; note: string }[];
  judged: "ai" | "offline";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as JudgeRequest | null;
  if (!body?.sides || body.sides.length < 2) {
    return NextResponse.json({ error: "two sides required" }, { status: 400 });
  }

  // Custom (AI-generated) boards carry their own scenario; presets look theirs up.
  const preset = body.packId ? getPack(body.packId) : undefined;
  const pack = body.pack ?? preset;
  const sides = body.sides;

  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey && pack) {
    try {
      const rosterText = sides
        .map((s) => {
          const picks = s.roster.length
            ? s.roster
                .map((p) => `  - ${p.name}${p.variant ? ` (${p.variant})` : ""} — $${p.price}`)
                .join("\n")
            : "  - (drafted nobody)";
          const spent = s.roster.reduce((sum, p) => sum + p.price, 0);
          return `TEAM "${s.name}" [id: ${s.id}] — spent $${spent}, $${s.budget} unspent\n${picks}`;
        })
        .join("\n\n");

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 700,
          temperature: 0.75,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are the judge of a live auction draft show. You are decisive, funny, and you commit to a winner — never a tie. " +
                "You care about the scenario, not about who spent more. A cheap roster that fits the scenario beats an expensive one that doesn't. " +
                "Note when a team overpaid or found a steal. Be specific about the actual names drafted; never be generic. " +
                'Reply with ONLY JSON: {"winnerId": string, "headline": string (max 8 words, no period), "reasoning": string (3-4 sentences), ' +
                '"sideNotes": [{"sideId": string, "score": number 0-100, "mvp": string (a drafted name), "bust": string (a drafted name), "note": string (one sentence)}]}',
            },
            {
              role: "user",
              content:
                `DRAFT TOPIC: ${pack.name}\n` +
                `SCENARIO: ${pack.scenario}\n` +
                `JUDGING CRITERIA: ${pack.criteria}\n\n` +
                `${rosterText}\n\n` +
                `Note: a name in parentheses is that character's condition and it is binding — "Jaime Lannister (one hand)" really does only have one hand. Judge them as drafted.\n\n` +
                `Pick the winner. Use the exact id string for winnerId and sideId.`,
            },
          ],
        }),
        signal: AbortSignal.timeout(25000),
      });

      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content;
      if (raw) {
        const parsed = JSON.parse(raw);
        const validId = sides.some((s) => s.id === parsed.winnerId);
        if (validId && parsed.headline && parsed.reasoning) {
          const verdict: Verdict = {
            winnerId: parsed.winnerId,
            headline: String(parsed.headline).slice(0, 80),
            reasoning: String(parsed.reasoning).slice(0, 900),
            sideNotes: Array.isArray(parsed.sideNotes)
              ? parsed.sideNotes
                  .filter((n: { sideId?: string }) => sides.some((s) => s.id === n.sideId))
                  .map((n: Record<string, unknown>) => ({
                    sideId: String(n.sideId),
                    score: Math.max(0, Math.min(100, Number(n.score) || 50)),
                    mvp: String(n.mvp ?? "").slice(0, 60),
                    bust: String(n.bust ?? "").slice(0, 60),
                    note: String(n.note ?? "").slice(0, 200),
                  }))
              : [],
            judged: "ai",
          };
          return NextResponse.json(verdict);
        }
      }
    } catch {
      /* fall through to the offline scorer */
    }
  }

  // ── Offline fallback ──────────────────────────────────────────────────────
  const off = offlineVerdict(sides);
  const winner = sides.find((s) => s.id === off.winnerId);
  const verdict: Verdict = {
    winnerId: off.winnerId,
    headline: `${winner?.name ?? "The winner"} takes it`,
    reasoning: off.reasoning,
    sideNotes: off.scores.map((sc) => {
      const side = sides.find((s) => s.id === sc.sideId)!;
      const sorted = [...side.roster].sort((a, b) => b.tier - a.tier);
      return {
        sideId: sc.sideId,
        score: Math.min(100, Math.round(sc.power * 2)),
        mvp: sorted[0]?.name ?? "—",
        bust: sorted[sorted.length - 1]?.name ?? "—",
        note: `${sc.power} power for $${sc.spent} spent.`,
      };
    }),
    judged: "offline",
  };
  return NextResponse.json(verdict);
}
