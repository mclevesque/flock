"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Props {
  userId: string;
  username: string;
  avatarUrl: string;
}

function TightropeFrame({ userId, username, avatarUrl }: Props) {
  const searchParams = useSearchParams();
  const partyId = searchParams.get("partyId") ?? "";

  const params = new URLSearchParams({
    userId,
    username,
    avatar: avatarUrl,
    ...(partyId ? { partyId, partyHost: "https://flock.partykit.dev" } : {}),
  });

  const src = `/games/tightrope/index.html?${params.toString()}`;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#000",
      display: "flex",
      flexDirection: "column",
      zIndex: 1001,
    }}>
      <iframe
        src={src}
        style={{
          width: "100%",
          flex: 1,
          border: "none",
          display: "block",
        }}
        allow="autoplay"
        title="Tightrope Terror"
      />
    </div>
  );
}

export default function TightropeClient(props: Props) {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a1a", color: "#ff6644", fontFamily: "monospace", fontSize: 18 }}>
        Loading Tightrope Terror…
      </div>
    }>
      <TightropeFrame {...props} />
    </Suspense>
  );
}
