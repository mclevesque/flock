"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Props {
  userId: string;
  username: string;
  avatarUrl: string;
}

function DodgeGauntletFrame({ userId, username, avatarUrl }: Props) {
  const searchParams = useSearchParams();

  const params = new URLSearchParams({
    userId,
    username,
    avatar: avatarUrl,
  });

  const src = `/games/dodge-gauntlet/index.html?${params.toString()}`;

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
        title="Dodge Gauntlet"
      />
    </div>
  );
}

export default function DodgeGauntletClient(props: Props) {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0020", color: "#a855f7", fontFamily: "monospace", fontSize: 18 }}>
        Loading Dodge Gauntlet...
      </div>
    }>
      <DodgeGauntletFrame {...props} />
    </Suspense>
  );
}
