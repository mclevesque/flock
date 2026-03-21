// ── House System Data ──────────────────────────────────────────────────────────
// All pets, furniture, wallpapers, floors, and exterior styles for the Flock housing system.

export interface Pet {
  id: string;
  name: string;
  emoji: string;
  category: "mammal" | "bird" | "reptile" | "aquatic" | "insect" | "mythical" | "fantasy";
  movementStyle: "wander" | "bounce" | "swim" | "float" | "hop";
  speed: number; // 1=slow, 2=medium, 3=fast
}

export const PETS: Pet[] = [
  // Mammals (35)
  { id: "dog", name: "Dog", emoji: "🐕", category: "mammal", movementStyle: "wander", speed: 2 },
  { id: "cat", name: "Cat", emoji: "🐈", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "black_cat", name: "Black Cat", emoji: "🐈‍⬛", category: "mammal", movementStyle: "wander", speed: 2 },
  { id: "rabbit", name: "Rabbit", emoji: "🐇", category: "mammal", movementStyle: "hop", speed: 2 },
  { id: "hamster", name: "Hamster", emoji: "🐹", category: "mammal", movementStyle: "wander", speed: 2 },
  { id: "fox", name: "Fox", emoji: "🦊", category: "mammal", movementStyle: "wander", speed: 2 },
  { id: "wolf", name: "Wolf", emoji: "🐺", category: "mammal", movementStyle: "wander", speed: 3 },
  { id: "bear", name: "Bear", emoji: "🐻", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "panda", name: "Panda", emoji: "🐼", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "koala", name: "Koala", emoji: "🐨", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "lion", name: "Lion", emoji: "🦁", category: "mammal", movementStyle: "wander", speed: 2 },
  { id: "tiger", name: "Tiger", emoji: "🐯", category: "mammal", movementStyle: "wander", speed: 3 },
  { id: "horse", name: "Horse", emoji: "🐎", category: "mammal", movementStyle: "wander", speed: 3 },
  { id: "pig", name: "Pig", emoji: "🐷", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "sheep", name: "Sheep", emoji: "🐑", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "deer", name: "Deer", emoji: "🦌", category: "mammal", movementStyle: "wander", speed: 2 },
  { id: "raccoon", name: "Raccoon", emoji: "🦝", category: "mammal", movementStyle: "wander", speed: 2 },
  { id: "otter", name: "Otter", emoji: "🦦", category: "mammal", movementStyle: "wander", speed: 2 },
  { id: "hedgehog", name: "Hedgehog", emoji: "🦔", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "bat", name: "Bat", emoji: "🦇", category: "mammal", movementStyle: "float", speed: 2 },
  { id: "monkey", name: "Monkey", emoji: "🐒", category: "mammal", movementStyle: "bounce", speed: 3 },
  { id: "elephant", name: "Elephant", emoji: "🐘", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "giraffe", name: "Giraffe", emoji: "🦒", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "zebra", name: "Zebra", emoji: "🦓", category: "mammal", movementStyle: "wander", speed: 3 },
  { id: "kangaroo", name: "Kangaroo", emoji: "🦘", category: "mammal", movementStyle: "hop", speed: 3 },
  { id: "sloth", name: "Sloth", emoji: "🦥", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "red_panda", name: "Red Panda", emoji: "🐼", category: "mammal", movementStyle: "wander", speed: 2 },
  { id: "capybara", name: "Capybara", emoji: "🐀", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "alpaca", name: "Alpaca", emoji: "🦙", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "skunk", name: "Skunk", emoji: "🦨", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "meerkat", name: "Meerkat", emoji: "🐿️", category: "mammal", movementStyle: "wander", speed: 2 },
  { id: "opossum", name: "Opossum", emoji: "🐀", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "weasel", name: "Weasel", emoji: "🦫", category: "mammal", movementStyle: "wander", speed: 3 },
  { id: "gorilla", name: "Gorilla", emoji: "🦍", category: "mammal", movementStyle: "wander", speed: 1 },
  { id: "hippo", name: "Hippo", emoji: "🦛", category: "mammal", movementStyle: "wander", speed: 1 },
  // Birds (12)
  { id: "parrot", name: "Parrot", emoji: "🦜", category: "bird", movementStyle: "float", speed: 2 },
  { id: "owl", name: "Owl", emoji: "🦉", category: "bird", movementStyle: "float", speed: 1 },
  { id: "eagle", name: "Eagle", emoji: "🦅", category: "bird", movementStyle: "float", speed: 3 },
  { id: "penguin", name: "Penguin", emoji: "🐧", category: "bird", movementStyle: "wander", speed: 1 },
  { id: "flamingo", name: "Flamingo", emoji: "🦩", category: "bird", movementStyle: "wander", speed: 1 },
  { id: "peacock", name: "Peacock", emoji: "🦚", category: "bird", movementStyle: "wander", speed: 1 },
  { id: "duck", name: "Duck", emoji: "🦆", category: "bird", movementStyle: "wander", speed: 1 },
  { id: "swan", name: "Swan", emoji: "🦢", category: "bird", movementStyle: "wander", speed: 1 },
  { id: "dove", name: "Dove", emoji: "🕊️", category: "bird", movementStyle: "float", speed: 2 },
  { id: "crow", name: "Crow", emoji: "🐦‍⬛", category: "bird", movementStyle: "float", speed: 2 },
  { id: "toucan", name: "Toucan", emoji: "🦜", category: "bird", movementStyle: "float", speed: 2 },
  { id: "chicken", name: "Chicken", emoji: "🐔", category: "bird", movementStyle: "wander", speed: 1 },
  // Reptiles (8)
  { id: "turtle", name: "Turtle", emoji: "🐢", category: "reptile", movementStyle: "wander", speed: 1 },
  { id: "lizard", name: "Lizard", emoji: "🦎", category: "reptile", movementStyle: "wander", speed: 2 },
  { id: "snake", name: "Snake", emoji: "🐍", category: "reptile", movementStyle: "wander", speed: 1 },
  { id: "crocodile", name: "Crocodile", emoji: "🐊", category: "reptile", movementStyle: "wander", speed: 1 },
  { id: "dino", name: "Mini Dino", emoji: "🦕", category: "reptile", movementStyle: "wander", speed: 2 },
  { id: "trex", name: "T-Rex", emoji: "🦖", category: "reptile", movementStyle: "wander", speed: 2 },
  { id: "axolotl", name: "Axolotl", emoji: "🦎", category: "reptile", movementStyle: "swim", speed: 1 },
  { id: "chameleon", name: "Chameleon", emoji: "🦎", category: "reptile", movementStyle: "wander", speed: 1 },
  // Aquatic (12)
  { id: "fish", name: "Tropical Fish", emoji: "🐠", category: "aquatic", movementStyle: "swim", speed: 2 },
  { id: "blowfish", name: "Blowfish", emoji: "🐡", category: "aquatic", movementStyle: "swim", speed: 1 },
  { id: "shark", name: "Shark", emoji: "🦈", category: "aquatic", movementStyle: "swim", speed: 3 },
  { id: "octopus", name: "Octopus", emoji: "🐙", category: "aquatic", movementStyle: "swim", speed: 1 },
  { id: "crab", name: "Crab", emoji: "🦀", category: "aquatic", movementStyle: "wander", speed: 1 },
  { id: "lobster", name: "Lobster", emoji: "🦞", category: "aquatic", movementStyle: "wander", speed: 1 },
  { id: "whale", name: "Mini Whale", emoji: "🐋", category: "aquatic", movementStyle: "swim", speed: 1 },
  { id: "dolphin", name: "Dolphin", emoji: "🐬", category: "aquatic", movementStyle: "swim", speed: 3 },
  { id: "seal", name: "Seal", emoji: "🦭", category: "aquatic", movementStyle: "wander", speed: 1 },
  { id: "seahorse", name: "Seahorse", emoji: "🐠", category: "aquatic", movementStyle: "float", speed: 1 },
  { id: "jellyfish", name: "Jellyfish", emoji: "🪼", category: "aquatic", movementStyle: "float", speed: 1 },
  { id: "narwhal", name: "Narwhal", emoji: "🐳", category: "aquatic", movementStyle: "swim", speed: 2 },
  // Insects (10)
  { id: "butterfly", name: "Butterfly", emoji: "🦋", category: "insect", movementStyle: "float", speed: 2 },
  { id: "bee", name: "Bee", emoji: "🐝", category: "insect", movementStyle: "float", speed: 2 },
  { id: "ladybug", name: "Ladybug", emoji: "🐞", category: "insect", movementStyle: "wander", speed: 1 },
  { id: "ant", name: "Ant", emoji: "🐜", category: "insect", movementStyle: "wander", speed: 2 },
  { id: "cricket", name: "Cricket", emoji: "🦗", category: "insect", movementStyle: "hop", speed: 2 },
  { id: "spider", name: "Spider", emoji: "🕷️", category: "insect", movementStyle: "wander", speed: 2 },
  { id: "scorpion", name: "Scorpion", emoji: "🦂", category: "insect", movementStyle: "wander", speed: 1 },
  { id: "dragonfly", name: "Dragonfly", emoji: "🪲", category: "insect", movementStyle: "float", speed: 3 },
  { id: "snail", name: "Snail", emoji: "🐌", category: "insect", movementStyle: "wander", speed: 1 },
  { id: "worm", name: "Worm", emoji: "🪱", category: "insect", movementStyle: "wander", speed: 1 },
  // Mythical & Fantasy (25)
  { id: "dragon", name: "Dragon", emoji: "🐉", category: "mythical", movementStyle: "float", speed: 2 },
  { id: "unicorn", name: "Unicorn", emoji: "🦄", category: "mythical", movementStyle: "wander", speed: 3 },
  { id: "phoenix", name: "Phoenix", emoji: "🦅", category: "mythical", movementStyle: "float", speed: 3 },
  { id: "ghost", name: "Ghost", emoji: "👻", category: "mythical", movementStyle: "float", speed: 1 },
  { id: "alien_pet", name: "Alien Pet", emoji: "👾", category: "fantasy", movementStyle: "bounce", speed: 2 },
  { id: "robot_pet", name: "Robot Pet", emoji: "🤖", category: "fantasy", movementStyle: "wander", speed: 2 },
  { id: "spirit_orb", name: "Spirit Orb", emoji: "🔮", category: "mythical", movementStyle: "float", speed: 1 },
  { id: "star_sprite", name: "Star Sprite", emoji: "⭐", category: "mythical", movementStyle: "float", speed: 2 },
  { id: "moon_bunny", name: "Moon Bunny", emoji: "🌙", category: "mythical", movementStyle: "hop", speed: 2 },
  { id: "cloud_puff", name: "Cloud Puff", emoji: "☁️", category: "mythical", movementStyle: "float", speed: 1 },
  { id: "shadow_cat", name: "Shadow Cat", emoji: "😼", category: "mythical", movementStyle: "wander", speed: 2 },
  { id: "ice_wolf", name: "Ice Wolf", emoji: "🐺", category: "mythical", movementStyle: "wander", speed: 3 },
  { id: "rainbow_fish", name: "Rainbow Fish", emoji: "🐠", category: "mythical", movementStyle: "swim", speed: 2 },
  { id: "crystal_deer", name: "Crystal Deer", emoji: "🦌", category: "mythical", movementStyle: "wander", speed: 2 },
  { id: "thunder_bird", name: "Thunderbird", emoji: "⚡", category: "mythical", movementStyle: "float", speed: 3 },
  { id: "forest_spirit", name: "Forest Spirit", emoji: "🌿", category: "mythical", movementStyle: "float", speed: 1 },
  { id: "water_spirit", name: "Water Spirit", emoji: "💧", category: "mythical", movementStyle: "float", speed: 1 },
  { id: "fairy", name: "Fairy", emoji: "🧚", category: "mythical", movementStyle: "float", speed: 2 },
  { id: "imp", name: "Imp", emoji: "😈", category: "mythical", movementStyle: "bounce", speed: 3 },
  { id: "slime", name: "Slime", emoji: "🟢", category: "mythical", movementStyle: "bounce", speed: 1 },
  { id: "wisp", name: "Will-o-Wisp", emoji: "🕯️", category: "mythical", movementStyle: "float", speed: 2 },
  { id: "phoenix_chick", name: "Phoenix Chick", emoji: "🐤", category: "mythical", movementStyle: "bounce", speed: 2 },
  { id: "mini_kraken", name: "Mini Kraken", emoji: "🐙", category: "mythical", movementStyle: "float", speed: 1 },
  { id: "void_cat", name: "Void Cat", emoji: "🌑", category: "mythical", movementStyle: "wander", speed: 2 },
  { id: "earth_golem", name: "Earth Golem", emoji: "🪨", category: "mythical", movementStyle: "wander", speed: 1 },
];

