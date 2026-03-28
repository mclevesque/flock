/* ============================================
   LORECRAFT — Lore, World & Dialogue Generation
   Template-based story, name, dialogue, faction
   and quest generation. Zero API calls.
   ============================================ */


/* ---- WORD POOLS BY SETTING ---- */
const LORE_POOLS = {
    space: {
        protagonistTitles: ['Captain', 'Commander', 'Ranger', 'Pilot', 'Engineer', 'Operative', 'Specialist', 'Cadet'],
        antagonistTitles: ['Overlord', 'Warlord', 'Admiral', 'Hivemind', 'Emperor', 'Archon', 'Tyrant', 'Devourer'],
        objectives: ['save the colony', 'stop the invasion', 'retrieve the artifact', 'escape the station', 'destroy the mothership', 'find the lost crew', 'deliver the cargo', 'defend the outpost'],
        locations: ['Nebula', 'Station', 'Outpost', 'Asteroid Belt', 'Colony', 'Starport', 'Orbital', 'Frontier'],
        factionTypes: ['Fleet', 'Syndicate', 'Corporation', 'Alliance', 'Collective', 'Order', 'Armada', 'Union'],
        creatures: ['drones', 'aliens', 'pirates', 'raiders', 'mutants', 'bots', 'parasites', 'mercenaries'],
        items: ['blaster', 'plasma core', 'shield module', 'nav chip', 'cryo canister', 'energy cell', 'beacon', 'data cube'],
        adjectives: ['stellar', 'void', 'crimson', 'iron', 'quantum', 'dark', 'burning', 'frozen'],
        phonemes: {
            prefixes: ['Zy', 'Kra', 'Vo', 'Xe', 'Tha', 'Ori', 'Ax', 'Ne', 'Sol', 'Vy', 'Pla', 'Ry'],
            middles: ['ri', 'na', 'lo', 'xe', 'mu', 'ko', 'tha', 'vi', 'on', 'ar'],
            suffixes: ['x', 'on', 'is', 'us', 'ar', 'ix', 'en', 'os', 'al', 'um']
        },
        placePhonemes: {
            prefixes: ['Nova', 'Helio', 'Astro', 'Cryo', 'Exo', 'Proto', 'Xeno', 'Vega'],
            suffixes: [' Prime', ' Station', ' Reach', 'phis', 'thos', 'nar', ' IX', ' VII']
        }
    },
    medieval: {
        protagonistTitles: ['Knight', 'Squire', 'Ranger', 'Paladin', 'Monk', 'Huntsman', 'Herald', 'Champion'],
        antagonistTitles: ['Dark Lord', 'Necromancer', 'Tyrant King', 'Witch', 'Dragon', 'Warlord', 'Shadow', 'Lich'],
        objectives: ['slay the dragon', 'rescue the heir', 'reclaim the throne', 'lift the curse', 'defend the village', 'find the holy relic', 'forge the alliance', 'breach the fortress'],
        locations: ['Castle', 'Village', 'Forest', 'Mountain Pass', 'Dungeon', 'Cathedral', 'Ruins', 'Crossroads'],
        factionTypes: ['Kingdom', 'Order', 'Guild', 'Clan', 'Brotherhood', 'Church', 'House', 'Legion'],
        creatures: ['goblins', 'bandits', 'wolves', 'undead', 'orcs', 'trolls', 'wraiths', 'knights'],
        items: ['sword', 'shield', 'crown', 'tome', 'amulet', 'potion', 'scroll', 'chalice'],
        adjectives: ['iron', 'golden', 'shadowed', 'crimson', 'silver', 'ancient', 'cursed', 'holy'],
        phonemes: {
            prefixes: ['Al', 'Bra', 'Cor', 'Dun', 'Ed', 'Gar', 'Hal', 'Kel', 'Mor', 'Tho', 'Wil', 'Ro'],
            middles: ['an', 'el', 'or', 'in', 'ar', 'un', 'en', 'al', 'on', 'is'],
            suffixes: ['ric', 'mund', 'wen', 'dor', 'grim', 'ald', 'bert', 'ius', 'ard', 'wyn']
        },
        placePhonemes: {
            prefixes: ['North', 'Iron', 'Stone', 'Raven', 'Wolf', 'Oak', 'Grey', 'Black'],
            suffixes: ['hold', 'keep', 'vale', 'shire', 'haven', 'march', 'gate', 'bridge']
        }
    },
    cyberpunk: {
        protagonistTitles: ['Runner', 'Hacker', 'Fixer', 'Agent', 'Merc', 'Courier', 'Ripper', 'Ghost'],
        antagonistTitles: ['CEO', 'AI Overlord', 'Director', 'Kingpin', 'Architect', 'Overseer', 'Chairman', 'Enforcer'],
        objectives: ['expose the corporation', 'hack the mainframe', 'steal the prototype', 'rescue the informant', 'shut down the AI', 'smuggle the data', 'survive the purge', 'destroy the network'],
        locations: ['Megacity', 'Undercity', 'Data Center', 'Neon District', 'Slums', 'Corporate Tower', 'Black Market', 'Chop Shop'],
        factionTypes: ['Corp', 'Gang', 'Syndicate', 'Cell', 'Network', 'Cartel', 'Crew', 'Collective'],
        creatures: ['drones', 'enforcers', 'cyborgs', 'hackers', 'gangers', 'bots', 'augments', 'clones'],
        items: ['data chip', 'cyber deck', 'stim pack', 'EMP grenade', 'nano blade', 'cred stick', 'jammer', 'implant'],
        adjectives: ['neon', 'chrome', 'shadow', 'glitch', 'wired', 'toxic', 'black', 'razor'],
        phonemes: {
            prefixes: ['Zk', 'Nx', 'Vy', 'Rx', 'Jx', 'Kz', 'Dv', 'Qx', 'Sv', 'Bz', 'Tx', 'Mx'],
            middles: ['4', '0', 'x', 'i', 'e', 'a', 'u', '3', 'y', 'o'],
            suffixes: ['ce', 'xx', 'ro', 'ck', 'ze', 'nx', 'kr', 'sh', 'vr', 'ne']
        },
        placePhonemes: {
            prefixes: ['Neo', 'Syn', 'Hex', 'Nox', 'Arc', 'Grid', 'Bit', 'Core'],
            suffixes: [' Block', ' Zone', 'plex', 'hub', ' Sector', 'stack', 'net', 'link']
        }
    },
    fantasy: {
        protagonistTitles: ['Mage', 'Warrior', 'Druid', 'Bard', 'Thief', 'Summoner', 'Sage', 'Wanderer'],
        antagonistTitles: ['Dark Sorcerer', 'Demon King', 'Lich Queen', 'Fallen God', 'Void Walker', 'Archfiend', 'Witch King', 'Shadow Lord'],
        objectives: ['seal the rift', 'destroy the cursed gem', 'unite the races', 'awaken the guardian', 'purify the corruption', 'reclaim the lost magic', 'defeat the ancient evil', 'find the chosen one'],
        locations: ['Enchanted Forest', 'Crystal Cavern', 'Floating Isle', 'Arcane Tower', 'Sacred Grove', 'Abyssal Rift', 'Elder Ruins', 'Dragon Peak'],
        factionTypes: ['Circle', 'Coven', 'Tribe', 'Court', 'Fellowship', 'Enclave', 'Covenant', 'Lodge'],
        creatures: ['sprites', 'demons', 'golems', 'elementals', 'shades', 'beasts', 'constructs', 'fae'],
        items: ['staff', 'grimoire', 'crystal', 'rune stone', 'elixir', 'charm', 'wand', 'orb'],
        adjectives: ['arcane', 'ethereal', 'twilight', 'crystal', 'shadow', 'ember', 'frost', 'verdant'],
        phonemes: {
            prefixes: ['Ae', 'Ly', 'Fa', 'Ith', 'Cel', 'Sy', 'Ari', 'El', 'Thi', 'Ny', 'Gal', 'Ol'],
            middles: ['an', 'ri', 'el', 'ae', 'ith', 'yl', 'or', 'en', 'ia', 'un'],
            suffixes: ['dris', 'wen', 'thil', 'nor', 'iel', 'wyn', 'las', 'mir', 'ael', 'oth']
        },
        placePhonemes: {
            prefixes: ['Silver', 'Star', 'Moon', 'Sun', 'Elder', 'Thorn', 'Mist', 'Ember'],
            suffixes: ['wood', 'glade', 'spire', 'hollow', 'reach', 'fall', 'song', 'weald']
        }
    },
    'post-apocalyptic': {
        protagonistTitles: ['Survivor', 'Scavenger', 'Warden', 'Nomad', 'Drifter', 'Scout', 'Stalker', 'Keeper'],
        antagonistTitles: ['Raider King', 'Mutant Lord', 'Cult Leader', 'Warlord', 'Machine', 'Plague Bringer', 'Cannibal Chief', 'Overseer'],
        objectives: ['find clean water', 'reach the safe zone', 'stop the raiders', 'cure the plague', 'restore the generator', 'rescue the settlers', 'destroy the hive', 'uncover the bunker'],
        locations: ['Wasteland', 'Ruins', 'Bunker', 'Settlement', 'Dead City', 'Crater', 'Quarantine Zone', 'Scrapyard'],
        factionTypes: ['Clan', 'Militia', 'Cult', 'Caravan', 'Settlement', 'Horde', 'Commune', 'Patrol'],
        creatures: ['mutants', 'raiders', 'ferals', 'scavengers', 'drones', 'infected', 'beasts', 'marauders'],
        items: ['gas mask', 'rad pills', 'pipe rifle', 'water purifier', 'scrap armor', 'medkit', 'battery', 'ration pack'],
        adjectives: ['rusted', 'burned', 'toxic', 'broken', 'scarred', 'ash', 'blighted', 'salvaged'],
        phonemes: {
            prefixes: ['Gri', 'Ru', 'Sca', 'Bo', 'Kru', 'Ma', 'Tor', 'Vu', 'Zan', 'Ax', 'Dre', 'Rak'],
            middles: ['u', 'a', 'o', 'e', 'i', 'ax', 'ek', 'ul', 'ag', 'or'],
            suffixes: ['gg', 'nk', 'x', 'rr', 'sh', 'zz', 'ck', 'tt', 'ss', 'nd']
        },
        placePhonemes: {
            prefixes: ['Rust', 'Ash', 'Dead', 'Bone', 'Scar', 'Dust', 'Rot', 'Bleak'],
            suffixes: [' Flats', 'pit', ' Hollow', 'yard', ' Ridge', 'town', ' Reach', ' Heap']
        }
    }
};


