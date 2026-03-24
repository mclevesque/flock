"use client";
import { useEffect, useRef, useState } from "react";

interface Story {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  expires_at: string;
  views: number;
}

interface Props {
  stories: Story[];
  startIndex: number;
  onClose: () => void;
  currentUserId?: string;
  onDelete?: (storyId: string) => void;
}

export default function StoryViewer({ stories, startIndex, onClose, currentUserId, onDelete }: Props) {
  const [idx, setIdx] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const story = stories[idx];

  useEffect(() => {
    if (!story) { onClose(); return; }
    setProgress(0);
    // Mark as viewed
    fetch(`/api/stories/${story.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view" }) }).catch(() => {});
  }, [idx, story, onClose]);

  useEffect(() => {
    if (!story) return;
    const dur = (story.duration_seconds || 10) * 1000;
    const start = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / dur) * 100);
      setProgress(pct);
      if (pct >= 100) next();
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, story]);

  function next() {
    if (idx < stories.length - 1) setIdx(i => i + 1);
    else onClose();
  }
  function prev() { if (idx > 0) setIdx(i => i - 1); }

  async function deleteStory() {
    if (!story) return;
    await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
    onDelete?.(story.id);
    next();
  }

  if (!story) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 20000, background: "#000", display: "flex", flexDirection: "column" }} onClick={next}>
      {/* Progress bars */}
      <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 4, zIndex: 10 }}>
        {stories.map((s, i) => (
          <div key={s.id} style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.3)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#fff", borderRadius: 2, width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ position: "absolute", top: 22, left: 16, right: 16, display: "flex", alignItems: "center", gap: 10, zIndex: 10 }} onClick={e => e.stopPropagation()}>
        <img src={story.avatar_url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${story.username}`} alt={story.username} style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #fff", objectFit: "cover" }} />
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>@{story.username}</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "monospace" }}>
            {Math.round((new Date(story.expires_at).getTime() - Date.now()) / 3600000)}h left
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {currentUserId === story.user_id && (
            <button onClick={deleteStory} style={{ background: "rgba(255,0,0,0.3)", border: "none", color: "#fff", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>Delete</button>
          )}
          <button onClick={onClose} style={{ background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>&#x2715;</button>
        </div>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        key={story.id}
        src={story.video_url}
        autoPlay
        playsInline
        muted={false}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />

      {/* Tap zones */}
      <div style={{ position: "absolute", top: 70, bottom: 0, left: 0, width: "40%", zIndex: 5 }} onClick={e => { e.stopPropagation(); prev(); }} />
      <div style={{ position: "absolute", top: 70, bottom: 0, right: 0, width: "40%", zIndex: 5 }} onClick={e => { e.stopPropagation(); next(); }} />
    </div>
  );
}
