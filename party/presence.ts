import type * as Party from "partykit/server";

interface UserInfo {
  userId: string;
  username: string;
  avatarUrl?: string;
}

/**
 * Presence party server — tracks who's online globally.
 * Single room "global" — all users join the same room.
 * Multi-tab safe: only broadcasts user-left when LAST connection for a userId closes.
 */
export default class PresenceParty implements Party.Server {
  // connId → user info
  private connections = new Map<string, UserInfo>();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Client will send a "join" message with their info
  }

  onMessage(msg: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(msg);

      if (data.type === "join" && data.userId) {
        const info: UserInfo = {
          userId: data.userId,
          username: data.username || "Unknown",
          avatarUrl: data.avatarUrl,
        };
        this.connections.set(sender.id, info);

        // Send snapshot of all online users to the new connection
        const users = this.getUniqueUsers();
        sender.send(JSON.stringify({ type: "snapshot", users }));

        // Broadcast join to everyone else
        this.room.broadcast(
          JSON.stringify({ type: "user-joined", ...info }),
          [sender.id]
        );
      }

      if (data.type === "get-online") {
        const users = this.getUniqueUsers();
        sender.send(JSON.stringify({ type: "snapshot", users }));
      }
    } catch {
      // ignore malformed messages
    }
  }

  onClose(conn: Party.Connection) {
    const info = this.connections.get(conn.id);
    this.connections.delete(conn.id);

    if (info) {
      // Only broadcast user-left if no other connections for this userId
      const stillConnected = [...this.connections.values()].some(
        (u) => u.userId === info.userId
      );
      if (!stillConnected) {
        this.room.broadcast(
          JSON.stringify({ type: "user-left", userId: info.userId })
        );
      }
    }
  }

  onError(conn: Party.Connection) {
    this.onClose(conn);
  }

  /** Deduplicate by userId (multiple tabs = one user) */
  private getUniqueUsers(): UserInfo[] {
    const seen = new Map<string, UserInfo>();
    for (const info of this.connections.values()) {
      if (!seen.has(info.userId)) seen.set(info.userId, info);
    }
    return [...seen.values()];
  }
}