/* ---- SHARED UTILITY ---- */
function _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function _pickN(arr, n) {
    const shuffled = arr.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, arr.length));
}

function _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function _detectSetting(text) {
    const lower = text.toLowerCase();
    const scores = {};
    const keywords = {
        space: ['space', 'star', 'galaxy', 'planet', 'alien', 'ship', 'crew', 'colony', 'nebula', 'asteroid', 'orbital', 'cosmic', 'void', 'shuttle'],
        medieval: ['knight', 'king', 'queen', 'castle', 'sword', 'dragon', 'kingdom', 'village', 'throne', 'lord', 'dungeon', 'peasant', 'squire', 'realm'],
        cyberpunk: ['cyber', 'hack', 'neon', 'corp', 'android', 'chrome', 'data', 'augment', 'implant', 'matrix', 'runner', 'megacity', 'synthetic', 'wire'],
        fantasy: ['magic', 'wizard', 'spell', 'mage', 'enchant', 'sorcerer', 'demon', 'elf', 'dwarf', 'arcane', 'mystic', 'potion', 'elemental', 'fairy'],
        'post-apocalyptic': ['wasteland', 'survive', 'apocaly', 'mutant', 'ruin', 'scaveng', 'bunker', 'raider', 'fallout', 'nuclear', 'plague', 'zombie', 'desolat', 'aftermath']
    };
    for (const [setting, words] of Object.entries(keywords)) {
        scores[setting] = 0;
        for (const w of words) {
            if (lower.includes(w)) scores[setting] += 1;
        }
    }
    let best = 'fantasy';
    let bestScore = 0;
    for (const [setting, score] of Object.entries(scores)) {
        if (score > bestScore) { bestScore = score; best = setting; }
    }
    return best;
}


