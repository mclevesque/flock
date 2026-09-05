import { NextResponse } from "next/server";
import { getPack } from "@/lib/draftmasters/packs";
import { offlineVerdict, type Side } from "@/lib/draftmasters/engine";
import { DRAFT_MODEL } from "@/lib/draftmasters/model";

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
          model: DRAFT_MODEL,
          max_tokens: 6000,
          // Medium, not low: a verdict people argue about deserves an actual
          // war-game of the matchup, not a vibe. Costs a few seconds once.
          reasoning_effort: "medium",
          temperature: 0.6,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are the judge of a live auction draft show. You are decisive, funny, and you commit to a winner — never a tie. " +
                "Before deciding, actually play the scenario out: who on each side handles whom, what each roster lacks, where it breaks. Use what is widely known about these characters' feats and weaknesses — the verdict should survive a fan's cross-examination. " +
                "You care about the scenario, not about who spent more. A cheap roster that fits the scenario beats an expensive one that doesn't. " +
                "Note when a team overpaid or found a steal. Be specific about the actual names drafted; never be generic. " +
                "A condition in parentheses is binding, but weigh it proportionately: a mild one (a wound, fatigue, age) makes them only slightly worse; only a crippling one (missing sword hand, sealed away, dying) changes who they are. " +
                'Reply with ONLY JSON: {"winnerId": string, "headline": string (max 8 words, no period), "reasoning": string (3-4 sentences), ' +
                '"sideNotes": [{"sideId": string, "score": number 0-100, "mvp": string (a drafted name), "bust": string (a drafted name), "note": string (one sentence), ' +
                '"picks": [{"name": string (exact drafted name), "contribution": number 0-10 (how much THIS pick mattered to the team\'s result in the scenario — 10 carried it, 0 was dead weight)}] (one entry per drafted pick, in roster order)}]}',
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
                    picks: Array.isArray(n.picks)
                      ? (n.picks as Record<string, unknown>[]).slice(0, 12).map((p) => ({
                          name: String(p.name ?? "").slice(0, 60),
                          contribution: Math.max(0, Math.min(10, Math.round(Number(p.contribution) || 0))),
                        }))
                      : [],
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
        // Offline: contribution tracks tier — a 5 carried, a 1 rode the bench.
        picks: side.roster.map((p) => ({ name: p.name, contribution: Math.max(0, Math.min(10, p.tier * 2)) })),
      };
    }),
    judged: "offline",
  };
  return NextResponse.json(verdict);
}
