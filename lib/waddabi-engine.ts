// Word list - at least 120 words across categories
export const WADDABI_WORDS: string[] = [
  // Animals
  "cat", "dog", "fish", "bird", "elephant", "giraffe", "penguin", "octopus", "whale", "butterfly",
  "lion", "tiger", "bear", "rabbit", "frog", "snake", "turtle", "shark", "dolphin", "eagle",
  // Food
  "pizza", "burger", "cake", "ice cream", "taco", "sushi", "hot dog", "donut", "cookie", "sandwich",
  "apple", "banana", "watermelon", "strawberry", "popcorn", "noodles", "soup", "pancake",
  // Objects
  "umbrella", "guitar", "camera", "clock", "phone", "glasses", "key", "crown", "rocket", "sword",
  "telescope", "compass", "lantern", "trophy", "balloon", "kite", "anchor", "diamond",
  // Nature
  "sun", "moon", "star", "cloud", "rainbow", "mountain", "volcano", "wave", "tree", "flower",
  "snowflake", "lightning", "tornado", "cactus", "mushroom", "leaf",
  // Places/Things
  "house", "castle", "bridge", "lighthouse", "boat", "train", "airplane", "car", "bicycle",
  "tent", "igloo", "pyramid", "windmill",
  // Actions/Concepts
  "sleeping", "swimming", "dancing", "flying", "fishing", "reading",
  // Fun/Weird
  "ghost", "robot", "alien", "dragon", "unicorn", "mermaid", "wizard", "ninja",
];

