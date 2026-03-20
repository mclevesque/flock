/**
 * party/theater.ts — Flock Theater PartyKit Server
 *
 * Replaces the 3-second DB poll in StremioLobby and TownClient.
 * Each "room" maps to a theater party ID (e.g. "stremio-main" or a town partyId).
 *
 * Flow:
 *  1. Client connects → server sends current state immediately
 *  2. Client sends an action → server updates state + broadcasts to all clients
 *  3. DB write still happens via the existing Next.js API routes (keeps persistence)
 *
 * Message types (client → server):
 *  { type: "state-update", state: TheaterState }   — host pushing new state
 *  { type: "chat", message: ChatMessage }           — new chat message
 *  { type: "subscribe" }                            — request full state snapshot
 *
 * Message types (server → client):
 *  { type: "state", state: TheaterState }           — full state snapshot
 *  { type: "chat", messages: ChatMessage[] }        — updated chat list
 *  { type: "state-patch", patch: Partial<TheaterState> } — incremental update
 */

import type * as Party from "partykit/server";

interface TheaterState {
  videoUrl: string | null;
  startedAt: number | null;
  hostId: string | null;
  seats: Record<string, { userId: string; username: string }>;
  isPaused: boolean;
  pausedAt: number | null;
  jukeboxUrl: string | null;
  jukeboxStartedAt: number | null;
  jukeboxBy: string | null;
}

interface ChatMessage {
  userId: string;
  username: string;
  avatarUrl: string;
  message: string;
  createdAt: number;
}

const DEFAULT_STATE: TheaterState = {
  videoUrl: null,
  startedAt: null,
  hostId: null,
  seats: {},
  isPaused: false,
  pausedAt: null,
  jukeboxUrl: null,
  jukeboxStartedAt: null,
  jukeboxBy: null,
};

// Keep the last 50 chat messages in memory
const MAX_CHAT = 50;

export default class TheaterServer implements Party.Server {
  private state: TheaterState = { ...DEFAULT_STATE };
  private chat: ChatMessage[] = [];

  constructor(readonly room: Party.Room) {}

  /** New connection — send current state immediately */
  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({
      type: "state",
      state: this.state,
      chat: this.chat,
    }));
  }

  /** Message from a client */
  onMessage(message: string, sender: Party.Connection) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(message) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (msg.type) {
      case "subscribe": {
        // Resend full state to this connection
        sender.send(JSON.stringify({
          type: "state",
          state: this.state,
          chat: this.chat,
        }));
        break;
      }

      case "state-update": {
        // Host is pushing a new full state — broadcast to everyone
        const newState = msg.state as Partial<TheaterState>;
        this.state = { ...this.state, ...newState };
        this.room.broadcast(JSON.stringify({
          type: "state",
          state: this.state,
          chat: this.chat,
        }));
        break;
      }

      case "state-patch": {
        // Incremental update (e.g. just pause, just seek)
        const patch = msg.patch as Partial<TheaterState>;
        this.state = { ...this.state, ...patch };
        this.room.broadcast(JSON.stringify({
          type: "state-patch",
          patch,
        }));
        break;
      }

      case "chat": {
        const chatMsg = msg.message as ChatMessage;
        if (!chatMsg?.message || !chatMsg?.userId) break;
        chatMsg.createdAt = chatMsg.createdAt ?? Date.now();
        this.chat.push(chatMsg);
        if (this.chat.length > MAX_CHAT) this.chat = this.chat.slice(-MAX_CHAT);
        this.room.broadcast(JSON.stringify({
          type: "chat",
          messages: this.chat,
        }));
        break;
      }

      case "seat-update": {
        // Someone sat down or stood up
        const { seatKey, seatData } = msg as { seatKey: string; seatData: { userId: string; username: string } | null };
        if (!seatKey) break;
        if (seatData) {
          this.state.seats[seatKey] = seatData;
        } else {
          delete this.state.seats[seatKey];
        }
        this.room.broadcast(JSON.stringify({
          type: "state-patch",
          patch: { seats: this.state.seats },
        }));
        break;
      }

      case "clear": {
        this.state = { ...DEFAULT_STATE };
        this.room.broadcast(JSON.stringify({
          type: "state",
          state: this.state,
          chat: this.chat,
        }));
        break;
      }
    }
  }
}

TheaterServer satisfies Party.Worker;
