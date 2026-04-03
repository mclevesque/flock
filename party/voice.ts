import type * as Party from "partykit/server";

interface Participant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isMuted: boolean;
}

/**
 * Voice room party server.
 *
 * Replaces DB-polling for:
 *  - Participant roster (snapshot sent on connect, diffs broadcast)
 *  - WebRTC signals (offer / answer / ICE) — targeted delivery
 *  - In-room chat — ephemeral broadcast
 *
 * Room ID = voice room ID (e.g. "moonhaven-main", dm-pair, etc.)
 * Each physical voice room gets its own party instance.
 */
export default class VoiceParty implements Party.Server {
  /** connId → { conn, participant } */
  private roster = new Map<string, { conn: Party.Connection; participant: Participant }>();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Send current roster snapshot immediately so the new joiner sees everyone
    const participants = this.getParticipants();
    conn.send(JSON.stringify({ type: "voice-snapshot", participants }));
  }

  onMessage(msg: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(msg) as Record<string, unknown>;

      // ── Join ────────────────────────────────────────────────────────────────
      if (data.type === "voice-join" && data.userId) {
        const p: Participant = {
          userId: data.userId as string,
          username: (data.username as string) ?? "User",
          avatarUrl: (data.avatarUrl as string | null) ?? null,
          isMuted: (data.isMuted as boolean) ?? false,
        };
        this.roster.set(sender.id, { conn: sender, participant: p });
        // Broadcast join to everyone else
        this.room.broadcast(
          JSON.stringify({ type: "voice-join", ...p }),
          [sender.id]
        );
      }

      // ── Mute toggle ─────────────────────────────────────────────────────────
      else if (data.type === "voice-mute" && data.userId) {
        const entry = this.roster.get(sender.id);
        if (entry) {
          entry.participant.isMuted = data.isMuted as boolean;
          this.room.broadcast(
            JSON.stringify({ type: "voice-mute", userId: entry.participant.userId, isMuted: entry.participant.isMuted }),
            [sender.id]
          );
        }
      }

      // ── Targeted WebRTC signal (offer / answer / ICE candidate) ────────────
      else if (data.type === "rtc-signal" && data.toUserId) {
        const target = this.getConnByUserId(data.toUserId as string);
        if (target) {
          target.send(JSON.stringify(data));
        }
        // If target not yet connected, signal is lost — client will retry via re-offer
      }

      // ── In-room chat ────────────────────────────────────────────────────────
      else if (data.type === "voice-chat") {
        this.room.broadcast(JSON.stringify(data), [sender.id]);
      }
    } catch { /* ignore malformed */ }
  }

  onClose(conn: Party.Connection) {
    const entry = this.roster.get(conn.id);
    this.roster.delete(conn.id);
    if (entry) {
      this.room.broadcast(
        JSON.stringify({ type: "voice-leave", userId: entry.participant.userId })
      );
    }
  }

  onError(conn: Party.Connection) {
    this.onClose(conn);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private getParticipants(): Participant[] {
    return [...this.roster.values()].map(e => e.participant);
  }

  private getConnByUserId(userId: string): Party.Connection | undefined {
    for (const { conn, participant } of this.roster.values()) {
      if (participant.userId === userId) return conn;
    }
    return undefined;
  }
}