export function pickThreeWords(): string[] {
  const shuffled = [...WADDABI_WORDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export interface Stroke {
  id: string;
  points: Array<{x: number; y: number}>;
  color: string;
  size: number;
  t: number; // ms since round start (for bot timing)
}

export interface ChatMsg {
  id: string;
  userId: string;
  username: string;
  text: string;
  isCorrect?: boolean;
  isSystem?: boolean;
  t: number; // Date.now()
}

export interface WaddabiState {
  phase: "lobby" | "choosing" | "drawing" | "roundEnd" | "gameOver";
  turnOrder: string[]; // player IDs
  currentTurnIdx: number;
  currentWord: string | null;
  wordChoices: string[] | null;
  strokes: Stroke[];
  scores: Record<string, number>;
  guessedThisRound: string[];
  roundStartTime: number; // Date.now() when drawing started
  phaseStartTime: number; // Date.now() when phase started
  chatHistory: ChatMsg[];
  roundCount: number;
  targetScore: number; // 5
  winner: string | null;
  winnerName: string | null;
  roundDuration: number; // 80000ms
  choosingDuration: number; // 15000ms
}

export function emptyState(): WaddabiState {
  return {
    phase: "lobby",
    turnOrder: [],
    currentTurnIdx: 0,
    currentWord: null,
    wordChoices: null,
    strokes: [],
    scores: {},
    guessedThisRound: [],
    roundStartTime: 0,
    phaseStartTime: Date.now(),
    chatHistory: [],
    roundCount: 0,
    targetScore: 5,
    winner: null,
    winnerName: null,
    roundDuration: 40000,
    choosingDuration: 15000,
  };
}

// Remove word from chat for non-drawers
export function sanitizeState(state: WaddabiState, viewerUserId: string, drawerUserId: string): WaddabiState {
  if (viewerUserId === drawerUserId) return state; // drawer sees full state
  return { ...state, currentWord: null, wordChoices: null };
}

// Bot names and types
export const BOT_DRAWERS = [
  { id: "bot-artbot", name: "Artbot 🎨", avatar: "🎨", type: "good" as const },
  { id: "bot-scribblez", name: "Scribblez ✏️", avatar: "✏️", type: "bad" as const },
  { id: "bot-doodler", name: "Doodler 🖊️", avatar: "🖊️", type: "medium" as const },
  { id: "bot-pablo", name: "Pablo 🖌️", avatar: "🖌️", type: "good" as const },
];

// Bot guesser personalities for chat
const BOT_GUESS_CHAT: Record<string, { thinking: string[]; wrong: string[]; win: string[]; timeup: string[] }> = {
  "bot-artbot": {
    thinking: ["hmm let me think...", "I see shapes..."],
    wrong: ["wait that's not right", "oops wrong one"],
    win: ["got it! 🎨", "too easy for an artist 😏"],
    timeup: ["damn, ran out of time", "I had a feeling but too slow"],
  },
  "bot-scribblez": {
    thinking: ["uhhh", "wait what even is that"],
    wrong: ["idk man", "lol no idea", "was it definitely not a potato?"],
    win: ["WAIT I GOT IT", "lucky guess lol"],
    timeup: ["yeah i had no idea", "my drawing was better tbh 😤"],
  },
  "bot-doodler": {
    thinking: ["could be...", "hmm..."],
    wrong: ["nope", "close?", "maybe next time"],
    win: ["nice!", "got it 👍"],
    timeup: ["ran out of time", "tough one"],
  },
  "bot-pablo": {
    thinking: ["studying the composition...", "I see the form..."],
    wrong: ["not what I envisioned", "the proportions were misleading"],
    win: ["a masterpiece recognized 🖌️", "the artist's eye prevails"],
    timeup: ["even masters can be stumped", "the mystery remains..."],
  },
};

// ─── Deterministic hash (no Math.random) ─────────────────────────────────

function simpleHash(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = (Math.imul(hash, 31) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Returns ms after round start when this bot should make their guess
function botGuessTime(botId: string, word: string, quality: "good" | "medium" | "bad", roundDuration: number): number {
  const h = simpleHash(botId + word + "guesstime");
  const minFrac = quality === "good" ? 0.12 : quality === "medium" ? 0.25 : 0.45;
  const maxFrac = quality === "good" ? 0.40 : quality === "medium" ? 0.62 : 0.82;
  const frac = minFrac + ((h % 1000) / 1000) * (maxFrac - minFrac);
  return frac * roundDuration;
}

// Deterministically decides what a bot guesses
function botDecideGuess(botId: string, word: string, quality: "good" | "medium" | "bad"): string {
  const h = simpleHash(botId + word + "guess");
  const correctChance = quality === "good" ? 0.78 : quality === "medium" ? 0.52 : 0.15;
  const isCorrect = (h % 100) < correctChance * 100;
  if (isCorrect) return word;
  // Wrong deterministic pick
  const wrongIdx = (h + 7) % WADDABI_WORDS.length;
  const wrong = WADDABI_WORDS[wrongIdx];
  return wrong === word ? WADDABI_WORDS[(wrongIdx + 3) % WADDABI_WORDS.length] : wrong;
}

// Process bot guesses during drawing phase. Returns updated state (or same state if nothing changed).
export function processBotGuesses(
  state: WaddabiState,
  playerIds: string[],
  playerNames: Record<string, string>,
  botTypes: Record<string, "good" | "medium" | "bad">,
  now: number,
): WaddabiState {
  if (state.phase !== "drawing" || !state.currentWord) return state;

  const elapsed = now - state.roundStartTime;
  const drawerIdx = state.currentTurnIdx % Math.max(1, state.turnOrder.length);
  const drawerUserId = state.turnOrder[drawerIdx];

  let newState = state;
  let mutated = false;

  for (const playerId of state.turnOrder) {
    if (!botTypes[playerId]) continue;             // not a bot
    if (playerId === drawerUserId) continue;        // bot is drawing
    if (state.guessedThisRound.includes(playerId)) continue; // already guessed
    if (!playerIds.includes(playerId)) continue;

    const quality = botTypes[playerId];
    const guessTime = botGuessTime(playerId, state.currentWord, quality, state.roundDuration);
    if (elapsed < guessTime) continue;

    // Bot guesses now
    const guess = botDecideGuess(playerId, state.currentWord, quality);
    const correct = guess.toLowerCase() === state.currentWord.toLowerCase();
    const botName = playerNames[playerId] ?? "Bot";

    // Occasionally add a "thinking" chat message before the guess (different hash)
    const thinkHash = simpleHash(playerId + state.currentWord + "think");
    const addThinkMsg = (thinkHash % 3) === 0; // 1-in-3 chance of thinking message
    const thinkKey = playerId + state.currentWord + "thinkdone";
    const alreadyThought = newState.chatHistory.some(m => m.id === simpleHash(thinkKey).toString(36));

    const msgId = simpleHash(playerId + state.currentWord + "guess").toString(36);
    if (newState.chatHistory.some(m => m.id === msgId)) continue; // already processed

    const newMessages: ChatMsg[] = [];

    if (addThinkMsg && !alreadyThought) {
      const persona = BOT_GUESS_CHAT[playerId];
      const thinkLines = persona?.thinking ?? ["hmm..."];
      const thinkLine = thinkLines[thinkHash % thinkLines.length];
      newMessages.push({
        id: simpleHash(thinkKey).toString(36),
        userId: playerId,
        username: botName,
        text: thinkLine,
        t: now - 500,
      });
    }

    const chatText = correct
      ? (BOT_GUESS_CHAT[playerId]?.win[simpleHash(playerId + "win") % (BOT_GUESS_CHAT[playerId]?.win.length ?? 1)] ?? `✅ ${botName} guessed it!`)
      : guess;

    newMessages.push({
      id: msgId,
      userId: playerId,
      username: botName,
      text: correct ? `✅ ${botName} guessed it!` : chatText,
      isCorrect: correct,
      t: now,
    });

    newState = {
      ...newState,
      chatHistory: [...newState.chatHistory.slice(-80), ...newMessages],
      guessedThisRound: correct ? [...newState.guessedThisRound, playerId] : newState.guessedThisRound,
      scores: correct ? {
        ...newState.scores,
        [playerId]: (newState.scores[playerId] ?? 0) + 1,
        // Drawer gets +1 when someone guesses
        ...(drawerUserId && correct ? { [drawerUserId]: (newState.scores[drawerUserId] ?? 0) + 1 } : {}),
      } : newState.scores,
    };
    mutated = true;

    // Round ends immediately on first correct guess
    if (correct) {
      const endMsg: ChatMsg = {
        id: Math.random().toString(36).slice(2),
        userId: "system",
        username: "Wadabbi?!",
        text: `🎉 "${state.currentWord}" — ${botName} got it!`,
        isSystem: true,
        t: now + 1,
      };
      newState = {
        ...newState,
        phase: "roundEnd",
        phaseStartTime: now,
        chatHistory: [...newState.chatHistory, endMsg],
      };
      return newState; // stop processing more bots
    }
  }

  return mutated ? newState : state;
}

// Generate bot strokes for a given word
// quality: 'good' = geometric shapes, 'bad' = random scribbles, 'medium' = somewhere between
export function generateBotStrokes(word: string, quality: "good" | "medium" | "bad", roundDuration = 40000): Stroke[] {
  const strokes: Stroke[] = [];
  const W = 600; // canvas width reference
  const H = 450; // canvas height reference
  const cx = W / 2;
  const cy = H / 2;
  let t = 800; // ms since round start when first stroke appears
  // Space strokes so drawing fills until ~1 second before the round ends
  const fillMs = Math.max(0, roundDuration - 1000 - t);
  const avgGap = Math.max(400, Math.floor(fillMs / 28));

  function makeStroke(pts: Array<{x: number; y: number}>, color: string, size: number): Stroke {
    const stroke: Stroke = { id: Math.random().toString(36).slice(2), points: pts, color, size, t };
    t += avgGap + Math.floor((Math.random() - 0.2) * avgGap * 0.5);
    return stroke;
  }

  function wobble(x: number, y: number, amount: number): {x: number; y: number} {
    return { x: x + (Math.random() - 0.5) * amount, y: y + (Math.random() - 0.5) * amount };
  }

  function line(x1: number, y1: number, x2: number, y2: number, steps = 8, wobbleAmt = 0): Array<{x: number; y: number}> {
    const pts: Array<{x: number; y: number}> = [];
    for (let i = 0; i <= steps; i++) {
      const t2 = i / steps;
      const x = x1 + (x2 - x1) * t2;
      const y = y1 + (y2 - y1) * t2;
      pts.push(wobble(x, y, wobbleAmt));
    }
    return pts;
  }

  function circle(cx2: number, cy2: number, r: number, steps = 24, wobbleAmt = 0): Array<{x: number; y: number}> {
    const pts: Array<{x: number; y: number}> = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const x = cx2 + Math.cos(angle) * r;
      const y = cy2 + Math.sin(angle) * r;
      pts.push(wobble(x, y, wobbleAmt));
    }
    return pts;
  }

  function rect(x: number, y: number, w: number, h: number, wobbleAmt = 0): Array<{x: number; y: number}> {
    return [
      ...line(x, y, x+w, y, 6, wobbleAmt),
      ...line(x+w, y, x+w, y+h, 6, wobbleAmt),
      ...line(x+w, y+h, x, y+h, 6, wobbleAmt),
      ...line(x, y+h, x, y, 6, wobbleAmt),
    ];
  }

  const wobbleAmt = quality === "good" ? 3 : quality === "medium" ? 12 : 30;
  const darkColor = "#1a1a2e";
  const size = quality === "bad" ? 6 : 3;
  const sz = size; // alias used throughout drawing code

  if (quality === "bad") {
    // Random chaotic scribbles spread across the full round
    for (let s = 0; s < 14; s++) {
      const pts: Array<{x: number; y: number}> = [];
      let px = 100 + Math.random() * 400;
      let py = 50 + Math.random() * 350;
      for (let i = 0; i < 25; i++) {
        px += (Math.random() - 0.5) * 80;
        py += (Math.random() - 0.5) * 80;
        px = Math.max(20, Math.min(W - 20, px));
        py = Math.max(20, Math.min(H - 20, py));
        pts.push({ x: px, y: py });
      }
      strokes.push(makeStroke(pts, ["#e74c3c","#3498db","#2ecc71","#f39c12","#9b59b6","#e91e8c"][s % 6], 5 + Math.random() * 6));
    }
    return strokes;
  }

  const w = word.toLowerCase();

  // ── Animals ──────────────────────────────────────────────────────────────
  if (w === "bird" || w === "eagle") {
    // Body
    strokes.push(makeStroke(circle(cx, cy+10, 40, 16, wobbleAmt), "#7f8c8d", sz));
    // Head
    strokes.push(makeStroke(circle(cx+30, cy-30, 22, 14, wobbleAmt), "#7f8c8d", sz));
    // Beak
    strokes.push(makeStroke([wobble(cx+50,cy-30,wobbleAmt),wobble(cx+72,cy-24,wobbleAmt),wobble(cx+50,cy-22,wobbleAmt)], "#f39c12", sz));
    // Left wing
    strokes.push(makeStroke([wobble(cx-10,cy,wobbleAmt),wobble(cx-80,cy-60,wobbleAmt),wobble(cx-100,cy+10,wobbleAmt),wobble(cx-20,cy+20,wobbleAmt)], w==="eagle"?"#2c3e50":"#95a5a6", sz));
    // Right wing
    strokes.push(makeStroke([wobble(cx+20,cy,wobbleAmt),wobble(cx+90,cy-55,wobbleAmt),wobble(cx+110,cy+5,wobbleAmt),wobble(cx+30,cy+20,wobbleAmt)], w==="eagle"?"#2c3e50":"#95a5a6", sz));
    // Eye
    strokes.push(makeStroke(circle(cx+35, cy-35, 5, 8, wobbleAmt), "#2c3e50", sz));
    // Tail feathers
    strokes.push(makeStroke([wobble(cx-35,cy+40,wobbleAmt),wobble(cx-50,cy+80,wobbleAmt),wobble(cx-30,cy+75,wobbleAmt),wobble(cx-15,cy+40,wobbleAmt)], "#7f8c8d", sz));
    strokes.push(makeStroke([wobble(cx-15,cy+40,wobbleAmt),wobble(cx-20,cy+85,wobbleAmt),wobble(cx,cy+80,wobbleAmt),wobble(cx+5,cy+40,wobbleAmt)], "#95a5a6", sz));
  } else if (w === "elephant") {
    // Body
    strokes.push(makeStroke(circle(cx, cy+30, 90, 20, wobbleAmt), "#95a5a6", sz));
    // Head
    strokes.push(makeStroke(circle(cx-80, cy-40, 55, 18, wobbleAmt), "#95a5a6", sz));
    // Trunk
    strokes.push(makeStroke([wobble(cx-110,cy-20,wobbleAmt),wobble(cx-140,cy+10,wobbleAmt),wobble(cx-150,cy+50,wobbleAmt),wobble(cx-130,cy+70,wobbleAmt),wobble(cx-110,cy+65,wobbleAmt)], "#7f8c8d", sz+2));
    // Ear
    strokes.push(makeStroke(circle(cx-50, cy-50, 40, 16, wobbleAmt), "#c0b0b0", sz));
    // Eye
    strokes.push(makeStroke(circle(cx-95, cy-55, 7, 8, wobbleAmt), "#2c3e50", sz));
    // Legs
    strokes.push(makeStroke(rect(cx-50, cy+110, 30, 60, wobbleAmt), "#95a5a6", sz));
    strokes.push(makeStroke(rect(cx, cy+110, 30, 60, wobbleAmt), "#95a5a6", sz));
    strokes.push(makeStroke(rect(cx+50, cy+100, 30, 60, wobbleAmt), "#7f8c8d", sz));
    // Tail
    strokes.push(makeStroke(line(cx+85, cy+10, cx+110, cy+50, 5, wobbleAmt), "#95a5a6", sz));
  } else if (w === "giraffe") {
    // Body
    strokes.push(makeStroke(circle(cx+20, cy+60, 65, 18, wobbleAmt), "#f39c12", sz));
    // Neck
    strokes.push(makeStroke(rect(cx-5, cy-100, 30, 170, wobbleAmt), "#f39c12", sz));
    // Head
    strokes.push(makeStroke(circle(cx+10, cy-130, 28, 14, wobbleAmt), "#f39c12", sz));
    // Horns
    strokes.push(makeStroke(line(cx+2,cy-155,cx-2,cy-175,4,wobbleAmt), "#8B4513", sz));
    strokes.push(makeStroke(line(cx+18,cy-155,cx+22,cy-175,4,wobbleAmt), "#8B4513", sz));
    // Eye
    strokes.push(makeStroke(circle(cx+18, cy-135, 5, 6, wobbleAmt), "#2c3e50", sz));
    // Spots
    strokes.push(makeStroke(circle(cx+30,cy+40,15,8,wobbleAmt), "#e67e22", sz));
    strokes.push(makeStroke(circle(cx-20,cy+70,12,8,wobbleAmt), "#e67e22", sz));
    strokes.push(makeStroke(circle(cx+50,cy+80,13,8,wobbleAmt), "#e67e22", sz));
    strokes.push(makeStroke(circle(cx+10,cy+20,10,8,wobbleAmt), "#e67e22", sz));
    // Legs
    strokes.push(makeStroke(line(cx-20,cy+120,cx-25,cy+200,5,wobbleAmt), "#f39c12", sz));
    strokes.push(makeStroke(line(cx+40,cy+120,cx+45,cy+200,5,wobbleAmt), "#f39c12", sz));
  } else if (w === "penguin") {
    // Body
    strokes.push(makeStroke(circle(cx, cy+20, 70, 20, wobbleAmt), "#2c3e50", sz));
    // White belly
    strokes.push(makeStroke(circle(cx, cy+30, 45, 18, wobbleAmt), "#ecf0f1", sz));
    // Head
    strokes.push(makeStroke(circle(cx, cy-60, 42, 16, wobbleAmt), "#2c3e50", sz));
    // Eyes
    strokes.push(makeStroke(circle(cx-12, cy-65, 7, 8, wobbleAmt), "#ecf0f1", sz));
    strokes.push(makeStroke(circle(cx+12, cy-65, 7, 8, wobbleAmt), "#ecf0f1", sz));
    strokes.push(makeStroke(circle(cx-12, cy-65, 3, 6, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(circle(cx+12, cy-65, 3, 6, wobbleAmt), "#2c3e50", sz));
    // Beak
    strokes.push(makeStroke([wobble(cx-8,cy-50,wobbleAmt),wobble(cx+8,cy-50,wobbleAmt),wobble(cx,cy-38,wobbleAmt)], "#f39c12", sz));
    // Wings
    strokes.push(makeStroke([wobble(cx-55,cy-20,wobbleAmt),wobble(cx-90,cy+20,wobbleAmt),wobble(cx-70,cy+60,wobbleAmt),wobble(cx-40,cy+30,wobbleAmt)], "#2c3e50", sz));
    strokes.push(makeStroke([wobble(cx+55,cy-20,wobbleAmt),wobble(cx+90,cy+20,wobbleAmt),wobble(cx+70,cy+60,wobbleAmt),wobble(cx+40,cy+30,wobbleAmt)], "#2c3e50", sz));
    // Feet
    strokes.push(makeStroke([wobble(cx-20,cy+85,wobbleAmt),wobble(cx-40,cy+105,wobbleAmt)], "#f39c12", sz+2));
    strokes.push(makeStroke([wobble(cx+20,cy+85,wobbleAmt),wobble(cx+40,cy+105,wobbleAmt)], "#f39c12", sz+2));
  } else if (w === "octopus") {
    // Head
    strokes.push(makeStroke(circle(cx, cy-30, 65, 20, wobbleAmt), "#9b59b6", sz));
    // Eyes
    strokes.push(makeStroke(circle(cx-22, cy-40, 10, 8, wobbleAmt), "#ecf0f1", sz));
    strokes.push(makeStroke(circle(cx+22, cy-40, 10, 8, wobbleAmt), "#ecf0f1", sz));
    strokes.push(makeStroke(circle(cx-22, cy-40, 5, 6, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(circle(cx+22, cy-40, 5, 6, wobbleAmt), "#2c3e50", sz));
    // 8 Tentacles
    for (let i = 0; i < 8; i++) {
      const baseAngle = (i / 8) * Math.PI + 0.1;
      const bx = cx + Math.cos(baseAngle) * 55;
      const by = cy + Math.sin(baseAngle) * 30 + 10;
      const ex = bx + Math.cos(baseAngle) * 80 + (Math.random()-0.5)*30;
      const ey = by + 120 + Math.random()*40;
      strokes.push(makeStroke([wobble(bx,by,wobbleAmt),wobble((bx+ex)/2+(Math.random()-0.5)*40,by+60,wobbleAmt),wobble(ex,ey,wobbleAmt)], "#8e44ad", sz));
    }
  } else if (w === "butterfly") {
    // Body
    strokes.push(makeStroke(line(cx, cy-70, cx, cy+70, 6, wobbleAmt), "#2c3e50", sz));
    // Top left wing
    strokes.push(makeStroke(circle(cx-60, cy-30, 55, 18, wobbleAmt), "#e74c3c", sz));
    // Top right wing
    strokes.push(makeStroke(circle(cx+60, cy-30, 55, 18, wobbleAmt), "#e74c3c", sz));
    // Bottom left wing
    strokes.push(makeStroke(circle(cx-50, cy+40, 38, 14, wobbleAmt), "#e67e22", sz));
    // Bottom right wing
    strokes.push(makeStroke(circle(cx+50, cy+40, 38, 14, wobbleAmt), "#e67e22", sz));
    // Antennae
    strokes.push(makeStroke(line(cx-5,cy-70,cx-35,cy-120,5,wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(line(cx+5,cy-70,cx+35,cy-120,5,wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(circle(cx-35, cy-120, 5, 6, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(circle(cx+35, cy-120, 5, 6, wobbleAmt), "#2c3e50", sz));
    // Wing patterns
    strokes.push(makeStroke(circle(cx-60, cy-30, 20, 10, wobbleAmt), "#f1c40f", sz));
    strokes.push(makeStroke(circle(cx+60, cy-30, 20, 10, wobbleAmt), "#f1c40f", sz));
  } else if (w === "frog") {
    // Body
    strokes.push(makeStroke(circle(cx, cy+20, 70, 20, wobbleAmt), "#27ae60", sz));
    // Eye bumps on top
    strokes.push(makeStroke(circle(cx-30, cy-50, 22, 14, wobbleAmt), "#27ae60", sz));
    strokes.push(makeStroke(circle(cx+30, cy-50, 22, 14, wobbleAmt), "#27ae60", sz));
    // Pupils
    strokes.push(makeStroke(circle(cx-30, cy-52, 10, 8, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(circle(cx+30, cy-52, 10, 8, wobbleAmt), "#2c3e50", sz));
    // Mouth
    strokes.push(makeStroke([...Array.from({length:10},(_,i)=>wobble(cx-40+i*8,cy+50+Math.sin(i/9*Math.PI)*15,wobbleAmt))], "#1a5c2e", sz));
    // Front legs
    strokes.push(makeStroke([wobble(cx-60,cy+30,wobbleAmt),wobble(cx-100,cy+50,wobbleAmt),wobble(cx-110,cy+80,wobbleAmt)], "#27ae60", sz+1));
    strokes.push(makeStroke([wobble(cx+60,cy+30,wobbleAmt),wobble(cx+100,cy+50,wobbleAmt),wobble(cx+110,cy+80,wobbleAmt)], "#27ae60", sz+1));
    // Back legs
    strokes.push(makeStroke([wobble(cx-40,cy+80,wobbleAmt),wobble(cx-80,cy+110,wobbleAmt),wobble(cx-50,cy+140,wobbleAmt)], "#2ecc71", sz+1));
    strokes.push(makeStroke([wobble(cx+40,cy+80,wobbleAmt),wobble(cx+80,cy+110,wobbleAmt),wobble(cx+50,cy+140,wobbleAmt)], "#2ecc71", sz+1));
  } else if (w === "snake") {
    const snakePts: Array<{x: number; y: number}> = [];
    for (let i = 0; i <= 40; i++) {
      const prog = i / 40;
      const x = 60 + prog * 480;
      const y = cy + Math.sin(prog * Math.PI * 3) * 80;
      snakePts.push(wobble(x, y, wobbleAmt));
    }
    strokes.push(makeStroke(snakePts, "#27ae60", sz+3));
    // Head
    strokes.push(makeStroke(circle(520, cy + Math.sin(3 * Math.PI) * 80, 20, 12, wobbleAmt), "#2ecc71", sz));
    // Eye
    strokes.push(makeStroke(circle(530, cy + Math.sin(3 * Math.PI) * 80 - 8, 5, 6, wobbleAmt), "#2c3e50", sz));
    // Tongue
    strokes.push(makeStroke([wobble(535,cy+Math.sin(3*Math.PI)*80,wobbleAmt),wobble(560,cy+Math.sin(3*Math.PI)*80-8,wobbleAmt)], "#e74c3c", sz));
    strokes.push(makeStroke([wobble(535,cy+Math.sin(3*Math.PI)*80,wobbleAmt),wobble(560,cy+Math.sin(3*Math.PI)*80+8,wobbleAmt)], "#e74c3c", sz));
    // Scale details
    strokes.push(makeStroke(circle(200, cy-50, 12, 8, wobbleAmt), "#1a5c2e", sz));
    strokes.push(makeStroke(circle(320, cy+60, 12, 8, wobbleAmt), "#1a5c2e", sz));
    strokes.push(makeStroke(circle(400, cy-40, 12, 8, wobbleAmt), "#1a5c2e", sz));
  } else if (w === "turtle") {
    // Shell dome
    const shellPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 20; i++) { const a = Math.PI + (i/20)*Math.PI; shellPts.push(wobble(cx+Math.cos(a)*90, cy+Math.sin(a)*60+20, wobbleAmt)); }
    strokes.push(makeStroke(shellPts, "#27ae60", sz));
    strokes.push(makeStroke(line(cx-90, cy+20, cx+90, cy+20, 6, wobbleAmt), "#1a5c2e", sz));
    // Shell pattern
    strokes.push(makeStroke(circle(cx, cy-15, 30, 10, wobbleAmt), "#1a5c2e", sz));
    strokes.push(makeStroke(line(cx-60,cy+5,cx+60,cy+5,6,wobbleAmt), "#1a5c2e", sz));
    strokes.push(makeStroke(line(cx-40,cy-10,cx-70,cy+15,4,wobbleAmt), "#1a5c2e", sz));
    strokes.push(makeStroke(line(cx+40,cy-10,cx+70,cy+15,4,wobbleAmt), "#1a5c2e", sz));
    // Head
    strokes.push(makeStroke(circle(cx+100, cy+10, 22, 12, wobbleAmt), "#2ecc71", sz));
    // Eye
    strokes.push(makeStroke(circle(cx+110, cy+4, 5, 6, wobbleAmt), "#2c3e50", sz));
    // Legs
    strokes.push(makeStroke(circle(cx-70, cy+40, 18, 10, wobbleAmt), "#2ecc71", sz));
    strokes.push(makeStroke(circle(cx+60, cy+45, 18, 10, wobbleAmt), "#2ecc71", sz));
    strokes.push(makeStroke(circle(cx-50, cy-10, 15, 8, wobbleAmt), "#2ecc71", sz));
    strokes.push(makeStroke(circle(cx+30, cy-15, 15, 8, wobbleAmt), "#2ecc71", sz));

  // ── Food ─────────────────────────────────────────────────────────────────
  } else if (w === "burger") {
    // Top bun
    const bunPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 20; i++) { const a = Math.PI + (i/20)*Math.PI; bunPts.push(wobble(cx+Math.cos(a)*80, cy-40+Math.sin(a)*40, wobbleAmt)); }
    strokes.push(makeStroke(bunPts, "#e67e22", sz));
    strokes.push(makeStroke(line(cx-80, cy-40, cx+80, cy-40, 6, wobbleAmt), "#e67e22", sz));
    // Sesame seeds
    strokes.push(makeStroke(circle(cx-20,cy-60,5,6,wobbleAmt), "#f8f9fa", sz));
    strokes.push(makeStroke(circle(cx+20,cy-65,5,6,wobbleAmt), "#f8f9fa", sz));
    strokes.push(makeStroke(circle(cx,cy-55,5,6,wobbleAmt), "#f8f9fa", sz));
    // Lettuce
    strokes.push(makeStroke(line(cx-80,cy-30,cx+80,cy-30,6,wobbleAmt), "#27ae60", sz+2));
    // Cheese
    strokes.push(makeStroke(rect(cx-75,cy-20,150,18,wobbleAmt), "#f1c40f", sz));
    // Patty
    strokes.push(makeStroke(rect(cx-75,cy,150,30,wobbleAmt), "#8B4513", sz));
    // Bottom bun
    strokes.push(makeStroke(rect(cx-80,cy+30,160,30,wobbleAmt), "#e67e22", sz));
    strokes.push(makeStroke([...Array.from({length:10},(_,i)=>wobble(cx-80+i*18,cy+60+Math.sin(i/9*Math.PI)*10,wobbleAmt))], "#e67e22", sz));
  } else if (w === "ice cream") {
    // Cone
    strokes.push(makeStroke([wobble(cx-60,cy+20,wobbleAmt),wobble(cx,cy+150,wobbleAmt),wobble(cx+60,cy+20,wobbleAmt)], "#DEB887", sz));
    // Cone lines
    strokes.push(makeStroke(line(cx-30,cy+50,cx+10,cy+130,4,wobbleAmt), "#c8a060", sz));
    strokes.push(makeStroke(line(cx,cy+50,cx+30,cy+130,4,wobbleAmt), "#c8a060", sz));
    // Scoop 1
    strokes.push(makeStroke(circle(cx, cy-20, 60, 20, wobbleAmt), "#f1948a", sz));
    // Scoop 2 (smaller on top)
    strokes.push(makeStroke(circle(cx-10, cy-80, 42, 16, wobbleAmt), "#85c1e9", sz));
    // Cherry
    strokes.push(makeStroke(circle(cx-10, cy-120, 12, 8, wobbleAmt), "#e74c3c", sz));
    strokes.push(makeStroke(line(cx-10,cy-120,cx+10,cy-140,4,wobbleAmt), "#27ae60", sz));
    // Drips
    strokes.push(makeStroke([wobble(cx-20,cy+15,wobbleAmt),wobble(cx-25,cy+35,wobbleAmt),wobble(cx-18,cy+40,wobbleAmt)], "#f1948a", sz));
    strokes.push(makeStroke([wobble(cx+20,cy+10,wobbleAmt),wobble(cx+22,cy+28,wobbleAmt),wobble(cx+16,cy+32,wobbleAmt)], "#85c1e9", sz));
  } else if (w === "hot dog") {
    // Bun top
    const hotBunTop: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 18; i++) { const a = Math.PI + (i/18)*Math.PI; hotBunTop.push(wobble(cx+Math.cos(a)*100, cy-20+Math.sin(a)*35, wobbleAmt)); }
    strokes.push(makeStroke(hotBunTop, "#DEB887", sz));
    // Bun bottom
    const hotBunBot: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 18; i++) { const a = (i/18)*Math.PI; hotBunBot.push(wobble(cx+Math.cos(a)*100, cy+30+Math.sin(a)*35, wobbleAmt)); }
    strokes.push(makeStroke(hotBunBot, "#DEB887", sz));
    // Sausage
    strokes.push(makeStroke(rect(cx-100, cy-15, 200, 40, wobbleAmt), "#c0392b", sz));
    // Sausage ends (circles)
    strokes.push(makeStroke(circle(cx-100, cy+5, 20, 10, wobbleAmt), "#a93226", sz));
    strokes.push(makeStroke(circle(cx+100, cy+5, 20, 10, wobbleAmt), "#a93226", sz));
    // Mustard
    strokes.push(makeStroke(line(cx-80,cy,cx+80,cy,8,wobbleAmt), "#f1c40f", sz+2));
    // Ketchup squiggle
    const ketchupPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 20; i++) { ketchupPts.push(wobble(cx-80+i*8, cy+10+Math.sin(i*1.2)*8, wobbleAmt)); }
    strokes.push(makeStroke(ketchupPts, "#e74c3c", sz+1));
  } else if (w === "apple") {
    strokes.push(makeStroke(circle(cx, cy+10, 70, 22, wobbleAmt), "#e74c3c", sz));
    // Indentation top
    strokes.push(makeStroke(circle(cx, cy-55, 15, 8, wobbleAmt), "#ecf0f1", sz+1));
    // Stem
    strokes.push(makeStroke(line(cx+5, cy-62, cx+15, cy-90, 4, wobbleAmt), "#8B4513", sz));
    // Leaf
    strokes.push(makeStroke([wobble(cx+10,cy-80,wobbleAmt),wobble(cx+40,cy-100,wobbleAmt),wobble(cx+30,cy-70,wobbleAmt),wobble(cx+10,cy-80,wobbleAmt)], "#27ae60", sz));
    // Shine
    strokes.push(makeStroke(circle(cx-25, cy-20, 15, 8, wobbleAmt), "#ff9999", sz));
    strokes.push(makeStroke(line(cx-30,cy-30,cx-10,cy-10,4,wobbleAmt), "#ff9999", sz));
    // Shadow underside
    strokes.push(makeStroke(circle(cx+20, cy+40, 20, 10, wobbleAmt), "#c0392b", sz));
  } else if (w === "banana") {
    const banPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 30; i++) {
      const prog = i / 30;
      const x = cx - 120 + prog * 240;
      const y = cy + 60 - Math.sin(prog * Math.PI) * 120;
      banPts.push(wobble(x, y, wobbleAmt));
    }
    strokes.push(makeStroke(banPts, "#f1c40f", sz+2));
    // Inner curve
    const banPts2: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 30; i++) {
      const prog = i / 30;
      const x = cx - 100 + prog * 200;
      const y = cy + 40 - Math.sin(prog * Math.PI) * 90;
      banPts2.push(wobble(x, y, wobbleAmt));
    }
    strokes.push(makeStroke(banPts2, "#e6b800", sz));
    // Tips
    strokes.push(makeStroke(circle(cx-120, cy+60, 10, 8, wobbleAmt), "#c8a000", sz));
    strokes.push(makeStroke(circle(cx+120, cy+60, 10, 8, wobbleAmt), "#c8a000", sz));
    // Peel lines
    strokes.push(makeStroke(line(cx-60,cy-30,cx-50,cy+20,4,wobbleAmt), "#e6b800", sz));
    strokes.push(makeStroke(line(cx,cy-50,cx+10,cy-10,4,wobbleAmt), "#e6b800", sz));
    strokes.push(makeStroke(line(cx+60,cy-30,cx+50,cy+20,4,wobbleAmt), "#e6b800", sz));
  } else if (w === "watermelon") {
    // Half
    const wmPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 20; i++) { const a = Math.PI + (i/20)*Math.PI; wmPts.push(wobble(cx+Math.cos(a)*120, cy+Math.sin(a)*80, wobbleAmt)); }
    strokes.push(makeStroke(wmPts, "#e74c3c", sz));
    strokes.push(makeStroke(line(cx-120, cy, cx+120, cy, 8, wobbleAmt), "#27ae60", sz));
    // Rind
    const rindPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 20; i++) { const a = Math.PI + (i/20)*Math.PI; rindPts.push(wobble(cx+Math.cos(a)*110, cy+Math.sin(a)*70, wobbleAmt)); }
    strokes.push(makeStroke(rindPts, "#ecf0f1", sz));
    // Seeds
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI + (i / 5) * Math.PI;
      strokes.push(makeStroke(circle(cx+Math.cos(angle)*55, cy+Math.sin(angle)*35, 6, 6, wobbleAmt), "#2c3e50", sz));
    }
    // Stripes on rind
    strokes.push(makeStroke(line(cx-120,cy+5,cx-100,cy+5,4,wobbleAmt), "#27ae60", sz));
    strokes.push(makeStroke(line(cx+100,cy+5,cx+120,cy+5,4,wobbleAmt), "#27ae60", sz));
  } else if (w === "strawberry") {
    // Berry body (heart-ish)
    strokes.push(makeStroke(circle(cx-20, cy, 45, 16, wobbleAmt), "#e74c3c", sz));
    strokes.push(makeStroke(circle(cx+20, cy, 45, 16, wobbleAmt), "#e74c3c", sz));
    strokes.push(makeStroke([wobble(cx-50,cy+15,wobbleAmt),wobble(cx,cy+80,wobbleAmt),wobble(cx+50,cy+15,wobbleAmt)], "#e74c3c", sz));
    // Seeds
    for (let i = 0; i < 8; i++) {
      const sx = cx + (Math.random()-0.5)*60;
      const sy = cy + Math.random()*50;
      strokes.push(makeStroke(circle(sx, sy, 4, 5, wobbleAmt), "#f8f9fa", sz));
    }
    // Leaves
    strokes.push(makeStroke([wobble(cx,cy-40,wobbleAmt),wobble(cx-30,cy-80,wobbleAmt),wobble(cx-10,cy-50,wobbleAmt)], "#27ae60", sz));
    strokes.push(makeStroke([wobble(cx,cy-40,wobbleAmt),wobble(cx+30,cy-80,wobbleAmt),wobble(cx+10,cy-50,wobbleAmt)], "#27ae60", sz));
    strokes.push(makeStroke([wobble(cx,cy-40,wobbleAmt),wobble(cx,cy-90,wobbleAmt)], "#27ae60", sz));
  } else if (w === "taco") {
    // Shell curve
    const shellPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 20; i++) { const a = (i/20)*Math.PI; shellPts.push(wobble(cx-110+i*11, cy+Math.sin(a)*70, wobbleAmt)); }
    strokes.push(makeStroke(shellPts, "#DEB887", sz));
    strokes.push(makeStroke(line(cx-110,cy,cx+110,cy,4,wobbleAmt), "#DEB887", sz));
    // Lettuce
    for (let i = 0; i < 5; i++) strokes.push(makeStroke(circle(cx-60+i*30, cy-10, 18, 8, wobbleAmt), "#27ae60", sz));
    // Meat
    strokes.push(makeStroke(rect(cx-80, cy+10, 160, 20, wobbleAmt), "#8B4513", sz));
    // Cheese
    strokes.push(makeStroke(line(cx-70,cy+5,cx+70,cy+5,6,wobbleAmt), "#f1c40f", sz+2));
    // Tomato
    for (let i = 0; i < 4; i++) strokes.push(makeStroke(circle(cx-45+i*30,cy-20,12,8,wobbleAmt), "#e74c3c", sz));
    // Top shell edge
    strokes.push(makeStroke(line(cx-110,cy,cx+110,cy,6,wobbleAmt), "#c8a060", sz));
  } else if (w === "sushi") {
    // Rice roll
    strokes.push(makeStroke(circle(cx, cy+10, 65, 20, wobbleAmt), "#f8f9fa", sz));
    // Nori wrap
    strokes.push(makeStroke(circle(cx, cy+10, 58, 18, wobbleAmt), "#2c3e50", sz+1));
    // Rice visible
    strokes.push(makeStroke(circle(cx, cy+10, 52, 16, wobbleAmt), "#f8f9fa", sz));
    // Topping (salmon)
    strokes.push(makeStroke(circle(cx, cy+10, 35, 14, wobbleAmt), "#fa8072", sz));
    // Top oval for 3D
    strokes.push(makeStroke(circle(cx, cy-48, 58, 16, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(circle(cx, cy-48, 35, 12, wobbleAmt), "#fa8072", sz));
    // Chopsticks
    strokes.push(makeStroke(line(cx+70,cy-100,cx+50,cy+100,6,wobbleAmt), "#DEB887", sz));
    strokes.push(makeStroke(line(cx+90,cy-100,cx+70,cy+100,6,wobbleAmt), "#DEB887", sz));
    // Wasabi dot
    strokes.push(makeStroke(circle(cx-80, cy+30, 15, 8, wobbleAmt), "#27ae60", sz));
  } else if (w === "popcorn") {
    // Bucket
    strokes.push(makeStroke(rect(cx-50, cy+20, 100, 100, wobbleAmt), "#e74c3c", sz));
    // Stripes on bucket
    strokes.push(makeStroke(line(cx-20,cy+20,cx-20,cy+120,4,wobbleAmt), "#f8f9fa", sz));
    strokes.push(makeStroke(line(cx+20,cy+20,cx+20,cy+120,4,wobbleAmt), "#f8f9fa", sz));
    // Popcorn puffs
    for (let i = 0; i < 9; i++) {
      const px = cx - 60 + (i % 3) * 60;
      const py = cy - 30 - Math.floor(i / 3) * 35;
      strokes.push(makeStroke(circle(px, py, 20 + Math.random()*8, 8, wobbleAmt), "#f8f9fa", sz));
    }
    // Yellow tint on some puffs
    strokes.push(makeStroke(circle(cx-60, cy-30, 15, 6, wobbleAmt), "#f1c40f", sz));
    strokes.push(makeStroke(circle(cx+60, cy-65, 14, 6, wobbleAmt), "#f1c40f", sz));
  } else if (w === "soup") {
    // Bowl
    const bowlPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 20; i++) { const a = (i/20)*Math.PI; bowlPts.push(wobble(cx-100+Math.cos(a)*100,cy+Math.sin(a)*60, wobbleAmt)); }
    strokes.push(makeStroke(bowlPts, "#DEB887", sz));
    strokes.push(makeStroke(line(cx-100, cy, cx+100, cy, 4, wobbleAmt), "#DEB887", sz));
    // Rim
    strokes.push(makeStroke(circle(cx, cy, 100, 14, wobbleAmt), "#c8a060", sz));
    // Liquid
    strokes.push(makeStroke(circle(cx, cy+10, 90, 14, wobbleAmt), "#e67e22", sz));
    // Steam
    for (let i = -1; i <= 1; i++) {
      const steamPts: Array<{x:number;y:number}> = [];
      for (let j = 0; j <= 10; j++) { steamPts.push(wobble(cx+i*30, cy-20-j*8+Math.sin(j*1.5)*10, wobbleAmt+5)); }
      strokes.push(makeStroke(steamPts, "#aab8c2", sz));
    }
    // Vegetables
    strokes.push(makeStroke(circle(cx-30, cy+20, 10, 6, wobbleAmt), "#e74c3c", sz));
    strokes.push(makeStroke(circle(cx+20, cy+15, 10, 6, wobbleAmt), "#27ae60", sz));
    strokes.push(makeStroke(circle(cx, cy+35, 8, 6, wobbleAmt), "#f1c40f", sz));
  } else if (w === "pancake") {
    // Three stacked pancakes
    strokes.push(makeStroke(circle(cx, cy+80, 80, 14, wobbleAmt), "#DEB887", sz));
    strokes.push(makeStroke(circle(cx, cy+40, 75, 14, wobbleAmt), "#c8a060", sz));
    strokes.push(makeStroke(circle(cx, cy, 70, 14, wobbleAmt), "#DEB887", sz));
    // Syrup drip
    const syrupPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 12; i++) { syrupPts.push(wobble(cx+30+Math.sin(i*0.8)*20, cy-5+i*10, wobbleAmt)); }
    strokes.push(makeStroke(syrupPts, "#8B4513", sz+2));
    strokes.push(makeStroke(syrupPts.map(p=>({x:p.x-15, y:p.y+15})), "#8B4513", sz+2));
    // Butter pat
    strokes.push(makeStroke(rect(cx-15, cy-15, 30, 15, wobbleAmt), "#f1c40f", sz));
    // Plate
    strokes.push(makeStroke(circle(cx, cy+90, 100, 14, wobbleAmt), "#ecf0f1", sz));
  } else if (w === "noodles") {
    // Bowl
    const nBowlPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 20; i++) { const a = (i/20)*Math.PI; nBowlPts.push(wobble(cx-100+Math.cos(a)*100,cy+50+Math.sin(a)*60,wobbleAmt)); }
    strokes.push(makeStroke(nBowlPts, "#f8f9fa", sz));
    strokes.push(makeStroke(line(cx-100, cy+50, cx+100, cy+50, 4, wobbleAmt), "#f8f9fa", sz));
    // Noodles
    for (let n = 0; n < 6; n++) {
      const nPts: Array<{x:number;y:number}> = [];
      for (let i = 0; i <= 20; i++) { nPts.push(wobble(cx-70+i*7, cy+30-n*8+Math.sin(i*0.8+n)*20, wobbleAmt)); }
      strokes.push(makeStroke(nPts, "#f1c40f", sz));
    }
    // Egg
    strokes.push(makeStroke(circle(cx-40, cy+10, 20, 10, wobbleAmt), "#f8f9fa", sz));
    strokes.push(makeStroke(circle(cx-40, cy+10, 10, 8, wobbleAmt), "#f39c12", sz));
    // Meat slice
    strokes.push(makeStroke(circle(cx+40, cy+5, 22, 10, wobbleAmt), "#e74c3c", sz));
    // Broth
    strokes.push(makeStroke(circle(cx, cy+60, 90, 10, wobbleAmt), "#e67e22", sz));
  } else if (w === "sandwich") {
    // Top bread
    const sbPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 18; i++) { const a = Math.PI+(i/18)*Math.PI; sbPts.push(wobble(cx+Math.cos(a)*100,cy-50+Math.sin(a)*35,wobbleAmt)); }
    strokes.push(makeStroke(sbPts, "#DEB887", sz));
    strokes.push(makeStroke(line(cx-100, cy-50, cx+100, cy-50, 6, wobbleAmt), "#DEB887", sz));
    // Layers
    strokes.push(makeStroke(rect(cx-95, cy-45, 190, 18, wobbleAmt), "#27ae60", sz)); // lettuce
    strokes.push(makeStroke(rect(cx-90, cy-27, 180, 15, wobbleAmt), "#e74c3c", sz)); // tomato
    strokes.push(makeStroke(rect(cx-90, cy-12, 180, 20, wobbleAmt), "#8B4513", sz)); // meat
    strokes.push(makeStroke(rect(cx-90, cy+8, 180, 12, wobbleAmt), "#f1c40f", sz)); // cheese
    // Bottom bread
    strokes.push(makeStroke(rect(cx-100, cy+20, 200, 35, wobbleAmt), "#DEB887", sz));
    const sb2Pts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 18; i++) { const a = (i/18)*Math.PI; sb2Pts.push(wobble(cx+Math.cos(a)*100,cy+55+Math.sin(a)*15,wobbleAmt)); }
    strokes.push(makeStroke(sb2Pts, "#DEB887", sz));
    // Toothpick
    strokes.push(makeStroke(line(cx, cy-50, cx, cy+55, 4, wobbleAmt), "#27ae60", sz));
    strokes.push(makeStroke(circle(cx, cy-55, 6, 6, wobbleAmt), "#e74c3c", sz));

  // ── Objects ───────────────────────────────────────────────────────────────
  } else if (w === "clock") {
    strokes.push(makeStroke(circle(cx, cy, 100, 24, wobbleAmt), "#ecf0f1", sz));
    strokes.push(makeStroke(circle(cx, cy, 90, 20, wobbleAmt), "#2c3e50", sz));
    // Hour markers
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      strokes.push(makeStroke(line(cx+Math.cos(a)*75, cy+Math.sin(a)*75, cx+Math.cos(a)*88, cy+Math.sin(a)*88, 3, wobbleAmt), "#ecf0f1", sz));
    }
    // Hands
    strokes.push(makeStroke(line(cx, cy, cx, cy-65, 6, wobbleAmt), "#e74c3c", sz+1));
    strokes.push(makeStroke(line(cx, cy, cx+45, cy+15, 5, wobbleAmt), "#ecf0f1", sz));
    strokes.push(makeStroke(circle(cx, cy, 6, 8, wobbleAmt), "#e74c3c", sz));
    // Numbers (12, 3, 6, 9)
    strokes.push(makeStroke(circle(cx, cy-82, 5, 5, wobbleAmt), "#f1c40f", sz));
    strokes.push(makeStroke(circle(cx+82, cy, 5, 5, wobbleAmt), "#f1c40f", sz));
    strokes.push(makeStroke(circle(cx, cy+82, 5, 5, wobbleAmt), "#f1c40f", sz));
    strokes.push(makeStroke(circle(cx-82, cy, 5, 5, wobbleAmt), "#f1c40f", sz));
  } else if (w === "phone") {
    strokes.push(makeStroke(rect(cx-45, cy-95, 90, 185, wobbleAmt), "#2c3e50", sz));
    // Screen
    strokes.push(makeStroke(rect(cx-35, cy-80, 70, 145, wobbleAmt), "#3498db", sz));
    // Home button
    strokes.push(makeStroke(circle(cx, cy+80, 10, 10, wobbleAmt), "#7f8c8d", sz));
    // Camera
    strokes.push(makeStroke(circle(cx, cy-85, 5, 6, wobbleAmt), "#95a5a6", sz));
    // App icons on screen
    strokes.push(makeStroke(rect(cx-28, cy-60, 18, 18, wobbleAmt), "#e74c3c", sz));
    strokes.push(makeStroke(rect(cx+10, cy-60, 18, 18, wobbleAmt), "#2ecc71", sz));
    strokes.push(makeStroke(rect(cx-28, cy-35, 18, 18, wobbleAmt), "#f39c12", sz));
    strokes.push(makeStroke(rect(cx+10, cy-35, 18, 18, wobbleAmt), "#9b59b6", sz));
  } else if (w === "glasses") {
    // Left lens
    strokes.push(makeStroke(circle(cx-55, cy, 40, 16, wobbleAmt), "#2c3e50", sz+1));
    // Right lens
    strokes.push(makeStroke(circle(cx+55, cy, 40, 16, wobbleAmt), "#2c3e50", sz+1));
    // Bridge
    strokes.push(makeStroke(line(cx-15, cy-10, cx+15, cy-10, 4, wobbleAmt), "#2c3e50", sz));
    // Left arm
    strokes.push(makeStroke(line(cx-95, cy-5, cx-140, cy+10, 4, wobbleAmt), "#2c3e50", sz));
    // Right arm
    strokes.push(makeStroke(line(cx+95, cy-5, cx+140, cy+10, 4, wobbleAmt), "#2c3e50", sz));
    // Lens shine
    strokes.push(makeStroke(circle(cx-65, cy-10, 10, 6, wobbleAmt), "#5dade2", sz));
    strokes.push(makeStroke(circle(cx+65, cy-10, 10, 6, wobbleAmt), "#5dade2", sz));
    // Nose pad detail
    strokes.push(makeStroke(line(cx-15, cy-5, cx-15, cy+5, 3, wobbleAmt), "#7f8c8d", sz));
    strokes.push(makeStroke(line(cx+15, cy-5, cx+15, cy+5, 3, wobbleAmt), "#7f8c8d", sz));
  } else if (w === "key") {
    // Handle ring
    strokes.push(makeStroke(circle(cx-60, cy, 55, 18, wobbleAmt), "#f1c40f", sz+1));
    strokes.push(makeStroke(circle(cx-60, cy, 38, 14, wobbleAmt), "#e67e22", sz));
    // Key shaft
    strokes.push(makeStroke(line(cx-5, cy, cx+120, cy, 8, wobbleAmt), "#f1c40f", sz+2));
    // Teeth
    strokes.push(makeStroke(line(cx+40, cy, cx+40, cy+25, 5, wobbleAmt), "#f1c40f", sz+1));
    strokes.push(makeStroke(line(cx+70, cy, cx+70, cy+20, 5, wobbleAmt), "#f1c40f", sz+1));
    strokes.push(makeStroke(line(cx+100, cy, cx+100, cy+15, 5, wobbleAmt), "#f1c40f", sz+1));
    // Shine on ring
    strokes.push(makeStroke(circle(cx-75, cy-20, 10, 6, wobbleAmt), "#f8f9fa", sz));
  } else if (w === "camera") {
    // Body
    strokes.push(makeStroke(rect(cx-80, cy-50, 160, 100, wobbleAmt), "#2c3e50", sz));
    // Lens
    strokes.push(makeStroke(circle(cx-5, cy+10, 40, 16, wobbleAmt), "#7f8c8d", sz));
    strokes.push(makeStroke(circle(cx-5, cy+10, 28, 12, wobbleAmt), "#1a1a2e", sz));
    strokes.push(makeStroke(circle(cx-5, cy+10, 16, 8, wobbleAmt), "#3498db", sz));
    // Flash
    strokes.push(makeStroke(rect(cx+50, cy-45, 25, 18, wobbleAmt), "#f1c40f", sz));
    // Viewfinder
    strokes.push(makeStroke(rect(cx+20, cy-45, 25, 15, wobbleAmt), "#34495e", sz));
    // Shutter button
    strokes.push(makeStroke(circle(cx+50, cy-60, 10, 8, wobbleAmt), "#e74c3c", sz));
    // Grip area
    strokes.push(makeStroke(rect(cx+70, cy-50, 15, 100, wobbleAmt), "#34495e", sz));
    // Strap lug
    strokes.push(makeStroke(rect(cx-80, cy-30, 10, 15, wobbleAmt), "#7f8c8d", sz));
  } else if (w === "telescope") {
    // Main tube (angled)
    strokes.push(makeStroke(line(cx-100, cy+60, cx+100, cy-60, 10, wobbleAmt), "#7f8c8d", sz+3));
    // Small tube section
    strokes.push(makeStroke(line(cx+70, cy-45, cx+140, cy-90, 7, wobbleAmt), "#95a5a6", sz+2));
    // Eyepiece end
    strokes.push(makeStroke(circle(cx-100, cy+60, 15, 10, wobbleAmt), "#2c3e50", sz));
    // Objective lens end
    strokes.push(makeStroke(circle(cx+140, cy-90, 22, 12, wobbleAmt), "#5dade2", sz));
    // Tripod legs
    strokes.push(makeStroke(line(cx-20, cy+30, cx-60, cy+140, 5, wobbleAmt), "#8B4513", sz));
    strokes.push(makeStroke(line(cx-20, cy+30, cx+20, cy+140, 5, wobbleAmt), "#8B4513", sz));
    strokes.push(makeStroke(line(cx-20, cy+30, cx-110, cy+110, 5, wobbleAmt), "#8B4513", sz));
    // Stars in background
    strokes.push(makeStroke(circle(cx+80, cy-120, 4, 5, wobbleAmt), "#f1c40f", sz));
    strokes.push(makeStroke(circle(cx-80, cy-60, 3, 4, wobbleAmt), "#f1c40f", sz));
    strokes.push(makeStroke(circle(cx+140, cy-10, 3, 4, wobbleAmt), "#f1c40f", sz));
  } else if (w === "compass") {
    strokes.push(makeStroke(circle(cx, cy, 90, 22, wobbleAmt), "#DEB887", sz));
    strokes.push(makeStroke(circle(cx, cy, 80, 20, wobbleAmt), "#ecf0f1", sz));
    // N arrow (red)
    strokes.push(makeStroke([wobble(cx,cy,wobbleAmt),wobble(cx-10,cy+40,wobbleAmt),wobble(cx,cy-60,wobbleAmt),wobble(cx+10,cy+40,wobbleAmt),wobble(cx,cy,wobbleAmt)], "#e74c3c", sz));
    // S arrow (white)
    strokes.push(makeStroke([wobble(cx,cy,wobbleAmt),wobble(cx-8,cy-30,wobbleAmt),wobble(cx,cy+60,wobbleAmt),wobble(cx+8,cy-30,wobbleAmt),wobble(cx,cy,wobbleAmt)], "#ecf0f1", sz));
    // Center dot
    strokes.push(makeStroke(circle(cx, cy, 6, 6, wobbleAmt), "#2c3e50", sz));
    // Cardinal direction ticks
    strokes.push(makeStroke(line(cx, cy-80, cx, cy-70, 3, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(line(cx, cy+70, cx, cy+80, 3, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(line(cx-80, cy, cx-70, cy, 3, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(line(cx+70, cy, cx+80, cy, 3, wobbleAmt), "#2c3e50", sz));
  } else if (w === "balloon") {
    // Balloon
    strokes.push(makeStroke(circle(cx, cy-40, 80, 22, wobbleAmt), "#e74c3c", sz));
    // Knot
    strokes.push(makeStroke(circle(cx, cy+40, 8, 8, wobbleAmt), "#c0392b", sz));
    // String
    const strPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 20; i++) strPts.push(wobble(cx+Math.sin(i*0.5)*15, cy+48+i*8, wobbleAmt));
    strokes.push(makeStroke(strPts, "#7f8c8d", sz));
    // Shine
    strokes.push(makeStroke(circle(cx-30, cy-65, 18, 8, wobbleAmt), "#ff8888", sz));
    strokes.push(makeStroke(circle(cx-20, cy-75, 8, 6, wobbleAmt), "#ffaaaa", sz));
    // Highlight stripe
    strokes.push(makeStroke(line(cx+30,cy-80,cx+50,cy-20,4,wobbleAmt), "#f1948a", sz));
  } else if (w === "kite") {
    // Diamond kite shape
    strokes.push(makeStroke([wobble(cx,cy-110,wobbleAmt),wobble(cx+80,cy,wobbleAmt),wobble(cx,cy+80,wobbleAmt),wobble(cx-80,cy,wobbleAmt),wobble(cx,cy-110,wobbleAmt)], "#e74c3c", sz));
    // Cross spars
    strokes.push(makeStroke(line(cx, cy-110, cx, cy+80, 4, wobbleAmt), "#8B4513", sz));
    strokes.push(makeStroke(line(cx-80, cy, cx+80, cy, 4, wobbleAmt), "#8B4513", sz));
    // Color sections
    strokes.push(makeStroke([wobble(cx,cy-110,wobbleAmt),wobble(cx-80,cy,wobbleAmt),wobble(cx,cy,wobbleAmt)], "#f1c40f", sz));
    strokes.push(makeStroke([wobble(cx,cy-110,wobbleAmt),wobble(cx+80,cy,wobbleAmt),wobble(cx,cy,wobbleAmt)], "#3498db", sz));
    // Tail
    const tailPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 15; i++) tailPts.push(wobble(cx+Math.sin(i*0.7)*25, cy+80+i*12, wobbleAmt));
    strokes.push(makeStroke(tailPts, "#7f8c8d", sz));
    // Tail ribbons
    strokes.push(makeStroke(line(cx-15,cy+100,cx+15,cy+110,4,wobbleAmt), "#f1c40f", sz));
    strokes.push(makeStroke(line(cx-10,cy+125,cx+15,cy+135,4,wobbleAmt), "#e74c3c", sz));
  } else if (w === "diamond") {
    // Top half
    strokes.push(makeStroke([wobble(cx-40,cy-10,wobbleAmt),wobble(cx,cy-90,wobbleAmt),wobble(cx+40,cy-10,wobbleAmt)], "#5dade2", sz));
    // Bottom half
    strokes.push(makeStroke([wobble(cx-60,cy,wobbleAmt),wobble(cx,cy+100,wobbleAmt),wobble(cx+60,cy,wobbleAmt)], "#3498db", sz));
    // Top girdle
    strokes.push(makeStroke([wobble(cx-60,cy,wobbleAmt),wobble(cx-40,cy-10,wobbleAmt),wobble(cx,cy-10,wobbleAmt),wobble(cx+40,cy-10,wobbleAmt),wobble(cx+60,cy,wobbleAmt)], "#85c1e9", sz));
    // Facet lines
    strokes.push(makeStroke(line(cx, cy-90, cx-60, cy, 4, wobbleAmt), "#a9cce3", sz));
    strokes.push(makeStroke(line(cx, cy-90, cx+60, cy, 4, wobbleAmt), "#a9cce3", sz));
    strokes.push(makeStroke(line(cx, cy-90, cx, cy+100, 4, wobbleAmt), "#a9cce3", sz));
    strokes.push(makeStroke(line(cx-60,cy,cx,cy+100,4,wobbleAmt), "#2980b9", sz));
    strokes.push(makeStroke(line(cx+60,cy,cx,cy+100,4,wobbleAmt), "#2980b9", sz));
    // Shine
    strokes.push(makeStroke(circle(cx-15, cy-50, 8, 6, wobbleAmt), "#ecf0f1", sz));
  } else if (w === "trophy") {
    // Cup body
    strokes.push(makeStroke(rect(cx-50, cy-60, 100, 80, wobbleAmt), "#f1c40f", sz));
    // Cup curve top
    strokes.push(makeStroke(circle(cx, cy-60, 50, 12, wobbleAmt), "#f1c40f", sz));
    // Handles
    strokes.push(makeStroke([wobble(cx-50,cy-40,wobbleAmt),wobble(cx-85,cy-40,wobbleAmt),wobble(cx-85,cy+10,wobbleAmt),wobble(cx-50,cy+10,wobbleAmt)], "#f39c12", sz));
    strokes.push(makeStroke([wobble(cx+50,cy-40,wobbleAmt),wobble(cx+85,cy-40,wobbleAmt),wobble(cx+85,cy+10,wobbleAmt),wobble(cx+50,cy+10,wobbleAmt)], "#f39c12", sz));
    // Stem
    strokes.push(makeStroke(line(cx, cy+20, cx, cy+70, 6, wobbleAmt), "#e67e22", sz));
    // Base
    strokes.push(makeStroke(rect(cx-65, cy+70, 130, 20, wobbleAmt), "#e67e22", sz));
    // Star on cup
    const starPts2: Array<{x:number;y:number}> = [];
    for (let i = 0; i < 5; i++) {
      const oa = (i/5)*Math.PI*2 - Math.PI/2;
      const ia = oa + Math.PI/5;
      starPts2.push(wobble(cx+Math.cos(oa)*28,cy-30+Math.sin(oa)*28,wobbleAmt));
      starPts2.push(wobble(cx+Math.cos(ia)*12,cy-30+Math.sin(ia)*12,wobbleAmt));
    }
    starPts2.push(starPts2[0]);
    strokes.push(makeStroke(starPts2, "#e67e22", sz));
    // Shine
    strokes.push(makeStroke(line(cx-25,cy-50,cx-25,cy-20,4,wobbleAmt), "#f8f9fa", sz));
  } else if (w === "lantern") {
    // Top bar
    strokes.push(makeStroke(line(cx-30, cy-90, cx+30, cy-90, 5, wobbleAmt), "#2c3e50", sz));
    // Hook
    strokes.push(makeStroke(line(cx, cy-90, cx, cy-110, 4, wobbleAmt), "#2c3e50", sz));
    // Body
    strokes.push(makeStroke(rect(cx-45, cy-85, 90, 120, wobbleAmt), "#e74c3c", sz));
    // Glow inside
    strokes.push(makeStroke(circle(cx, cy-25, 35, 12, wobbleAmt), "#f1c40f", sz));
    // Ribs
    for (let i = 0; i < 5; i++) strokes.push(makeStroke(line(cx-45, cy-85+i*25, cx+45, cy-85+i*25, 4, wobbleAmt), "#c0392b", sz));
    // Bottom fringe
    for (let i = -3; i <= 3; i++) strokes.push(makeStroke(line(cx+i*12, cy+35, cx+i*12, cy+60, 3, wobbleAmt), "#e67e22", sz));
    // Bottom piece
    strokes.push(makeStroke(line(cx-35, cy+35, cx+35, cy+35, 5, wobbleAmt), "#2c3e50", sz));

  // ── Nature ────────────────────────────────────────────────────────────────
  } else if (w === "snowflake") {
    const sfColors = ["#aab8c2","#85c1e9","#5dade2"];
    for (let arm = 0; arm < 6; arm++) {
      const a = (arm / 6) * Math.PI * 2;
      strokes.push(makeStroke(line(cx, cy, cx+Math.cos(a)*90, cy+Math.sin(a)*90, 6, wobbleAmt), sfColors[arm%3], sz));
      // Branch
      strokes.push(makeStroke(line(cx+Math.cos(a)*40, cy+Math.sin(a)*40, cx+Math.cos(a+Math.PI/3)*65, cy+Math.sin(a+Math.PI/3)*65, 4, wobbleAmt), sfColors[(arm+1)%3], sz));
      strokes.push(makeStroke(line(cx+Math.cos(a)*40, cy+Math.sin(a)*40, cx+Math.cos(a-Math.PI/3)*65, cy+Math.sin(a-Math.PI/3)*65, 4, wobbleAmt), sfColors[(arm+2)%3], sz));
    }
    strokes.push(makeStroke(circle(cx, cy, 10, 8, wobbleAmt), "#ecf0f1", sz));
  } else if (w === "tornado") {
    const tornPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 40; i++) {
      const prog = i / 40;
      const r = 10 + prog * 120;
      const a = prog * Math.PI * 6;
      tornPts.push(wobble(cx + Math.cos(a) * r, 60 + prog * 330, wobbleAmt + prog * 15));
    }
    strokes.push(makeStroke(tornPts, "#7f8c8d", sz+2));
    // Width lines
    for (let i = 1; i <= 5; i++) {
      const py = 60 + i * 65;
      const r = i * 22;
      strokes.push(makeStroke(line(cx-r, py, cx+r, py, 4, wobbleAmt), "#95a5a6", sz));
    }
    // Debris
    strokes.push(makeStroke(circle(cx-80, cy+40, 8, 6, wobbleAmt), "#8B4513", sz));
    strokes.push(makeStroke(circle(cx+90, cy+80, 6, 5, wobbleAmt), "#27ae60", sz));
    strokes.push(makeStroke(circle(cx-100, cy+100, 5, 5, wobbleAmt), "#95a5a6", sz));
  } else if (w === "leaf") {
    // Main leaf shape
    const lfPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const r = 80 + Math.cos(a * 2) * 20;
      lfPts.push(wobble(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r, wobbleAmt));
    }
    strokes.push(makeStroke(lfPts, "#27ae60", sz));
    // Central vein
    strokes.push(makeStroke(line(cx, cy-100, cx, cy+100, 4, wobbleAmt), "#1a5c2e", sz));
    // Side veins
    for (let i = -3; i <= 3; i++) {
      const vy = cy + i * 28;
      const dir = i % 2 === 0 ? 1 : -1;
      strokes.push(makeStroke(line(cx, vy, cx+dir*50, vy-20, 3, wobbleAmt), "#1a5c2e", sz));
    }
    // Stem
    strokes.push(makeStroke(line(cx, cy+100, cx+10, cy+145, 4, wobbleAmt), "#8B4513", sz));
    // Color variation
    strokes.push(makeStroke(circle(cx+20, cy-20, 15, 8, wobbleAmt), "#2ecc71", sz));

  // ── Places / Things ───────────────────────────────────────────────────────
  } else if (w === "bridge") {
    // Road
    strokes.push(makeStroke(line(50, cy+30, W-50, cy+30, 8, wobbleAmt), "#7f8c8d", sz+2));
    // Towers
    strokes.push(makeStroke(rect(cx-140, cy-100, 25, 130, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(rect(cx+115, cy-100, 25, 130, wobbleAmt), "#2c3e50", sz));
    // Tower tops
    strokes.push(makeStroke(rect(cx-145, cy-110, 35, 15, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(rect(cx+110, cy-110, 35, 15, wobbleAmt), "#2c3e50", sz));
    // Main cables
    const cablePts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 30; i++) { const prog = i/30; cablePts.push(wobble(50+prog*(W-100), cy+30 - Math.sin(prog*Math.PI)*80, wobbleAmt)); }
    strokes.push(makeStroke(cablePts, "#c0392b", sz));
    const cable2Pts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 30; i++) { const prog = i/30; cable2Pts.push(wobble(50+prog*(W-100), cy+20 - Math.sin(prog*Math.PI)*80, wobbleAmt)); }
    strokes.push(makeStroke(cable2Pts, "#e74c3c", sz));
    // Vertical suspenders
    for (let i = 0; i <= 8; i++) {
      const sx = 80 + i * (W-160)/8;
      const sy = cy + 25 - Math.sin((i/8)*Math.PI)*80;
      strokes.push(makeStroke(line(sx, sy, sx, cy+30, 3, wobbleAmt), "#7f8c8d", sz));
    }
  } else if (w === "lighthouse") {
    // Tower body
    strokes.push(makeStroke([wobble(cx-30,H-60,wobbleAmt),wobble(cx-18,cy-40,wobbleAmt),wobble(cx+18,cy-40,wobbleAmt),wobble(cx+30,H-60,wobbleAmt),wobble(cx-30,H-60,wobbleAmt)], "#ecf0f1", sz));
    // Stripes
    strokes.push(makeStroke(rect(cx-25, cy+80, 50, 30, wobbleAmt), "#e74c3c", sz));
    strokes.push(makeStroke(rect(cx-22, cy+20, 44, 30, wobbleAmt), "#e74c3c", sz));
    // Lantern room
    strokes.push(makeStroke(rect(cx-22, cy-80, 44, 40, wobbleAmt), "#7f8c8d", sz));
    // Light beam
    strokes.push(makeStroke([wobble(cx,cy-60,wobbleAmt),wobble(cx+160,cy-120,wobbleAmt),wobble(cx+160,cy-20,wobbleAmt),wobble(cx,cy-40,wobbleAmt)], "#f1c40f", sz));
    strokes.push(makeStroke(circle(cx, cy-60, 18, 10, wobbleAmt), "#f1c40f", sz));
    // Balcony railing
    strokes.push(makeStroke(line(cx-25, cy-40, cx+25, cy-40, 4, wobbleAmt), "#2c3e50", sz));
    // Door
    strokes.push(makeStroke(rect(cx-12, H-90, 24, 30, wobbleAmt), "#8B4513", sz));
    // Rocks at base
    strokes.push(makeStroke(circle(cx-55, H-50, 20, 8, wobbleAmt), "#7f8c8d", sz));
    strokes.push(makeStroke(circle(cx+55, H-50, 18, 8, wobbleAmt), "#95a5a6", sz));
  } else if (w === "train") {
    // Engine body
    strokes.push(makeStroke(rect(cx-80, cy-30, 140, 70, wobbleAmt), "#e74c3c", sz));
    // Cab
    strokes.push(makeStroke(rect(cx+30, cy-60, 50, 35, wobbleAmt), "#c0392b", sz));
    // Smokestack
    strokes.push(makeStroke(rect(cx-50, cy-60, 20, 35, wobbleAmt), "#2c3e50", sz));
    // Smoke
    strokes.push(makeStroke(circle(cx-40, cy-75, 15, 8, wobbleAmt), "#aab8c2", sz));
    strokes.push(makeStroke(circle(cx-30, cy-95, 20, 8, wobbleAmt), "#aab8c2", sz));
    strokes.push(makeStroke(circle(cx-15, cy-110, 18, 8, wobbleAmt), "#aab8c2", sz));
    // Wheels
    strokes.push(makeStroke(circle(cx-50, cy+40, 28, 14, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(circle(cx, cy+40, 28, 14, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(circle(cx+60, cy+40, 22, 12, wobbleAmt), "#2c3e50", sz));
    // Window
    strokes.push(makeStroke(rect(cx+35, cy-55, 20, 20, wobbleAmt), "#85c1e9", sz));
    // Coupling
    strokes.push(makeStroke(line(cx+60, cy+10, cx+90, cy+10, 6, wobbleAmt), "#7f8c8d", sz));
    // Track
    strokes.push(makeStroke(line(30, cy+68, W-30, cy+68, 5, wobbleAmt), "#8B4513", sz));
  } else if (w === "bicycle") {
    // Two wheels
    strokes.push(makeStroke(circle(cx-70, cy+30, 60, 18, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(circle(cx+70, cy+30, 60, 18, wobbleAmt), "#2c3e50", sz));
    // Spokes (left wheel)
    for (let i = 0; i < 6; i++) { const a = (i/6)*Math.PI*2; strokes.push(makeStroke(line(cx-70+Math.cos(a)*50,cy+30+Math.sin(a)*50,cx-70,cy+30,3,wobbleAmt), "#7f8c8d", sz)); }
    // Spokes (right wheel)
    for (let i = 0; i < 6; i++) { const a = (i/6)*Math.PI*2; strokes.push(makeStroke(line(cx+70+Math.cos(a)*50,cy+30+Math.sin(a)*50,cx+70,cy+30,3,wobbleAmt), "#7f8c8d", sz)); }
    // Frame
    strokes.push(makeStroke([wobble(cx-70,cy+30,wobbleAmt),wobble(cx,cy-40,wobbleAmt),wobble(cx+70,cy+30,wobbleAmt)], "#e74c3c", sz+1));
    strokes.push(makeStroke([wobble(cx,cy-40,wobbleAmt),wobble(cx-20,cy+30,wobbleAmt)], "#e74c3c", sz+1));
    // Seat
    strokes.push(makeStroke(line(cx-15, cy-55, cx+15, cy-55, 5, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(line(cx, cy-40, cx, cy-55, 4, wobbleAmt), "#2c3e50", sz));
    // Handlebars
    strokes.push(makeStroke(line(cx-20,cy-30,cx+20,cy-30,5,wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(line(cx+10, cy-40, cx+10, cy-25, 4, wobbleAmt), "#2c3e50", sz));
    // Pedals
    strokes.push(makeStroke(line(cx-25,cy+30,cx+25,cy+30,4,wobbleAmt), "#7f8c8d", sz));
  } else if (w === "tent") {
    // Main triangle
    strokes.push(makeStroke([wobble(50,H-60,wobbleAmt),wobble(cx,cy-90,wobbleAmt),wobble(W-50,H-60,wobbleAmt),wobble(50,H-60,wobbleAmt)], "#e74c3c", sz));
    // Second color panel
    strokes.push(makeStroke([wobble(cx-60,H-60,wobbleAmt),wobble(cx+30,cy-30,wobbleAmt),wobble(cx+60,H-60,wobbleAmt)], "#f39c12", sz));
    // Door/opening
    const doorPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 10; i++) { const a = Math.PI + (i/10)*Math.PI; doorPts.push(wobble(cx+Math.cos(a)*35,H-60+Math.sin(a)*60,wobbleAmt)); }
    strokes.push(makeStroke(doorPts, "#2c3e50", sz));
    strokes.push(makeStroke(line(cx-35,H-60,cx+35,H-60,4,wobbleAmt), "#2c3e50", sz));
    // Ground pegs
    strokes.push(makeStroke(line(55,H-60,40,H-40,4,wobbleAmt), "#7f8c8d", sz));
    strokes.push(makeStroke(line(W-55,H-60,W-40,H-40,4,wobbleAmt), "#7f8c8d", sz));
    // Center pole
    strokes.push(makeStroke(line(cx, cy-90, cx, H-60, 4, wobbleAmt), "#DEB887", sz));
    // Ground line
    strokes.push(makeStroke(line(30, H-55, W-30, H-55, 4, wobbleAmt), "#27ae60", sz));
  } else if (w === "windmill") {
    // Tower
    strokes.push(makeStroke([wobble(cx-25,H-60,wobbleAmt),wobble(cx-10,cy-40,wobbleAmt),wobble(cx+10,cy-40,wobbleAmt),wobble(cx+25,H-60,wobbleAmt),wobble(cx-25,H-60,wobbleAmt)], "#DEB887", sz));
    // Center hub
    strokes.push(makeStroke(circle(cx, cy-40, 15, 10, wobbleAmt), "#8B4513", sz));
    // 4 Blades
    strokes.push(makeStroke([wobble(cx,cy-40,wobbleAmt),wobble(cx-20,cy-100,wobbleAmt),wobble(cx+20,cy-130,wobbleAmt),wobble(cx+15,cy-40,wobbleAmt)], "#ecf0f1", sz));
    strokes.push(makeStroke([wobble(cx,cy-40,wobbleAmt),wobble(cx+60,cy-60,wobbleAmt),wobble(cx+90,cy-20,wobbleAmt),wobble(cx+15,cy-25,wobbleAmt)], "#ecf0f1", sz));
    strokes.push(makeStroke([wobble(cx,cy-40,wobbleAmt),wobble(cx+20,cy+30,wobbleAmt),wobble(cx-20,cy+50,wobbleAmt),wobble(cx-15,cy-30,wobbleAmt)], "#aab8c2", sz));
    strokes.push(makeStroke([wobble(cx,cy-40,wobbleAmt),wobble(cx-60,cy-20,wobbleAmt),wobble(cx-90,cy-60,wobbleAmt),wobble(cx-15,cy-55,wobbleAmt)], "#aab8c2", sz));
    // Ground
    strokes.push(makeStroke(line(30, H-55, W-30, H-55, 4, wobbleAmt), "#27ae60", sz));
    strokes.push(makeStroke(circle(cx-80, H-70, 12, 6, wobbleAmt), "#2ecc71", sz));
    strokes.push(makeStroke(circle(cx+100, H-65, 10, 6, wobbleAmt), "#2ecc71", sz));

  // ── Actions ───────────────────────────────────────────────────────────────
  } else if (w === "sleeping") {
    // Bed
    strokes.push(makeStroke(rect(50, cy, W-100, 120, wobbleAmt), "#8B4513", sz));
    // Pillow
    strokes.push(makeStroke(circle(120, cy+20, 50, 14, wobbleAmt), "#ecf0f1", sz));
    // Blanket
    strokes.push(makeStroke(rect(50, cy+40, W-100, 80, wobbleAmt), "#3498db", sz));
    // Head
    strokes.push(makeStroke(circle(120, cy+15, 35, 14, wobbleAmt), "#DEB887", sz));
    // Eyes closed lines
    strokes.push(makeStroke(line(105,cy+10,115,cy+12,4,wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(line(128,cy+10,138,cy+12,4,wobbleAmt), "#2c3e50", sz));
    // Z's
    strokes.push(makeStroke([wobble(180,cy-10,wobbleAmt),wobble(210,cy-10,wobbleAmt),wobble(180,cy-35,wobbleAmt),wobble(210,cy-35,wobbleAmt)], "#9b59b6", sz));
    strokes.push(makeStroke([wobble(220,cy-40,wobbleAmt),wobble(255,cy-40,wobbleAmt),wobble(220,cy-68,wobbleAmt),wobble(255,cy-68,wobbleAmt)], "#9b59b6", sz+1));
    strokes.push(makeStroke([wobble(265,cy-70,wobbleAmt),wobble(305,cy-70,wobbleAmt),wobble(265,cy-105,wobbleAmt),wobble(305,cy-105,wobbleAmt)], "#9b59b6", sz+2));
    // Moon above
    strokes.push(makeStroke(circle(W-80, cy-80, 30, 16, wobbleAmt), "#f1c40f", sz));
    strokes.push(makeStroke(circle(W-65, cy-90, 26, 14, wobbleAmt), "#1a237e", sz+1));
  } else if (w === "swimming") {
    // Person
    strokes.push(makeStroke(circle(cx-60, cy-50, 25, 12, wobbleAmt), "#DEB887", sz));
    strokes.push(makeStroke(line(cx-60, cy-25, cx+60, cy-10, 6, wobbleAmt), "#e74c3c", sz+2));
    // Arms
    strokes.push(makeStroke(line(cx-40,cy-30,cx-100,cy-60,5,wobbleAmt), "#DEB887", sz));
    strokes.push(makeStroke(line(cx+40,cy-15,cx+110,cy-50,5,wobbleAmt), "#DEB887", sz));
    // Legs/kick
    strokes.push(makeStroke(line(cx+60,cy-10,cx+110,cy+15,5,wobbleAmt), "#DEB887", sz));
    strokes.push(makeStroke(line(cx+60,cy-10,cx+100,cy-30,5,wobbleAmt), "#DEB887", sz));
    // Swim cap
    strokes.push(makeStroke(circle(cx-60, cy-55, 20, 10, wobbleAmt), "#3498db", sz));
    // Goggles
    strokes.push(makeStroke(circle(cx-52, cy-48, 8, 6, wobbleAmt), "#ecf0f1", sz));
    // Waves below
    const wPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 30; i++) wPts.push(wobble(30+i*18, cy+20+Math.sin(i*0.8)*15, wobbleAmt));
    strokes.push(makeStroke(wPts, "#3498db", sz));
    const wPts2: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 30; i++) wPts2.push(wobble(30+i*18, cy+40+Math.sin(i*0.8+1)*15, wobbleAmt));
    strokes.push(makeStroke(wPts2, "#2980b9", sz));
    strokes.push(makeStroke(line(30, cy+55, W-30, cy+55, 4, wobbleAmt), "#2471a3", sz));
  } else if (w === "dancing") {
    // Body
    strokes.push(makeStroke(line(cx, cy-50, cx, cy+50, 6, wobbleAmt), "#e74c3c", sz+1));
    // Head
    strokes.push(makeStroke(circle(cx, cy-70, 28, 14, wobbleAmt), "#DEB887", sz));
    // Arms raised and spread
    strokes.push(makeStroke([wobble(cx,cy-30,wobbleAmt),wobble(cx-60,cy-80,wobbleAmt),wobble(cx-90,cy-60,wobbleAmt)], "#DEB887", sz+1));
    strokes.push(makeStroke([wobble(cx,cy-30,wobbleAmt),wobble(cx+70,cy-70,wobbleAmt),wobble(cx+100,cy-50,wobbleAmt)], "#DEB887", sz+1));
    // Legs in dance pose
    strokes.push(makeStroke([wobble(cx,cy+50,wobbleAmt),wobble(cx-50,cy+100,wobbleAmt),wobble(cx-40,cy+150,wobbleAmt)], "#DEB887", sz+1));
    strokes.push(makeStroke([wobble(cx,cy+50,wobbleAmt),wobble(cx+60,cy+80,wobbleAmt),wobble(cx+80,cy+140,wobbleAmt)], "#DEB887", sz+1));
    // Music notes
    strokes.push(makeStroke(circle(cx-110, cy-100, 8, 6, wobbleAmt), "#9b59b6", sz));
    strokes.push(makeStroke(line(cx-102,cy-100,cx-102,cy-130,4,wobbleAmt), "#9b59b6", sz));
    strokes.push(makeStroke(circle(cx+110, cy-80, 8, 6, wobbleAmt), "#9b59b6", sz));
    strokes.push(makeStroke(line(cx+118,cy-80,cx+118,cy-110,4,wobbleAmt), "#9b59b6", sz));
    // Skirt/dress flare
    strokes.push(makeStroke([wobble(cx-10,cy+50,wobbleAmt),wobble(cx-60,cy+100,wobbleAmt),wobble(cx+60,cy+100,wobbleAmt),wobble(cx+10,cy+50,wobbleAmt)], "#e91e8c", sz));
  } else if (w === "flying") {
    // Body (person horizontal)
    strokes.push(makeStroke(line(cx-80, cy, cx+80, cy, 8, wobbleAmt), "#e74c3c", sz+2));
    // Head
    strokes.push(makeStroke(circle(cx+80, cy, 28, 12, wobbleAmt), "#DEB887", sz));
    // Arms spread like wings
    strokes.push(makeStroke([wobble(cx-20,cy,wobbleAmt),wobble(cx-60,cy-60,wobbleAmt),wobble(cx-100,cy-40,wobbleAmt)], "#DEB887", sz+1));
    strokes.push(makeStroke([wobble(cx-20,cy,wobbleAmt),wobble(cx-60,cy+60,wobbleAmt),wobble(cx-100,cy+40,wobbleAmt)], "#DEB887", sz+1));
    // Cape
    strokes.push(makeStroke([wobble(cx-80,cy,wobbleAmt),wobble(cx-100,cy+40,wobbleAmt),wobble(cx-40,cy+60,wobbleAmt),wobble(cx-80,cy-5,wobbleAmt)], "#9b59b6", sz));
    // Speed lines
    for (let i = -2; i <= 2; i++) strokes.push(makeStroke(line(cx-130, cy+i*25, cx-160, cy+i*25, 4, wobbleAmt), "#aab8c2", sz));
    // Clouds
    strokes.push(makeStroke(circle(cx-160, cy-80, 30, 10, wobbleAmt), "#ecf0f1", sz));
    strokes.push(makeStroke(circle(cx-130, cy-85, 25, 8, wobbleAmt), "#ecf0f1", sz));
    strokes.push(makeStroke(circle(cx+120, cy-70, 35, 10, wobbleAmt), "#ecf0f1", sz));
  } else if (w === "fishing") {
    // Person (stick figure, seated)
    strokes.push(makeStroke(circle(cx-80, cy-80, 25, 12, wobbleAmt), "#DEB887", sz));
    strokes.push(makeStroke(line(cx-80,cy-55,cx-80,cy+20,6,wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(line(cx-80,cy-20,cx-40,cy+20,5,wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(line(cx-80,cy-20,cx-120,cy+20,5,wobbleAmt), "#2c3e50", sz));
    // Fishing rod
    strokes.push(makeStroke(line(cx-60,cy-70,cx+120,cy-120,4,wobbleAmt), "#8B4513", sz));
    // Fishing line
    strokes.push(makeStroke(line(cx+120,cy-120,cx+100,cy+60,3,wobbleAmt), "#7f8c8d", sz));
    // Hook
    strokes.push(makeStroke(circle(cx+100, cy+65, 6, 6, wobbleAmt), "#7f8c8d", sz));
    // Water
    const fPts: Array<{x:number;y:number}> = [];
    for (let i = 0; i <= 30; i++) fPts.push(wobble(30+i*18, cy+50+Math.sin(i*0.7)*10, wobbleAmt));
    strokes.push(makeStroke(fPts, "#3498db", sz));
    strokes.push(makeStroke(line(30, cy+70, W-30, cy+70, 4, wobbleAmt), "#2980b9", sz));
    // Fish underwater
    strokes.push(makeStroke(circle(cx+80, cy+90, 15, 8, wobbleAmt), "#f39c12", sz));
    strokes.push(makeStroke([wobble(cx+92,cy+85,wobbleAmt),wobble(cx+110,cy+80,wobbleAmt),wobble(cx+110,cy+95,wobbleAmt),wobble(cx+92,cy+90,wobbleAmt)], "#f39c12", sz));
    // Log the person is sitting on
    strokes.push(makeStroke(circle(cx-80, cy+20, 20, 8, wobbleAmt), "#8B4513", sz));
  } else if (w === "reading") {
    // Open book
    strokes.push(makeStroke(rect(cx-120, cy-40, 110, 90, wobbleAmt), "#ecf0f1", sz));
    strokes.push(makeStroke(rect(cx+10, cy-40, 110, 90, wobbleAmt), "#ecf0f1", sz));
    // Spine
    strokes.push(makeStroke(line(cx, cy-40, cx, cy+50, 4, wobbleAmt), "#7f8c8d", sz));
    // Book cover corners
    strokes.push(makeStroke(line(cx-120,cy-40,cx-120,cy+50,4,wobbleAmt), "#DEB887", sz));
    strokes.push(makeStroke(line(cx+120,cy-40,cx+120,cy+50,4,wobbleAmt), "#DEB887", sz));
    // Text lines on pages
    for (let i = 0; i < 5; i++) {
      strokes.push(makeStroke(line(cx-105, cy-25+i*18, cx-25, cy-25+i*18, 3, wobbleAmt), "#aab8c2", sz));
      strokes.push(makeStroke(line(cx+25, cy-25+i*18, cx+105, cy-25+i*18, 3, wobbleAmt), "#aab8c2", sz));
    }
    // Hands holding book
    strokes.push(makeStroke(line(cx-120,cy+50,cx-130,cy+90,5,wobbleAmt), "#DEB887", sz+1));
    strokes.push(makeStroke(line(cx+120,cy+50,cx+130,cy+90,5,wobbleAmt), "#DEB887", sz+1));
    // Reading glasses perched
    strokes.push(makeStroke(circle(cx-20, cy-70, 14, 8, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(circle(cx+20, cy-70, 14, 8, wobbleAmt), "#2c3e50", sz));
    strokes.push(makeStroke(line(cx-6,cy-75,cx+6,cy-75,3,wobbleAmt), "#2c3e50", sz));

  // ── Already handled words (kept from original) ────────────────────────────
  } else if (w.includes("sun")) {
    strokes.push(makeStroke(circle(cx, cy, 60, 20, wobbleAmt), "#f39c12", size));
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      strokes.push(makeStroke(line(cx + Math.cos(angle)*70, cy + Math.sin(angle)*70, cx + Math.cos(angle)*100, cy + Math.sin(angle)*100, 4, wobbleAmt), "#f39c12", size));
    }
  } else if (w.includes("moon")) {
    strokes.push(makeStroke(circle(cx, cy, 70, 24, wobbleAmt), "#f1c40f", size));
    strokes.push(makeStroke(circle(cx+25, cy-10, 65, 24, wobbleAmt), "#f8f9fa", size+1));
  } else if (w.includes("star")) {
    const starPts: Array<{x: number; y: number}> = [];
    for (let i = 0; i < 5; i++) {
      const outerAngle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const innerAngle = outerAngle + Math.PI / 5;
      starPts.push(wobble(cx + Math.cos(outerAngle)*80, cy + Math.sin(outerAngle)*80, wobbleAmt));
      starPts.push(wobble(cx + Math.cos(innerAngle)*35, cy + Math.sin(innerAngle)*35, wobbleAmt));
    }
    starPts.push(starPts[0]);
    strokes.push(makeStroke(starPts, "#f39c12", size));
  } else if (w.includes("house")) {
    strokes.push(makeStroke(rect(cx-80, cy-30, 160, 120, wobbleAmt), "#8e44ad", size));
    strokes.push(makeStroke([
      wobble(cx-100, cy-30, wobbleAmt), wobble(cx, cy-130, wobbleAmt), wobble(cx+100, cy-30, wobbleAmt)
    ], "#c0392b", size));
    strokes.push(makeStroke(rect(cx-20, cy+30, 40, 60, wobbleAmt), "#8B4513", size));
    strokes.push(makeStroke(rect(cx-60, cy-10, 35, 35, wobbleAmt), "#3498db", size));
    strokes.push(makeStroke(rect(cx+25, cy-10, 35, 35, wobbleAmt), "#3498db", size));
  } else if (w.includes("cat") || w.includes("dog") || w.includes("bear") || w.includes("rabbit") || w.includes("lion") || w.includes("tiger")) {
    strokes.push(makeStroke(circle(cx, cy+20, 70, 20, wobbleAmt), "#7f8c8d", size));
    strokes.push(makeStroke(circle(cx, cy-80, 45, 20, wobbleAmt), "#7f8c8d", size));
    if (w.includes("cat") || w.includes("rabbit")) {
      strokes.push(makeStroke([wobble(cx-35,cy-120,wobbleAmt), wobble(cx-45,cy-155,wobbleAmt), wobble(cx-20,cy-125,wobbleAmt)], "#7f8c8d", size));
      strokes.push(makeStroke([wobble(cx+35,cy-120,wobbleAmt), wobble(cx+45,cy-155,wobbleAmt), wobble(cx+20,cy-125,wobbleAmt)], "#7f8c8d", size));
    }
    strokes.push(makeStroke(line(cx-12, cy-75, cx-12, cy-68, 3, wobbleAmt), "#2c3e50", size));
    strokes.push(makeStroke(line(cx+12, cy-75, cx+12, cy-68, 3, wobbleAmt), "#2c3e50", size));
  } else if (w.includes("fish") || w.includes("shark") || w.includes("dolphin") || w.includes("whale")) {
    const fishPts: Array<{x: number; y: number}> = [];
    for (let i = 0; i <= 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      fishPts.push(wobble(cx + Math.cos(angle) * 100 - 20, cy + Math.sin(angle) * 50, wobbleAmt));
    }
    strokes.push(makeStroke(fishPts, "#3498db", size));
    strokes.push(makeStroke([wobble(cx+80,cy-30,wobbleAmt), wobble(cx+130,cy-50,wobbleAmt), wobble(cx+130,cy+50,wobbleAmt), wobble(cx+80,cy+30,wobbleAmt)], "#3498db", size));
  } else if (w.includes("tree") || w.includes("cactus")) {
    strokes.push(makeStroke(rect(cx-10, cy+30, 20, 90, wobbleAmt), "#8B4513", size));
    strokes.push(makeStroke(circle(cx, cy-20, 70, 16, wobbleAmt), "#27ae60", size));
    if (quality === "good") {
      strokes.push(makeStroke(circle(cx-40, cy+10, 45, 12, wobbleAmt), "#27ae60", size));
      strokes.push(makeStroke(circle(cx+40, cy+10, 45, 12, wobbleAmt), "#27ae60", size));
    }
  } else if (w.includes("cloud")) {
    strokes.push(makeStroke(circle(cx, cy, 60, 20, wobbleAmt), "#aab8c2", size));
    strokes.push(makeStroke(circle(cx-60, cy+10, 45, 16, wobbleAmt), "#aab8c2", size));
    strokes.push(makeStroke(circle(cx+60, cy+10, 45, 16, wobbleAmt), "#aab8c2", size));
    strokes.push(makeStroke(circle(cx-30, cy-30, 40, 16, wobbleAmt), "#aab8c2", size));
    strokes.push(makeStroke(circle(cx+30, cy-30, 40, 16, wobbleAmt), "#aab8c2", size));
  } else if (w.includes("mountain")) {
    strokes.push(makeStroke([wobble(50,H-60,wobbleAmt), wobble(cx-50,80,wobbleAmt), wobble(W-50,H-60,wobbleAmt)], "#7f8c8d", size));
    strokes.push(makeStroke([wobble(cx-50,80,wobbleAmt), wobble(cx,50,wobbleAmt), wobble(cx+30,90,wobbleAmt)], darkColor, size+1));
  } else if (w.includes("pizza")) {
    strokes.push(makeStroke(circle(cx, cy, 90, 24, wobbleAmt), "#f39c12", size));
    strokes.push(makeStroke([wobble(cx,cy,wobbleAmt), wobble(cx,cy-90,wobbleAmt)], "#c0392b", size));
    strokes.push(makeStroke([wobble(cx,cy,wobbleAmt), wobble(cx+78,cy+45,wobbleAmt)], "#c0392b", size));
    strokes.push(makeStroke([wobble(cx,cy,wobbleAmt), wobble(cx-78,cy+45,wobbleAmt)], "#c0392b", size));
    for (let i = 0; i < 5; i++) {
      strokes.push(makeStroke(circle(cx + (Math.random()-0.5)*120, cy + (Math.random()-0.5)*120, 8, 8, wobbleAmt), "#c0392b", size));
    }
  } else if (w.includes("car")) {
    strokes.push(makeStroke(rect(cx-100, cy, 200, 60, wobbleAmt), "#e74c3c", size));
    strokes.push(makeStroke(rect(cx-60, cy-50, 120, 55, wobbleAmt), "#e74c3c", size));
    strokes.push(makeStroke(circle(cx-65, cy+60, 20, 16, wobbleAmt), "#2c3e50", size));
    strokes.push(makeStroke(circle(cx+65, cy+60, 20, 16, wobbleAmt), "#2c3e50", size));
  } else if (w.includes("rocket") || w.includes("airplane")) {
    strokes.push(makeStroke(line(cx, cy+120, cx, cy-80, 10, wobbleAmt), "#95a5a6", size+1));
    strokes.push(makeStroke(circle(cx, cy-100, 30, 16, wobbleAmt), "#c0392b", size));
    strokes.push(makeStroke([wobble(cx-40,cy+50,wobbleAmt), wobble(cx-80,cy+120,wobbleAmt), wobble(cx,cy+80,wobbleAmt)], "#e74c3c", size));
    strokes.push(makeStroke([wobble(cx+40,cy+50,wobbleAmt), wobble(cx+80,cy+120,wobbleAmt), wobble(cx,cy+80,wobbleAmt)], "#e74c3c", size));
  } else if (w.includes("castle")) {
    strokes.push(makeStroke(rect(cx-100, cy-80, 200, 160, wobbleAmt), "#95a5a6", size));
    for (let i = -80; i <= 80; i += 40) strokes.push(makeStroke(rect(cx+i-8, cy-110, 16, 35, wobbleAmt), "#95a5a6", size));
    strokes.push(makeStroke(rect(cx-15, cy+10, 30, 70, wobbleAmt), "#2c3e50", size));
    strokes.push(makeStroke(circle(cx, cy+10, 15, 10, wobbleAmt), "#2c3e50", size));
  } else if (w.includes("dragon") || w.includes("ghost") || w.includes("alien") || w.includes("unicorn") || w.includes("robot") || w.includes("wizard") || w.includes("mermaid") || w.includes("ninja")) {
    strokes.push(makeStroke(circle(cx, cy-80, 40, 16, wobbleAmt), "#9b59b6", size));
    strokes.push(makeStroke(rect(cx-35, cy-35, 70, 90, wobbleAmt), "#9b59b6", size));
    if (w.includes("dragon")) {
      strokes.push(makeStroke([wobble(cx+35,cy-20,wobbleAmt), wobble(cx+100,cy-80,wobbleAmt), wobble(cx+80,cy+20,wobbleAmt)], "#27ae60", size));
      strokes.push(makeStroke([wobble(cx-35,cy-20,wobbleAmt), wobble(cx-100,cy-80,wobbleAmt), wobble(cx-80,cy+20,wobbleAmt)], "#27ae60", size));
    }
    if (w.includes("unicorn")) {
      strokes.push(makeStroke(line(cx, cy-120, cx+20, cy-170, 6, wobbleAmt), "#f1c40f", size));
    }
  } else if (w.includes("crown")) {
    strokes.push(makeStroke([
      wobble(cx-80,cy+40,wobbleAmt), wobble(cx-80,cy-40,wobbleAmt),
      wobble(cx-40,cy+10,wobbleAmt), wobble(cx,cy-60,wobbleAmt),
      wobble(cx+40,cy+10,wobbleAmt), wobble(cx+80,cy-40,wobbleAmt),
      wobble(cx+80,cy+40,wobbleAmt), wobble(cx-80,cy+40,wobbleAmt)
    ], "#f39c12", size));
    for (let i = -60; i <= 60; i += 60) strokes.push(makeStroke(circle(cx+i, cy, 8, 8, wobbleAmt), "#e74c3c", size));
  } else if (w.includes("flower")) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      strokes.push(makeStroke(circle(cx + Math.cos(angle)*50, cy + Math.sin(angle)*50, 30, 12, wobbleAmt), "#e74c3c", size));
    }
    strokes.push(makeStroke(circle(cx, cy, 25, 12, wobbleAmt), "#f39c12", size));
    strokes.push(makeStroke(line(cx, cy+80, cx, cy+160, 6, wobbleAmt), "#27ae60", size));
  } else if (w.includes("anchor")) {
    strokes.push(makeStroke(circle(cx, cy-80, 20, 12, wobbleAmt), "#2c3e50", size));
    strokes.push(makeStroke(line(cx, cy-60, cx, cy+80, 8, wobbleAmt), "#2c3e50", size));
    strokes.push(makeStroke(line(cx-60, cy-20, cx+60, cy-20, 6, wobbleAmt), "#2c3e50", size));
    strokes.push(makeStroke([wobble(cx-60,cy+80,wobbleAmt), wobble(cx,cy+40,wobbleAmt), wobble(cx+60,cy+80,wobbleAmt)], "#2c3e50", size));
  } else if (w.includes("lightning") || w.includes("bolt")) {
    strokes.push(makeStroke([wobble(cx+20,cy-120,wobbleAmt), wobble(cx-20,cy,wobbleAmt), wobble(cx+30,cy,wobbleAmt), wobble(cx-10,cy+120,wobbleAmt)], "#f1c40f", size+1));
  } else if (w.includes("boat") || w.includes("ship")) {
    strokes.push(makeStroke([wobble(cx-100,cy+40,wobbleAmt), wobble(cx-60,cy+80,wobbleAmt), wobble(cx+60,cy+80,wobbleAmt), wobble(cx+100,cy+40,wobbleAmt), wobble(cx-100,cy+40,wobbleAmt)], "#8B4513", size));
    strokes.push(makeStroke(line(cx, cy+40, cx, cy-80, 6, wobbleAmt), "#95a5a6", size));
    strokes.push(makeStroke([wobble(cx,cy-80,wobbleAmt), wobble(cx+80,cy-30,wobbleAmt), wobble(cx,cy+20,wobbleAmt)], "#ecf0f1", size));
  } else if (w.includes("wave")) {
    const wavePts: Array<{x: number; y: number}> = [];
    for (let i = 0; i <= 30; i++) {
      const x = 50 + (W-100) * i / 30;
      const y = cy + Math.sin(i * 0.6) * 60;
      wavePts.push(wobble(x, y, wobbleAmt));
    }
    strokes.push(makeStroke(wavePts, "#3498db", size));
    const wavePts2: Array<{x: number; y: number}> = [];
    for (let i = 0; i <= 30; i++) {
      const x = 50 + (W-100) * i / 30;
      const y = cy + 30 + Math.sin(i * 0.6 + 1) * 50;
      wavePts2.push(wobble(x, y, wobbleAmt));
    }
    strokes.push(makeStroke(wavePts2, "#2980b9", size));
  } else if (w.includes("rainbow")) {
    const rainbowColors = ["#e74c3c","#e67e22","#f1c40f","#2ecc71","#3498db","#9b59b6"];
    for (let ri = 0; ri < 6; ri++) {
      const r = 150 - ri * 20;
      const arcPts: Array<{x: number; y: number}> = [];
      for (let i = 0; i <= 20; i++) {
        const angle = Math.PI + (i / 20) * Math.PI;
        arcPts.push(wobble(cx + Math.cos(angle)*r, cy + Math.sin(angle)*r + 60, wobbleAmt));
      }
      strokes.push(makeStroke(arcPts, rainbowColors[ri], size));
    }
  } else if (w.includes("donut") || w.includes("cookie") || w.includes("cake")) {
    strokes.push(makeStroke(circle(cx, cy, 80, 20, wobbleAmt), "#DEB887", size));
    if (w.includes("donut")) {
      strokes.push(makeStroke(circle(cx, cy, 30, 14, wobbleAmt), "#f8f9fa", size+1));
    } else {
      for (let i = 0; i < 8; i++) {
        const angle = (i/8)*Math.PI*2;
        strokes.push(makeStroke(circle(cx+Math.cos(angle)*50, cy+Math.sin(angle)*50, 6, 6, wobbleAmt), "#e74c3c", size));
      }
    }
  } else if (w.includes("guitar")) {
    strokes.push(makeStroke(circle(cx, cy+40, 60, 20, wobbleAmt), "#8B4513", size));
    strokes.push(makeStroke(circle(cx, cy-30, 40, 16, wobbleAmt), "#8B4513", size));
    strokes.push(makeStroke(line(cx, cy-10, cx, cy-100, 6, wobbleAmt), "#5D4037", size));
    strokes.push(makeStroke(rect(cx-20, cy-130, 40, 30, wobbleAmt), "#5D4037", size));
  } else if (w.includes("umbrella")) {
    const arcPts: Array<{x: number; y: number}> = [];
    for (let i = 0; i <= 20; i++) {
      const angle = Math.PI + (i/20)*Math.PI;
      arcPts.push(wobble(cx + Math.cos(angle)*90, cy + Math.sin(angle)*70, wobbleAmt));
    }
    strokes.push(makeStroke(arcPts, "#e74c3c", size));
    strokes.push(makeStroke(line(cx, cy, cx, cy+120, 8, wobbleAmt), "#95a5a6", size));
    strokes.push(makeStroke([wobble(cx,cy+120,wobbleAmt), wobble(cx-20,cy+140,wobbleAmt)], "#95a5a6", size));
  } else if (w.includes("mushroom")) {
    const capPts: Array<{x: number; y: number}> = [];
    for (let i = 0; i <= 20; i++) {
      const angle = Math.PI + (i/20)*Math.PI;
      capPts.push(wobble(cx + Math.cos(angle)*80, cy + Math.sin(angle)*70, wobbleAmt));
    }
    strokes.push(makeStroke(capPts, "#e74c3c", size));
    strokes.push(makeStroke(rect(cx-25, cy, 50, 70, wobbleAmt), "#f8f9fa", size));
    for (let i = 0; i < 4; i++) strokes.push(makeStroke(circle(cx + (Math.random()-0.5)*100, cy - 20 + (Math.random()-0.5)*40, 10, 6, wobbleAmt), "#f8f9fa", size));
  } else if (w.includes("volcano")) {
    strokes.push(makeStroke([wobble(cx-120,H-60,wobbleAmt), wobble(cx-20,cy-50,wobbleAmt), wobble(cx+20,cy-50,wobbleAmt), wobble(cx+120,H-60,wobbleAmt)], "#7f8c8d", size));
    strokes.push(makeStroke([wobble(cx-20,cy-50,wobbleAmt), wobble(cx-40,cy-120,wobbleAmt), wobble(cx,cy-80,wobbleAmt), wobble(cx+40,cy-120,wobbleAmt), wobble(cx+20,cy-50,wobbleAmt)], "#e74c3c", size));
  } else if (w.includes("pyramid")) {
    strokes.push(makeStroke([wobble(cx,50,wobbleAmt), wobble(cx-160,H-60,wobbleAmt), wobble(cx+160,H-60,wobbleAmt), wobble(cx,50,wobbleAmt)], "#f39c12", size));
    strokes.push(makeStroke(line(cx, 50, cx, H-60, 4, wobbleAmt), "#e67e22", size));
  } else if (w.includes("igloo")) {
    const iglooPts: Array<{x: number; y: number}> = [];
    for (let i = 0; i <= 20; i++) {
      const angle = Math.PI + (i/20)*Math.PI;
      iglooPts.push(wobble(cx + Math.cos(angle)*100, cy+40 + Math.sin(angle)*80, wobbleAmt));
    }
    strokes.push(makeStroke(iglooPts, "#aab8c2", size));
    strokes.push(makeStroke(line(cx-100, cy+40, cx+100, cy+40, 4, wobbleAmt), "#aab8c2", size));
    strokes.push(makeStroke([wobble(cx-30,cy+40,wobbleAmt), wobble(cx-30,cy+80,wobbleAmt), wobble(cx+30,cy+80,wobbleAmt), wobble(cx+30,cy+40,wobbleAmt)], "#3498db", size));
  } else {
    // Fallback: draw a box with an X
    strokes.push(makeStroke(rect(cx-80, cy-60, 160, 120, wobbleAmt), "#9b59b6", size));
    strokes.push(makeStroke(line(cx-80, cy-60, cx+80, cy+60, 6, wobbleAmt), "#9b59b6", size));
    strokes.push(makeStroke(line(cx+80, cy-60, cx-80, cy+60, 6, wobbleAmt), "#9b59b6", size));
    strokes.push(makeStroke(circle(cx, cy-100, 30, 12, wobbleAmt), "#e74c3c", size));
  }

  return strokes;
}

// Check if a guess matches the current word (case-insensitive, trim)
export function checkGuess(guess: string, word: string): boolean {
  return guess.trim().toLowerCase() === word.trim().toLowerCase();
}

// Advance phase based on timers - called every GET to drive game forward automatically
export function advancePhaseIfNeeded(
  state: WaddabiState,
  playerIds: string[],
  playerNames: Record<string, string>,
  botTypes: Record<string, "good" | "medium" | "bad">,
  now: number,
): WaddabiState {
  if (state.phase === "choosing") {
    const elapsed = now - state.phaseStartTime;
    if (elapsed >= state.choosingDuration) {
      const word = state.wordChoices?.[0] ?? WADDABI_WORDS[Math.floor(Math.random() * WADDABI_WORDS.length)];
      const drawerId = state.turnOrder[state.currentTurnIdx % Math.max(1, state.turnOrder.length)];
      const isBot = drawerId?.startsWith("bot-");
      const botStrokes = isBot ? generateBotStrokes(word, botTypes[drawerId] ?? "medium") : [];
      return {
        ...state,
        phase: "drawing",
        currentWord: word,
        wordChoices: null,
        strokes: botStrokes,
        roundStartTime: now,
        phaseStartTime: now,
        guessedThisRound: [],
      };
    }
  }

  if (state.phase === "drawing") {
    const elapsed = now - state.roundStartTime;

    if (elapsed >= state.roundDuration) {
      // Time up — drawer gets -1 if nobody guessed
      const drawerIdx = state.currentTurnIdx % Math.max(1, state.turnOrder.length);
      const drawerUserId = state.turnOrder[drawerIdx];
      const nobodyGuessed = state.guessedThisRound.length === 0;

      const chat: ChatMsg = {
        id: Math.random().toString(36).slice(2),
        userId: "system",
        username: "Wadabbi?!",
        text: nobodyGuessed
          ? `⏰ Time's up! The word was "${state.currentWord}" — no one guessed it!`
          : `⏰ Time's up! The word was "${state.currentWord}"`,
        isSystem: true,
        t: now,
      };

      const timeupScores = { ...state.scores };
      if (nobodyGuessed && drawerUserId && !drawerUserId.startsWith("bot-") || nobodyGuessed && drawerUserId) {
        // Penalty: -1 to drawer if nobody guessed
        timeupScores[drawerUserId] = Math.max(0, (timeupScores[drawerUserId] ?? 0) - 1);
      }

      // Add bot time-up chat reactions
      const botReactions: ChatMsg[] = [];
      if (nobodyGuessed) {
        for (const pid of state.turnOrder) {
          if (!botTypes[pid] || pid === drawerUserId) continue;
          if (!playerIds.includes(pid)) continue;
          const persona = BOT_GUESS_CHAT[pid];
          if (!persona) continue;
          const h = simpleHash(pid + (state.currentWord ?? "") + "timeup");
          if (h % 3 === 0) { // 1/3 bots react
            const line = persona.timeup[h % persona.timeup.length];
            botReactions.push({
              id: simpleHash(pid + "timeup" + now).toString(36),
              userId: pid,
              username: playerNames[pid] ?? "Bot",
              text: line,
              t: now + 500,
            });
          }
        }
      }

      return {
        ...state,
        phase: "roundEnd",
        phaseStartTime: now,
        scores: timeupScores,
        chatHistory: [...state.chatHistory.slice(-80), chat, ...botReactions],
      };
    }
  }

  if (state.phase === "roundEnd") {
    const elapsed = now - state.phaseStartTime;
    if (elapsed >= 5000) {
      // Check for winner
      const winner = Object.entries(state.scores).find(([, score]) => score >= state.targetScore);
      if (winner) {
        return {
          ...state,
          phase: "gameOver",
          winner: winner[0],
          winnerName: playerNames[winner[0]] ?? winner[0],
          phaseStartTime: now,
        };
      }

      // Next turn
      const activeTurnOrder = state.turnOrder.filter(id => playerIds.includes(id));
      const nextIdx = (state.currentTurnIdx + 1) % Math.max(1, activeTurnOrder.length);
      const nextDrawer = activeTurnOrder[nextIdx];
      const isNextBot = nextDrawer?.startsWith("bot-");
      const choices = isNextBot ? [WADDABI_WORDS[Math.floor(Math.random() * WADDABI_WORDS.length)]] : pickThreeWords();

      const sysMsg: ChatMsg = {
        id: Math.random().toString(36).slice(2),
        userId: "system",
        username: "Wadabbi?!",
        text: isNextBot ? `🤖 ${playerNames[nextDrawer] ?? nextDrawer} is drawing!` : `🎨 ${playerNames[nextDrawer] ?? nextDrawer}'s turn to draw!`,
        isSystem: true,
        t: now,
      };

      if (isNextBot) {
        const word = choices[0];
        const botStrokes = generateBotStrokes(word, botTypes[nextDrawer] ?? "medium");
        return {
          ...state,
          phase: "drawing",
          currentTurnIdx: nextIdx,
          turnOrder: activeTurnOrder,
          currentWord: word,
          wordChoices: null,
          strokes: botStrokes,
          roundStartTime: now,
          phaseStartTime: now,
          guessedThisRound: [],
          roundCount: state.roundCount + 1,
          chatHistory: [...state.chatHistory.slice(-80), sysMsg],
        };
      }

      return {
        ...state,
        phase: "choosing",
        currentTurnIdx: nextIdx,
        turnOrder: activeTurnOrder,
        currentWord: null,
        wordChoices: choices,
        strokes: [],
        phaseStartTime: now,
        guessedThisRound: [],
        roundCount: state.roundCount + 1,
        chatHistory: [...state.chatHistory.slice(-80), sysMsg],
      };
    }
  }

  return state;
}