/* ---- LORE SEED ---- */
class LoreSeed {
    /**
     * Parses a one-sentence prompt into story atoms.
     * Example: "A space ranger must save a colony from an alien horde"
     * => { protagonist, objective, antagonist, setting, tone }
     */
    static parse(prompt) {
        const setting = _detectSetting(prompt);
        const pool = LORE_POOLS[setting];
        const lower = prompt.toLowerCase();

        // Try to extract protagonist role
        let protagonist = null;
        for (const title of pool.protagonistTitles) {
            if (lower.includes(title.toLowerCase())) {
                protagonist = title;
                break;
            }
        }
        if (!protagonist) protagonist = _pick(pool.protagonistTitles);

        // Try to extract antagonist
        let antagonist = null;
        for (const title of pool.antagonistTitles) {
            if (lower.includes(title.toLowerCase())) {
                antagonist = title;
                break;
            }
        }
        if (!antagonist) antagonist = _pick(pool.antagonistTitles);

        // Try to extract objective
        let objective = null;
        for (const obj of pool.objectives) {
            // check if any significant words match
            const words = obj.split(' ').filter(w => w.length > 3);
            const matches = words.filter(w => lower.includes(w));
            if (matches.length >= 2) {
                objective = obj;
                break;
            }
        }
        if (!objective) objective = _pick(pool.objectives);

        // Detect tone
        let tone = 'heroic';
        const toneMap = {
            dark: ['dark', 'grim', 'shadow', 'bleak', 'horror', 'dread', 'doom', 'sinister'],
            humorous: ['funny', 'silly', 'comedy', 'joke', 'wacky', 'absurd', 'goofy', 'ridiculous'],
            epic: ['epic', 'grand', 'legendary', 'mighty', 'vast', 'colossal', 'titanic'],
            gritty: ['gritty', 'harsh', 'brutal', 'raw', 'tough', 'merciless', 'ruthless'],
            heroic: ['hero', 'brave', 'save', 'rescue', 'defend', 'protect', 'champion']
        };
        for (const [t, words] of Object.entries(toneMap)) {
            for (const w of words) {
                if (lower.includes(w)) { tone = t; break; }
            }
        }

        return {
            prompt,
            setting,
            protagonist,
            antagonist,
            objective,
            tone,
            pool // attach pool for downstream use
        };
    }

