import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { addVoiceRoomMessage } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "No GROQ_API_KEY" }, { status: 500 });

  const contentType = req.headers.get("content-type") ?? "";
  let questionText = "";
  let roomId = "";

  let botId = "default";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    roomId = (formData.get("roomId") as string) ?? "";
    botId = (formData.get("bot") as string) ?? "default";
    const audioBlob = formData.get("audio") as Blob | null;
    const textQuestion = formData.get("question") as string | null;

    if (textQuestion) {
      questionText = textQuestion;
    } else if (audioBlob && audioBlob.size > 0) {
      // Transcribe with Groq Whisper
      const transcribeForm = new FormData();
      transcribeForm.append("file", audioBlob, "audio.webm");
      transcribeForm.append("model", "whisper-large-v3-turbo");
      transcribeForm.append("response_format", "json");

      const transcribeRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: transcribeForm,
      });
      if (transcribeRes.ok) {
        const data = await transcribeRes.json();
        questionText = data.text ?? "";
      }
    }
  } else {
    const body = await req.json().catch(() => ({}));
    roomId = body.roomId ?? "";
    questionText = body.question ?? "";
    botId = body.bot ?? "default";
  }

  if (!questionText.trim()) {
    return NextResponse.json({ error: "No question provided" }, { status: 400 });
  }

  // Bot definitions
  const BOTS: Record<string, { name: string; emoji: string; system: string; temperature: number }> = {
    // Normal bots
    default: {
      name: "AI", emoji: "🤖",
      system: "You are a concise, helpful AI assistant inside a voice chat room. Keep answers to 2–3 sentences max. Be friendly and direct.",
      temperature: 0.7,
    },
    professor: {
      name: "Professor", emoji: "🎓",
      system: "You are a brilliant professor who explains everything clearly with depth and nuance. You love using analogies and real-world examples. Keep answers to 2-3 sentences but make them feel insightful and educational.",
      temperature: 0.7,
    },
    coach: {
      name: "Coach", emoji: "💪",
      system: "You are an energetic life coach and motivator. You answer questions with enthusiasm, positivity, and actionable advice. Keep answers to 2-3 sentences. You believe in the person asking.",
      temperature: 0.75,
    },
    // Character bots
    roger: {
      name: "Roger", emoji: "🥛",
      system: `You are Roger, a 58-year-old conspiracy theorist who is OBSESSED with raw milk. You believe raw milk cures everything, that Big Pharma suppresses its benefits, and that pasteurization is a government plot. You're funny, passionate, and a little unhinged. Every answer somehow connects back to raw milk, government cover-ups, or "the elites." Keep responses to 2-3 sentences. Use folksy language. Occasionally say things like "they don't want you to know this" or "I've done my research."`,
      temperature: 0.95,
    },
    pirate: {
      name: "Captain Blackbeak", emoji: "🏴‍☠️",
      system: "You are Captain Blackbeak, a salty old pirate who answers every question in pirate speak. You relate everything to treasure, sea voyages, and swashbuckling. Keep it to 2-3 sentences. Say 'arrr' at least once. Be dramatic and colorful.",
      temperature: 0.95,
    },
    karen: {
      name: "Karen", emoji: "💅",
      system: "You are Karen, a suburban mom who is perpetually outraged and convinced she deserves to speak to the manager. You give answers through the lens of mild passive-aggressive complaints, HOA rules, and demanding better service. Keep it to 2-3 sentences. Be funny, not mean.",
      temperature: 0.9,
    },
    yoda: {
      name: "Yoda", emoji: "🟢",
      system: "You are Yoda from Star Wars. Answer every question in Yoda's speech pattern — inverted sentence structure, wisdom, and occasional references to the Force. Keep answers to 2-3 sentences. Mysterious and wise you must be.",
      temperature: 0.85,
    },
  };

  const bot = BOTS[botId] ?? BOTS.default;

  // Save question to room chat
  if (roomId) {
    await addVoiceRoomMessage(
      roomId, session.user.id,
      session.user.name ?? "User",
      session.user.image ?? null,
      `❓ ${questionText}`
    ).catch(() => {});
  }

  // Ask Groq LLM
  const llmRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: bot.system },
        { role: "user", content: questionText },
      ],
      temperature: bot.temperature,
      max_tokens: 250,
    }),
  });

  if (!llmRes.ok) {
    return NextResponse.json({ error: "LLM error" }, { status: 500 });
  }

  const llmData = await llmRes.json();
  const answer = llmData.choices?.[0]?.message?.content ?? "Sorry, I couldn't answer that.";

  // Save AI answer to room chat
  if (roomId) {
    await addVoiceRoomMessage(roomId, null, `${bot.emoji} ${bot.name}`, null, answer, true).catch(() => {});
  }

  return NextResponse.json({ question: questionText, answer, bot: botId });
}
