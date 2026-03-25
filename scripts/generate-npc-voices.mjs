/**
 * One-time script: generate NPC voice lines via ElevenLabs and save as MP3s.
 * Run: node scripts/generate-npc-voices.mjs
 * Output: public/audio/npc/{npcId}_{0-7}.mp3  and  {npcId}_trait_{key}.mp3
 * Skips files that already exist (safe to re-run).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../public/audio/npc");

// Load from .env.local
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
  });
}
const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) { console.error("Missing ELEVENLABS_API_KEY in .env.local"); process.exit(1); }

const NPC_VOICES = {
  elder_mira:           "YHcCpa6SBWnKDaCPZJQR",
  blacksmith_theron:    "2EiwWnXFnvU5JabPnv8n", // Clyde
  innkeeper_bessie:     "pMsXgVXv3BLzUgSXRplE", // Serena
  guard_captain_aldric: "yoZ06aMxZJJ28mfd3POQ", // Sam
  court_wizard_lysara:  "AZnzlk1XvdvUeBnXmlld", // Domi
  queen_aelindra:       "21m00Tcm4TlvDq8ikWAM", // Rachel
  village_kid_pip:      "xHiHPxp77VDsBmqTIa4d", // Pip (Flock) — custom designed
  town_herald:          "zcAOhNBS3c14rBihAFp1", // Giovanni
  bandit_cutpurse:      "29vD33N1CtxCmqQRPOHJ", // Drew — gruff male
  bandit_shadowblade:   "EXAVITQu4vr4xnSDxMaL", // Bella — menacing female
  bandit_ironclub:      "VR6AewLTigWG4xSOukaG", // Arnold — heavy/brutish
};

// 8 lines per NPC. Indices 0-4 = originals, 5-7 = new plot-aware lines.
const NPC_LINES = {
  elder_mira: [
    "Ah, a traveler... the stars whispered of your coming.",
    "Careful, young one. The shadows grow longer these days.",
    "I remember when this town was half its size. Or was it twice? My memory is... cursed.",
    "The old magic stirs, I can feel it in my knees. They're very reliable, my knees.",
    "You have kind eyes, adventurer. That either means you're trustworthy, or very dangerous.",
    // new — plot-aware
    "The dragon hasn't been seen in a fortnight. That's either very good news or very bad news.",
    "Bandits near the eastern road again. These are not normal bandits. They organize. They plan. Something commands them.",
    "There's a cave south of here that swallows heroes whole. Not a metaphor. I've seen it.",
  ],
  blacksmith_theron: [
    "Need your blade sharpened? Best steel in the kingdom, right here.",
    "What do you want? I'm busy.",
    "Good steel doesn't lie. Unlike people. Steel I trust.",
    "Every sword I've made has a story. Most of them are about someone almost dying.",
    "Don't touch that. It's hot. Everything in here is hot. That's how forges work.",
    // new — plot-aware
    "The Queen's guards ordered fifty blades last week. Fifty. That's not a good sign.",
    "Something big is coming. I've been a smith for thirty years. Orders spike before wars. Orders are spiking.",
    "The iron ore is running scarce. Something's been disrupting the supply caravans from the north.",
  ],
  innkeeper_bessie: [
    "Welcome! Sit down, I'll grab you some pie!",
    "Oh, you won't believe what I heard today!",
    "The pie is fresh, the ale is cold, and the gossip is absolutely free.",
    "Between you and me, something very strange happened at the east road last Tuesday.",
    "I know everyone's business in this town. That's not a boast, that's just a fact.",
    // new — plot-aware
    "Three merchants came through yesterday. None of them wanted to talk about where they'd been. That never means anything good.",
    "People are hoarding bread again. Last time that happened, the dragon showed up. I'm just saying.",
    "A stranger came in last night, asked about the old ruins east of town. Paid gold. Didn't touch the pie. Suspicious.",
  ],
  guard_captain_aldric: [
    "State your business, citizen.",
    "Stay alert. These are dangerous times.",
    "I've been standing at this post for twelve years. Twelve. Years.",
    "Don't cause trouble and we won't have a problem. Cause trouble and we will.",
    "The Queen's safety is my only concern. Everything else is a distraction.",
    // quest-specific lines (indices 5, 6, 7)
    "Got a job for you, if you're up for it. The kingdom doesn't pay well but it pays in glory.",
    "Pick your mission carefully. Some of these contracts have a way of... not ending well for the contractor.",
    "The board's got a few open contracts. I'd recommend the cave job — good experience, manageable risk. Mostly.",
  ],
  court_wizard_lysara: [
    "Fascinating! The ley lines are unusually active today.",
    "Oh, a visitor! Do you know anything about ancient ward-stones?",
    "I've been up for forty-three hours. Magic doesn't sleep and neither do I. Mostly.",
    "My cats are all named after arcane elements. Don't ask me to explain. It would take hours.",
    "Something wicked is gathering to the east. I can't prove it yet, but I will.",
    // new — plot-aware
    "The anomaly in the ley lines started three weeks ago. Three weeks ago, the bandits appeared. Coincidence? No such thing.",
    "I've been studying the ruins east of town. The inscriptions are old. Older than the kingdom. Older than the language.",
    "If you find any enchanted artifacts in your adventures, please bring them here first. Last time someone went straight to market, we had frogs for a week.",
  ],
  queen_aelindra: [
    "Welcome, adventurer. The kingdom is grateful for your service.",
    "You honor Castle Aurvale with your presence.",
    "My parents believed one brave soul could light a kingdom's darkness. I'm inclined to agree.",
    "Rule is not glamour. It is weight. But it is worth carrying.",
    "I do not forget those who protect this realm. Nor do I forget those who threaten it.",
    // new — plot-aware
    "The bandits to the east worry me more than the dragon did. A dragon is honest in its violence.",
    "My scouts report movement near the old ruins. I've sent for reinforcements. They have not arrived.",
    "Should the kingdom fall dark again, I will need every capable blade — and trusted heart — I can find.",
  ],
  village_kid_pip: [
    "WHOA! Are you a REAL adventurer?!",
    "Did you fight any monsters today? How many?!",
    "I've been training! Watch — I can almost do a somersault!",
    "One day I'm gonna fight a dragon. A really big one. Probably two.",
    "Hey, is it true the caves have treasure? My friend said his cousin's uncle went in and never came out!",
    "I heard there was a REAL dragon over the town! I missed it because I was asleep! This is the worst thing that's ever happened to me!",
    "My mom said I can't go near the east road. Which obviously means there's something SUPER cool on the east road.",
    "Captain Aldric gave me a wooden sword for my birthday! I've already broken it on a tree. The tree lost.",
    "I tried to sneak into the castle once. I made it three steps before the guard sat on me. Not on purpose. He didn't see me.",
    "Do you think I could be a mage? I stared at a rock for an hour trying to make it float. It didn't. But I think it wobbled.",
    "My strategy for fighting bandits is to run very fast and scream. It hasn't been tested yet but I feel confident.",
    "Elder Mira said I have an old soul. I don't know what that means but it sounds expensive.",
    "I asked the Queen if I could be a royal guard. She said maybe when I'm taller. I've been standing on my tiptoes ever since.",
    "I found a magic-looking stick in the forest! Lysara said it was just a stick. But she seemed nervous when she said it.",
    "Bessie gave me a pie and said it would make me brave. I ate four. I am EXTREMELY brave now.",
    "There's a ghost in the inn. Bessie says it's just the wind. The wind has never knocked over my juice before.",
    "I bet I could beat a goblin. A small one. A really tired small one. With the sun in its eyes.",
    "Theron let me hold a sword once! For about two seconds. Then he said never again and looked very pale.",
    "I have a journal where I write down all my heroic deeds. It's mostly blank but the title page is AMAZING.",
    "One day everyone's gonna know my name. Probably because I did something incredible. Or possibly because I broke something.",
  ],
  town_herald: [
    "HEAR YE, HEAR YE! Strange portents trouble the Kingdom of Flock!",
    "The Flock Gazette brings you only the finest news in the realm!",
    "LATEST BULLETIN! Heroes of renown have been spotted in the town square! Details to follow!",
    "Dark stirrings near the eastern ruins! Citizens are advised to remain vigilant!",
    "The herald sees all! The herald knows all! The herald will NOT be ignored!",
    // new — plot-aware
    "BREAKING! The dragon has not been sighted in fourteen days! The herald cautiously calls this — probably fine!",
    "URGENT DISPATCH! Bandit activity on the eastern road reaches a three-month high! Merchants advised to travel in groups or not at all!",
    "EXCLUSIVE! Sources close to the castle confirm the Queen has issued a high-priority contract! Adventurers with a death wish encouraged to apply!",
  ],
  bandit_cutpurse: [
    "Your gold or your life!",
    "Nobody passes through here for free!",
    "This ain't personal... actually it is.",
    "The boss said rough 'em up!",
    "Last chance, hero.",
    "I've been waiting all day for someone to rob!",
    "Don't make this harder than it needs to be.",
    "You picked the wrong road, friend.",
  ],
  bandit_shadowblade: [
    "Stand and deliver!",
    "I got bills to pay, okay?",
    "You're worth more tied up than walking free.",
    "Strike fast, vanish faster. That's the Shadowblade way.",
    "I don't miss. Just so you know.",
    "Cry all you want. Nobody's coming.",
    "Make it quick and nobody gets hurt. Well. Hurt worse.",
    "I've taken down better than you. Twice before breakfast.",
  ],
  bandit_ironclub: [
    "We're bandits, har har har!",
    "Yeah, we're the bad guys.",
    "Ironclub smash!",
    "I don't know what's happening but I'm hitting things.",
    "Big weapon, small patience.",
    "You look tough. Good. I like a challenge.",
    "My club hasn't tasted defeat. Today ain't changing that.",
    "Ugh. More adventurers. Why is it always adventurers?",
  ],
};

// Trait-based lines (unchanged from before)
const NPC_TRAIT_LINES = {
  elder_mira: {
    class_warrior:  "A warrior's spirit... I've seen it before. Usually right before something explodes.",
    class_mage:     "Magic flows around you like a cloak. Be careful — I once said the same to someone who is now a frog.",
    class_archer:   "Keen eyes, steady hands. The forest loves an archer, though the forest doesn't love much.",
    class_rogue:    "You move quietly for someone who isn't hiding. Or are you hiding? I genuinely cannot tell.",
    class_none:     "You have not yet chosen your path. That is not weakness — that is possibility.",
    rich:           "You jingle when you walk. That either means coins or a very unusual belt. Either way — impressive.",
    veteran:        "Ah. Many battles behind those eyes. Sit with me — the young ones need to hear from someone who survived.",
  },
  blacksmith_theron: {
    class_warrior:  "Now THAT is someone who knows how to use a blade. Need it sharpened? I thought so.",
    class_mage:     "A mage. Last mage in here nearly turned my anvil into a duck. A duck. I'm still not over it.",
    class_archer:   "Light build, long reach, bowstring calluses. You're an archer. Good. Don't get shot.",
    class_rogue:    "You're the quiet type. I respect that. Keep your hands where I can see them though.",
    class_none:     "Pick up a sword sometime. Or don't. Either way, the kingdom needs more people who can swing things.",
    rich:           "You're loaded. Good. Quality work doesn't come cheap, and neither do I.",
    veteran:        "Been in a few fights, have you. I can always tell. The scars talk louder than the sword.",
  },
  innkeeper_bessie: {
    class_warrior:  "A warrior! Wonderful! You people eat three times the normal amount, which is marvelous for business!",
    class_mage:     "A mage! How thrilling! Can you make fire? Please don't make fire. Last time was catastrophic.",
    class_archer:   "An archer! Do you hunt? I've been looking for someone to get me a pheasant. The good kind.",
    class_rogue:    "You have that look about you. I don't ask questions — just don't nick the silverware. I count it.",
    class_none:     "No class yet? Oh honey, sit down. Pie first, life decisions second. Always.",
    rich:           "Oh my goodness, those coins! Please, have the good table. And the good pie. And more of everything.",
    veteran:        "You've got the look of someone who's seen things. The expensive ale is on the house. You've earned it.",
  },
  guard_captain_aldric: {
    class_warrior:  "Good. Someone who can actually fight. We need your kind and fewer of the magic-waving sort.",
    class_mage:     "A magic user. Fine. Just don't cast anything near the gate. Last time cost me three men and a confused horse.",
    class_archer:   "Archer. Good range, good discipline. I'd have you on the wall any day.",
    class_rogue:    "I know what you are. You know what you are. Let's both pretend we don't and have a peaceful afternoon.",
    class_none:     "Undecided? Pick something. This kingdom doesn't have the luxury of waiting.",
    rich:           "Don't flash those coins near the market. Pickpockets everywhere. You'd think I hadn't warned them.",
    veteran:        "Level like yours doesn't come cheap. Respect. I mean that — and I say it to almost no one.",
  },
  court_wizard_lysara: {
    class_warrior:  "Strength without subtlety. Useful in a fight, less so in a library. Please don't touch anything.",
    class_mage:     "Another mage! Finally! Have you studied dimensional folding? No? That's fine. I'll explain. All of it.",
    class_archer:   "Archery and magic share more than people think — patience, precision, geometry. Want a lecture? No? Pity.",
    class_rogue:    "I've warded this tower against theft. Just so we're on the same page. Lovely to meet you.",
    class_none:     "No class? Fascinating. A blank arcane slate. Have you considered magic? I may have some opinions on the subject.",
    rich:           "Money without magic is just weight. Money WITH magic, however... now we're talking.",
    veteran:        "Your experience precedes you, quite literally — I can read it in your aura. Remarkable. Concerning. Both.",
  },
  queen_aelindra: {
    class_warrior:  "Your strength honors this court. The kingdom's walls hold because of warriors like you.",
    class_mage:     "Magic is a gift and a burden in equal measure. I trust you carry it with wisdom.",
    class_archer:   "A true archer never misses twice. I expect you rarely miss the first time.",
    class_rogue:    "There is a place for shadows in this court. Only ensure they serve the light.",
    class_none:     "The unchosen path is still a path. Take your time — but know that the kingdom watches and hopes.",
    rich:           "Prosperity speaks well of a person — and of the choices that led them here.",
    veteran:        "Your record of service speaks for itself. The kingdom does not forget those who protect it.",
  },
  village_kid_pip: {
    class_warrior:  "YOU'RE A WARRIOR?! Can you lift me over your head?! Can you bench press a horse?! CAN YOU?!",
    class_mage:     "WHOA you're a MAGE?! Can you make fire?! Can you fly?! Can you turn something into a frog?! PLEASE!",
    class_archer:   "Archers are SO cool! You never miss, right?! RIGHT?! What's the furthest shot you've ever made?!",
    class_rogue:    "Are you a SPY?! You look like a spy. You don't have to tell me. Actually — PLEASE tell me. I won't tell anyone.",
    class_none:     "You haven't picked a class yet?! I already picked mine. I'm a hero. Unofficially. Mostly.",
    rich:           "Whoa. You're RICH. Can I have some? Just one coin? I'll trade you a really cool rock.",
    veteran:        "You're like... super high level. That's the coolest thing I've ever seen. Can I follow you around? Just for a bit?",
  },
  town_herald: {
    class_warrior:  "BREAKING NEWS! A seasoned warrior strides through the square! The kingdom rests easier tonight!",
    class_mage:     "SPECIAL REPORT! A wielder of arcane arts arrives! Citizens, mind your belongings and your eyebrows!",
    class_archer:   "LATEST DISPATCH! A marksman of legendary aim graces us! Sources confirm they have never missed. Never!",
    class_rogue:    "DEVELOPING STORY! A figure of mysterious profession visits! The herald asks no questions! The herald simply observes!",
    class_none:     "OPINION PIECE! A citizen of undefined vocation wanders into the square! The herald reserves judgement! For now!",
    rich:           "FINANCIAL BULLETIN! A person of considerable wealth approaches! The local economy is officially thriving!",
    veteran:        "VETERAN SPOTTED! A warrior of many campaigns walks among us! The herald is honored and slightly intimidated!",
  },
};

async function generateLine(text, voiceId, outPath) {
  if (fs.existsSync(outPath)) {
    console.log(`  SKIP: ${path.basename(outPath)}`);
    return;
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_monolingual_v1",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  FAIL ${path.basename(outPath)}: ${err}`);
    return;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  console.log(`  OK: ${path.basename(outPath)} (${buf.length} bytes)`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Generic lines (0-7)
  for (const [npcId, voiceId] of Object.entries(NPC_VOICES)) {
    const lines = NPC_LINES[npcId] ?? [];
    console.log(`\n${npcId}:`);
    for (let i = 0; i < lines.length; i++) {
      const outPath = path.join(OUT_DIR, `${npcId}_${i}.mp3`);
      await generateLine(lines[i], voiceId, outPath);
      await new Promise(r => setTimeout(r, 350));
    }
  }

  // Trait lines
  console.log("\n── Trait lines ──");
  for (const [npcId, voiceId] of Object.entries(NPC_VOICES)) {
    const traits = NPC_TRAIT_LINES[npcId] ?? {};
    console.log(`\n${npcId} traits:`);
    for (const [trait, text] of Object.entries(traits)) {
      const outPath = path.join(OUT_DIR, `${npcId}_trait_${trait}.mp3`);
      await generateLine(text, voiceId, outPath);
      await new Promise(r => setTimeout(r, 350));
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