    /**
     * Generate a full set of story atoms from a prompt,
     * including generated names and a location.
     */
    static generate(prompt) {
        const atoms = LoreSeed.parse(prompt);
        const gen = new NameGenerator(atoms.setting);

        atoms.protagonistName = gen.character();
        atoms.antagonistName = gen.character();
        atoms.locationName = gen.place();

        return atoms;
    }
}


/* ---- NAME GENERATOR ---- */
class NameGenerator {
    constructor(setting = 'fantasy') {
        this.setting = setting;
        this.pool = LORE_POOLS[setting] || LORE_POOLS.fantasy;
    }

    /** Generate a character name from phoneme tables */
    character() {
        const ph = this.pool.phonemes;
        const prefix = _pick(ph.prefixes);
        const useMiddle = Math.random() > 0.4;
        const middle = useMiddle ? _pick(ph.middles) : '';
        const suffix = _pick(ph.suffixes);
        return prefix + middle + suffix;
    }

    /** Generate a place name */
    place() {
        const pl = this.pool.placePhonemes;
        return _pick(pl.prefixes) + _pick(pl.suffixes);
    }

    /** Generate a faction name: "The [Adj] [FactionType]" */
    faction() {
        const adj = _capitalize(_pick(this.pool.adjectives));
        const type = _pick(this.pool.factionTypes);
        return `The ${adj} ${type}`;
    }