export interface WallpaperOption { id: string; name: string; css: string; }
export const WALLPAPERS: WallpaperOption[] = [
  { id: "cream", name: "Cream", css: "#F5F0E8" },
  { id: "sky_blue", name: "Sky Blue", css: "#B8D4E8" },
  { id: "sage", name: "Sage Green", css: "#B5C9B7" },
  { id: "lavender", name: "Lavender", css: "#C9B8D4" },
  { id: "peach", name: "Peach", css: "#F0D4B8" },
  { id: "midnight", name: "Midnight Blue", css: "#1a1a2e" },
  { id: "forest", name: "Forest", css: "linear-gradient(135deg,#2d5a27,#4a7c59)" },
  { id: "sunset", name: "Sunset", css: "linear-gradient(135deg,#ff6b35,#f7c59f)" },
  { id: "galaxy", name: "Galaxy", css: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)" },
  { id: "ocean", name: "Ocean", css: "linear-gradient(180deg,#006994,#0099cc,#33bbff)" },
  { id: "cherry", name: "Cherry Blossom", css: "linear-gradient(135deg,#ffb7c5,#ff8fab)" },
  { id: "brick", name: "Brick Wall", css: "repeating-linear-gradient(180deg,#c1440e 0,#c1440e 24px,#a33a0b 24px,#a33a0b 26px)" },
  { id: "wood_panel", name: "Wood Panels", css: "repeating-linear-gradient(90deg,#8B7355 0,#8B7355 60px,#7A6545 60px,#7A6545 62px)" },
  { id: "stripes", name: "Blue Stripes", css: "repeating-linear-gradient(180deg,#4a90d9 0,#4a90d9 20px,#5ba0e9 20px,#5ba0e9 40px)" },
  { id: "polka", name: "Polka Dots", css: "radial-gradient(circle,#ffb347 8px,transparent 8px) #fff5e6" },
  { id: "stars_wall", name: "Starry Night", css: "radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 60% 70%,#fff,transparent),radial-gradient(1px 1px at 80% 20%,#fff,transparent) #0d0d2b" },
  { id: "neon", name: "Neon Dark", css: "linear-gradient(135deg,#0d0d0d 0%,#1a0033 50%,#0d0d0d 100%)" },
  { id: "jungle", name: "Jungle", css: "linear-gradient(180deg,#1a3a1a,#2d5a2d)" },
  { id: "snow", name: "Winter", css: "linear-gradient(180deg,#e8f4f8,#c8e8f0)" },
  { id: "lava_wall", name: "Volcanic", css: "linear-gradient(180deg,#1a0000,#3d0000,#1a0000)" },
];

