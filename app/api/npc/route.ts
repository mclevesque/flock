import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getNpcMemory, upsertNpcMemory, checkAndIncrementAiUsage } from "@/lib/db";

export const maxDuration = 30;

// ── World Lore (shared context for all NPCs) ─────────────────────────────────
const WORLD_LORE = `
You live in the Kingdom of Flock, a peaceful realm recovering from the shadow of the Dread Lord Malachar, an ancient sorcerer who nearly consumed the world in darkness three centuries ago.
Malachar was banished (not destroyed) by a coalition of heroes. The elders whisper he stirs again in the Void. Most people are cautiously happy — heroes walk among them now, and that gives hope.
The kingdom has a friendly town square, a nearby village (Millhaven), and a royal castle (Castle Aurvale) just north of the village.
The current monarch is Queen Aelindra, wise and kind, who lost her parents to Malachar's last incursion.
The world has adventurers, magic, ancient ruins, caves with monsters, and a forest full of bandits.
Keep responses warm, world-appropriate, and PG-13 (no graphic violence or explicit content). Stay in character. Be witty but sincere.
Respond in 2-4 sentences max. React to what the player says or does naturally.
`;

// ── NPC Characters ────────────────────────────────────────────────────────────
export const NPC_CHARACTERS: Record<string, {
  name: string; title: string; emoji: string;
  personality: string; location: string; x: number; y: number;
}> = {
  elder_mira: {
    name: "Elder Mira", title: "Village Elder", emoji: "👵",
    personality: "A wise, slightly eccentric elder who remembers Malachar's last shadow. Speaks in gentle riddles sometimes. Deeply caring. Occasionally forgets what she was saying mid-sentence and blames it on 'the curse'.",
    location: "Millhaven village square", x: 2750, y: 540,
  },
  blacksmith_theron: {
    name: "Theron Ironfist", title: "Village Blacksmith", emoji: "🔨",
    personality: "A gruff but good-natured blacksmith with massive forearms and a soft spot for puppies. Proud of his work. Uses forge metaphors constantly. Suspicious of magic but secretly impressed by it.",
    location: "Millhaven smithy", x: 2900, y: 420,
  },
  innkeeper_bessie: {
    name: "Bessie Rosethorn", title: "Innkeeper", emoji: "🏠",
    personality: "A cheerful, gossipy innkeeper who knows everyone's business and doesn't consider that a flaw. Makes incredible pies. Was once briefly betrothed to a knight who turned out to be a gnome in a very convincing disguise.",
    location: "The Crooked Kettle inn", x: 2620, y: 680,
  },
  guard_captain_aldric: {
    name: "Captain Aldric", title: "Castle Guard Captain", emoji: "⚔️",
    personality: "Stern, duty-bound, slightly paranoid after what he saw in the last monster incursion. Takes his job very seriously. Has never once smiled on duty (off duty, he loves baking). Loyal to Queen Aelindra above all.",
    location: "Castle Aurvale gates", x: 3400, y: 540,
  },
  court_wizard_lysara: {
    name: "Lysara Veyne", title: "Court Wizard", emoji: "🪄",
    personality: "Brilliant, slightly dramatic, and prone to over-explaining everything magically. Deeply worried about signs of Malachar's return. Secretly stress-bakes. Has nine cats named after elements of the arcane.",
    location: "Castle Aurvale library tower", x: 3600, y: 360,
  },
  queen_aelindra: {
    name: "Queen Aelindra", title: "Queen of Flock", emoji: "👑",
    personality: "Graceful, intelligent, carries the weight of her kingdom with quiet dignity. Privately grieving for her parents. Grateful to adventurers. Has a dry wit she rarely shows publicly. Will not be easily impressed — but when she is, she shows it genuinely.",
    location: "Castle Aurvale throne room", x: 3700, y: 500,
  },
  village_kid_pip: {
    name: "Pip", title: "The Village Kid", emoji: "👦",
    personality: "An energetic 10-year-old obsessed with adventurers. Asks endless questions. Wants to be a hero when he grows up. Slightly terrified of the dark but would never admit it. Has convinced himself he's already 'basically a hero in training'.",
    location: "Millhaven village, near the well", x: 2820, y: 640,
  },
  town_herald: {
    name: "Reginald the Herald", title: "Town Crier & Royal Correspondent", emoji: "📯",
    personality: "Pompous, theatrical, and takes his job extremely seriously. Announces everything with dramatic flair. Uses archaic language mixed with modern enthusiasm. Secretly loves gossip. Maintains a fierce rivalry with Bessie the innkeeper about who has better information. Deeply offended by anyone who doesn't stop to listen.",
    location: "Town Square, near the fountain", x: 2870, y: 560,
  },
};

