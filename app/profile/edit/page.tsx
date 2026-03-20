"use client";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { actionUpdateProfile } from "@/lib/actions";

const PRESET_SONGS = [
  { title: "Midnight Synth", artist: "SoundHelix", genre: "Synthwave", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { title: "Electric Garden", artist: "SoundHelix", genre: "Electronic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { title: "Deep Current", artist: "SoundHelix", genre: "Ambient", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { title: "City Lights", artist: "SoundHelix", genre: "Chill", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
  { title: "Pixel Rush", artist: "SoundHelix", genre: "Upbeat", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
  { title: "Void Walk", artist: "SoundHelix", genre: "Dark", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
  { title: "Neon Dreams", artist: "SoundHelix", genre: "Synth", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3" },
  { title: "Solar Wind", artist: "SoundHelix", genre: "Space", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
  { title: "Ghost Protocol", artist: "SoundHelix", genre: "Thriller", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3" },
  { title: "Drift", artist: "SoundHelix", genre: "Lofi", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3" },
  { title: "Cascade", artist: "SoundHelix", genre: "Chill", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3" },
  { title: "Frequency", artist: "SoundHelix", genre: "Electronic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3" },
  { title: "Chromatic", artist: "SoundHelix", genre: "Cinematic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3" },
  { title: "Static Field", artist: "SoundHelix", genre: "Ambient", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3" },
  { title: "Warpzone", artist: "SoundHelix", genre: "Game", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3" },
  { title: "Binary Star", artist: "SoundHelix", genre: "Space", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3" },
  { title: "End Credits", artist: "SoundHelix", genre: "Cinematic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3" },
];

const GENRE_COLORS: Record<string, string> = {
  Synthwave: "#7c5cbf", Electronic: "#4a90d9", Ambient: "#4ad990", Chill: "#5cb8b2",
  Upbeat: "#f0c040", Dark: "#b05cc0", Synth: "#9b5cbf", Space: "#4470c0",
  Thriller: "#c05c5c", Lofi: "#8a9b6e", Cinematic: "#c09060", Game: "#5cb87c",
};

function ProfileSongPicker({ currentUrl, currentTitle, currentArtist, onSelect }: {
  currentUrl: string; currentTitle: string; currentArtist: string;
  onSelect: (url: string, title: string, artist: string) => void;
}) {
  const [tab, setTab] = useState<"presets" | "ai" | "url" | "youtube">("presets");
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedUrl, setSelectedUrl] = useState(currentUrl);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiUrl, setAiUrl] = useState("");
  const [customUrl, setCustomUrl] = useState(currentUrl);
  const [customTitle, setCustomTitle] = useState(currentTitle);
  const [customArtist, setCustomArtist] = useState(currentArtist);
  const [ytUrl, setYtUrl] = useState("");
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState("");
  const [ytInfo, setYtInfo] = useState<{ title: string; artist: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function extractYTId(url: string): string | null {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m?.[1] ?? null;
  }

  async function handleYTLink() {
    const id = extractYTId(ytUrl);
    if (!id) { setYtError("Invalid YouTube URL. Paste a youtube.com or youtu.be link."); return; }
    setYtLoading(true); setYtError(""); setYtInfo(null);
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      const title = data.title ?? "YouTube Song";
      const artist = data.author_name ?? "YouTube";
      setYtInfo({ title, artist });
      setSelectedUrl(`yt:${id}`);
      onSelect(`yt:${id}`, title, artist);
    } catch {
      setYtError("Couldn't fetch video info. Make sure the video is public.");
    }
    setYtLoading(false);
  }

  function previewTrack(url: string) {
    if (previewUrl === url) {
      setPreviewUrl("");
      audioRef.current?.pause();
    } else {
      setPreviewUrl(url);
    }
  }

  function pickPreset(song: typeof PRESET_SONGS[0]) {
    setSelectedUrl(song.url);
    onSelect(song.url, song.title, song.artist);
  }

  async function handleUpload(file: File) {
    setUploadLoading(true); setUploadError("");
    const form = new FormData();
    form.append("file", file);
    // Pass old URL so server can delete it (one song at a time)
    if (currentUrl) form.append("oldUrl", currentUrl);
    const res = await fetch("/api/audio-upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok || data.error) { setUploadError(data.error ?? "Upload failed"); setUploadLoading(false); return; }
    const name = file.name.replace(/\.[^.]+$/, "");
    setSelectedUrl(data.url);
    onSelect(data.url, name, "My Upload");
    setUploadLoading(false);
  }

  async function generateAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiError(""); setAiUrl("");
    const res = await fetch("/api/generate-music", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: aiPrompt }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      setAiError(data.error ?? "Generation failed");
      setAiLoading(false); return;
    }
    setAiUrl(data.url);
    setSelectedUrl(data.url);
    onSelect(data.url, `AI: ${aiPrompt.slice(0, 40)}`, "FLOCK AI");
    setAiLoading(false);
  }

  const tabBtn = (t: typeof tab, label: string) => (
    <button type="button" onClick={() => setTab(t)} style={{
      background: tab === t ? "var(--accent-purple)" : "transparent",
      color: tab === t ? "#fff" : "var(--text-secondary)",
      border: `1px solid ${tab === t ? "var(--accent-purple)" : "var(--border)"}`,
      borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
    }}>{label}</button>
  );

  return (
    <div>
      {/* Current selection preview */}
      {selectedUrl && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "10px 12px", background: "rgba(124,92,191,0.1)", border: "1px solid rgba(124,92,191,0.3)", borderRadius: 10 }}>
          <span style={{ fontSize: 18 }}>🎵</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-purple-bright)" }}>{currentTitle || "Song selected"}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{currentArtist || "Artist"}</div>
          </div>
          {selectedUrl.startsWith("yt:") ? (
            <span style={{ fontSize: 11, color: "var(--text-muted)", background: "rgba(255,0,0,0.12)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 6, padding: "4px 10px" }}>▶ YouTube</span>
          ) : (
            <button type="button" onClick={() => previewTrack(selectedUrl)} style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {previewUrl === selectedUrl ? "⏹ Stop" : "▶ Preview"}
            </button>
          )}
        </div>
      )}

      {/* Hidden audio player — not used for YouTube */}
      {previewUrl && !previewUrl.startsWith("yt:") && (
        <audio ref={audioRef} src={previewUrl} autoPlay onEnded={() => setPreviewUrl("")} style={{ display: "none" }} />
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {tabBtn("presets", "🎼 Presets")}
        {tabBtn("ai", "✦ AI Generate")}
        {tabBtn("url", "🔗 Custom URL")}
        {tabBtn("youtube", "▶ YouTube")}
      </div>

      {/* Presets */}
      {tab === "presets" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
          {PRESET_SONGS.map(song => {
            const isSelected = selectedUrl === song.url;
            const isPreviewing = previewUrl === song.url;
            const color = GENRE_COLORS[song.genre] ?? "var(--accent-purple)";
            return (
              <div key={song.url} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: isSelected ? "rgba(124,92,191,0.15)" : "var(--bg-elevated)", border: `1px solid ${isSelected ? "rgba(124,92,191,0.5)" : "var(--border)"}`, borderRadius: 8, transition: "all 0.15s" }}>
                <button type="button" onClick={() => previewTrack(song.url)} style={{ background: isPreviewing ? "#4ad990" : "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 13 }}>
                  {isPreviewing ? "⏹" : "▶"}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{song.title}</div>
                  <span style={{ fontSize: 10, background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>{song.genre}</span>
                </div>
                <button type="button" onClick={() => pickPreset(song)} style={{ background: isSelected ? "var(--accent-purple)" : "transparent", color: isSelected ? "#fff" : "var(--text-muted)", border: `1px solid ${isSelected ? "var(--accent-purple)" : "var(--border)"}`, borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {isSelected ? "✓ Selected" : "Select"}
                </button>
              </div>
            );
          })}
        </div>
      )}


      {/* AI Generate */}
      {tab === "ai" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Describe your song and AI will generate it using Meta&apos;s open source MusicGen model. Takes ~30–60 seconds. (~15s of audio)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); generateAI(); } }}
              placeholder="e.g. lofi hip hop with rain, dark synthwave, peaceful piano..."
              style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 13px", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" }}
            />
            <button type="button" onClick={generateAI} disabled={aiLoading || !aiPrompt.trim()}
              style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: aiLoading ? "default" : "pointer", opacity: aiLoading ? 0.6 : 1, whiteSpace: "nowrap" }}>
              {aiLoading ? "Generating..." : "✦ Generate"}
            </button>
          </div>
          {aiLoading && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 12, height: 12, border: "2px solid var(--accent-purple)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Composing your track... this may take up to a minute
            </div>
          )}
          {aiError && <div style={{ fontSize: 12, color: "#f08080" }}>{aiError}</div>}
          {aiUrl && !aiLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(74,217,144,0.1)", border: "1px solid rgba(74,217,144,0.3)", borderRadius: 8 }}>
              <span style={{ fontSize: 16 }}>✦</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#4ad990" }}>Track generated and set as your profile song!</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Preview it above.</div>
              </div>
              <button type="button" onClick={() => previewTrack(aiUrl)} style={{ background: "rgba(74,217,144,0.2)", color: "#4ad990", border: "1px solid rgba(74,217,144,0.4)", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {previewUrl === aiUrl ? "⏹ Stop" : "▶ Play"}
              </button>
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            Powered by Meta MusicGen (open source). Uses the same HUGGINGFACE_TOKEN as avatar generation.
          </div>
        </div>
      )}

      {/* YouTube */}
      {tab === "youtube" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Paste any YouTube link. The audio will autoplay on your profile — the video is hidden. Ads are handled automatically.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={ytUrl}
              onChange={e => { setYtUrl(e.target.value); setYtError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleYTLink(); } }}
              placeholder="https://www.youtube.com/watch?v=..."
              style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 13px", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" }}
            />
            <button type="button" onClick={handleYTLink} disabled={ytLoading || !ytUrl.trim()}
              style={{ background: "linear-gradient(135deg, #ff0000, #cc0000)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: ytLoading ? "default" : "pointer", opacity: ytLoading ? 0.6 : 1, whiteSpace: "nowrap" }}>
              {ytLoading ? "Loading..." : "▶ Use"}
            </button>
          </div>
          {ytError && <div style={{ fontSize: 12, color: "#f08080" }}>{ytError}</div>}
          {ytInfo && !ytLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,0,0,0.08)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 8 }}>
              <span style={{ fontSize: 18 }}>▶</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#ff6060", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ytInfo.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ytInfo.artist} · YouTube</div>
              </div>
              <span style={{ fontSize: 11, color: "#4ad990", fontWeight: 700 }}>✓ Set!</span>
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            Works with youtube.com/watch, youtu.be, and Shorts links.
          </div>
        </div>
      )}

      {/* Custom URL */}
      {tab === "url" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Paste a direct link to any .mp3 file. Try archive.org for free music.</div>
          <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Song title"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 13px", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          <input value={customArtist} onChange={e => setCustomArtist(e.target.value)} placeholder="Artist name"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 13px", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          <input value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="https://example.com/song.mp3" type="url"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 13px", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          <button type="button" onClick={() => { if (customUrl) { setSelectedUrl(customUrl); onSelect(customUrl, customTitle || "Custom Song", customArtist || "Artist"); } }}
            style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Use This URL
          </button>
        </div>
      )}
    </div>
  );
}

