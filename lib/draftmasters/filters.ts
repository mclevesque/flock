/**
 * Filters a player can switch on after picking a universe.
 *
 * Applied to the board BEFORE it is dealt, on the screen that builds it -- so
 * the filtered board is the one the room's server draws lots from, and the
 * one a PvP guest receives. Nothing downstream needs to know a filter exists.
 *
 * Checkboxes, and they stack: a card has to pass every filter that is on.
 * "Gen 1 only" and "Gen 1-4" together is just Gen 1.
 */
import type { Entry, Pack } from "./packs";

export interface PackFilter {
  id: string;
  label: string;
  /** One line under the checkbox, so a player knows what they are cutting. */
  hint: string;
  keep: (e: Entry) => boolean;
  /** Conditions that would sneak back in what the filter removes. */
  dropVariant?: RegExp;
}

/**
 * National Dex number for every Pokemon on the board, generated from PokeAPI.
 * A lookup by NUMBER rather than a hand-written list of names per generation,
 * so a new filter (Gen 1-2, Gen 5+) is a comparison and not another list.
 */
const POKEDEX: Record<string, number> = {
  "Bulbasaur": 1, "Venusaur": 3, "Charmander": 4, "Charizard": 6, "Squirtle": 7, "Blastoise": 9,
  "Caterpie": 10, "Metapod": 11, "Weedle": 13, "Kakuna": 14, "Pidgey": 16, "Pidgeot": 18,
  "Rattata": 19, "Pikachu": 25, "Raichu": 26, "Nidoqueen": 31, "Nidoking": 34, "Clefable": 36,
  "Ninetales": 38, "Jigglypuff": 39, "Zubat": 41, "Vileplume": 45, "Diglett": 50, "Meowth": 52,
  "Psyduck": 54, "Golduck": 55, "Arcanine": 59, "Poliwrath": 62, "Alakazam": 65, "Machamp": 68,
  "Bellsprout": 69, "Victreebel": 71, "Tentacool": 72, "Tentacruel": 73, "Geodude": 74,
  "Golem": 76, "Rapidash": 78, "Slowpoke": 79, "Slowbro": 80, "Magnemite": 81, "Farfetch’d": 83,
  "Dodrio": 85, "Dewgong": 87, "Grimer": 88, "Muk": 89, "Cloyster": 91, "Gengar": 94, "Onix": 95,
  "Hypno": 97, "Krabby": 98, "Kingler": 99, "Voltorb": 100, "Electrode": 101, "Exeggcute": 102,
  "Exeggutor": 103, "Cubone": 104, "Lickitung": 108, "Koffing": 109, "Weezing": 110,
  "Tangela": 114, "Kangaskhan": 115, "Horsea": 116, "Goldeen": 118, "Staryu": 120, "Starmie": 121,
  "Scyther": 123, "Magmar": 126, "Pinsir": 127, "Tauros": 128, "Magikarp": 129, "Gyarados": 130,
  "Lapras": 131, "Ditto": 132, "Eevee": 133, "Vaporeon": 134, "Jolteon": 135, "Flareon": 136,
  "Porygon": 137, "Omastar": 139, "Kabutops": 141, "Aerodactyl": 142, "Snorlax": 143,
  "Articuno": 144, "Zapdos": 145, "Moltres": 146, "Dragonite": 149, "Mewtwo": 150, "Mew": 151,
  "Chikorita": 152, "Meganium": 154, "Cyndaquil": 155, "Typhlosion": 157, "Totodile": 158,
  "Feraligatr": 160, "Sentret": 161, "Hoothoot": 163, "Ledyba": 165, "Spinarak": 167,
  "Crobat": 169, "Lanturn": 171, "Togepi": 175, "Natu": 177, "Xatu": 178, "Ampharos": 181,
  "Bellossom": 182, "Marill": 183, "Politoed": 186, "Jumpluff": 189, "Sunkern": 191, "Wooper": 194,
  "Espeon": 196, "Umbreon": 197, "Slowking": 199, "Unown": 201, "Wobbuffet": 202,
  "Forretress": 205, "Dunsparce": 206, "Steelix": 208, "Scizor": 212, "Shuckle": 213,
  "Heracross": 214, "Octillery": 224, "Delibird": 225, "Mantine": 226, "Skarmory": 227,
  "Houndoom": 229, "Kingdra": 230, "Donphan": 232, "Stantler": 234, "Smeargle": 235,
  "Tyrogue": 236, "Miltank": 241, "Blissey": 242, "Raikou": 243, "Entei": 244, "Suicune": 245,
  "Tyranitar": 248, "Lugia": 249, "Ho-Oh": 250, "Celebi": 251, "Treecko": 252, "Sceptile": 254,
  "Torchic": 255, "Blaziken": 257, "Mudkip": 258, "Swampert": 260, "Zigzagoon": 263,
  "Wurmple": 265, "Ludicolo": 272, "Shiftry": 275, "Gardevoir": 282, "Breloom": 286,
  "Slaking": 289, "Whismur": 293, "Exploud": 295, "Makuhita": 296, "Hariyama": 297,
  "Nosepass": 299, "Sableye": 302, "Aggron": 306, "Manectric": 310, "Plusle": 311, "Minun": 312,
  "Swalot": 317, "Sharpedo": 319, "Wailord": 321, "Camerupt": 323, "Torkoal": 324, "Grumpig": 326,
  "Flygon": 330, "Cacturne": 332, "Altaria": 334, "Lunatone": 337, "Solrock": 338, "Whiscash": 340,
  "Crawdaunt": 342, "Claydol": 344, "Cradily": 346, "Armaldo": 348, "Feebas": 349, "Milotic": 350,
  "Tropius": 357, "Absol": 359, "Glalie": 362, "Walrein": 365, "Huntail": 367, "Gorebyss": 368,
  "Relicanth": 369, "Luvdisc": 370, "Salamence": 373, "Metagross": 376, "Regirock": 377,
  "Regice": 378, "Registeel": 379, "Latias": 380, "Latios": 381, "Kyogre": 382, "Groudon": 383,
  "Rayquaza": 384, "Jirachi": 385, "Deoxys": 386, "Turtwig": 387, "Torterra": 389, "Chimchar": 390,
  "Infernape": 392, "Piplup": 393, "Empoleon": 395, "Staraptor": 398, "Bidoof": 399, "Shinx": 403,
  "Luxray": 405, "Roserade": 407, "Rampardos": 409, "Bastiodon": 411, "Combee": 415,
  "Vespiquen": 416, "Buizel": 418, "Floatzel": 419, "Cherubi": 420, "Gastrodon": 423,
  "Ambipom": 424, "Drifblim": 426, "Lopunny": 428, "Mismagius": 429, "Honchkrow": 430,
  "Skuntank": 435, "Bronzor": 436, "Bronzong": 437, "Happiny": 440, "Chatot": 441,
  "Spiritomb": 442, "Garchomp": 445, "Lucario": 448, "Hippopotas": 449, "Hippowdon": 450,
  "Drapion": 452, "Toxicroak": 454, "Lumineon": 457, "Abomasnow": 460, "Weavile": 461,
  "Magnezone": 462, "Lickilicky": 463, "Rhyperior": 464, "Tangrowth": 465, "Electivire": 466,
  "Magmortar": 467, "Togekiss": 468, "Yanmega": 469, "Leafeon": 470, "Glaceon": 471,
  "Gliscor": 472, "Mamoswine": 473, "Porygon-Z": 474, "Gallade": 475, "Probopass": 476,
  "Dusknoir": 477, "Froslass": 478, "Rotom": 479, "Uxie": 480, "Mesprit": 481, "Azelf": 482,
  "Dialga": 483, "Palkia": 484, "Heatran": 485, "Regigigas": 486, "Giratina": 487,
  "Cresselia": 488, "Phione": 489, "Manaphy": 490, "Darkrai": 491, "Shaymin": 492, "Arceus": 493,
  "Victini": 494, "Snivy": 495, "Serperior": 497, "Tepig": 498, "Emboar": 500, "Oshawott": 501,
  "Samurott": 503, "Patrat": 504, "Lillipup": 506, "Stoutland": 508, "Purrloin": 509,
  "Simisage": 512, "Simisear": 514, "Simipour": 516, "Munna": 517, "Musharna": 518,
  "Unfezant": 521, "Zebstrika": 523, "Gigalith": 526, "Woobat": 527, "Drilbur": 529,
  "Excadrill": 530, "Audino": 531, "Conkeldurr": 534, "Tympole": 535, "Seismitoad": 537,
  "Throh": 538, "Sawk": 539, "Leavanny": 542, "Scolipede": 545, "Whimsicott": 547,
  "Lilligant": 549, "Basculin": 550, "Krookodile": 553, "Darmanitan": 555, "Maractus": 556,
  "Dwebble": 557, "Crustle": 558, "Scraggy": 559, "Scrafty": 560, "Sigilyph": 561,
  "Cofagrigus": 563, "Carracosta": 565, "Archeops": 567, "Trubbish": 568, "Garbodor": 569,
  "Zoroark": 571, "Minccino": 572, "Cinccino": 573, "Gothitelle": 576, "Reuniclus": 579,
  "Swanna": 581, "Vanilluxe": 584, "Sawsbuck": 586, "Escavalier": 589, "Amoonguss": 591,
  "Jellicent": 593, "Alomomola": 594, "Galvantula": 596, "Ferrothorn": 598, "Klinklang": 601,
  "Eelektross": 604, "Beheeyem": 606, "Chandelure": 609, "Haxorus": 612, "Beartic": 614,
  "Cryogonal": 615, "Accelgor": 617, "Stunfisk": 618, "Mienshao": 620, "Druddigon": 621,
  "Golurk": 623, "Bouffalant": 626, "Braviary": 628, "Mandibuzz": 630, "Heatmor": 631,
  "Durant": 632, "Hydreigon": 635, "Volcarona": 637, "Cobalion": 638, "Terrakion": 639,
  "Virizion": 640, "Tornadus": 641, "Thundurus": 642, "Reshiram": 643, "Zekrom": 644,
  "Landorus": 645, "Kyurem": 646, "Keldeo": 647, "Meloetta": 648, "Genesect": 649, "Chespin": 650,
  "Chesnaught": 652, "Fennekin": 653, "Delphox": 655, "Froakie": 656, "Greninja": 658,
  "Bunnelby": 659, "Fletchling": 661, "Talonflame": 663, "Scatterbug": 664, "Litleo": 667,
  "Pyroar": 668, "Flabébé": 669, "Florges": 671, "Skiddo": 672, "Gogoat": 673, "Pancham": 674,
  "Pangoro": 675, "Furfrou": 676, "Espurr": 677, "Meowstic": 678, "Honedge": 679, "Aegislash": 681,
  "Aromatisse": 683, "Slurpuff": 685, "Inkay": 686, "Malamar": 687, "Barbaracle": 689,
  "Dragalge": 691, "Clawitzer": 693, "Heliolisk": 695, "Tyrantrum": 697, "Aurorus": 699,
  "Sylveon": 700, "Hawlucha": 701, "Carbink": 703, "Goodra": 706, "Klefki": 707, "Trevenant": 709,
  "Gourgeist": 711, "Bergmite": 712, "Avalugg": 713, "Noibat": 714, "Noivern": 715, "Xerneas": 716,
  "Yveltal": 717, "Zygarde": 718, "Diancie": 719, "Hoopa": 720, "Volcanion": 721, "Rowlet": 722,
  "Decidueye": 724, "Litten": 725, "Incineroar": 727, "Popplio": 728, "Primarina": 730,
  "Pikipek": 731, "Toucannon": 733, "Yungoos": 734, "Grubbin": 736, "Vikavolt": 738,
  "Crabrawler": 739, "Crabominable": 740, "Oricorio": 741, "Cutiefly": 742, "Ribombee": 743,
  "Rockruff": 744, "Lycanroc": 745, "Wishiwashi": 746, "Mareanie": 747, "Toxapex": 748,
  "Mudsdale": 750, "Lurantis": 754, "Salazzle": 758, "Stufful": 759, "Bewear": 760,
  "Bounsweet": 761, "Tsareena": 763, "Comfey": 764, "Oranguru": 765, "Passimian": 766,
  "Golisopod": 768, "Palossand": 770, "Type: Null": 772, "Silvally": 773, "Komala": 775,
  "Turtonator": 776, "Mimikyu": 778, "Bruxish": 779, "Drampa": 780, "Dhelmise": 781,
  "Kommo-o": 784, "Tapu Koko": 785, "Tapu Lele": 786, "Tapu Bulu": 787, "Tapu Fini": 788,
  "Cosmog": 789, "Cosmoem": 790, "Solgaleo": 791, "Lunala": 792, "Nihilego": 793, "Buzzwole": 794,
  "Pheromosa": 795, "Xurkitree": 796, "Celesteela": 797, "Kartana": 798, "Guzzlord": 799,
  "Necrozma": 800, "Magearna": 801, "Marshadow": 802, "Naganadel": 804, "Stakataka": 805,
  "Blacephalon": 806, "Zeraora": 807, "Meltan": 808, "Melmetal": 809, "Grookey": 810,
  "Rillaboom": 812, "Scorbunny": 813, "Cinderace": 815, "Sobble": 816, "Inteleon": 818,
  "Skwovet": 819, "Greedent": 820, "Rookidee": 821, "Corviknight": 823, "Blipbug": 824,
  "Orbeetle": 826, "Nickit": 827, "Gossifleur": 829, "Eldegoss": 830, "Dubwool": 832,
  "Chewtle": 833, "Drednaw": 834, "Yamper": 835, "Boltund": 836, "Rolycoly": 837, "Coalossal": 839,
  "Applin": 840, "Flapple": 841, "Appletun": 842, "Silicobra": 843, "Sandaconda": 844,
  "Cramorant": 845, "Arrokuda": 846, "Barraskewda": 847, "Toxel": 848, "Toxtricity": 849,
  "Sizzlipede": 850, "Centiskorch": 851, "Clobbopus": 852, "Grapploct": 853, "Sinistea": 854,
  "Polteageist": 855, "Hatenna": 856, "Hatterene": 858, "Impidimp": 859, "Grimmsnarl": 861,
  "Obstagoon": 862, "Cursola": 864, "Sirfetch’d": 865, "Mr. Rime": 866, "Runerigus": 867,
  "Milcery": 868, "Alcremie": 869, "Falinks": 870, "Frosmoth": 873, "Stonjourner": 874,
  "Eiscue": 875, "Indeedee": 876, "Copperajah": 879, "Dracozolt": 880, "Arctozolt": 881,
  "Dracovish": 882, "Arctovish": 883, "Dragapult": 887, "Zacian": 888, "Zamazenta": 889,
  "Eternatus": 890, "Kubfu": 891, "Urshifu": 892, "Zarude": 893, "Regieleki": 894,
  "Regidrago": 895, "Glastrier": 896, "Spectrier": 897, "Calyrex": 898, "Wyrdeer": 899,
  "Kleavor": 900, "Ursaluna": 901, "Basculegion": 902, "Sneasler": 903, "Overqwil": 904,
  "Enamorus": 905, "Sprigatito": 906, "Meowscarada": 908, "Fuecoco": 909, "Skeledirge": 911,
  "Quaxly": 912, "Quaquaval": 914, "Lechonk": 915, "Oinkologne": 916, "Tarountula": 917,
  "Nymble": 919, "Pawmi": 921, "Pawmot": 923, "Tandemaus": 924, "Maushold": 925, "Fidough": 926,
  "Dachsbun": 927, "Smoliv": 928, "Arboliva": 930, "Nacli": 932, "Garganacl": 934,
  "Armarouge": 936, "Ceruledge": 937, "Tadbulb": 938, "Bellibolt": 939, "Wattrel": 940,
  "Kilowattrel": 941, "Maschiff": 942, "Mabosstiff": 943, "Shroodle": 944, "Grafaiai": 945,
  "Bramblin": 946, "Brambleghast": 947, "Toedscruel": 949, "Scovillain": 952, "Rabsca": 954,
  "Flittle": 955, "Espathra": 956, "Tinkaton": 959, "Bombirdier": 962, "Finizen": 963,
  "Varoom": 965, "Revavroom": 966, "Cyclizar": 967, "Orthworm": 968, "Glimmora": 970,
  "Houndstone": 972, "Flamigo": 973, "Cetitan": 975, "Veluza": 976, "Dondozo": 977,
  "Tatsugiri": 978, "Annihilape": 979, "Farigiraf": 981, "Dudunsparce": 982, "Kingambit": 983,
  "Great Tusk": 984, "Scream Tail": 985, "Brute Bonnet": 986, "Flutter Mane": 987,
  "Slither Wing": 988, "Sandy Shocks": 989, "Iron Treads": 990, "Iron Bundle": 991,
  "Iron Hands": 992, "Iron Jugulis": 993, "Iron Moth": 994, "Iron Thorns": 995, "Baxcalibur": 998,
  "Gholdengo": 1000, "Wo-Chien": 1001, "Chien-Pao": 1002, "Ting-Lu": 1003, "Chi-Yu": 1004,
  "Roaring Moon": 1005, "Iron Valiant": 1006, "Koraidon": 1007, "Miraidon": 1008,
  "Walking Wake": 1009, "Iron Leaves": 1010, "Sinistcha": 1013, "Okidogi": 1014, "Munkidori": 1015,
  "Fezandipiti": 1016, "Ogerpon": 1017, "Archaludon": 1018, "Hydrapple": 1019,
  "Gouging Fire": 1020, "Raging Bolt": 1021, "Iron Boulder": 1022, "Iron Crown": 1023,
  "Terapagos": 1024, "Pecharunt": 1025,
};

