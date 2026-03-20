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
}

export const onFetch = (req: Request) =>
  new Response("Flock PartyKit server running", { status: 200 });
