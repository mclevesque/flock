// ── Vibe curated video pool ────────────────────────────────────────────────
// Each tag has a list of YouTube video IDs.
// Videos are interleaved from all selected tags to build the playlist.

export interface VibeTag {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  color: string;
}

export const VIBE_TAGS: VibeTag[] = [
  { id: "lotr",      label: "Lord of the Rings",  emoji: "💍", desc: "One does not simply skip leg day", color: "#8B6914" },
  { id: "anime",     label: "Anime",               emoji: "⚔️", desc: "Plus Ultra. Always.",              color: "#e84393" },
  { id: "gym",       label: "Gym / Grind",         emoji: "🏋️", desc: "Beast mode. No days off.",         color: "#ef4444" },
  { id: "coding",    label: "Deep Focus",          emoji: "💻", desc: "In the zone, shipping at 2am",     color: "#6366f1" },
  { id: "hiphop",    label: "Hip-Hop",             emoji: "🎤", desc: "From the bottom to the top",       color: "#f59e0b" },
  { id: "lofi",      label: "Lo-Fi / Chill",       emoji: "🌙", desc: "Cozy, calm, keep going",           color: "#60a5fa" },
  { id: "fantasy",   label: "Fantasy / Epic",      emoji: "🐉", desc: "Heroes, battles, destiny",         color: "#a855f7" },
  { id: "jrpg",      label: "JRPG",                emoji: "🎮", desc: "This isn't even my final form",    color: "#10b981" },
  { id: "sports",    label: "Sports",              emoji: "🏆", desc: "Champions are made in the dark",   color: "#f97316" },
  { id: "nature",    label: "Nature / Zen",        emoji: "🌿", desc: "Breathe. Reset. Rise.",             color: "#22c55e" },
  { id: "comedy",    label: "Comedy Relief",       emoji: "😂", desc: "Laugh it off, then get back up",   color: "#fbbf24" },
  { id: "kdrama",    label: "K-Drama / Romance",   emoji: "🌸", desc: "Feel it all. Then conquer.",        color: "#f472b6" },
];

export interface VibeVideo {
  id: string;       // YouTube video ID (or unique key for search entries)
  title: string;
  tags: string[];   // which interest tags this belongs to
  type: "motivation" | "music" | "funny" | "cinematic" | "speech" | "search";
  searchQuery?: string;  // if set, use YouTube search embed instead of specific video
}