export interface FloorOption { id: string; name: string; css: string; }
export const FLOORS: FloorOption[] = [
  { id: "hardwood", name: "Hardwood", css: "repeating-linear-gradient(90deg,#8B6914 0,#8B6914 40px,#7A5810 40px,#7A5810 42px)" },
  { id: "light_wood", name: "Light Wood", css: "repeating-linear-gradient(90deg,#DEB887 0,#DEB887 40px,#D2A679 40px,#D2A679 42px)" },
  { id: "dark_wood", name: "Dark Walnut", css: "repeating-linear-gradient(90deg,#3d1f00 0,#3d1f00 40px,#2d1500 40px,#2d1500 42px)" },
  { id: "marble_white", name: "White Marble", css: "linear-gradient(135deg,#f5f5f5,#e8e8e8,#f0f0f0)" },
  { id: "marble_black", name: "Black Marble", css: "linear-gradient(135deg,#1a1a1a,#2a2a2a,#1f1f1f)" },
  { id: "marble_pink", name: "Rose Marble", css: "linear-gradient(135deg,#f5d0d0,#e8b8b8)" },
  { id: "carpet_red", name: "Crimson Carpet", css: "#7a0000" },
  { id: "carpet_blue", name: "Royal Carpet", css: "#00007a" },
  { id: "carpet_purple", name: "Violet Carpet", css: "#3a0060" },
  { id: "carpet_green", name: "Emerald Carpet", css: "#004d00" },
  { id: "grass", name: "Garden Grass", css: "repeating-linear-gradient(90deg,#228B22 0,#228B22 8px,#196619 8px,#196619 16px)" },
  { id: "sand", name: "Sandy Beach", css: "linear-gradient(180deg,#F4D03F,#E8C838)" },
  { id: "stone_tile", name: "Stone Tiles", css: "repeating-conic-gradient(#888 0% 25%,#777 0% 50%) 0 0/48px 48px" },
  { id: "checkerboard", name: "Checkerboard", css: "repeating-conic-gradient(#f0f0f0 0% 25%,#333 0% 50%) 0 0/40px 40px" },
  { id: "ice", name: "Frozen Ice", css: "linear-gradient(135deg,#e8f4f8,#c8e8f0,#e0f0f8)" },
  { id: "cloud_floor", name: "Cloud Walk", css: "linear-gradient(180deg,#87CEEB,#b0d8f0)" },
  { id: "lava_floor", name: "Lava Rock", css: "radial-gradient(ellipse,#ff4500,#8B0000,#1a0000)" },
  { id: "space_floor", name: "Cosmos", css: "radial-gradient(1px 1px at 10% 20%,#fff,transparent),radial-gradient(1px 1px at 50% 80%,#fff,transparent),radial-gradient(1px 1px at 90% 40%,#fff,transparent) #000011" },
  { id: "rainbow_floor", name: "Rainbow", css: "linear-gradient(90deg,#ff0000,#ff7700,#ffff00,#00ff00,#0000ff,#8b00ff)" },
  { id: "dirt", name: "Earth", css: "repeating-linear-gradient(45deg,#5d3d1e,#4a2f15,#5d3d1e 20px)" },
];

