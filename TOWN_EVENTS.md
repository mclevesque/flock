# 🏰 Kingdom of Flock — Town Events Catalog

> **Design Philosophy:** Events are brief, shared experiences that make the town feel alive and dangerous.
> They fire every ~30 minutes (25% chance per window). One event runs at a time.
> Outcomes are posted to SHARE by the Town Herald. Story adapts based on recent NPC conversations.
>
> **Adding new events:** Add an entry below, then add the `type` key to `EVENT_TYPES` in `lib/db.ts`
> and a matching handler in `app/api/town/route.ts`.

---

## 🎯 Current Active Types (implemented)
| # | Type Key | Emoji | Name | Duration |
|---|----------|-------|------|----------|
| 1 | `dragon_attack` | 🐉 | Dragon Attack | 8 min |
| 2 | `bandit_raid` | 🗡️ | Bandit Raid | 4 min |
| 3 | `merchant_visit` | 🛒 | Wandering Merchant | 8 min |
| 4 | `festival` | 🎉 | Town Festival | 10 min |

---

## 📜 Planned Events — Add When Ready

### Tier 1: Combat / Threat Events
| # | Type Key | Emoji | Name | Mechanic | NPC Reaction |
|---|----------|-------|------|----------|--------------|
| 5 | `goblin_horde` | 👺 | Goblin Horde | 12 goblins swarm town, players stomp them like whack-a-mole (click to defeat each, they respawn quickly) | Guards form a defensive line; Pip (the kid) hides behind a barrel |
| 6 | `troll_bridge` | 🧌 | Troll Under the Bridge | A troll blocks the south path demanding a toll (50 coins/player) — fight it or pay | Old Pete refuses to pay and tries to run it over |
| 7 | `skeleton_army` | 💀 | Skeleton Army | Wave defense — 3 waves, each harder. Skeletons march from the east | The Blacksmith forges emergency weapons mid-battle |
| 8 | `vampire_lord` | 🧛 | Vampire Lord at Dusk | Appears only at night (8pm–midnight game time) — drains coins instead of HP; mirrors dragons mechanics but steals gold | Bessie serves garlic bread at the inn — free HP regen |
| 9 | `sea_serpent` | 🐍 | Sea Serpent (from the fountain) | Fountain erupts, serpent emerges — players must freeze it with ice (buy ice cream → throw at serpent) | Elder Mira attempts an ancient binding ritual; fails comedically |
| 10 | `angry_bear` | 🐻 | Bear Escapes the Forest | Wandered into town, just wants honey — give it honey (buy from market) to end event peacefully OR fight it | Pip tries to pet it; Captain Aldric panics |
| 11 | `assassin_plot` | 🥷 | Assassin Targets the Queen | A shadow figure pursues Queen Aelindra — escort her safely across the map to the castle gate | Queen cracks dry jokes the whole time |
| 12 | `wyvern_eggs` | 🥚 | Wyvern Nest Discovered | Wyvern defending eggs near town center — lure it away with fish (buy from market) or fight | Lysara wants to study the eggs scientifically |
| 13 | `plague_rats` | 🐀 | Plague of Rats | Rats steal items dropped on the ground; players must place traps (buy from market) | Blacksmith complains loudly; Bessie boards up the inn |
| 14 | `shadow_cult` | 👁️ | Shadow Cult Ritual | Cultists attempt a ritual at the fountain — interrupt by standing on rune spots | The Herald refuses to report on them |
| 15 | `fire_elemental` | 🔥 | Fire Elemental in the Smithy | Blacksmith accidentally summoned it — douse with water buckets (fill at fountain, run to smithy) | Theron apologizes profusely |