export const VIBE_VIDEOS: VibeVideo[] = [
  // ── LOTR ────────────────────────────────────────────────────────────────
  { id: "SwMUY5ro5Xo", title: "Aragorn's Battle Speech",                   tags: ["lotr","fantasy"],    type: "speech"     },
  { id: "CL_3mlOPnGI", title: "Concerning Hobbits",                        tags: ["lotr","fantasy"],    type: "music"      },
  { id: "HvF31-2bVNE", title: "Into the West",                             tags: ["lotr"],              type: "music"      },
  { id: "LhB95gMpMAQ", title: "Samwise — The Selfless Hero",               tags: ["lotr"],              type: "speech"     },
  { id: "POdknqszMDY", title: "Théoden's Battle Speech — Ride to Ruin",   tags: ["lotr","fantasy"],    type: "speech"     },

  // ── ANIME ────────────────────────────────────────────────────────────────
  { id: "oomE4oltFRo", title: "Demon Slayer — Gurenge (LiSA)",             tags: ["anime"],             type: "music"      },
  { id: "iYZIUtDAFIw", title: "My Hero Academia — You Say Run OST",        tags: ["anime"],             type: "music"      },
  { id: "2B6nj38AdD0", title: "Attack on Titan — Guren no Yumiya",         tags: ["anime"],             type: "music"      },
  { id: "2upuBiEiXDk", title: "Naruto Shippuden — Blue Bird Opening",      tags: ["anime"],             type: "music"      },
  { id: "_oGEhRZkwcg", title: "Haikyuu!! — Epic Motivational Soundtrack",  tags: ["anime","sports"],    type: "motivation" },

  // ── GYM / GRIND ──────────────────────────────────────────────────────────
  { id: "V80-gPkpH6M", title: "Greatest Gym Motivation 2024",              tags: ["gym"],               type: "motivation" },
  { id: "X4nGU4DZUwE", title: "David Goggins — You Owe It To Yourself",    tags: ["gym"],               type: "speech"     },
  { id: "6vuetQSwFW8", title: "Eric Thomas — How Bad Do You Want It",       tags: ["gym","sports"],      type: "speech"     },
  { id: "MFyOaz6_8l0", title: "Arnold Schwarzenegger — Hard Work Is Everything", tags: ["gym"],         type: "speech"     },
  { id: "_YYmfM2TfUA", title: "Rocky Training Montage — Gonna Fly Now",    tags: ["gym","sports"],      type: "cinematic"  },

  // ── DEEP FOCUS / CODING ──────────────────────────────────────────────────
  { id: "jfKfPfyJRdk", title: "Lofi Hip Hop Radio — Beats to Relax/Study", tags: ["coding","lofi"],     type: "music"      },
  { id: "5qap5aO4i9A", title: "Lofi Hip Hop Radio — Beats to Study To",    tags: ["coding","lofi"],     type: "music"      },
  { id: "n61ULEU7CO0", title: "Dark Ambient Study Mix",                     tags: ["coding"],            type: "music"      },
  { id: "WPni755-Krg", title: "Cyberpunk 2077 OST — The Rebel Path",       tags: ["coding","jrpg"],     type: "music"      },
  { id: "MVPTGNGiI-4", title: "Daft Punk — Tron Legacy OST",               tags: ["coding"],            type: "music"      },

  // ── HIP-HOP ──────────────────────────────────────────────────────────────
  { id: "uelHwf8o7_U", title: "Kendrick Lamar — HUMBLE.",                   tags: ["hiphop"],            type: "music"      },
  { id: "ZbZSe6N_BXs", title: "Kanye West — Power",                        tags: ["hiphop","gym"],      type: "music"      },

  // ── LO-FI / CHILL ────────────────────────────────────────────────────────
  { id: "DWcJFNfaw9c", title: "Studio Ghibli Lofi Mix",                    tags: ["lofi","anime"],      type: "music"      },
  { id: "hlWiI4xVXKY", title: "Coffee Shop Ambience + Jazz",               tags: ["lofi"],              type: "music"      },
  { id: "77ZozI0rw7w", title: "Rainy Night Lofi Mix",                      tags: ["lofi"],              type: "music"      },

  // ── FANTASY / EPIC ────────────────────────────────────────────────────────
  { id: "hKRUPYrAQoE", title: "Two Steps From Hell — Victory",             tags: ["fantasy","sports"],  type: "music"      },
  { id: "UsnRQJxanVM", title: "Skyrim — Song of the Dragonborn",           tags: ["fantasy","jrpg"],    type: "music"      },
  { id: "M3hFN8UrBPw", title: "Skyrim — Dragonborn Theme (Epic Cover)",    tags: ["fantasy","jrpg"],    type: "music"      },
  { id: "o0u4M6vppCI", title: "Game of Thrones — Main Theme",              tags: ["fantasy"],           type: "music"      },
  { id: "dX3k_QDnzHE", title: "Epic Fantasy Motivation Mix",               tags: ["fantasy"],           type: "motivation" },

  // ── JRPG ─────────────────────────────────────────────────────────────────
  { id: "mYdf0yqK_Fc", title: "Final Fantasy VII — One Winged Angel",      tags: ["jrpg"],              type: "music"      },
  { id: "dsuJZx24V_A", title: "Persona 5 — Life Will Change",              tags: ["jrpg"],              type: "music"      },
  { id: "ToBQY630PZE", title: "NieR: Automata — Weight of the World",      tags: ["jrpg"],              type: "music"      },
  { id: "YkgkThdzX-8", title: "Final Fantasy VII — One Winged Angel (Alt)", tags: ["jrpg"],             type: "music"      },

  // ── SPORTS ───────────────────────────────────────────────────────────────
  { id: "mkggXE5e2yk", title: "Sports Motivation — This Is Your Moment",   tags: ["sports","gym"],      type: "motivation" },
  { id: "xd-9D3GzUpo", title: "Kobe Bryant — Mamba Mentality Speech",      tags: ["sports","gym"],      type: "speech"     },
  { id: "GB8BB2CxQVc", title: "Michael Jordan — Leadership Has a Price",    tags: ["sports"],            type: "motivation" },

  // ── NATURE / ZEN ─────────────────────────────────────────────────────────
  { id: "pkWU2A9yBF4", title: "Alan Watts — What Do You Desire?",          tags: ["nature"],            type: "speech"     },
  { id: "qp0HIF3SfI4", title: "Stoic Meditation — Marcus Aurelius",        tags: ["nature"],            type: "speech"     },
  { id: "qHXFLsnKDq0", title: "Mountain Stream — Nature Sounds 24/7",      tags: ["nature","lofi"],     type: "music"      },

  // ── COMEDY RELIEF ────────────────────────────────────────────────────────
  { id: "hFZFjoX2cGg", title: "Dwight Schrute — Motivational Speeches",    tags: ["comedy"],            type: "funny"      },
  { id: "ZXsQAXx_ao0", title: "Shia LaBeouf — Just Do It",                 tags: ["comedy","gym"],      type: "funny"      },

  // ── K-DRAMA / ROMANCE ────────────────────────────────────────────────────
  { id: "xEeFrLSkMm8", title: "BTS — Spring Day MV",                       tags: ["kdrama","lofi"],     type: "music"      },
  { id: "gdZLi9oWNZg", title: "BTS — DNA MV",                              tags: ["kdrama"],            type: "music"      },
  { id: "MBdVXkSdhwU", title: "Crash Landing On You OST — Here I Am",      tags: ["kdrama"],            type: "music"      },
  { id: "IHNzOHi8sJs", title: "Goblin OST — Stay With Me",                 tags: ["kdrama","fantasy"],  type: "music"      },
];