    /** Generate N unique character names */
    characters(n = 4) {
        const names = new Set();
        let safety = 0;
        while (names.size < n && safety < n * 10) {
            names.add(this.character());
            safety++;
        }
        return [...names];
    }

    /** Generate N unique place names */
    places(n = 3) {
        const names = new Set();
        let safety = 0;
        while (names.size < n && safety < n * 10) {
            names.add(this.place());
            safety++;
        }
        return [...names];
    }
}


/* ---- QUIP GENERATOR ---- */
class QuipGenerator {
    constructor(setting = 'fantasy') {
        this.setting = setting;
    }

    static TEMPLATES = {
        // {role} = protagonist/antagonist/minion, {enemy} = what they fight
        taunt: {
            space: [
                "Your shields can't save you!",
                "This sector belongs to us now!",
                "Surrender or be vaporized!",
                "You're flying into a death trap!",
                "Lock weapons — fire at will!",
                "No one escapes the void!",
                "Target acquired. Engaging!",
                "You call that a ship?"
            ],
            medieval: [
                "For the kingdom!",
                "You dare challenge me?",
                "Steel meets steel!",
                "Your blade is dull, like your wits!",
                "To arms, brothers!",
                "By the crown, you will fall!",
                "Stand and fight, coward!",
                "This land is ours!"
            ],
            cyberpunk: [
                "STOP RESISTING!",
                "System override initiated!",
                "Your firewall is pathetic!",
                "Flatline incoming!",
                "You're just code to me!",
                "Welcome to the grid, choom!",
                "Data breach in progress!",
                "Time to unplug — permanently!"
            ],
            fantasy: [
                "The arcane will consume you!",
                "By the ancient power!",
                "Your magic is nothing!",
                "The spirits demand your end!",
                "Feel the wrath of the elements!",
                "You cannot outrun destiny!",
                "The wards have spoken!",
                "Begone, trespasser!"
            ],
            'post-apocalyptic': [
                "This is OUR territory!",
                "Another day, another body!",
                "Hand over your supplies!",
                "Nobody leaves alive!",
                "The wasteland takes all!",
                "You should've stayed hidden!",
                "Fresh meat for the crew!",
                "Scavenge THIS!"
            ]
        },
        battleCry: {
            space: [
                "All systems, FIRE!",
                "For the fleet!",
                "Engage! Engage!",
                "Burn the void!"
            ],
            medieval: [
                "CHARGE!",
                "For honor and glory!",
                "Death before dishonor!",
                "Hold the line!"
            ],
            cyberpunk: [
                "Go loud!",
                "Breach and clear!",
                "Light 'em up!",
                "Zero them all!"
            ],
            fantasy: [
                "By the elder flame!",
                "Unleash the storm!",
                "Spirits, guide my hand!",
                "For the sacred grove!"
            ],
            'post-apocalyptic': [
                "Take everything!",
                "No mercy!",
                "Burn it down!",
                "Fight or die!"
            ]
        },
        defeat: {
            space: [
                "Systems... failing...",
                "Tell the fleet... we tried...",
                "Hull breach... critical...",
                "It was... an honor..."
            ],
            medieval: [
                "My sword... falls...",
                "The kingdom... will remember...",
                "I go to... the great hall...",
                "Avenge... me..."
            ],
            cyberpunk: [
                "Flatlining...",
                "System... shutdown...",
                "Unplugged... for good...",
                "Delete my... data..."
            ],
            fantasy: [
                "The light... fades...",
                "My magic... spent...",
                "Return me... to the earth...",
                "The prophecy... continues..."
            ],
            'post-apocalyptic': [
                "The wasteland... wins...",
                "Should've... stayed home...",
                "Bury me... with my gear...",
                "At least... I fought..."
            ]
        },
        idle: {
            space: [
                "Running diagnostics...",
                "Sector is quiet. Too quiet.",
                "All systems nominal.",
                "Scanning for hostiles..."
            ],
            medieval: [
                "The wind carries ill tidings.",
                "My blade hungers.",
                "A quiet road is a suspicious road.",
                "I smell smoke on the wind."
            ],
            cyberpunk: [
                "Pinging the local mesh...",
                "Scanners are clean. For now.",
                "Need a reboot after this run.",
                "Cred balance is looking thin."
            ],
            fantasy: [
                "The ley lines hum softly.",
                "Something stirs in the shadows.",
                "The runes are restless.",
                "I sense a presence..."
            ],
            'post-apocalyptic': [
                "Keep your head down.",
                "Water's running low.",
                "Stay sharp. Stay alive.",
                "I don't like this silence."
            ]
        }
    };

