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
  zone?: string; // "town" | "neighborhood"
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

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Send current state snapshot to new connection
    conn.send(JSON.stringify({ type: "snapshot", state: this.state }));
  }

  onMessage(msg: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(msg);

      if (data.type === "player-update") {
        const player: Player = { id: sender.id, ...data.player };
        this.state.players[sender.id] = player;
        // Broadcast update to everyone else
        this.room.broadcast(
          JSON.stringify({ type: "player-update", player }),
          [sender.id]
        );
      } else if (data.type === "player-leave") {
        delete this.state.players[sender.id];
        this.room.broadcast(
          JSON.stringify({ type: "player-leave", id: sender.id }),
          [sender.id]
        );
      } else if (data.type === "chat") {
        this.room.broadcast(
          JSON.stringify({ type: "chat", ...data }),
          []
        );
      } else if (
        data.type === "rps_update" ||
        data.type === "adventure_end" ||
        data.type === "party_update"
      ) {
        // Pass-through: broadcast ephemeral game/party state to all other players
        this.room.broadcast(JSON.stringify(data), [sender.id]);
      }
    } catch {
      // ignore malformed messages
    }
  }

  onClose(conn: Party.Connection) {
    delete this.state.players[conn.id];
    this.room.broadcast(
      JSON.stringify({ type: "player-leave", id: conn.id })
    );
  }

  onError(conn: Party.Connection) {
    delete this.state.players[conn.id];
    this.room.broadcast(
      JSON.stringify({ type: "player-leave", id: conn.id })
    );
  }
}
