import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  upsertTownPlayer, getActiveTownPlayers, leaveTown, setTownPlayerIt,
  buyTownItem, giveTownItem, unequipTownItem, earnTownCoins, spendTownCoins,
  getTownPlayerCoins, setTownEquippedDisplay,
  getOrCreateAdventureStats, updateAdventureStats,
  getPlayerStashAndSlots, updatePlayerStashAndSlots,
  dropItemOnGround, pickUpGroundItem, getGroundItems, cleanupExpiredGroundItems,
  setFrogHex, getActiveEvent, checkAndTriggerTownEvent, updateEventState,
  getLatestStorylines, getVendorStock,
  completeEvent, awardEventLootToAll, getRecentlyCompletedEvent,
  getTheaterState, setTheaterVideo, setTheaterSeat, clearTheaterSeat, clearTheaterAll,
  pauseTheater, unpauseTheater, seekTheater,
  addTheaterChat, getTheaterChat,
  setScreenshareOffer, setScreenshareAnswer, getScreenshareAnswer,
  setViewerOffer, getAllViewerOffers, clearViewerOffer, clearAllViewerOffers,
  setTheaterJukebox,
  setPlayerLastEffect,
} from "@/lib/db";

async function postHeraldShare(_content: string, _title: string) {
  // Post a share entry from the Herald — best-effort, fire and forget
  // sql is not available in this route; handled by db.ts internally via checkAndTriggerTownEvent
}

// GET — fetch all active players + ground items + active event
export async function GET(req: NextRequest) {
  try {
    cleanupExpiredGroundItems().catch(() => {});
    checkAndTriggerTownEvent().catch(() => {});
    const { searchParams } = new URL(req.url);
    const partyId = searchParams.get("partyId") || null;
    const [players, ground_items, active_event, recent_victory, theater_state, theater_chat] = await Promise.all([
      getActiveTownPlayers(partyId),
      getGroundItems().catch(() => []),
      getActiveEvent().catch(() => null),
      getRecentlyCompletedEvent().catch(() => null),
      getTheaterState(partyId).catch(() => null),
      getTheaterChat(partyId).catch(() => []),
    ]);
    return NextResponse.json({ players, ground_items, active_event, recent_victory, theater_state, theater_chat });
  } catch {
    return NextResponse.json({ players: [], ground_items: [], active_event: null, recent_victory: null }, { status: 200 });
  }
}