    /** Get a quip by type: 'taunt', 'battleCry', 'defeat', 'idle' */
    get(type = 'taunt') {
        const pool = QuipGenerator.TEMPLATES[type];
        if (!pool) return "...";
        const lines = pool[this.setting] || pool.fantasy;
        return _pick(lines);
    }

    /** Get N unique quips of a type */
    getMany(type = 'taunt', n = 3) {
        const pool = QuipGenerator.TEMPLATES[type];
        if (!pool) return ["..."];
        const lines = pool[this.setting] || pool.fantasy;
        return _pickN(lines, n);
    }

    /** Get a full quip set for a character (one of each type) */
    characterSet() {
        return {
            taunt: this.get('taunt'),
            battleCry: this.get('battleCry'),
            defeat: this.get('defeat'),
            idle: this.get('idle')
        };
    }

    /** Generate a full bark table (multiple of each type) for a character */
    barkTable(countsPerType = 3) {
        return {
            taunts: this.getMany('taunt', countsPerType),
            battleCries: this.getMany('battleCry', countsPerType),
            defeats: this.getMany('defeat', countsPerType),
            idles: this.getMany('idle', countsPerType)
        };
    }
}


/* ---- FACTION GENERATOR ---- */
class FactionGenerator {
    constructor(setting = 'fantasy') {
        this.setting = setting;
        this.nameGen = new NameGenerator(setting);
        this.pool = LORE_POOLS[setting] || LORE_POOLS.fantasy;
    }

    static ROLES = ['ruling', 'rebel', 'merchant', 'mystic', 'military', 'criminal', 'nomadic', 'scholarly'];
    static DISPOSITIONS = ['aggressive', 'defensive', 'neutral', 'expansionist', 'isolationist', 'diplomatic'];
    static RELATIONSHIPS = ['allied', 'rival', 'hostile', 'neutral', 'trading', 'vassal'];

    /** Generate a single faction */
    one() {
        const name = this.nameGen.faction();
        const role = _pick(FactionGenerator.ROLES);
        const disposition = _pick(FactionGenerator.DISPOSITIONS);
        const leaderName = this.nameGen.character();
        const leaderTitle = _pick(this.pool.protagonistTitles);
        const territory = this.nameGen.place();

        return {
            name,
            role,
            disposition,
            leader: `${leaderTitle} ${leaderName}`,
            territory,
            strength: Math.floor(Math.random() * 5) + 1 // 1-5
        };
    }

    /** Generate N factions with relationships between them */
    generate(count = 4) {
        const factions = [];
        for (let i = 0; i < count; i++) {
            factions.push(this.one());
        }

        // Build relationship map
        const relationships = {};
        for (let i = 0; i < factions.length; i++) {
            for (let j = i + 1; j < factions.length; j++) {
                const rel = _pick(FactionGenerator.RELATIONSHIPS);
                const key = `${factions[i].name} <-> ${factions[j].name}`;
                relationships[key] = rel;
            }
        }

        return { factions, relationships };
    }