/** Build search entries for a custom interest (multiple queries for variety) */
function buildCustomEntries(interest: string): VibeVideo[] {
  const tag = `custom:${interest}`;
  const queries = [
    `${interest} motivation`,
    `${interest} best moments`,
    `${interest} highlights`,
    `${interest} epic scenes`,
  ];
  return queries.map((q, i) => ({
    id: `custom-${interest.toLowerCase().replace(/\s+/g, "-")}-${i}`,
    title: i === 0 ? interest : `${interest} — ${["Best Moments", "Highlights", "Epic Scenes"][i - 1]}`,
    tags: [tag],
    type: "search" as const,
    searchQuery: q,
  }));
}

/** Build a shuffled playlist from selected tag IDs (curated + custom) */
export function buildPlaylist(selectedTags: string[]): VibeVideo[] {
  if (selectedTags.length === 0) return [];

  // Separate curated tags from custom free-text tags
  const curatedTags = selectedTags.filter(t => !t.startsWith("custom:"));
  const customTags = selectedTags.filter(t => t.startsWith("custom:"));

  // Bucket curated videos by tag
  const buckets: Map<string, VibeVideo[]> = new Map();
  for (const tag of curatedTags) {
    buckets.set(tag, VIBE_VIDEOS.filter(v => v.tags.includes(tag)));
  }

  // Round-robin interleave curated videos
  const result: VibeVideo[] = [];
  const seen = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const tag of curatedTags) {
      const bucket = buckets.get(tag) ?? [];
      const next = bucket.find(v => !seen.has(v.id));
      if (next) {
        seen.add(next.id);
        result.push(next);
        changed = true;
      }
    }
  }

  // Add custom search entries (interleaved)
  const customEntries: VibeVideo[] = [];
  for (const tag of customTags) {
    const interest = tag.slice("custom:".length);
    customEntries.push(...buildCustomEntries(interest));
  }

  // Interleave custom entries into result
  if (customEntries.length > 0 && result.length > 0) {
    const step = Math.max(1, Math.floor(result.length / customEntries.length));
    for (let i = 0; i < customEntries.length; i++) {
      result.splice(Math.min(step * (i + 1) + i, result.length), 0, customEntries[i]);
    }
  } else if (customEntries.length > 0) {
    result.push(...customEntries);
  }

  // Fisher-Yates shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