/**
 * Game of Thrones cards who fight with their own hands: swords, spears, bows,
 * hammers and fists. No dragons, no Night King or the dead, no giant, no
 * disease, no wolves, and none of the people whose weapon is somebody else.
 */
const GOT_FIGHTERS = new Set<string>([
  "Jaime Lannister",
  "The Mountain",
  "Arya Stark",
  "The Hound",
  "Brienne of Tarth",
  "Jon Snow",
  "Khal Drogo",
  "Oberyn Martell",
  "Bronn",
  "Ser Barristan Selmy",
  "Ramsay Bolton",
  "Grey Worm",
  "Syrio Forel",
  "Ygritte",
  "Tormund Giantsbane",
  "Podrick Payne",
  "Euron Greyjoy",
  "Beric Dondarrion",
  "Robb Stark",
  "Eddard Stark",
  "Ser Arthur Dayne",
  "Theon Greyjoy",
  "Yara Greyjoy",
  "Jorah Mormont",
  "Stannis Baratheon",
  "Robert Baratheon",
  "Gendry",
  "Daario Naharis",
  "Daemon Targaryen",
  "Aemond Targaryen",
  "Corlys Velaryon",
  "Criston Cole",
  "Harwin Strong",
  "Cregan Stark",
]);

const dex = (e: Entry) => POKEDEX[e.n] ?? Number.POSITIVE_INFINITY;