const DICEBEAR_SEEDS = [
  "cosmic","void","neon","ghost","cipher","luna","nova","ash","rex","solar",
  "echo","zap","hex","vex","kira","mira","dex","rae","jun","pixel",
  "blade","frost","storm","ember","wave","comet","pulse","drift","spark","haze",
];

const CUSTOM_PRESETS: { url: string; label: string }[] = [];

const FAVORITES_KEY = "flock_avatar_favorites";
const MAX_FAVORITES = 20;

function loadFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]"); }
  catch { return []; }
}
function saveFavorites(list: string[]) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function AvatarPicker({ current, username, onSelect, sessionImage }: { current: string; username: string; onSelect: (url: string) => void; sessionImage?: string | null }) {
  const [tab, setTab] = useState<"presets" | "ai">("presets");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPreview, setAiPreview] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiImgStatus, setAiImgStatus] = useState<"loading" | "done" | "error">("loading");
  const [aiError, setAiError] = useState("");
  const [selected, setSelected] = useState(current);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [aiHistory, setAiHistory] = useState<string[]>([]); // session-only past generations
  const [uploading, setUploading] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => { setFavorites(loadFavorites()); }, []);

  function dicebear(seed: string) {
    return `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}`;
  }

  // For AI-generated previews (blob: URLs) and Pollinations presets:
  // fetch the image bytes and POST to avatar-upload → saved permanently to Vercel Blob.
  // Vercel Blob keeps up to 5 avatars per user; oldest is auto-removed.
  async function pick(url: string) {
    const needsUpload = url.startsWith("blob:") || url.includes("pollinations.ai");
    if (needsUpload) {
      setUploading(true);
      try {
        const imgRes = await fetch(url);
        if (imgRes.ok) {
          const blob = await imgRes.blob();
          const formData = new FormData();
          formData.append("file", blob, "avatar.jpg");
          const res = await fetch("/api/avatar-upload", { method: "POST", body: formData });
          if (res.ok) {
            const data = await res.json();
            url = data.url; // permanent Vercel Blob CDN URL
          }
        }
      } catch { /* ignore — use original url as fallback */ }
      setUploading(false);
    }
    setSelected(url);
    onSelect(url);
  }

  function toggleFavorite(url: string) {
    setFavorites(prev => {
      const isSaved = prev.includes(url);
      const next = isSaved
        ? prev.filter(u => u !== url)
        : [url, ...prev].slice(0, MAX_FAVORITES);
      saveFavorites(next);
      return next;
    });
  }

  async function generateAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiPreview("");
    setAiError("");
    setAiImgStatus("loading");
    const seed = Math.floor(Math.random() * 99999);
    const prompt = `pixel art avatar portrait, ${aiPrompt.trim()}, retro 16bit game sprite, vibrant colors, clean background`;
    // POST to /api/generate-image — HuggingFace FLUX streams image bytes back.
    // We create a local blob URL for preview. Image is only saved to Vercel Blob
    // permanently when user clicks "Use This ✓" (via pick() → avatar-upload).
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, seed }),
      });
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try { const j = await res.json(); msg = j.error || msg; } catch { /* ignore */ }
        setAiError(msg);
        setAiImgStatus("error");
        setAiLoading(false);
        return;
      }
      const blob = await res.blob();
      const localUrl = URL.createObjectURL(blob);
      setAiPreview(localUrl);
      setAiImgStatus("done");
    } catch (e) {
      setAiError(String(e));
      setAiImgStatus("error");
    }
    setAiLoading(false);
  }

  function onAiImageLoad(url: string) {
    setAiImgStatus("done");
    setAiHistory(prev => [url, ...prev.filter(u => u !== url)].slice(0, 10));
  }

  const btnStyle = (active: boolean) => ({
    background: active ? "var(--accent-purple)" : "transparent",
    color: active ? "#fff" : "var(--text-secondary)",
    border: `1px solid ${active ? "var(--accent-purple)" : "var(--border)"}`,
    borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
  });

  // Thumbnail with heart button — used for both favorites strip and history strip
  function AvatarThumb({ url, showHeart = true }: { url: string; showHeart?: boolean }) {
    const isSelected = selected === url;
    const isFav = favorites.includes(url);
    return (
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => pick(url)}
          title="Use this avatar"
          style={{
            width: 60, height: 60, padding: 0, borderRadius: 10, overflow: "hidden",
            border: `2px solid ${isSelected ? "var(--accent-purple-bright)" : "var(--border)"}`,
            background: "var(--bg-elevated)", cursor: "pointer", display: "block",
            boxShadow: isSelected ? "0 0 0 2px var(--accent-purple)" : "none",
            transition: "border-color 0.15s",
          }}
        >
          <img src={url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </button>
        {showHeart && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleFavorite(url); }}
            title={isFav ? "Remove from favorites" : "Save to favorites"}
            style={{
              position: "absolute", top: -6, right: -6,
              width: 20, height: 20, borderRadius: "50%", border: "none",
              background: isFav ? "#e91e8c" : "var(--bg-elevated)",
              color: isFav ? "#fff" : "var(--text-muted)",
              fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              transition: "all 0.15s",
            }}
          >
            {isFav ? "♥" : "♡"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Current avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <img src={selected || dicebear(username)} alt="current" style={{ width: 72, height: 72, borderRadius: 14, border: "2px solid var(--accent-purple)", background: "var(--bg-elevated)" }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Your Avatar</div>
          {uploading
            ? <div style={{ fontSize: 12, color: "var(--accent-purple)" }}>⏳ Saving avatar…</div>
            : <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Pick a preset or generate with AI</div>
          }
        </div>
      </div>

      {/* Current photo from account (GitHub/OAuth) — shown as a 1-click option */}
      {sessionImage && !sessionImage.includes("dicebear") && (
        <div style={{ marginBottom: 14, padding: "10px 12px", background: "rgba(124,92,191,0.07)", border: "1px solid rgba(124,92,191,0.25)", borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, letterSpacing: "0.5px" }}>YOUR ACCOUNT PHOTO</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={() => pick(sessionImage)} style={{ padding: 0, background: "none", border: `2px solid ${selected === sessionImage ? "var(--accent-purple-bright)" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", overflow: "hidden", width: 52, height: 52, flexShrink: 0, boxShadow: selected === sessionImage ? "0 0 0 2px var(--accent-purple)" : "none" }}>
              <img src={sessionImage} alt="account photo" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>Use your current profile photo</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>From your linked account</div>
            </div>
            {selected !== sessionImage && (
              <button type="button" onClick={() => pick(sessionImage)} style={{ marginLeft: "auto", background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Use This</button>
            )}
            {selected === sessionImage && (
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#4ad990", fontWeight: 700 }}>✓ Active</span>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button type="button" style={btnStyle(tab === "presets")} onClick={() => setTab("presets")}>Presets</button>
        <button type="button" style={btnStyle(tab === "ai")} onClick={() => setTab("ai")}>
          ✦ AI Generate {favorites.length > 0 && <span style={{ marginLeft: 4, background: "rgba(233,30,140,0.2)", color: "#e91e8c", borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>♥ {favorites.length}</span>}
        </button>
      </div>

      {tab === "presets" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {CUSTOM_PRESETS.map(p => {
            const isSelected = selected === p.url;
            return (
              <button type="button" key={p.label} onClick={() => pick(p.url)} style={{ background: isSelected ? "rgba(124,92,191,0.2)" : "var(--bg-elevated)", border: `2px solid ${isSelected ? "var(--accent-purple-bright)" : "var(--accent-purple)"}`, borderRadius: 10, padding: 4, cursor: "pointer", transition: "all 0.1s", position: "relative" }}>
                <img src={p.url} alt={p.label} style={{ width: "100%", aspectRatio: "1", display: "block", borderRadius: 6 }} />
                <div style={{ fontSize: 9, color: "var(--accent-purple-bright)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{p.label}</div>
              </button>
            );
          })}
          {DICEBEAR_SEEDS.map(seed => {
            const url = dicebear(seed);
            const isSelected = selected === url;
            return (
              <button type="button" key={seed} onClick={() => pick(url)} style={{ background: isSelected ? "rgba(124,92,191,0.2)" : "var(--bg-elevated)", border: `2px solid ${isSelected ? "var(--accent-purple-bright)" : "var(--border)"}`, borderRadius: 10, padding: 4, cursor: "pointer", transition: "all 0.1s" }}>
                <img src={url} alt={seed} style={{ width: "100%", aspectRatio: "1", display: "block", borderRadius: 6 }} />
                <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seed}</div>
              </button>
            );
          })}
        </div>
      )}

      {tab === "ai" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ── Favorites strip ── */}
          {favorites.length > 0 && (
            <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "#e91e8c", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                ♥ Saved Favorites
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({favorites.length}/{MAX_FAVORITES}) — click ♥ to remove</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {favorites.map((url, i) => <AvatarThumb key={i} url={url} />)}
              </div>
            </div>
          )}

          {/* ── Generator ── */}
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Describe your character and AI will generate a pixel art avatar.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); generateAI(); } }}
              placeholder="e.g. female space pirate, cyberpunk wizard, forest elf..."
              style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 13px", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" }}
            />
            <button type="button" onClick={generateAI} disabled={aiLoading} style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: aiLoading ? "default" : "pointer", opacity: aiLoading ? 0.6 : 1, whiteSpace: "nowrap" }}>
              {aiLoading ? "..." : "✦ Generate"}
            </button>
          </div>

          {/* ── Current preview ── */}
          {(aiLoading || aiPreview || aiImgStatus === "error") && (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 96, height: 96, borderRadius: 14, border: "2px solid var(--border)", background: "var(--bg-elevated)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {(aiImgStatus === "loading" || aiLoading) && !aiPreview && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 20, height: 20, border: "2px solid var(--accent-purple)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    </div>
                  )}
                  {aiImgStatus === "error" && <div style={{ fontSize: 10, color: "rgba(255,120,120,0.8)", textAlign: "center", padding: 4 }}>✗ Failed</div>}
                  {aiPreview && <img
                    key={aiPreview}
                    src={aiPreview}
                    alt="AI avatar"
                    onLoad={() => onAiImageLoad(aiPreview)}
                    onError={() => setAiImgStatus("error")}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: aiImgStatus === "done" ? "block" : "none" }}
                  />}
                </div>
                {/* Heart button on the big preview */}
                {aiImgStatus === "done" && (
                  <button
                    type="button"
                    onClick={() => toggleFavorite(aiPreview)}
                    title={favorites.includes(aiPreview) ? "Remove from favorites" : "Save to favorites"}
                    style={{
                      position: "absolute", top: -8, right: -8,
                      width: 26, height: 26, borderRadius: "50%", border: "none",
                      background: favorites.includes(aiPreview) ? "#e91e8c" : "var(--bg-base)",
                      color: favorites.includes(aiPreview) ? "#fff" : "var(--text-muted)",
                      fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.5)", transition: "all 0.15s",
                    }}
                  >
                    {favorites.includes(aiPreview) ? "♥" : "♡"}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(aiLoading || aiImgStatus === "loading") && !aiPreview && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Generating... this takes 20–40s</div>}
                {aiImgStatus === "error" && <div style={{ fontSize: 12, color: "rgba(255,120,120,0.8)" }}>Generation failed{aiError ? `: ${aiError}` : ""}</div>}
                {aiImgStatus === "done" && aiPreview && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Looking good! ♥ to save it.</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => pick(aiPreview)} disabled={aiImgStatus !== "done" || !aiPreview} style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: aiImgStatus === "done" && aiPreview ? "pointer" : "default", opacity: aiImgStatus === "done" && aiPreview ? 1 : 0.4 }}>
                    Use This ✓
                  </button>
                  <button type="button" onClick={generateAI} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer" }}>
                    {aiImgStatus === "error" ? "Retry" : "Regenerate"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Session history (excludes current preview and already-shown favorites) ── */}
          {aiHistory.filter(u => u !== aiPreview).length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                This session
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                {aiHistory.filter(u => u !== aiPreview).map((url, i) => (
                  <AvatarThumb key={i} url={url} />
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default function EditProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songUrl, setSongUrl] = useState("");
  const [discord, setDiscord] = useState("");
  const [steam, setSteam] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loadedSongUrl, setLoadedSongUrl] = useState("");
  const [replyPrivacy, setReplyPrivacy] = useState("anyone");
  const [favoriteGame, setFavoriteGame] = useState<string>("");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { router.push("/signin"); return; }
    const idParam = session?.user?.id ? `id=${session.user.id}` : session?.user?.name ? `username=${session.user.name}` : null;
    if (!idParam) { setLoading(false); return; }
    fetch(`/api/users?${idParam}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setDisplayName(data.display_name ?? "");
          setUsername(data.username ?? "");
          setBio(data.bio ?? "");
          setLocation(data.location ?? "");
          setWebsite(data.website ?? "");
          setSongTitle(data.profile_song_title ?? "");
          setSongArtist(data.profile_song_artist ?? "");
          setSongUrl(data.profile_song_url ?? "");
          setLoadedSongUrl(data.profile_song_url ?? "");
          setDiscord(data.discord_handle ?? "");
          setSteam(data.steam_handle ?? "");
          setAvatarUrl(data.avatar_url ?? "");
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    // Load privacy setting separately
    fetch("/api/user/privacy").then(r => r.json()).then(d => {
      if (d.reply_privacy) setReplyPrivacy(d.reply_privacy);
    }).catch(() => {});
    // Load favorite game
    fetch(`/api/users?${idParam}`).then(r => r.json()).then(d => {
      if (d.favorite_game) setFavoriteGame(d.favorite_game);
    }).catch(() => {});
  }, [session, status, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess(false);
    try {
      await actionUpdateProfile({
        display_name: displayName.trim() || undefined,
        username: username.trim() || undefined,
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        avatar_url: avatarUrl || undefined,
        profile_song_title: songTitle.trim() || undefined,
        profile_song_artist: songArtist.trim() || undefined,
        profile_song_url: songUrl.trim() || undefined,
        discord_handle: discord.trim(),
        steam_handle: steam.trim(),
      });
      // Save privacy setting
      await fetch("/api/user/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply_privacy: replyPrivacy }),
      }).catch(() => {});
      // Save favorite game
      await fetch("/api/user/favorite-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameName: favoriteGame || null }),
      }).catch(() => {});
      setSuccess(true);
      setTimeout(() => router.push(`/profile/${username.trim() || session?.user?.name}`), 800);
    } catch (e) {
      setError(String(e).replace("Error: ", ""));
    }
    setSaving(false);
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 52px)", color: "var(--text-muted)" }}>
      Loading...
    </div>
  );

  const field = (label: string, value: string, onChange: (v: string) => void, opts?: { placeholder?: string; hint?: string; type?: string; multiline?: boolean }) => (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.5px" }}>{label}</label>
      {opts?.multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={opts.placeholder}
          style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical", minHeight: 80 }} />
      ) : (
        <input type={opts?.type ?? "text"} value={value} onChange={e => onChange(e.target.value)} placeholder={opts?.placeholder}
          style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
      )}
      {opts?.hint && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{opts.hint}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <button onClick={() => router.back()} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>← Back</button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Edit Profile</h1>
      </div>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Avatar */}
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-header" style={{ marginBottom: 16 }}>Avatar</div>
          <AvatarPicker current={avatarUrl} username={username || session?.user?.name || "you"} onSelect={setAvatarUrl} sessionImage={session?.user?.image} />
        </div>

        {/* Identity */}
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-header" style={{ marginBottom: 16 }}>Identity</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {field("DISPLAY NAME", displayName, setDisplayName, { placeholder: "How your name appears" })}
            {field("USERNAME", username, v => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, "")), {
              placeholder: "yourname",
              hint: `Letters, numbers, underscores only. Your URL: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://flocksocial.netlify.app"}/profile/${username || "yourname"}`,
            })}
            {field("BIO", bio, setBio, { placeholder: "Tell people about yourself...", multiline: true })}
          </div>
        </div>

        {/* Info */}
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-header" style={{ marginBottom: 16 }}>Details</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {field("LOCATION", location, setLocation, { placeholder: "City, Planet..." })}
            {field("WEBSITE", website, setWebsite, { placeholder: "https://yoursite.com", type: "url" })}
          </div>
        </div>

        {/* Social */}
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-header" style={{ marginBottom: 4 }}>Social Links</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Link your other accounts so friends can find you.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {field("DISCORD", discord, setDiscord, { placeholder: "username or username#1234", hint: "Your Discord username" })}
            {field("STEAM", steam, setSteam, { placeholder: "SteamID or vanity URL name", hint: "Your Steam profile name or ID" })}
          </div>
        </div>

        {/* Privacy */}
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-header" style={{ marginBottom: 4 }}>Privacy</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Who can reply to your wall posts and video comments.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[{ v: "anyone", label: "🌐 Anyone", desc: "All Flock users can reply to your posts" }, { v: "friends_only", label: "👥 Friends only", desc: "Only your friends can reply" }].map(opt => (
              <label key={opt.v} style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", padding: "10px 14px", background: replyPrivacy === opt.v ? "rgba(124,92,191,0.1)" : "var(--bg-elevated)", border: `1px solid ${replyPrivacy === opt.v ? "rgba(124,92,191,0.45)" : "var(--border)"}`, borderRadius: 10, transition: "all 0.15s" }}>
                <input type="radio" name="reply_privacy" value={opt.v} checked={replyPrivacy === opt.v} onChange={() => setReplyPrivacy(opt.v)} style={{ accentColor: "#a78bfa", marginTop: 3, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Favorite Game */}
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-header" style={{ marginBottom: 4 }}>🎮 Favorite Game</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
            Pin a game to your profile sidebar. Leave blank to show your most recently played game.
          </div>
          <select
            value={favoriteGame}
            onChange={e => setFavoriteGame(e.target.value)}
            style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "inherit" }}
          >
            <option value="">— Show recently played —</option>
            {[
              "Street Fighter II Turbo","Super Mario World","Mortal Kombat II","Donkey Kong Country",
              "Kirby Super Star","Contra III","NBA Jam","Turtles in Time","Super Bomberman",
              "Super Mario Kart","Secret of Mana","Street Fighter Alpha 2","Killer Instinct",
              "Donkey Kong Country 2","Sunset Riders","Mega Man X","Chrono Trigger",
              "Zelda: A Link to the Past","Super Punch-Out!!","Earthbound","Star Fox",
              "Final Fantasy VI","Super Castlevania IV","Lufia II","Soul Blazer",
              "Breath of Fire II","Yoshi's Island","Mega Man X3","F-Zero",
              "Super Mario RPG","Evo: Search for Eden","Illusion of Gaia","ActRaiser",
            ].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {/* Profile Song */}
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-header" style={{ marginBottom: 4 }}>Profile Song</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Plays automatically when people visit your profile.</div>
          <ProfileSongPicker
            currentUrl={loadedSongUrl}
            currentTitle={songTitle}
            currentArtist={songArtist}
            onSelect={(url, title, artist) => { setSongUrl(url); setSongTitle(title); setSongArtist(artist); }}
          />
        </div>

        {error && (
          <div style={{ background: "rgba(191,92,92,0.15)", border: "1px solid rgba(191,92,92,0.4)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f08080" }}>{error}</div>
        )}
        {success && (
          <div style={{ background: "rgba(74,217,144,0.15)", border: "1px solid rgba(74,217,144,0.4)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#4ad990" }}>Saved! Redirecting...</div>
        )}

        <button type="submit" disabled={saving}
          style={{ width: "100%", background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))", color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