export interface ExteriorStyle {
  id: string; name: string;
  wallColor: string; roofColor: string; doorColor: string;
  trimColor: string; emoji: string;
}
export const EXTERIOR_STYLES: ExteriorStyle[] = [
  { id: "cottage", name: "Cottage", wallColor: "#F5DEB3", roofColor: "#8B4513", doorColor: "#654321", trimColor: "#90EE90", emoji: "🏡" },
  { id: "modern", name: "Modern", wallColor: "#E0E0E0", roofColor: "#333333", doorColor: "#555555", trimColor: "#4FC3F7", emoji: "🏢" },
  { id: "castle", name: "Castle", wallColor: "#B0B0B0", roofColor: "#6A5ACD", doorColor: "#4B0082", trimColor: "#FFD700", emoji: "🏰" },
  { id: "japanese", name: "Japanese", wallColor: "#FAF0E6", roofColor: "#CC0000", doorColor: "#8B4513", trimColor: "#FF69B4", emoji: "⛩️" },
  { id: "treehouse", name: "Treehouse", wallColor: "#8B6914", roofColor: "#228B22", doorColor: "#4a2800", trimColor: "#90EE90", emoji: "🌳" },
  { id: "crystal", name: "Crystal", wallColor: "#d0eef8", roofColor: "#80DEEA", doorColor: "#4DD0E1", trimColor: "#E1F5FE", emoji: "💎" },
  { id: "haunted", name: "Haunted", wallColor: "#2d2d2d", roofColor: "#1a1a1a", doorColor: "#0d0d0d", trimColor: "#9C27B0", emoji: "👻" },
  { id: "nordic", name: "Nordic Log", wallColor: "#ECEFF1", roofColor: "#37474F", doorColor: "#263238", trimColor: "#E53935", emoji: "❄️" },
  { id: "desert", name: "Desert Adobe", wallColor: "#FFCC80", roofColor: "#E65100", doorColor: "#BF360C", trimColor: "#FFE0B2", emoji: "🌵" },
  { id: "mushroom", name: "Mushroom", wallColor: "#fff0f0", roofColor: "#cc2200", doorColor: "#884400", trimColor: "#ffaaaa", emoji: "🍄" },
];

