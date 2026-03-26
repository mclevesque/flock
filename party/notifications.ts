import type * as Party from "partykit/server";

/**
 * Notifications party server — per-user rooms for push notifications.
 * Room ID = userId. API routes POST to push notifications to users.
 */
export default class NotificationsParty implements Party.Server {
  // Queue notifications when user has no active connections
  private pending: unknown[] = [];
  private readonly MAX_PENDING = 20;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Send any queued notifications
    if (this.pending.length > 0) {
      conn.send(JSON.stringify({ type: "snapshot", pending: this.pending }));
      this.pending = [];
    }
  }

  onMessage(_msg: string, _sender: Party.Connection) {
    // Clients don't send messages to this room — it's receive-only
  }

  /**
   * HTTP handler — Next.js API routes POST notifications here.
   * POST https://{host}/parties/notifications/{userId}
   */
  async onRequest(req: Party.Request) {
    if (req.method === "POST") {
      try {
        const payload = await req.json();
        const msg = JSON.stringify(payload);

        // If connections exist, broadcast immediately
        const connections = [...this.room.getConnections()];
        if (connections.length > 0) {
          this.room.broadcast(msg);
        } else {
          // Queue for when user connects
          this.pending.push(payload);
          if (this.pending.length > this.MAX_PENDING) {
            this.pending = this.pending.slice(-this.MAX_PENDING);
          }
        }

        return new Response("ok", { status: 200 });
      } catch {
        return new Response("bad request", { status: 400 });
      }
    }

    return new Response("method not allowed", { status: 405 });
  }
}