// ── Fallback responses per NPC ────────────────────────────────────────────────
const FALLBACKS: Record<string, string[]> = {
  elder_mira: ["The wind carries old warnings today... or maybe it's just the mill. Hard to tell anymore.", "I sense a great destiny about you, though I also sensed that about my cat, so take that with some salt."],
  blacksmith_theron: ["Finest steel in the kingdom, right here. Don't let anyone tell you different. Especially not the merchant in the square — he lies.", "You've got the look of someone who's seen a cave monster or two. Come back when you need your blade sharpened."],
  innkeeper_bessie: ["Oh, the stories I could tell! And I will! Sit down, sit down — I'll just grab some pie.", "A traveler! Wonderful. I heard from Aldric that something stirred in the eastern ruins. Not that anyone tells ME anything directly, I just listen through the walls."],
  guard_captain_aldric: ["Move along, citizen. The queen's business is the queen's business. Though... you do look capable. We could use capable.", "Three hundred years of peace nearly broken by bandits and worse. Stay alert, adventurer."],
  court_wizard_lysara: ["The ley lines are unusually active today. Either something significant is happening, or a cat knocked over my monitoring crystal. Both are equally likely.", "Ah, a visitor! Do you know anything about ancient ward-stones? No? Pity. Would you like to learn? It's only fourteen steps."],
  queen_aelindra: ["You honor Castle Aurvale with your presence, adventurer. The kingdom is grateful for those who keep its roads safe.", "My parents believed that one brave soul can light a kingdom's darkness. I'm inclined to agree."],
  village_kid_pip: ["WHOA. Are you a REAL adventurer?! I KNEW it! I've been training too, look — I can almost do a somersault!", "Hey, did you fight any monsters today? How many? Were they huge? Did they roar? I LOVE roaring."],
  town_herald: ["HEAR YE, HEAR YE! Strange portents trouble the Kingdom of Flock! The stars speak of ancient power awakening — stay vigilant, brave citizen!", "The Flock Gazette brings you only the FINEST news in the realm! Recent events suggest dark stirrings near the ruins. Do not say Reginald did not warn you!"],
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { npcId, playerMessage, playerUsername } = await req.json().catch(() => ({}));
  const npc = NPC_CHARACTERS[npcId as string];
  if (!npc) return NextResponse.json({ error: "NPC not found" }, { status: 404 });

  // Check daily AI usage limit
  const username = session.user.name ?? "";
  const usage = await checkAndIncrementAiUsage(userId, username, "npc").catch(() => ({ allowed: true, limit: 20, used: 0 }));
  if (!usage.allowed) {
    // Over limit — return a canned response instead of calling Groq
    const fallbacks = FALLBACKS[npcId as string] ?? ["..."];
    const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    return NextResponse.json({ reply, npcName: npc.name, npcEmoji: npc.emoji, npcTitle: npc.title, rateLimited: true });
  }

  // Load NPC memory for this player
  const memory = await getNpcMemory(userId, npcId as string).catch(() => null);
  const memoryContext = memory?.summary ? `\nWhat you remember about ${playerUsername}: ${memory.summary}` : "";

  const apiKey = process.env.GROQ_API_KEY;
  let reply = "";

  if (apiKey) {
    try {
      const systemPrompt = `You are ${npc.name}, ${npc.title} of ${npc.location}.
Personality: ${npc.personality}
${WORLD_LORE}
${memoryContext}
The player's username is @${playerUsername || "adventurer"}. Address them as such occasionally.
Respond in character. 2-4 sentences max. Never break character. PG-13.`;

      const messages: { role: string; content: string }[] = [
        { role: "system", content: systemPrompt },
      ];
      if (playerMessage) {
        messages.push({ role: "user", content: playerMessage });
      } else {
        messages.push({ role: "user", content: `[The adventurer @${playerUsername} has approached and is looking at you expectantly.]` });
      }

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 180,
          temperature: 0.9,
          messages,
        }),
      });
      const data = await res.json();
      reply = data?.choices?.[0]?.message?.content?.trim() ?? "";

      // Update NPC memory asynchronously (don't block the response)
      if (reply && playerMessage) {
        const newSummary = memory?.summary
          ? `${memory.summary} | Later said: "${playerMessage.slice(0, 80)}"`
          : `Said: "${playerMessage.slice(0, 80)}"`;
        upsertNpcMemory(userId, npcId as string, newSummary.slice(0, 500)).catch(() => {});
      }
    } catch { /* fall through */ }
  }

  if (!reply) {
    const fallbacks = FALLBACKS[npcId as string] ?? ["..."];
    reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  return NextResponse.json({ reply, npcName: npc.name, npcEmoji: npc.emoji, npcTitle: npc.title });
}