export interface FurnitureItem {
  id: string; name: string; emoji: string;
  category: "seating" | "table" | "storage" | "decor" | "plant" | "tech" | "bed" | "lighting" | "special";
  w: number; h: number; // size in grid cells (each cell = 64px)
}
export const FURNITURE: FurnitureItem[] = [
  // Seating
  { id: "sofa", name: "Sofa", emoji: "🛋️", category: "seating", w: 3, h: 1 },
  { id: "armchair", name: "Armchair", emoji: "🪑", category: "seating", w: 1, h: 1 },
  { id: "bean_bag", name: "Bean Bag", emoji: "🫘", category: "seating", w: 1, h: 1 },
  { id: "rocking_chair", name: "Rocking Chair", emoji: "🪑", category: "seating", w: 1, h: 1 },
  { id: "bench", name: "Bench", emoji: "🪵", category: "seating", w: 2, h: 1 },
  { id: "hammock", name: "Hammock", emoji: "🏕️", category: "seating", w: 3, h: 1 },
  { id: "throne", name: "Throne", emoji: "👑", category: "seating", w: 1, h: 2 },
  // Tables
  { id: "dining_table", name: "Dining Table", emoji: "🍽️", category: "table", w: 3, h: 2 },
  { id: "coffee_table", name: "Coffee Table", emoji: "☕", category: "table", w: 2, h: 1 },
  { id: "desk", name: "Desk", emoji: "💻", category: "table", w: 2, h: 1 },
  { id: "round_table", name: "Round Table", emoji: "⭕", category: "table", w: 2, h: 2 },
  // Storage
  { id: "bookshelf", name: "Bookshelf", emoji: "📚", category: "storage", w: 2, h: 2 },
  { id: "wardrobe", name: "Wardrobe", emoji: "👔", category: "storage", w: 2, h: 2 },
  { id: "treasure_chest", name: "Treasure Chest", emoji: "🎁", category: "storage", w: 1, h: 1 },
  { id: "cabinet", name: "Cabinet", emoji: "🗄️", category: "storage", w: 1, h: 2 },
  { id: "safe", name: "Safe", emoji: "🔒", category: "storage", w: 1, h: 1 },
  // Decor
  { id: "painting", name: "Painting", emoji: "🖼️", category: "decor", w: 1, h: 1 },
  { id: "rug", name: "Round Rug", emoji: "🔵", category: "decor", w: 2, h: 2 },
  { id: "mirror", name: "Mirror", emoji: "🪞", category: "decor", w: 1, h: 2 },
  { id: "fireplace", name: "Fireplace", emoji: "🔥", category: "decor", w: 2, h: 2 },
  { id: "trophy", name: "Trophy Case", emoji: "🏆", category: "decor", w: 1, h: 2 },
  { id: "globe", name: "Globe", emoji: "🌍", category: "decor", w: 1, h: 1 },
  { id: "clock", name: "Grand Clock", emoji: "🕰️", category: "decor", w: 1, h: 2 },
  { id: "vase", name: "Vase", emoji: "🏺", category: "decor", w: 1, h: 1 },
  { id: "guitar", name: "Guitar", emoji: "🎸", category: "decor", w: 1, h: 2 },
  { id: "piano", name: "Grand Piano", emoji: "🎹", category: "decor", w: 3, h: 2 },
  { id: "sword_display", name: "Sword Display", emoji: "⚔️", category: "decor", w: 1, h: 2 },
  { id: "banner", name: "Banner", emoji: "🚩", category: "decor", w: 1, h: 2 },
  // Plants
  { id: "fern", name: "Fern", emoji: "🌿", category: "plant", w: 1, h: 1 },
  { id: "cactus", name: "Cactus", emoji: "🌵", category: "plant", w: 1, h: 1 },
  { id: "flowers", name: "Flowers", emoji: "🌷", category: "plant", w: 1, h: 1 },
  { id: "tree_pot", name: "Indoor Tree", emoji: "🌳", category: "plant", w: 1, h: 2 },
  { id: "bonsai", name: "Bonsai", emoji: "🌱", category: "plant", w: 1, h: 1 },
  { id: "mushroom_plant", name: "Giant Mushroom", emoji: "🍄", category: "plant", w: 1, h: 2 },
  { id: "sunflower", name: "Sunflower", emoji: "🌻", category: "plant", w: 1, h: 2 },
  // Tech
  { id: "tv", name: "Big Screen TV", emoji: "📺", category: "tech", w: 3, h: 2 },
  { id: "computer", name: "Gaming Setup", emoji: "🖥️", category: "tech", w: 2, h: 2 },
  { id: "telescope", name: "Telescope", emoji: "🔭", category: "tech", w: 1, h: 2 },
  { id: "microscope", name: "Microscope", emoji: "🔬", category: "tech", w: 1, h: 1 },
  { id: "jukebox", name: "Jukebox", emoji: "🎵", category: "tech", w: 1, h: 2 },
  { id: "game_console", name: "Game Console", emoji: "🎮", category: "tech", w: 1, h: 1 },
  // Beds
  { id: "bed_single", name: "Single Bed", emoji: "🛏️", category: "bed", w: 2, h: 2 },
  { id: "bed_double", name: "King Bed", emoji: "🛏️", category: "bed", w: 3, h: 2 },
  { id: "sleeping_bag", name: "Sleeping Bag", emoji: "🛌", category: "bed", w: 2, h: 1 },
  // Lighting
  { id: "lamp", name: "Floor Lamp", emoji: "💡", category: "lighting", w: 1, h: 2 },
  { id: "lantern", name: "Lantern", emoji: "🏮", category: "lighting", w: 1, h: 1 },
  { id: "candle", name: "Candles", emoji: "🕯️", category: "lighting", w: 1, h: 1 },
  { id: "chandelier", name: "Chandelier", emoji: "✨", category: "lighting", w: 2, h: 1 },
  // Special
  { id: "portal", name: "Magic Portal", emoji: "🌀", category: "special", w: 2, h: 3 },
  { id: "cauldron", name: "Cauldron", emoji: "🫕", category: "special", w: 1, h: 1 },
  { id: "crystal_ball", name: "Crystal Ball", emoji: "🔮", category: "special", w: 1, h: 1 },
  { id: "fountain", name: "Fountain", emoji: "⛲", category: "special", w: 2, h: 2 },
  { id: "aquarium", name: "Aquarium", emoji: "🐠", category: "special", w: 3, h: 2 },
  { id: "forge", name: "Forge", emoji: "⚒️", category: "special", w: 2, h: 2 },
  { id: "altar", name: "Altar", emoji: "⭐", category: "special", w: 3, h: 2 },
  { id: "wishing_well", name: "Wishing Well", emoji: "🪣", category: "special", w: 2, h: 2 },
];

export interface PlacedFurniture {
  instanceId: string;
  furnitureId: string;
  x: number; // 0–100 percent of room width
  y: number; // 0–100 percent of floor height
}

export interface OwnedPet {
  instanceId: string;
  petId: string;
  name: string;
}

export interface HouseConfig {
  userId: string;
  exteriorStyle: string;
  wallpaper: string;
  floorType: string;
  furniture: PlacedFurniture[];
  pets: OwnedPet[];
}

export const DEFAULT_HOUSE_CONFIG: Omit<HouseConfig, "userId"> = {
  exteriorStyle: "cottage",
  wallpaper: "cream",
  floorType: "hardwood",
  furniture: [],
  pets: [],
};

// NPC houses for empty district slots
export const NPC_HOUSE_NAMES = [
  "Old Maevis", "Bram the Blacksmith", "Thistle", "Fennick", "Wren",
  "Cob the Baker", "Sailor Darro", "Juniper", "Moss", "Ridley",
];
export const NPC_EXTERIORS = ["cottage", "modern", "nordic", "desert", "japanese", "mushroom"];