export const PACK_FILTERS: Record<string, PackFilter[]> = {
  pokemon: [
    { id: "gen1", label: "Gen 1 only", hint: "The original 151, Bulbasaur to Mew.", keep: (e) => dex(e) <= 151 },
    { id: "gen1-4", label: "Gen 1–4", hint: "Kanto to Sinnoh, up to Arceus.", keep: (e) => dex(e) <= 493 },
  ],
  got: [
    {
      id: "fighters",
      label: "Fighters only",
      hint: "Warriors only: Arya, Brienne, Grey Worm, Arthur Dayne. No dragons, no Night King, no schemers.",
      keep: (e) => GOT_FIGHTERS.has(e.n),
      // Stannis's army, Euron's fleet and Ramsay's hounds are not the warrior.
      dropVariant: /dragon|army|fleet|hounds/i,
    },
  ],
};

/** The filters a board offers, by its preset id (any "#nonce" ignored). */
export function filtersFor(packId: string | null | undefined): PackFilter[] {
  return packId ? PACK_FILTERS[packId.split("#")[0]] ?? [] : [];
}

/**
 * The board with the chosen filters applied. Unknown ids are ignored, and a
 * board with nothing switched on comes back untouched.
 */
export function applyFilters(pack: Pack, ids: string[]): Pack {
  const on = filtersFor(pack.id).filter((f) => ids.includes(f.id));
  if (!on.length) return pack;
  const entries = pack.entries
    .filter((e) => on.every((f) => f.keep(e)))
    .map((e) => {
      const drops = on.map((f) => f.dropVariant).filter((r): r is RegExp => Boolean(r));
      if (!drops.length || !e.variants?.length) return e;
      const variants = e.variants.filter((v) => !drops.some((r) => r.test(v.v)));
      return variants.length ? { ...e, variants } : { ...e, variants: undefined };
    });
  return {
    ...pack,
    entries,
    name: `${pack.name} · ${on.map((f) => f.label).join(" · ")}`,
    filters: on.map((f) => f.id),
  };
}