### Tier 2: Social / Quirky Events
| # | Type Key | Emoji | Name | Mechanic | NPC Reaction |
|---|----------|-------|------|----------|--------------|
| 16 | `royal_parade` | 👑 | Royal Parade | Stand along the route and wave (proximity to path = coins earned); miss it = miss out | Herald narrates the entire thing pompously |
| 17 | `cooking_contest` | 🍳 | Town Cooking Contest | Players submit best item (vote using coins); top voter wins 2× their coins back | Bessie is a judge; strongly biased toward anything from her inn |
| 18 | `lost_wizard` | 🧙 | Lost Wizard | Confused wizard teleports randomly around town, needs escort back to the tower | Lysara is extremely embarrassed; this is her mentor |
| 19 | `puppet_show` | 🎭 | Puppet Show | A traveling troupe performs; watch for 3 minutes = +30 XP; heckling (typing during) = +50 XP | Pip is thrilled; Captain Aldric finds it undignified |
| 20 | `pie_competition` | 🥧 | Pie-Eating Competition | Click rapidly to eat pies; most pies eaten = crown + 200 coins | Bessie hosts; everyone else regrets entering |
| 21 | `treasure_hunt` | 🗺️ | Herald's Treasure Hunt | Herald posts clues in chat; players follow them to buried gold on the map | All NPCs pretend not to know where it is |
| 22 | `talent_show` | 🎤 | Town Talent Show | Players type their best joke/poem in chat; most 😂 reactions wins | Pip does magic tricks that don't work |
| 23 | `rumor_mill` | 📰 | Rumor Mill | A false rumor spreads; players must find the source (talk to NPCs) and correct it | Herald publishes correction but gets details wrong |
| 24 | `wedding` | 💒 | NPC Wedding | Two NPCs get married; players attend and throw rice (throw fun items) | Dramatic revelation that the Innkeeper and Blacksmith have been feuding over this |
| 25 | `art_auction` | 🖼️ | Royal Art Auction | Bid on mystery items using coins; could be trash or legendary | Queen pretends everything is priceless |

### Tier 3: Weather / Environmental Events
| # | Type Key | Emoji | Name | Mechanic | Notes |
|---|----------|-------|------|----------|-------|
| 26 | `blizzard` | ❄️ | Blizzard | Movement slowed 50%; build a snowman (stand still 10s) = snowman trophy item | Warm drinks sold at inn for HP regen |
| 27 | `heat_wave` | ☀️ | Heat Wave | Ice cream shop sells out instantly; Shaved Ice becomes legendary rarity | Ice cream vendor panics, raises prices |
| 28 | `thunderstorm` | ⛈️ | Thunderstorm | Lightning strikes random spots on map (avoid them); standing near fountain during storm = +XP | Everyone shelters except Captain Aldric |
| 29 | `fog_of_war` | 🌫️ | Magic Fog | Visibility limited to 200px radius; players can only see nearby players | NPCs keep bumping into each other |
| 30 | `meteor_shower` | ☄️ | Meteor Shower | Meteorites fall on the map; dodge them OR mine them for ore (click) → crafting material | Lysara predicts exactly where each one lands |
| 31 | `earthquake` | 🌍 | Tremor | Map tiles shake; cracks appear revealing hidden gold caches | Elder Mira warns this is a bad omen |
| 32 | `rainbow` | 🌈 | Magic Rainbow | Follow the rainbow to its end (moves every 30s) = pot of gold (250 coins) | Multiple rainbows = confusion and arguing |
| 33 | `pollen_storm` | 🌸 | Cherry Blossom Storm | Town covered in petals; collect them (walk over) for crafting a special bouquet item | Allergic NPCs sneeze into chat |

### Tier 4: Mysterious / Supernatural Events
| # | Type Key | Emoji | Name | Mechanic | Story Tie-in |
|---|----------|-------|------|----------|--------------|
| 34 | `cursed_fountain` | 🔮 | Fountain Curse | Fountain turns black; coins drain 5/min until curse is broken (interact with it 10 times, cooperatively) | Malachar connection (main villain) |
| 35 | `ghost_invasion` | 👻 | Haunting | Ghosts appear on the map; walking through them triggers random effects (teleport, flip controls, laugh emote) | Graveyard glows ominously |
| 36 | `mirror_world` | 🪞 | Mirror World Rift | A rift opens; entering it switches your avatar to a shadowy version for 5 minutes (different color, spooky) | Lysara warns not to look directly at your reflection |
| 37 | `time_loop` | ⏰ | Time Loop | Town clock goes backward; players' positions reset to where they were 30s ago every 10s | NPCs repeat the same line of dialogue on loop; aware something is wrong |
| 38 | `prophecy` | 📜 | Ancient Prophecy Fulfilled | Herald reads a prophecy; first player to complete the described action wins a legendary item | The prophecy is always vague and somewhat embarrassing |
| 39 | `malachar_scout` | 🦅 | Malachar's Scout | A dark bird spies on town; shoot it down (throw items at it, proximity click) before it escapes | Queen Aelindra looks worried. Storyline advances. |
| 40 | `wish_well` | 💫 | Wishing Well Appears | Toss 50 coins in → random outcome: double coins back / legendary item / frog hex / brain freeze | Pip wishes for a puppy every time |

