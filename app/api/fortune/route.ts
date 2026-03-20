import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkAndIncrementAiUsage } from "@/lib/db";

export const maxDuration = 30;

const FALLBACK_FORTUNES = [
  "The stars align in your favor — mostly. Mercury is in retrograde, but Mercury is always up to something, so honestly, ignore it. Today: great things await, probably on a Tuesday.",
  "You will soon receive unexpected news. It will be slightly inconvenient, mildly amusing, and ultimately fine. The universe has a sense of humor about these things.",
  "A mysterious stranger will cross your path. They may be your destiny — or just someone who also needed the same parking spot. Hard to say. Keep your options open.",
  "Beware of overconfidence today, especially in matters involving furniture assembly. The instructions lie. They always lie. Trust your instincts, not the diagrams.",
  "Great wealth approaches you — it might be wealth of spirit, friendship, or an actual fiver in an old coat pocket. All are valid. All are treasures.",
  "Your charm will open doors today. Not metaphorically — someone will literally hold a door for you and it will feel weirdly meaningful. Take the win.",
  "The crystal ball shows confusion, which the ball says is YOUR fault. You've been overthinking again. Stop it. Also drink more water. And yes, call your mother.",
  "Fortune smiles upon you, though she is laughing a little, and it is unclear if it is WITH you or AT you. Either way, she seems friendly.",
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username } = await req.json().catch(() => ({}));

  // Check daily limit — over limit gets a canned fortune (still fun, zero Groq cost)
  const usage = await checkAndIncrementAiUsage(session.user.id, session.user.name ?? "", "fortune").catch(() => ({ allowed: true }));
  if (!usage.allowed) {
    const fortune = FALLBACK_FORTUNES[Math.floor(Math.random() * FALLBACK_FORTUNES.length)];
    return NextResponse.json({ fortune });
  }

  // Try Groq API for a real AI-generated fortune
  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 120,
          temperature: 1.1,
          messages: [
            {
              role: "system",
              content: "You are Madame Zara, a theatrical and slightly dramatic fortune teller in an old-timey town square. You give fortunes that are mysterious and poetic but also genuinely funny and a little self-aware. Keep each fortune to 2-3 sentences. Don't use clichés — surprise the reader. Sign off with a wink at the absurdity of fortune telling.",
            },
            {
              role: "user",
              content: `Give a fortune for ${username || "a traveler"} who has come to seek wisdom today.`,
            },
          ],
        }),
      });
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return NextResponse.json({ fortune: text });
    } catch { /* fall through to fallback */ }
  }

  // Fallback: random preset fortune
  const fortune = FALLBACK_FORTUNES[Math.floor(Math.random() * FALLBACK_FORTUNES.length)];
  return NextResponse.json({ fortune });
}