    /** Generate factions from story atoms (ensures protagonist/antagonist factions) */
    fromAtoms(atoms) {
        const count = 3 + Math.floor(Math.random() * 2); // 3-4
        const result = this.generate(count);

        // Tag first faction as protagonist-aligned, second as antagonist-aligned
        if (result.factions.length >= 2) {
            result.factions[0].alignment = 'protagonist';
            result.factions[0].role = 'rebel';
            result.factions[1].alignment = 'antagonist';
            result.factions[1].role = 'ruling';
            result.factions[1].disposition = 'aggressive';

            // Force hostility between protagonist and antagonist factions
            const key = `${result.factions[0].name} <-> ${result.factions[1].name}`;
            result.relationships[key] = 'hostile';
        }

        return result;
    }
}


/* ---- QUEST GENERATOR ---- */
class QuestGenerator {
    constructor(setting = 'fantasy') {
        this.setting = setting;
        this.nameGen = new NameGenerator(setting);
        this.pool = LORE_POOLS[setting] || LORE_POOLS.fantasy;
    }

    static ACT_TEMPLATES = {
        act1: {
            titles: ['The Call', 'Discovery', 'Warning Signs', 'The Awakening', 'First Steps'],
            structures: [
                { type: 'gather', desc: 'Gather supplies and allies before the journey' },
                { type: 'investigate', desc: 'Investigate the source of the disturbance' },
                { type: 'escort', desc: 'Escort a key figure to safety' },
                { type: 'survive', desc: 'Survive an ambush that reveals the true threat' },
                { type: 'discover', desc: 'Discover the enemy\'s plan' }
            ]
        },
        act2: {
            titles: ['The Crossing', 'Into the Unknown', 'Rising Danger', 'The Test', 'Descent'],
            structures: [
                { type: 'infiltrate', desc: 'Infiltrate the enemy stronghold' },
                { type: 'retrieve', desc: 'Retrieve a crucial item from a dangerous location' },
                { type: 'defend', desc: 'Defend an ally location against a major assault' },
                { type: 'betray', desc: 'Deal with betrayal from within' },
                { type: 'navigate', desc: 'Cross through hostile territory' }
            ]
        },
        act3: {
            titles: ['The Final Stand', 'Reckoning', 'The End', 'Showdown', 'Resolution'],
            structures: [
                { type: 'boss', desc: 'Confront the main antagonist in a final battle' },
                { type: 'sacrifice', desc: 'Make a sacrifice to achieve victory' },
                { type: 'siege', desc: 'Lead a siege against the enemy fortress' },
                { type: 'escape', desc: 'Escape the collapsing stronghold after victory' },
                { type: 'choose', desc: 'Make a final choice that determines the outcome' }
            ]
        }
    };

    /** Generate a 3-act quest chain */
    generate(atoms = null) {
        if (!atoms) {
            atoms = {
                protagonist: _pick(this.pool.protagonistTitles),
                antagonist: _pick(this.pool.antagonistTitles),
                objective: _pick(this.pool.objectives),
                setting: this.setting,
                tone: 'heroic'
            };
        }

        const acts = [];

        for (const actKey of ['act1', 'act2', 'act3']) {
            const template = QuestGenerator.ACT_TEMPLATES[actKey];
            const title = _pick(template.titles);
            const structure = _pick(template.structures);
            const location = this.nameGen.place();
            const enemy = _pick(this.pool.creatures);
            const reward = _pick(this.pool.items);

            acts.push({
                act: actKey,
                title,
                type: structure.type,
                description: this._fillDescription(structure.desc, atoms, location, enemy),
                location,
                enemies: [enemy],
                reward: actKey === 'act3' ? 'Victory' : reward,
                objective: actKey === 'act3' ? atoms.objective : structure.desc
            });
        }

        return {
            title: this._questTitle(atoms),
            setting: atoms.setting,
            protagonist: atoms.protagonist,
            antagonist: atoms.antagonist,
            acts
        };
    }