### Tier 5: Economy / Market Events
| # | Type Key | Emoji | Name | Mechanic | Notes |
|---|----------|-------|------|----------|-------|
| 41 | `black_market` | 🕶️ | Black Market | Shady vendor sells items at 70% discount but items are cursed (random negative effect) | Captain Aldric shuts it down after 3 min |
| 42 | `tax_collector` | 📋 | Royal Tax Collector | Collector takes 10% of coins from each player; fight him to get it back (combat event) | Queen Aelindra is mortified; "I did NOT authorize this" |
| 43 | `coin_shower` | 🪙 | Lucky Coin Rain | Coins appear on the ground randomly; walk over to collect (competitive) | Herald announces total collected in SHARE |
| 44 | `inflation` | 📈 | Market Inflation | All prices triple for 5 minutes; vendor complains loudly | Bessie secretly hoards stock |
| 45 | `grand_sale` | 🏷️ | Grand Sale | All shop items 80% off for 3 minutes | Stampede to all NPC shops |
| 46 | `heist` | 🎩 | Town Treasury Heist | A thief attempts to rob the treasury; catch them (proximity tag mechanic) for reward | Captain Aldric utterly failing at pursuit |
| 47 | `gambling_table` | 🎲 | Gambling Table | Bet coins on dice roll; small chance of 10× return | Elder Mira heavily disapproves |
| 48 | `shipment_arrival` | 📦 | Rare Shipment | Merchant arrives with 1 legendary item for auction (top bidder wins) | Harold the Merchant appears |

### Tier 6: Mini-Game Events
| # | Type Key | Emoji | Name | Mechanic | Reward |
|---|----------|-------|------|----------|--------|
| 49 | `race` | 🏃 | Town Race | Sprint from south gate to north gate and back; first to finish wins | Trophy item + 300 coins |
| 50 | `hide_and_seek` | 🙈 | Hide and Seek | One player is chosen as seeker; others have 30s to hide behind buildings | 100 coins for surviving seekers |
| 51 | `snowball_fight` | ❄️ | Snowball Fight | Two teams; throw snowballs (tap button when near enemy); most hits wins | Fun item: ❄️ Snowball |
| 52 | `duck_duck_goose` | 🦆 | Duck Duck Dragon | Giant dragon variant of duck-duck-goose using the town layout | Dragon stomps on "goose" |
| 53 | `tower_defense` | 🏰 | Castle Defense | Monsters march toward castle in waves; players block path | XP per wave survived |
| 54 | `fishing` | 🎣 | Fishing in the Fountain | Cast (button), wait (random 2–10s), reel (button) = fish item | Fish can be sold or given to the bear event |
| 55 | `archery` | 🎯 | Archery Contest | Targets appear on map; click them quickly for points | Bow item + accuracy badge |

### Tier 7: Storyline-Driven Events (advances main plot)
| # | Type Key | Emoji | Name | Trigger Condition | Story Impact |
|---|----------|-------|------|-------------------|--------------|
| 56 | `malachar_attack` | 💀 | Malachar's Army | Triggered by story reaching chapter 5+ | Major boss fight; multiple phases |
| 57 | `queen_kidnapped` | 👑 | Queen Taken! | After Malachar scout event x3 | Escort mission to rescue her |
| 58 | `dark_eclipse` | 🌑 | The Dark Eclipse | Story chapter 8 | All monsters have 2× HP; 2× loot |
| 59 | `hero_ceremony` | 🎖️ | Hero Recognition Ceremony | After defeating Malachar's army | All players get title badges |
| 60 | `peace_treaty` | 🕊️ | Peace Treaty | Story resolution | Festival + double XP for 1 day |

