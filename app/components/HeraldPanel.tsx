"use client";

interface StoryChapter {
  id: number;
  chapter: number;
  content: string;
  posted_at: string;
}

interface HeraldPanelProps {
  chapters: StoryChapter[];
  onClose: () => void;
}

export default function HeraldPanel({ chapters, onClose }: HeraldPanelProps) {
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#0f0e1a",
        border: "2px solid #c8a84b",
        borderRadius: 12,
        padding: 24,
        width: 480,
        maxHeight: "80vh",
        overflowY: "auto",
        color: "#e8d9a0",
        fontFamily: "'Georgia', serif",
        boxShadow: "0 0 40px rgba(200,168,75,0.3)",
      }} onClick={e => e.stopPropagation()}>
        {/* Masthead */}
        <div style={{ textAlign: "center", borderBottom: "1px solid #c8a84b", paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>📯</div>
          <div style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 2, color: "#ffd700" }}>
            THE FLOCK GAZETTE
          </div>
          <div style={{ fontSize: 10, color: "#888", letterSpacing: 1 }}>
            ROYAL CORRESPONDENT REGINALD THE HERALD • KINGDOM OF FLOCK
          </div>
        </div>

        {chapters.length === 0 ? (
          <div style={{ textAlign: "center", color: "#666", padding: 20, fontSize: 13 }}>
            The herald has not yet made any announcements. Check back later.
          </div>
        ) : (
          chapters.map((ch, idx) => (
            <div key={ch.id} style={{
              marginBottom: 20,
              paddingBottom: idx < chapters.length - 1 ? 20 : 0,
              borderBottom: idx < chapters.length - 1 ? "1px dashed #3a3a1a" : "none",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#c8a84b", fontWeight: "bold", letterSpacing: 1 }}>
                  CHAPTER {ch.chapter}
                </span>
                <span style={{ fontSize: 10, color: "#666" }}>{formatDate(ch.posted_at)}</span>
              </div>
              <p style={{ margin: 0, lineHeight: 1.7, fontSize: 13, color: "#d9c88a" }}>
                {ch.content}
              </p>
            </div>
          ))
        )}

        <div style={{ borderTop: "1px solid #c8a84b", paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <a href="/feed" style={{ color: "#c8a84b", fontSize: 11, textDecoration: "none" }}>
            📖 View all in Feed →
          </a>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid #c8a84b",
            color: "#c8a84b", padding: "4px 14px", borderRadius: 6,
            cursor: "pointer", fontFamily: "inherit", fontSize: 12,
          }}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
