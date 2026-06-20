import { getBlindRankSession, getBlindRankResults } from "@/lib/db";
import BlindRankResultsClient from "./BlindRankResultsClient";

export const dynamic = "force-dynamic";

export default async function BlindRankResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const timeout = (promise: Promise<any>, ms: number) =>
    Promise.race([promise, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);

  const [session, results] = await Promise.all([
    timeout(getBlindRankSession(id).catch(() => null), 5000).catch(() => null),
    timeout(getBlindRankResults(id).catch(() => []), 5000).catch(() => []),
  ]);

  // Session doesn't exist yet (no one has submitted) — show waiting state
  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8dcc8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "sans-serif", padding: 24 }}>
        <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 900, letterSpacing: "0.1em", background: "linear-gradient(135deg,#d4a942,#fff,#d4a942)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
          BL!NDR4NK
        </h1>
        <p style={{ color: "#a89878", fontSize: 16, margin: 0, textAlign: "center" }}>Waiting for the first ranking…</p>
        <p style={{ color: "#333", fontSize: 13, margin: 0, textAlign: "center" }}>This page will update automatically once someone submits.</p>
        <a href="/blindrank" style={{ color: "#d4a942", fontSize: 14, marginTop: 8 }}>Create your own →</a>
      </div>
    );
  }

  return (
    <BlindRankResultsClient
      sessionId={id}
      topic={session.topic}
      items={session.items}
      createdBy={session.createdBy}
      initialResults={results}
    />
  );
}
