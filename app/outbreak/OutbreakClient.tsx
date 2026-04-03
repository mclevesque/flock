"use client";
import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import OutbreakLobby from "./OutbreakLobby";

interface Props {
  userId: string;
  username: string;
  avatarUrl: string;
}

function OutbreakFrame({ userId, username, avatarUrl }: Props) {
  const searchParams = useSearchParams();
  const initialRoom = searchParams.get("room") ?? undefined;

  const [gameRoomCode, setGameRoomCode] = useState<string | null>(null);
  const [isSolo, setIsSolo] = useState(false);

  const handlePlay = useCallback((roomCode: string) => {
    setGameRoomCode(roomCode);
  }, []);

  const handleSolo = useCallback(() => {
    setIsSolo(true);
    setGameRoomCode(null);
  }, []);

  const handleBackToLobby = useCallback(() => {
    setGameRoomCode(null);
    setIsSolo(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Show lobby if no game started
  if (!gameRoomCode && !isSolo) {
    return (
      <OutbreakLobby
        userId={userId}
        username={username}
        avatarUrl={avatarUrl}
        onPlay={handlePlay}
        onSolo={handleSolo}
        initialRoom={initialRoom}
      />
    );
  }

  // Build iframe src
  const params = new URLSearchParams({
    userId,
    username,
    avatar: avatarUrl,
    supermusic: "1",
    ...(gameRoomCode ? { partyId: gameRoomCode, partyHost: "https://flock.partykit.dev" } : {}),
  });
  const src = `/games/outbreak/index.html?${params.toString()}`;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 1001 }}>
      <iframe
        src={src}
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="autoplay"
        title="Outbreak"
      />
      {/* Back to lobby button */}
      <button
        onClick={handleBackToLobby}
        style={{
          position: "fixed", top: 12, left: 12, zIndex: 1002,
          background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 8, color: "rgba(255,255,255,0.6)", padding: "6px 12px",
          fontSize: 12, fontFamily: "monospace", cursor: "pointer",
        }}
      >
        ← Lobby
      </button>
    </div>
  );
}

export default function OutbreakClient(props: Props) {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0010", color: "#c084fc", fontFamily: "monospace", fontSize: 18 }}>
        Loading Outbreak…
      </div>
    }>
      <OutbreakFrame {...props} />
    </Suspense>
  );
}
