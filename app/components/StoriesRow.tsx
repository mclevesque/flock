"use client";
import { useEffect, useState, useCallback } from "react";
import StoryViewer from "./StoryViewer";
import StoryRecorder from "./StoryRecorder";

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
  currentUserId: string;
  currentUsername: string;
  currentAvatarUrl?: string | null;
}

export default function StoriesRow({ currentUserId, currentUsername, currentAvatarUrl }: Props) {
  const [stories, setStories] = useState<Story[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [myStory, setMyStory] = useState<Story | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/stories").then(r => r.json()).catch(() => ({ stories: [] }));
    const all: Story[] = d.stories ?? [];
    setStories(all);
    setMyStory(all.find(s => s.user_id === currentUserId) ?? null);
  }, [currentUserId]);

  useEffect(() => { load(); }, [load]);

  function openViewer(idx: number) { setViewerStart(idx); setViewerOpen(true); }

  function handleDelete(storyId: string) {
    setStories(prev => prev.filter(s => s.id !== storyId));
    setMyStory(prev => prev?.id === storyId ? null : prev);
  }

  // Others' stories (not mine)
  const othersStories = stories.filter(s => s.user_id !== currentUserId);

  return (
    <>
      <div style={{
        display: "flex", gap: 14, padding: "12px 16px", overflowX: "auto",
        scrollbarWidth: "none", borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Your story button */}
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, cursor: "pointer" }}
          onClick={() => myStory ? openViewer(stories.findIndex(s => s.user_id === currentUserId)) : setRecorderOpen(true)}
        >
          <div style={{ position: "relative" }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%", overflow: "hidden",
              border: myStory ? "2.5px solid #7c3aed" : "2px dashed rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.05)",
            }}>
              {(myStory?.thumbnail_url || currentAvatarUrl) ? (
                <img src={myStory?.thumbnail_url ?? currentAvatarUrl ?? ""} alt="you" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 22 }}>+</div>
              )}
            </div>
            {!myStory && (
              <div style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: "50%", background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, border: "2px solid #0d0f14", color: "#fff" }}>+</div>
            )}
          </div>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "monospace", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {myStory ? "Your story" : "Add story"}
          </span>
        </div>

        {/* Others' stories */}
        {othersStories.map(s => (
          <div
            key={s.id}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, cursor: "pointer" }}
            onClick={() => openViewer(stories.findIndex(st => st.id === s.id))}
          >
            <div style={{
              width: 60, height: 60, borderRadius: "50%", overflow: "hidden",
              background: "linear-gradient(135deg,#7c3aed,#2563eb)", padding: 2,
            }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", border: "2px solid #0d0f14" }}>
                {s.thumbnail_url || s.avatar_url ? (
                  <img src={s.thumbnail_url ?? s.avatar_url ?? ""} alt={s.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: "#1a1f2e", display: "flex", alignItems: "center", justifyContent: "center", color: "#7c3aed", fontSize: 18 }}>&#9654;</div>
                )}
              </div>
            </div>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "monospace", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              @{s.username}
            </span>
          </div>
        ))}
      </div>

      {viewerOpen && (
        <StoryViewer
          stories={stories}
          startIndex={viewerStart}
          onClose={() => setViewerOpen(false)}
          currentUserId={currentUserId}
          onDelete={handleDelete}
        />
      )}
      {recorderOpen && (
        <StoryRecorder
          onClose={() => setRecorderOpen(false)}
          onUploaded={() => { setRecorderOpen(false); load(); }}
        />
      )}
    </>
  );
}
