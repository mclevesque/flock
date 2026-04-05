import type * as Party from "partykit/server";

interface Player {
  id: string;
  username: string;
  x: number;
  y: number;
  direction: string;
  moving: boolean;
  avatar_url?: string;
  party_id?: string;
  zone?: string; // "town" | "neighborhood" | "moonhaven"
}

interface TownState {
  players: Record<string, Player>;
  npcs: Record<string, unknown>;
}

/**
 * Town party server — real-time player positions & state for the Phaser town.
 */
export default class TownParty implements Party.Server {
  private state: TownState = { players: {}, npcs: {} };
  // Maps app-level userId (DB) → PartyKit connectionId for targeted messaging
  private userConnMap = new Map<string, string>();
  private connUserMap = new Map<string, string>();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "snapshot", state: this.state }));
  }

  onMessage(msg: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(msg);

      // Accept both hyphen and underscore variants (client sends underscore)
      if (data.type === "player_update" || data.type === "player-update") {
        const player: Player = { id: sender.id, ...data.player };
        this.state.players[sender.id] = player;
        // Register userId → connId so screen-signal routing works
        const userId = data.player?.user_id as string | undefined;
        if (userId) {
          this.userConnMap.set(userId, sender.id);
          this.connUserMap.set(sender.id, userId);
        }
        this.room.broadcast(
          JSON.stringify({ type: "player_update", player }),
          [sender.id]
        );
      } else if (data.type === "player_leave" || data.type === "player-leave") {
        delete this.state.players[sender.id];
        const userId = this.connUserMap.get(sender.id);
        if (userId) { this.userConnMap.delete(userId); this.connUserMap.delete(sender.id); }
        this.room.broadcast(
          JSON.stringify({ type: "player_leave", userId: data.userId ?? userId ?? sender.id }),
          [sender.id]
        );
      } else if (data.type === "chat") {
        this.room.broadcast(JSON.stringify({ type: "chat", ...data }), []);
      } else if (data.type === "screen-signal" && data.toUser) {
        // Targeted: route by app userId, not PartyKit connId
        const targetConnId = this.userConnMap.get(data.toUser as string);
        if (targetConnId) {
          for (const conn of this.room.getConnections()) {
            if (conn.id === targetConnId) { conn.send(JSON.stringify(data)); break; }
          }
        }
      } else if (
        data.type === "screen-share-ended" ||
        data.type === "rps_update" ||
        data.type === "rps_enter" ||
        data.type === "rps_leave" ||
        data.type === "rps_start" ||
        data.type === "rps_commit" ||
        data.type === "rps_reveal" ||
        data.type === "adventure_end" ||
        data.type === "party_update" ||
        data.type === "tag_transfer" ||
        data.type === "tag_game_end" ||
        data.type === "room_host_announce" ||
        data.type === "drive_emote" ||
        data.type === "hand_grant" ||
        data.type === "hand_revoke" ||
        data.type === "kick" ||
        data.type === "jukebox_play" ||
        data.type === "jukebox_stop" ||
        data.type === "jukebox_suggest"
      ) {
        this.room.broadcast(JSON.stringify(data), [sender.id]);
      }
    } catch {
      // ignore malformed messages
    }
  }

  onClose(conn: Party.Connection) {
    delete this.state.players[conn.id];
    const userId = this.connUserMap.get(conn.id);
    if (userId) { this.userConnMap.delete(userId); this.connUserMap.delete(conn.id); }
    this.room.broadcast(JSON.stringify({ type: "player_leave", userId: userId ?? conn.id }));
  }

  onError(conn: Party.Connection) {
    delete this.state.players[conn.id];
    const userId = this.connUserMap.get(conn.id);
    if (userId) { this.userConnMap.delete(userId); this.connUserMap.delete(conn.id); }
    this.room.broadcast(JSON.stringify({ type: "player_leave", userId: userId ?? conn.id }));
  }
}