    /** Generate a single side quest */
    sideQuest() {
        const sideTypes = [
            { type: 'fetch', template: 'Retrieve {item} from {location}' },
            { type: 'kill', template: 'Clear out {enemies} in {location}' },
            { type: 'escort', template: 'Escort {npc} safely to {location}' },
            { type: 'defend', template: 'Defend {location} from {enemies}' },
            { type: 'investigate', template: 'Investigate strange activity in {location}' }
        ];

        const quest = _pick(sideTypes);
        const location = this.nameGen.place();
        const npc = this.nameGen.character();
        const enemies = _pick(this.pool.creatures);
        const item = _pick(this.pool.items);
        const reward = _pick(this.pool.items);

        const description = quest.template
            .replace('{item}', item)
            .replace('{location}', location)
            .replace('{npc}', npc)
            .replace('{enemies}', enemies);

        return {
            type: quest.type,
            title: `${_capitalize(quest.type)}: ${location}`,
            description,
            location,
            reward
        };
    }

    _questTitle(atoms) {
        const templates = [
            `${atoms.protagonist}: ${_capitalize(atoms.objective)}`,
            `The ${_pick(this.pool.adjectives)} ${_pick(this.pool.locations)}`,
            `${atoms.antagonist}'s ${_pick(['Downfall', 'End', 'Reckoning', 'Doom', 'Defeat'])}`,
            `${_pick(this.pool.adjectives)} ${_pick(['Dawn', 'Rising', 'Storm', 'Fall', 'Journey'])}`
        ];
        return _capitalize(_pick(templates));
    }

    _fillDescription(desc, atoms, location, enemy) {
        return desc
            .replace('enemy stronghold', `${atoms.antagonist}'s stronghold at ${location}`)
            .replace('the true threat', `the threat of ${atoms.antagonist}`)
            .replace('enemy fortress', `${atoms.antagonist}'s fortress`)
            .replace('main antagonist', atoms.antagonist)
            .replace('hostile territory', `${enemy}-infested territory near ${location}`)
            .replace('ally location', location)
            .replace('a dangerous location', location)
            .replace('a key figure', `an ally of the ${atoms.protagonist}`);
    }
}


/* ---- LORECRAFT FACADE ---- */
class LoreCraft {
    /**
     * One-call world generation from a single prompt.
     * Returns everything a game needs: atoms, names, factions, quests, quips.
     */
    static generate(prompt) {
        const atoms = LoreSeed.generate(prompt);
        const setting = atoms.setting;

        const nameGen = new NameGenerator(setting);
        const factionGen = new FactionGenerator(setting);
        const questGen = new QuestGenerator(setting);
        const quipGen = new QuipGenerator(setting);

        const factions = factionGen.fromAtoms(atoms);
        const mainQuest = questGen.generate(atoms);
        const sideQuests = [questGen.sideQuest(), questGen.sideQuest()];

        // Generate NPC names for each faction leader
        const npcs = factions.factions.map(f => ({
            name: f.leader,
            faction: f.name,
            role: f.role,
            quips: quipGen.characterSet()
        }));

        return {
            atoms,
            setting,
            factions,
            mainQuest,
            sideQuests,
            npcs,
            locations: nameGen.places(5),
            extraNames: nameGen.characters(6)
        };
    }

    /** Quick-generate just the dialogue barks for a setting */
    static barks(setting = 'fantasy', count = 3) {
        const gen = new QuipGenerator(setting);
        return gen.barkTable(count);
    }

    /** List available settings */
    static get settings() {
        return Object.keys(LORE_POOLS);
    }
}


window.LoreSeed = LoreSeed;
window.NameGenerator = NameGenerator;
window.QuipGenerator = QuipGenerator;
window.FactionGenerator = FactionGenerator;
window.QuestGenerator = QuestGenerator;
window.LoreCraft = LoreCraft;
window.LORE_POOLS = LORE_POOLS;
