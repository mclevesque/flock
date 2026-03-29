import type * as Party from "partykit/server";

/**
 * Default party server — general-purpose broadcast hub.
 * Named parties (theater, draw, town) have their own files.
 */
export default class Main implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onMessage(msg: string, sender: Party.Connection) {
    // Broadcast to all other connections in the room
    this.room.broadcast(msg, [sender.id]);
  }

  /** HTTP POST from API routes → broadcast to all connections in this room */
  async onRequest(req: Party.Request) {
    if (req.method === "POST") {
      const body = await req.text();
      this.room.broadcast(body);
      return new Response("OK", { status: 200 });
    }
    return new Response("Method not allowed", { status: 405 });
  }
}

export const onFetch = (req: Request) =>
  new Response("Ryft PartyKit server running", { status: 200 });
