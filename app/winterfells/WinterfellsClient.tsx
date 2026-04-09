"use client";
import { Suspense } from "react";

interface Props {
  userId: string;
  username: string;
  avatarUrl: string;
}

function WinterfellsFrame({ userId, username, avatarUrl }: Props) {
  const params = new URLSearchParams({
    userId,
    username,
    avatar: avatarUrl,
  });

  const src = `/games/winterfells/index.html?${params.toString()}`;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#0a0a1a",
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
        title="Winterfells"
      />
    </div>
  );
}

export default function WinterfellsClient(props: Props) {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a1a", color: "#88bbff", fontFamily: "monospace", fontSize: 18 }}>
        Loading Winterfells...
      </div>
    }>
      <WinterfellsFrame {...props} />
    </Suspense>
  );
}
