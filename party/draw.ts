/**
 * party/draw.ts — Flock Draw Room PartyKit Server
 *
 * Replaces the 5-second canvas snapshot poll with real-time stroke streaming.
 *
 * Architecture:
 *  - Host draws → sends strokes to PartyKit → server broadcasts to all viewers instantly
 *  - Collaborators also send strokes directly
 *  - Canvas snapshot (JPEG data URL) stored in-memory for late joiners
 *  - DB snapshot save still happens via /api/draw-room/[id] (persistence layer)
 *
 * Message types (client → server):
 *  { type: "stroke",   data: StrokeData }    — single stroke or stroke segment
 *  { type: "snapshot", data: string }        — full canvas JPEG data URL (on stroke end)
 *  { type: "clear" }                         — clear canvas
 *  { type: "join",     userId, username, avatarUrl, isHost?, isCollaborator? }
 *  { type: "leave",    userId }
 *  { type: "chat",     userId, username, avatarUrl, content }
 *  { type: "fill",     x, y, color, opacity } — flood fill event
 *  { type: "subscribe" }                     — request snapshot + viewer list + chat
 *
 * Message types (server → client):
 *  { type: "stroke",   data: StrokeData }
 *  { type: "fill",     x, y, color, opacity }
 *  { type: "clear" }
 *  { type: "snapshot", data: string }        — latest canvas (sent on join)
 *  { type: "viewers",  viewers: Viewer[] }
 *  { type: "chat",     messages: ChatMessage[] }
 */

import type * as Party from "partykit/server";

interface Viewer {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isHost: boolean;
  isCollaborator: boolean;
  connId: string;
}

interface ChatMessage {
  userId: string;
  username: string;
  avatarUrl: string | null;
  content: string;
  createdAt: number;
}

interface StrokeData {
  tool: string;
  color: string;
  size: number;
  opacity: number;
  points: { x: number; y: number }[];
  symmetry?: "none" | "h" | "v";
  // For shapes
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

const MAX_CHAT = 100;
const MAX_STROKE_BUFFER = 200; // keep last N strokes for late joiners

export default class DrawServer implements Party.Server {
  private snapshot: string | null = null;       // latest canvas JPEG
  private viewers = new Map<string, Viewer>();  // connId → Viewer
  private chat: ChatMessage[] = [];
  private strokeBuffer: StrokeData[] = [];      // recent strokes for late joiners

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Send current state to new connection immediately
    this.sendState(conn);
  }

  onClose(conn: Party.Connection) {
    const viewer = this.viewers.get(conn.id);
    this.viewers.delete(conn.id);
    if (viewer) {
      this.broadcastViewers();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(message) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (msg.type) {
      case "subscribe": {
        this.sendState(sender);
        break;
      }

      case "join": {
        this.viewers.set(sender.id, {
          userId:         msg.userId as string,
          username:       msg.username as string,
          avatarUrl:      (msg.avatarUrl as string | null) ?? null,
          isHost:         !!(msg.isHost),
          isCollaborator: !!(msg.isCollaborator),
          connId:         sender.id,
        });
        this.broadcastViewers();
        break;
      }

      case "leave": {
        this.viewers.delete(sender.id);
        this.broadcastViewers();
        break;
      }

      case "stroke": {
        const stroke = msg.data as StrokeData;
        if (!stroke) break;

        // Buffer for late joiners (keep last N strokes since last snapshot)
        this.strokeBuffer.push(stroke);
        if (this.strokeBuffer.length > MAX_STROKE_BUFFER) {
          this.strokeBuffer.shift();
        }

        // Broadcast to all OTHER clients instantly
        this.room.broadcast(JSON.stringify({ type: "stroke", data: stroke }), [sender.id]);
        break;
      }

      case "fill": {
        // Flood fill — broadcast coords + color
        this.room.broadcast(JSON.stringify({
          type: "fill",
          x: msg.x, y: msg.y,
          color: msg.color,
          opacity: msg.opacity,
        }), [sender.id]);
        break;
      }

      case "clear": {
        this.snapshot = null;
        this.strokeBuffer = [];
        this.room.broadcast(JSON.stringify({ type: "clear" }), [sender.id]);
        break;
      }

      case "snapshot": {
        // Host/collaborator sends snapshot after a stroke batch — store + broadcast to viewers
        const data = msg.data as string;
        if (!data) break;
        this.snapshot = data;
        this.strokeBuffer = []; // strokes now baked into snapshot

        // Broadcast only to non-drawing viewers (collaborators draw locally)
        const viewerConnIds = [...this.viewers.values()]
          .filter(v => !v.isHost && !v.isCollaborator)
          .map(v => v.connId);

        for (const connId of viewerConnIds) {
          const conn = this.room.getConnection(connId);
          if (conn) {
            conn.send(JSON.stringify({ type: "snapshot", data }));
          }
        }
        break;
      }

      case "chat": {
        const chatMsg: ChatMessage = {
          userId:    msg.userId as string,
          username:  msg.username as string,
          avatarUrl: (msg.avatarUrl as string | null) ?? null,
          content:   msg.content as string,
          createdAt: Date.now(),
        };
        this.chat.push(chatMsg);
        if (this.chat.length > MAX_CHAT) this.chat = this.chat.slice(-MAX_CHAT);
        this.room.broadcast(JSON.stringify({ type: "chat", messages: this.chat }));
        break;
      }

      case "set-collaborator": {
        // Host promotes/demotes a viewer
        const targetUserId = msg.userId as string;
        const isCollab = !!(msg.isCollaborator);
        for (const [connId, v] of this.viewers.entries()) {
          if (v.userId === targetUserId) {
            this.viewers.set(connId, { ...v, isCollaborator: isCollab });
          }
        }
        this.broadcastViewers();
        // Notify the specific connection too
        for (const [connId, v] of this.viewers.entries()) {
          if (v.userId === targetUserId) {
            const conn = this.room.getConnection(connId);
            conn?.send(JSON.stringify({ type: "collaborator-status", isCollaborator: isCollab }));
          }
        }
        break;
      }
    }
  }

  private sendState(conn: Party.Connection) {
    // Send snapshot if available, otherwise send recent strokes for reconstruction
    if (this.snapshot) {
      conn.send(JSON.stringify({ type: "snapshot", data: this.snapshot }));
    } else if (this.strokeBuffer.length > 0) {
      conn.send(JSON.stringify({ type: "replay", strokes: this.strokeBuffer }));
    }
    // Always send viewers and chat
    conn.send(JSON.stringify({ type: "viewers", viewers: [...this.viewers.values()] }));
    conn.send(JSON.stringify({ type: "chat", messages: this.chat }));
  }

  private broadcastViewers() {
    const viewerList = [...this.viewers.values()];
    this.room.broadcast(JSON.stringify({ type: "viewers", viewers: viewerList }));
  }
}

DrawServer satisfies Party.Worker;