### Tier 8: Seasonal / Special Events
| # | Type Key | Emoji | Name | Season | Special |
|---|----------|-------|------|--------|---------|
| 61 | `harvest_festival` | 🎃 | Harvest Festival | October | Pumpkin items; ghost NPCs |
| 62 | `winter_solstice` | 🎄 | Winter Solstice | December | Gift exchange mechanic |
| 63 | `spring_bloom` | 🌸 | Spring Bloom | March | Flower items everywhere; no combat |
| 64 | `summer_games` | ☀️ | Summer Games | July | All mini-game events 2× chance |
| 65 | `flock_anniversary` | 🎂 | Flock Birthday | App anniversary | Everyone gets legendary birthday cake item |

---

## 🎲 Event Weights & Balance

```typescript
// Suggested distribution when randomly selecting (adjust over time)
const EVENT_POOL = [
  // Combat (35% of events)
  { type: "dragon_attack", weight: 8 },
  { type: "goblin_horde",  weight: 10 },
  { type: "bandit_raid",   weight: 10 },
  { type: "skeleton_army", weight: 7 },
  // Social/Fun (30%)
  { type: "festival",      weight: 12 },
  { type: "merchant_visit",weight: 10 },
  { type: "cooking_contest",weight: 8 },
  // Environmental (20%)
  { type: "thunderstorm",  weight: 10 },
  { type: "blizzard",      weight: 5 },
  { type: "meteor_shower", weight: 5 },
  // Mysterious (15%)
  { type: "ghost_invasion",weight: 8 },
  { type: "cursed_fountain",weight: 7 },
];
```

---

## 📝 NPC Roles by Event Type

| NPC | Combat Events | Social Events | Weather Events |
|-----|--------------|---------------|----------------|
| Capt. Aldric ⚔️ | Leads defense, sword attacks | Keeps order | "Just a drizzle, soldiers don't flinch" |
| Bessie 🍺 | Hands out healing ale | Hosts parties | Boards up the inn |
| Theron 🔨 | Forges weapons mid-battle | Judges crafting | "Good weather for the forge" |
| Elder Mira 👵 | Ancient spells (mostly fail) | Tells lore | Predicts weather but usually wrong |
| Pip 👦 | Cheers from a safe distance | Causes minor chaos | Jumps in every puddle |
| Lysara 🪄 | Actual powerful spells | Studies phenomena | "Meteorologically fascinating" |
| Queen Aelindra 👑 | "I could fight but won't" | Royal ceremonies | Complains about her hair |
| Reginald 📯 | Narrates dramatically, no fighting | Announces everything | Reports weather inaccurately |
| Marcus (Ice Cream) 🍦 | Throws ice cream at enemies | Sells discounted treats | Brain freezes from his own products |
| Old Pete (Carriage) 🐴 | Horse charges at threats | Offers rides | Horse is terrified of lightning |

---

## 🔧 Implementation Notes

### Adding a new event:
1. Add entry to `EVENT_TYPES` array in `lib/db.ts`
2. Add initial state to `EVENT_INITIAL_STATE` in `lib/db.ts`
3. Add duration to `EVENT_DURATIONS` in `lib/db.ts`
4. Add handler in `event-action` block in `app/api/town/route.ts`
5. Add visual (Phaser sprite) and HUD row in `app/town/TownClient.tsx`
6. Update this document with outcome text template

### Storyline adaptation:
Events tagged with "Storyline-Driven" should check the current chapter in `town_storyline` table before triggering. The Herald's daily Groq call can reference recent events and advance the plot accordingly.

### NPC attack flavors (for combat events):
```typescript
// Reusable NPC attack text by event type
const NPC_ATTACK_FLAVOR = {
  dragon_attack: {
    "guard_captain": ["⚔️ Aldric drives his blade into the dragon's flank!", "⚔️ 'For the Kingdom!' Aldric charges!"],
    "ice_cream":     ["🍦 Marcus scores a direct hit! Brain freeze works on dragons too?", "🍦 Rocky Road to the snout!"],
    "carriage":      ["🐴 Old Pete charges full speed into the dragon!", "🐴 Horse and dragon, face to face. Horse wins."],
  },
  goblin_horde: {
    "guard_captain": ["⚔️ Aldric cuts through three goblins at once!", "⚔️ 'Back to your holes, you gremlins!'"],
    "ice_cream":     ["🍦 Ice cream to the face! The goblin chief retreats!", "🍦 Soft serve = effective distraction"],
  },
};
```
