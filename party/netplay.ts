import type * as Party from "partykit/server";

/**
 * Netplay party — two-player SNES netplay signaling + state sync.
 *
 * Room ID = `netplay-${emulatorRoomId}`
 *
 * Handles:
 *  - WebRTC signaling relay (offer / answer / ICE)
 *  - State sync (host → guest save state for desync recovery)
 *  - Disconnect events (peer left = concede → auto-show result modal)
 *  - Ping/pong for latency display
 */
export default class NetplayParty implements Party.Server {
  private peers = new Map<string, { conn: Party.Connection; role: "host" | "join"; userId: string }>();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Immediately tell new connector how many peers are present
    conn.send(JSON.stringify({ type: "np-peer-count", count: this.peers.size }));
  }

  onMessage(msg: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(msg) as Record<string, unknown>;

      // ── Register peer ──────────────────────────────────────────────────────
      if (data.type === "np-join") {
        this.peers.set(sender.id, {
          conn: sender,
          role: data.role as "host" | "join",
          userId: data.userId as string,
        });
        // Tell both sides how many players are in the room
        this.room.broadcast(JSON.stringify({ type: "np-peer-count", count: this.peers.size }));
        return;
      }

      // ── Ping/pong — echo back to sender ───────────────────────────────────
      if (data.type === "np-ping") {
        sender.send(JSON.stringify({ type: "np-pong", t: data.t }));
        return;
      }

      // ── Relay everything else to the OTHER peer ────────────────────────────
      // This covers: np-offer, np-answer, np-ice, np-state, np-input, etc.
      for (const [id, peer] of this.peers) {
        if (id !== sender.id) {
          peer.conn.send(msg);
        }
      }
    } catch { /* ignore malformed */ }
  }

  onClose(conn: Party.Connection) {
    const peer = this.peers.get(conn.id);
    this.peers.delete(conn.id);
    if (peer) {
      this.room.broadcast(
        JSON.stringify({ type: "np-disconnect", userId: peer.userId, role: peer.role }),
      );
    }
  }
}
