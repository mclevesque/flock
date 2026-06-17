import { Suspense } from "react";
import BlindRankPlayClient from "./BlindRankPlayClient";

export const metadata = { title: "BL!NDR4NK — Ranking" };

export default function BlindRankPlayPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Cinzel', serif", color: "#d4a942", fontSize: 18 }}>Loading…</div>
      </div>
    }>
      <BlindRankPlayClient />
    </Suspense>
  );
}