// POST — update own position (or leave or tag or shop)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string; name?: string | null; image?: string | null };

  try {
    const body = await req.json();

    if (body.action === "leave") {
      await leaveTown(u.id);
      return NextResponse.json({ ok: true });
    }

    // Tag game: set a new IT player (tagItId = null clears game)
    if (body.action === "tag") {
      await setTownPlayerIt(body.tagItId ?? null);
      return NextResponse.json({ ok: true });
    }

    // Shop: buy an item
    if (body.action === "buy") {
      const { emoji, price } = body;
      if (!emoji || price == null) return NextResponse.json({ error: "emoji and price required" }, { status: 400 });
      const result = await buyTownItem(u.id, emoji, Number(price));
      return NextResponse.json(result);
    }

    // Give equipped item to nearby player
    if (body.action === "give") {
      const { toId } = body;
      if (!toId) return NextResponse.json({ error: "toId required" }, { status: 400 });
      const result = await giveTownItem(u.id, toId);
      return NextResponse.json(result);
    }

    // Unequip item
    if (body.action === "unequip") {
      await unequipTownItem(u.id);
      return NextResponse.json({ ok: true });
    }

    // Earn coins from adventure rewards
    if (body.action === "earn") {
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return NextResponse.json({ error: "amount required" }, { status: 400 });
      const result = await earnTownCoins(u.id, amount);
      return NextResponse.json(result);
    }

    // Adventure stats
    if (body.action === "get-adventure-stats") {
      const stats = await getOrCreateAdventureStats(u.id);
      return NextResponse.json(stats);
    }

    if (body.action === "update-adventure-stats") {
      await updateAdventureStats(u.id, body.patch ?? {});
      const stats = await getOrCreateAdventureStats(u.id);
      return NextResponse.json(stats);
    }

    // ── Stash & Equipment ──────────────────────────────────────────────────────

    // Single-call load: returns coins + all adventure/inventory/stash/equipped data
    if (body.action === "load-all") {
      const [stashData, statsData, coinsData] = await Promise.all([
        getPlayerStashAndSlots(u.id),
        getOrCreateAdventureStats(u.id) as Promise<Record<string, unknown>>,
        getTownPlayerCoins(u.id).catch(() => null),
      ]);
      const coins = typeof coinsData === "number" ? coinsData : 0;
      let inventory = stashData.inventory;
      // Migration: restore any equipped items that the old system removed from inventory
      for (const equippedItem of Object.values(stashData.equipped_slots)) {
        if (equippedItem && !(inventory as { id: string }[]).find(i => i.id === (equippedItem as { id: string }).id)) {
          inventory = [...inventory, equippedItem as unknown];
        }
      }
      return NextResponse.json({
        coins,
        class: statsData.class ?? null,
        level: Number(statsData.level ?? stashData.level ?? 1),
        xp: Number(statsData.xp ?? 0),
        hp: Number(statsData.hp ?? 100),
        max_hp: Number(statsData.max_hp ?? 100),
        base_attack: Number(statsData.base_attack ?? 10),
        inventory,
        stash_items: stashData.stash_items,
        equipped_slots: stashData.equipped_slots,
      });
    }

    if (body.action === "save-all") {
      const gs = body.gameState as Record<string, unknown>;
      if (!gs) return NextResponse.json({ error: "No state" }, { status: 400 });
      // Save adventure stats
      const statsPatch: Record<string, unknown> = {};
      if (gs.class !== undefined) statsPatch.class = gs.class;
      if (gs.level !== undefined) statsPatch.level = gs.level;
      if (gs.xp !== undefined) statsPatch.xp = gs.xp;
      if (gs.hp !== undefined) statsPatch.hp = gs.hp;
      if (gs.max_hp !== undefined) statsPatch.max_hp = gs.max_hp;
      if (gs.base_attack !== undefined) statsPatch.base_attack = gs.base_attack;
      if (Array.isArray(gs.inventory)) statsPatch.inventory = gs.inventory;
      await updateAdventureStats(u.id, statsPatch);
      // Save stash/equipped
      const stashPatch: { stash_items?: unknown[]; equipped_slots?: Record<string, unknown>; inventory?: unknown[] } = {};
      if (Array.isArray(gs.stash_items)) stashPatch.stash_items = gs.stash_items;
      // Only persist equipped_slots if at least one slot is non-null — prevents a race where
      // buildSave() fires before loadStashData() completes and sends {} which would wipe DB slots.
      if (gs.equipped_slots && typeof gs.equipped_slots === "object") {
        const slots = gs.equipped_slots as Record<string, unknown>;
        if (Object.values(slots).some(v => v !== null && v !== undefined)) {
          stashPatch.equipped_slots = slots;
        }
      }
      if (Array.isArray(gs.inventory)) stashPatch.inventory = gs.inventory;
      if (Object.keys(stashPatch).length) await updatePlayerStashAndSlots(u.id, stashPatch);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "buy-fun-item") {
      const { emoji, name, price } = body;
      if (!emoji || price == null) return NextResponse.json({ error: "emoji and price required" }, { status: 400 });
      const result = await buyTownItem(u.id, emoji, Number(price));
      // The item itself is managed client-side; server just tracks coins
      return NextResponse.json(result);
    }

    if (body.action === "give-fun-item") {
      const { toUserId, item } = body;
      if (!toUserId || !item) return NextResponse.json({ error: "toUserId and item required" }, { status: 400 });
      const data = await getPlayerStashAndSlots(toUserId as string);
      const newInv = [...data.inventory, item];
      await updatePlayerStashAndSlots(toUserId as string, { inventory: newInv });
      await setPlayerLastEffect(toUserId as string, {
        type: "gift",
        emoji: (item as { emoji?: string }).emoji ?? "🎁",
        from: u.name ?? "someone",
        fromId: u.id,
        at: Date.now(),
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "get-stash") {
      const data = await getPlayerStashAndSlots(u.id);
      return NextResponse.json(data);
    }

    if (body.action === "equip-slot") {
      // Items STAY in inventory — equipped_slots just records which item is active in each slot.
      // You can only equip from backpack (inventory), not from stash.
      const { slot, itemId } = body;
      if (!["weapon", "boots", "secondary", "helm"].includes(slot)) return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
      const [data, stats] = await Promise.all([
        getPlayerStashAndSlots(u.id),
        getOrCreateAdventureStats(u.id) as Promise<Record<string, unknown>>,
      ]);

      let item: Record<string, unknown> | null = null;
      if (itemId) {
        // Only equip from inventory (backpack) — stash items must be withdrawn first
        const invItem = data.inventory.find((i: unknown) => (i as Record<string, unknown>).id === itemId);
        if (!invItem) return NextResponse.json({ error: "Item not in backpack" }, { status: 404 });
        item = invItem as Record<string, unknown>;

        // Server-side class restriction: weapons are class-specific
        if (slot === "weapon") {
          const weaponName = ((item.name as string) ?? "").toLowerCase();
          const playerClass = (stats.class as string | null) ?? null;
          const CLASS_WEAPON_KEYWORDS: Record<string, string[]> = {
            warrior: ["sword", "axe", "blade", "greatsword", "hammer", "mace", "club", "longsword", "broadsword", "cleaver", "warhammer", "halberd"],
            archer:  ["bow", "shortbow", "crossbow", "recurve", "longbow", "quiver"],
            mage:    ["staff", "wand", "tome", "orb", "grimoire", "scepter", "rod", "crystal"],
            rogue:   ["dagger", "stiletto", "knife", "shiv", "dirk", "rapier", "shank", "fang"],
          };
          const restrictedTo = Object.entries(CLASS_WEAPON_KEYWORDS).find(([, kws]) => kws.some(kw => weaponName.includes(kw)));
          if (restrictedTo && playerClass && restrictedTo[0] !== playerClass) {
            return NextResponse.json({ error: `This weapon requires the ${restrictedTo[0]} class` }, { status: 403 });
          }
        }
      }

      // Update equipped_slots only — inventory is unchanged
      const newSlots = { ...data.equipped_slots, [slot]: item ?? null };
      await updatePlayerStashAndSlots(u.id, { equipped_slots: newSlots });

      // Update town avatar display emoji from weapon slot
      if (slot === "weapon") {
        const emoji = item ? ((item.emoji as string) ?? null) : null;
        await setTownEquippedDisplay(u.id, emoji);
      }
      return NextResponse.json({ ok: true, equipped_slots: newSlots });
    }

    if (body.action === "stash-deposit") {
      // Move item from backpack → stash. Also unequip it if it was equipped.
      const { itemId } = body;
      const data = await getPlayerStashAndSlots(u.id);
      const invIdx = data.inventory.findIndex((i: unknown) => (i as Record<string, unknown>).id === itemId);
      if (invIdx < 0) return NextResponse.json({ error: "Item not in inventory" }, { status: 400 });
      if (data.stash_items.length >= 50) return NextResponse.json({ error: "Stash is full" }, { status: 400 });
      const item = data.inventory[invIdx];
      const newInventory = data.inventory.filter((_: unknown, i: number) => i !== invIdx);
      const newStash = [...data.stash_items, item];
      // Unequip if this item was equipped in any slot
      const newEquippedSlots = { ...data.equipped_slots };
      for (const slot of Object.keys(newEquippedSlots)) {
        if ((newEquippedSlots[slot] as Record<string,unknown>)?.id === itemId) newEquippedSlots[slot] = null;
      }
      await updatePlayerStashAndSlots(u.id, { inventory: newInventory, stash_items: newStash, equipped_slots: newEquippedSlots });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "stash-withdraw") {
      // Move item from stash → adventure inventory
      const { itemId } = body;
      const data = await getPlayerStashAndSlots(u.id);
      const stashIdx = data.stash_items.findIndex((i: unknown) => (i as Record<string, unknown>).id === itemId);
      if (stashIdx < 0) return NextResponse.json({ error: "Item not in stash" }, { status: 400 });
      if (data.inventory.length >= 8) return NextResponse.json({ error: "Backpack is full (8 items max)" }, { status: 400 });
      const item = data.stash_items[stashIdx];
      const newStash = data.stash_items.filter((_: unknown, i: number) => i !== stashIdx);
      const newInventory = [...data.inventory, item];
      await updatePlayerStashAndSlots(u.id, { inventory: newInventory, stash_items: newStash });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "drop-item") {
      const { itemId, x, y } = body;
      const data = await getPlayerStashAndSlots(u.id);
      // Find in stash or inventory
      let item: unknown = null;
      let newStash = data.stash_items;
      let newInventory = data.inventory;
      const stashIdx = data.stash_items.findIndex((i: unknown) => (i as Record<string, unknown>).id === itemId);
      if (stashIdx >= 0) {
        item = data.stash_items[stashIdx];
        newStash = data.stash_items.filter((_: unknown, i: number) => i !== stashIdx);
      } else {
        const invIdx = data.inventory.findIndex((i: unknown) => (i as Record<string, unknown>).id === itemId);
        if (invIdx >= 0) {
          item = data.inventory[invIdx];
          newInventory = data.inventory.filter((_: unknown, i: number) => i !== invIdx);
        }
      }
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      // Legendaries cannot be dropped
      if ((item as Record<string, unknown>).no_drop) return NextResponse.json({ error: "Legendary items cannot be dropped" }, { status: 403 });
      // Unequip if this item was equipped in any slot
      const dropEquippedSlots = { ...data.equipped_slots };
      for (const slot of Object.keys(dropEquippedSlots)) {
        if ((dropEquippedSlots[slot] as Record<string, unknown>)?.id === itemId) dropEquippedSlots[slot] = null;
      }
      await updatePlayerStashAndSlots(u.id, { stash_items: newStash, inventory: newInventory, equipped_slots: dropEquippedSlots });
      const dropped = await dropItemOnGround(item, x ?? 800, y ?? 600, u.id);
      return NextResponse.json({ ok: true, ground_item: dropped });
    }

    if (body.action === "pick-item") {
      const { groundItemId } = body;
      const item = await pickUpGroundItem(groundItemId);
      if (!item) return NextResponse.json({ error: "Item already taken" }, { status: 404 });
      const data = await getPlayerStashAndSlots(u.id);
      if (data.stash_items.length < 50) {
        await updatePlayerStashAndSlots(u.id, { stash_items: [...data.stash_items, item] });
      } else if (data.inventory.length < 8) {
        await updatePlayerStashAndSlots(u.id, { inventory: [...data.inventory, item] });
      } else {
        // Drop it back
        const i = item as Record<string, unknown>;
        await dropItemOnGround(item, Number(i.x ?? 800), Number(i.y ?? 600), "");
        return NextResponse.json({ error: "No room — stash and backpack full" }, { status: 400 });
      }
      const dest = data.stash_items.length < 50 ? "stash" : "inventory";
      return NextResponse.json({ ok: true, item, destination: dest });
    }

    if (body.action === "vendor-buy") {
      const { itemIndex } = body;
      const data = await getPlayerStashAndSlots(u.id);
      const stats = await getOrCreateAdventureStats(u.id);
      const level = Number((stats as Record<string, unknown>).level ?? 1);
      const daySeed = Math.floor(Date.now() / 86400000);
      const stock = getVendorStock(level, daySeed) as Record<string, unknown>[];
      const item = stock[itemIndex];
      if (!item) return NextResponse.json({ error: "Invalid item" }, { status: 400 });
      const price = item.price as number;
      // Check coins
      const coins = await getTownPlayerCoins(u.id);
      if (coins < price) return NextResponse.json({ error: "Not enough coins" }, { status: 400 });
      if (data.stash_items.length >= 50) return NextResponse.json({ error: "Stash is full" }, { status: 400 });
      // Deduct coins and add item to stash
      const spendResult = await spendTownCoins(u.id, price);
      if (!spendResult.ok) return NextResponse.json({ error: "Not enough coins" }, { status: 400 });
      const newStash = [...data.stash_items, { ...item, price: undefined }];
      await updatePlayerStashAndSlots(u.id, { stash_items: newStash });
      return NextResponse.json({ ok: true, item });
    }

    if (body.action === "vendor-sell") {
      const { itemId } = body;
      const data = await getPlayerStashAndSlots(u.id);
      // Find item in stash OR inventory
      let item: Record<string, unknown> | null = null;
      let newStash     = [...data.stash_items];
      let newInventory = [...data.inventory];
      const stashIdx = data.stash_items.findIndex((i: unknown) => (i as Record<string, unknown>).id === itemId);
      if (stashIdx >= 0) {
        item = data.stash_items[stashIdx] as Record<string, unknown>;
        newStash = data.stash_items.filter((_: unknown, i: number) => i !== stashIdx);
      } else {
        const invIdx = data.inventory.findIndex((i: unknown) => (i as Record<string, unknown>).id === itemId);
        if (invIdx >= 0) {
          item = data.inventory[invIdx] as Record<string, unknown>;
          newInventory = data.inventory.filter((_: unknown, i: number) => i !== invIdx);
        }
      }
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      // Legendary sell rule: only if player has ≥10 legendaries total
      if (item.no_sell) {
        const allItems = [...data.stash_items, ...data.inventory];
        const legendaryCount = allItems.filter((i: unknown) => (i as Record<string, unknown>).rarity === "legendary").length;
        if (legendaryCount < 10) return NextResponse.json({ error: "Cannot sell legendary items. Collect 10 legendaries to unlock selling one for 1b gold." }, { status: 403 });
        const legEquippedSlots = { ...data.equipped_slots };
        for (const slot of Object.keys(legEquippedSlots)) {
          if ((legEquippedSlots[slot] as Record<string, unknown>)?.id === itemId) legEquippedSlots[slot] = null;
        }
        await updatePlayerStashAndSlots(u.id, { stash_items: newStash, inventory: newInventory, equipped_slots: legEquippedSlots });
        await earnTownCoins(u.id, 1000000000);
        return NextResponse.json({ ok: true, coins_earned: "1b" });
      }
      const rarity = item.rarity as string;
      const sellPrices: Record<string, number> = { common: 50, uncommon: 100, rare: 500, epic: 10000, legendary: 1000000000 };
      const earned = sellPrices[rarity] ?? 50;
      // Unequip if this item was equipped in any slot
      const sellEquippedSlots = { ...data.equipped_slots };
      for (const slot of Object.keys(sellEquippedSlots)) {
        if ((sellEquippedSlots[slot] as Record<string, unknown>)?.id === itemId) sellEquippedSlots[slot] = null;
      }
      await updatePlayerStashAndSlots(u.id, { stash_items: newStash, inventory: newInventory, equipped_slots: sellEquippedSlots });
      await earnTownCoins(u.id, earned);
      return NextResponse.json({ ok: true, coins_earned: earned });
    }

    // ── Frog Hex ────────────────────────────────────────────────────────────────

    if (body.action === "frog-hex") {
      const { targets } = body;
      if (!Array.isArray(targets)) return NextResponse.json({ error: "targets required" }, { status: 400 });
      await setFrogHex(targets as string[], 12);
      return NextResponse.json({ ok: true });
    }

    // ── Theater (per-party) ──────────────────────────────────────────────────────
    const theaterPartyId = (body.partyId as string) || null;

    if (body.action === "theater-set-video") {
      const { videoUrl } = body;
      if (!videoUrl) return NextResponse.json({ error: "videoUrl required" }, { status: 400 });
      const coins = await getTownPlayerCoins(u.id);
      if (coins < 50) return NextResponse.json({ error: "Need 50 gold to play a video" }, { status: 400 });
      const spendResult = await spendTownCoins(u.id, 50);
      if (!spendResult.ok) return NextResponse.json({ error: "Not enough coins" }, { status: 400 });
      await setTheaterVideo(videoUrl, Date.now(), u.id, theaterPartyId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "theater-sit") {
      const { seatIdx } = body;
      if (seatIdx == null) return NextResponse.json({ error: "seatIdx required" }, { status: 400 });
      await clearTheaterSeat(u.id, theaterPartyId);
      await setTheaterSeat(Number(seatIdx), u.id, u.name ?? "Player", theaterPartyId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "theater-stand") {
      await clearTheaterSeat(u.id, theaterPartyId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "theater-clear-video") {
      await setTheaterVideo("", 0, "", theaterPartyId);
      return NextResponse.json({ ok: true });
    }

    // Hard reset: clears ALL theater state (video, seats, screenshare) — use to kick everyone and start fresh
    if (body.action === "theater-reset-all") {
      await clearTheaterAll(theaterPartyId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "theater-pause") {
      await pauseTheater(Date.now(), theaterPartyId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "theater-unpause") {
      await unpauseTheater(Date.now(), theaterPartyId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "theater-seek") {
      const { newStartedAt } = body;
      if (newStartedAt == null) return NextResponse.json({ error: "newStartedAt required" }, { status: 400 });
      await seekTheater(Number(newStartedAt), theaterPartyId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "theater-chat") {
      const { message } = body;
      if (!message || typeof message !== "string") return NextResponse.json({ error: "message required" }, { status: 400 });
      await addTheaterChat(u.id, u.name ?? "Anonymous", u.image ?? "", message.trim(), theaterPartyId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "theater-screenshare-offer") {
      const { offer } = body;
      await setScreenshareOffer(offer, theaterPartyId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "theater-screenshare-answer") {
      const { answer } = body;
      await setScreenshareAnswer(u.id, answer);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "theater-screenshare-get-answer") {
      const { viewerId } = body;
      const answer = await getScreenshareAnswer(viewerId ?? u.id);
      return NextResponse.json({ answer });
    }

    // Viewer-initiated WebRTC: viewer posts their offer for host to answer
    if (body.action === "theater-ss-viewer-offer") {
      const { offer } = body;
      if (!offer) return NextResponse.json({ error: "offer required" }, { status: 400 });
      await setViewerOffer(u.id, offer);
      return NextResponse.json({ ok: true });
    }

    // Host retrieves all viewer offers to answer them
    if (body.action === "theater-ss-get-viewer-offers") {
      const offers = await getAllViewerOffers();
      return NextResponse.json({ offers });
    }

    // Host posts an SDP answer for a specific viewer
    if (body.action === "theater-ss-host-answer") {
      const { viewerId, answer } = body;
      if (!viewerId || !answer) return NextResponse.json({ error: "viewerId and answer required" }, { status: 400 });
      await setScreenshareAnswer(viewerId, answer);
      await clearViewerOffer(viewerId); // viewer offer consumed
      return NextResponse.json({ ok: true });
    }

    // Viewer polls for host's answer to their offer
    if (body.action === "theater-ss-get-my-answer") {
      const answer = await getScreenshareAnswer(u.id);
      return NextResponse.json({ answer });
    }

    // Stop screenshare: clear all offers/answers
    if (body.action === "theater-ss-stop") {
      await setScreenshareOffer(null, theaterPartyId);
      await clearAllViewerOffers();
      return NextResponse.json({ ok: true });
    }

    // ── Jukebox ──────────────────────────────────────────────────────────────────
    if (body.action === "theater-jukebox-play") {
      const { jukeboxUrl } = body;
      if (!jukeboxUrl || typeof jukeboxUrl !== "string") return NextResponse.json({ error: "jukeboxUrl required" }, { status: 400 });
      await setTheaterJukebox(jukeboxUrl, Date.now(), u.name ?? "Someone", theaterPartyId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "theater-jukebox-stop") {
      await setTheaterJukebox(null, null, null, theaterPartyId);
      return NextResponse.json({ ok: true });
    }

    // ── Town Events ─────────────────────────────────────────────────────────────

    if (body.action === "event-action") {
      const { eventId, eventAction } = body;
      const event = await getActiveEvent();
      if (!event || event.id !== eventId) return NextResponse.json({ error: "Event not found" }, { status: 404 });
      const state = (event.state as Record<string, unknown>) ?? {};
      const eventType = event.type as string;

      if (eventType === "dragon_attack" && eventAction === "fight") {
        const playerDmg = Math.floor(Math.random() * 20) + 12; // 12-31
        const currentHp = Number(state.bossHp ?? 1500);
        const newBossHp = Math.max(0, currentHp - playerDmg);

        // NPC auto-defenders: every town NPC charges in to fight!
        const NPC_DEFENDERS = [
          { id: "guard_captain", name: "Capt. Aldric",      emoji: "⚔️", cooldown: 5000,  damage: [22, 38], attack: "heroic sword slash" },
          { id: "guard1",        name: "Town Guard",         emoji: "🛡️", cooldown: 7000,  damage: [12, 22], attack: "desperate shield bash" },
          { id: "bessie",        name: "Bessie Rosethorn",   emoji: "🍺", cooldown: 6000,  damage: [18, 32], attack: "flying ale mug barrage" },
          { id: "marcus",        name: "Marcus",             emoji: "🍦", cooldown: 8000,  damage: [10, 18], attack: "frozen soft-serve strike" },
          { id: "old_pete",      name: "Old Pete",           emoji: "🐴", cooldown: 11000, damage: [35, 55], attack: "full-gallop trampling charge" },
          { id: "elder_mira",    name: "Elder Mira",         emoji: "👵", cooldown: 9000,  damage: [28, 48], attack: "ancient walking stick whack" },
          { id: "theron",        name: "Theron Ironfist",    emoji: "🔨", cooldown: 7500,  damage: [25, 42], attack: "masterwork hammer smash" },
          { id: "pip",           name: "Pip",                emoji: "👦", cooldown: 4000,  damage: [4, 11],  attack: "rock + shoe throw" },
          { id: "lysara",        name: "Lysara Veyne",       emoji: "🪄", cooldown: 10000, damage: [40, 65], attack: "Arcane Fireball Deluxe™" },
          { id: "reginald",      name: "Reginald Herald",    emoji: "📯", cooldown: 13000, damage: [15, 28], attack: "sonic herald horn blast" },
        ];
        const npcLastAttacks = (state.npcLastAttacks as Record<string, number>) ?? {};
        const now = Date.now();
        const npcAttacks: { name: string; emoji: string; damage: number; attack: string }[] = [];
        let npcTotalDamage = 0;
        for (const npc of NPC_DEFENDERS) {
          const last = npcLastAttacks[npc.id] ?? 0;
          if (now - last >= npc.cooldown) {
            const dmg = Math.floor(Math.random() * (npc.damage[1] - npc.damage[0] + 1)) + npc.damage[0];
            npcTotalDamage += dmg;
            npcLastAttacks[npc.id] = now;
            npcAttacks.push({ name: npc.name, emoji: npc.emoji, damage: dmg, attack: npc.attack });
          }
        }
        const finalBossHp = Math.max(0, newBossHp - npcTotalDamage);

        // Dragon counter-attacks player (60% chance per swing, hits harder)
        const dragonCounters = Math.random() < 0.60;
        const dragonDmg = dragonCounters ? Math.floor(Math.random() * 25) + 18 : 0; // 18-42

        // Update participants (track damage per user)
        const participants = (state.participants as Record<string, { damage: number; name: string }>) ?? {};
        const prev = participants[u.id] ?? { damage: 0, name: u.name ?? "Hero" };
        participants[u.id] = { damage: prev.damage + playerDmg, name: u.name ?? prev.name };

        // Check victory
        if (finalBossHp <= 0 && !state.victoryProcessed) {
          const outcome = `🐉 THE DRAGON IS DEFEATED! ${Object.keys(participants).length} brave hero(es) saved the Kingdom of Flock!`;
          const lootMap = await awardEventLootToAll(participants, 5);
          const newState = { ...state, bossHp: 0, bossMaxHp: 1500, participants, npcLastAttacks, victoryProcessed: true, lootMap };
          await updateEventState(eventId, newState);
          await completeEvent(eventId, outcome);
          // Post to SHARE as Herald
          await postHeraldShare(outcome, "⚔️ Victory!").catch(() => {});
          return NextResponse.json({
            ok: true, playerDmg, bossHp: 0, npcAttacks, dragonDmg,
            victory: true, yourLoot: lootMap[u.id] ?? [], participantCount: Object.keys(participants).length,
          });
        }

        const newState = { ...state, bossHp: finalBossHp, bossMaxHp: 1500, participants, npcLastAttacks };
        await updateEventState(eventId, newState);
        return NextResponse.json({ ok: true, playerDmg, bossHp: finalBossHp, npcAttacks, dragonDmg });
      }

      if (eventType === "bandit_raid" && (eventAction === "defend" || eventAction === "fight")) {
        const playerDmg = Math.floor(Math.random() * 22) + 10; // 10-31
        const currentHp = Number(state.bossHp ?? 600);
        let newBossHp = Math.max(0, currentHp - playerDmg);

        // NPCs auto-defend: smaller but immediate damage
        const NPC_DEFENDERS = [
          { id: "guard_captain", cooldown: 5000, damage: [18, 30] },
          { id: "guard1",        cooldown: 7000, damage: [8, 16] },
          { id: "lysara",        cooldown: 10000, damage: [25, 40] },
          { id: "theron",        cooldown: 8000,  damage: [15, 28] },
        ];
        const npcLastAttacks = (state.npcLastAttacks as Record<string, number>) ?? {};
        const now = Date.now();
        let npcDmg = 0;
        for (const npc of NPC_DEFENDERS) {
          if (now - (npcLastAttacks[npc.id] ?? 0) >= npc.cooldown) {
            npcDmg += Math.floor(Math.random() * (npc.damage[1] - npc.damage[0] + 1)) + npc.damage[0];
            npcLastAttacks[npc.id] = now;
          }
        }
        newBossHp = Math.max(0, newBossHp - npcDmg);

        // Bandit counter-attack (50% chance)
        const banditCounters = Math.random() < 0.50;
        const banditDmg = banditCounters ? Math.floor(Math.random() * 20) + 8 : 0;

        const existingParticipants = (state.participants as Record<string, { damage: number; name: string }>) ?? {};
        const participants: Record<string, { damage: number; name: string }> = {
          ...existingParticipants,
          [u.id]: { damage: (existingParticipants[u.id]?.damage ?? 0) + playerDmg, name: u.name ?? "Hero" },
        };
        const defenders = new Set([...((state.defenders as string[]) ?? []), u.id]);
        const newState = { ...state, bossHp: newBossHp, bossMaxHp: state.bossMaxHp ?? 600, npcLastAttacks, participants, defenders: Array.from(defenders) };
        await updateEventState(eventId, newState);

        if (newBossHp <= 0) {
          const participants_count = Object.keys(participants).length;
          const outcome = `⚔️ THE BANDITS ARE DEFEATED! ${participants_count} hero(es) defended the Village!`;
          const lootMap = await awardEventLootToAll(participants, 5);
          const finalState = { ...newState, bossHp: 0, victoryProcessed: true, lootMap };
          await updateEventState(eventId, finalState);
          await completeEvent(eventId, outcome);
          const myLoot = (lootMap as Record<string, unknown[]>)[u.id] ?? [];
          return NextResponse.json({ ok: true, playerDmg, bossHp: 0, banditDmg, victory: true, yourLoot: myLoot, participantCount: participants_count });
        }
        return NextResponse.json({ ok: true, playerDmg, bossHp: newBossHp, banditDmg });
      }

      if (eventType === "festival") {
        await updateAdventureStats(u.id, { xp: 25 });
        return NextResponse.json({ ok: true, xp_gained: 25 });
      }

      return NextResponse.json({ ok: true });
    }

    // ── Herald / Storyline ──────────────────────────────────────────────────────

    if (body.action === "get-storyline") {
      const chapters = await getLatestStorylines(3);
      return NextResponse.json({ chapters });
    }

    // ── Get vendor stock ────────────────────────────────────────────────────────

    if (body.action === "get-vendor-stock") {
      const stats = await getOrCreateAdventureStats(u.id) as Record<string, unknown>;
      const level = Number(stats.level ?? 1);
      const daySeed = Math.floor(Date.now() / 86400000);
      const stock = getVendorStock(level, daySeed);
      const coinRows = (await getActiveTownPlayers() as Record<string, unknown>[]).find(p => p.user_id === u.id);
      const coins = Number((coinRows as Record<string, unknown> | undefined)?.coins ?? 0);
      return NextResponse.json({ stock, coins });
    }

    const { x, y, direction, chatMsg, partyId: posPartyId } = body;
    await upsertTownPlayer(u.id, u.name ?? "player", u.image ?? "", x ?? 800, y ?? 600, direction ?? "down", chatMsg ?? null, (posPartyId as string) || null);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
