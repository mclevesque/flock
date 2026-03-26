"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Props {
  userId: string;
  username: string;
  avatarUrl: string;
}

function WhodoneitFrame({ userId, username, avatarUrl }: Props) {
  const searchParams = useSearchParams();
  const partyId = searchParams.get("partyId") ?? "";

  const params = new URLSearchParams({
    userId,
    username,
    avatar: avatarUrl,
    ...(partyId ? { partyId, partyHost: "https://flock.partykit.dev" } : {}),
  });

  const src = `/games/whodoneit/index.html?${params.toString()}`;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#0a0008",
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
        title="WHO DONE IT? — Ryft Murder Mystery"
      />
    </div>
  );
}

export default function WhodoneitClient(props: Props) {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0008", color: "#cc0000", fontFamily: "monospace", fontSize: 18 }}>
        Loading WHO DONE IT?...
      </div>
    }>
      <WhodoneitFrame {...props} />
    </Suspense>
  );
}
