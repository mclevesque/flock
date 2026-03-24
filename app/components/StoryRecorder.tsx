"use client";
import { useRef, useState, useEffect, useCallback } from "react";

type FilterKey = "normal" | "cinematic" | "noir" | "warm" | "cyberpunk" | "vhs";

interface FilterDef {
  key: FilterKey;
  label: string;
  emoji: string;
  cssFilter: string;
  overlay?: "cinematic" | "vhs";
}

const FILTERS: FilterDef[] = [
  { key: "normal",    label: "Normal",  emoji: "📷", cssFilter: "none" },
  { key: "cinematic", label: "Cinema",  emoji: "🎬", cssFilter: "contrast(1.15) brightness(0.88) saturate(0.75)", overlay: "cinematic" },
  { key: "noir",      label: "Noir",    emoji: "🌑", cssFilter: "grayscale(1) contrast(1.4) brightness(0.85)" },
  { key: "warm",      label: "Warm",    emoji: "🌸", cssFilter: "sepia(0.25) saturate(1.5) brightness(1.08) hue-rotate(-10deg)" },
  { key: "cyberpunk", label: "Cyber",   emoji: "⚡", cssFilter: "hue-rotate(190deg) saturate(2) contrast(1.15) brightness(0.9)" },
  { key: "vhs",       label: "VHS",     emoji: "📼", cssFilter: "contrast(1.05) brightness(0.88) saturate(0.65)", overlay: "vhs" },
];

interface TextLayer { text: string; color: string; }

interface Props { onClose: () => void; onUploaded: () => void; }

const W = 720, H = 1280;

export default function StoryRecorder({ onClose, onUploaded }: Props) {
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const recorderRef    = useRef<MediaRecorder | null>(null);
  const chunksRef      = useRef<Blob[]>([]);
  const streamRef      = useRef<MediaStream | null>(null);
  const rafRef         = useRef<number | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep mutable values in refs so RAF callback stays stable
  const filterRef      = useRef<FilterKey>("normal");
  const textLayersRef  = useRef<TextLayer[]>([]);
  const phaseRef       = useRef<string>("preview");

  const [phase, setPhase]           = useState<"permissions"|"preview"|"recording"|"review"|"uploading"|"error">("permissions");
  const [countdown, setCountdown]   = useState(30);
  const [recordedBlob, setBlob]     = useState<Blob | null>(null);
  const [recordedUrl, setUrl]       = useState<string | null>(null);
  const [durationSec, setDuration]  = useState(0);
  const [error, setError]           = useState("");
  const [activeFilter, setFilter]   = useState<FilterKey>("normal");
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [addingText, setAddingText] = useState(false);
  const [textInput, setTextInput]   = useState("");
  const [textColor, setTextColor]   = useState("#ffffff");

  // Sync state → refs
  useEffect(() => { filterRef.current = activeFilter; }, [activeFilter]);
  useEffect(() => { textLayersRef.current = textLayers; }, [textLayers]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Canvas render loop ──────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video  = hiddenVideoRef.current;
    if (!canvas || !video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fd = FILTERS.find(f => f.key === filterRef.current) ?? FILTERS[0];

    // Draw filtered frame
    ctx.filter = fd.cssFilter;
    ctx.drawImage(video, 0, 0, W, H);
    ctx.filter = "none";

    // Cinematic letterbox
    if (fd.overlay === "cinematic") {
      const bar = Math.round(H * 0.08);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, bar);
      ctx.fillRect(0, H - bar, W, bar);
    }

    // VHS scanlines + noise
    if (fd.overlay === "vhs") {
      ctx.globalAlpha = 0.13;
      for (let y = 0; y < H; y += 4) { ctx.fillStyle = "#000"; ctx.fillRect(0, y, W, 2); }
      const ny = Math.floor(Math.random() * H);
      ctx.globalAlpha = 0.07;
      ctx.drawImage(video, 4, ny, W - 4, 30, 0, ny, W - 4, 30);
      ctx.globalAlpha = 1;
    }

    // Text overlays
    for (const t of textLayersRef.current) {
      ctx.font = `bold 52px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, W / 2, H / 2);
      ctx.shadowBlur = 0;
    }

    if (phaseRef.current === "preview" || phaseRef.current === "recording" || phaseRef.current === "permissions") {
      rafRef.current = requestAnimationFrame(drawFrame);
    }
  }, []);

  useEffect(() => {
    // Check if permission already granted — skip the permissions screen if so
    Promise.all([
      navigator.permissions?.query({ name: "camera" as PermissionName }),
      navigator.permissions?.query({ name: "microphone" as PermissionName }),
    ]).then(([cam, mic]) => {
      if (cam?.state === "granted" && mic?.state === "granted") {
        startCamera();
      }
    }).catch(() => {
      // Permissions API not supported — just show the allow screen
    });
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      streamRef.current = stream;
      const vid = hiddenVideoRef.current;
      if (vid) { vid.srcObject = stream; vid.muted = true; await vid.play(); }
      rafRef.current = requestAnimationFrame(drawFrame);
      setPhase("preview");
    } catch (err) {
      const isDenied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      setError(isDenied
        ? "Camera access was blocked.\n\nTo fix: open Chrome → tap ⋮ menu → Settings → Site settings → Camera → find this site → set to Allow.\n\nOr: Android Settings → Apps → Chrome → Permissions → Camera → Allow."
        : "Could not access camera. Make sure no other app is using it.");
      setPhase("error");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }

  function startRecording() {
    const canvas = canvasRef.current;
    const stream = streamRef.current;
    if (!canvas || !stream) return;

    // Combine filtered canvas video + original audio
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvasStream: MediaStream = (canvas as any).captureStream?.(30) ?? stream;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack && canvasStream !== stream) canvasStream.addTrack(audioTrack);

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(canvasStream, { mimeType });
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setBlob(blob);
      setUrl(URL.createObjectURL(blob));
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setPhase("review");
    };
    recorder.start(100);
    recorderRef.current = recorder;
    setPhase("recording");
    setCountdown(30);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setCountdown(Math.ceil(Math.max(0, 30 - elapsed)));
      setDuration(elapsed);
      if (elapsed >= 30) stopRecording();
    }, 200);
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    recorderRef.current?.stop();
  }

  function captureFrameAt(videoEl: HTMLVideoElement, timeSec: number): Promise<Blob | null> {
    return new Promise(resolve => {
      const seek = () => {
        const c = document.createElement("canvas");
        c.width = 360; c.height = 640;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(videoEl, 0, 0, 360, 640);
        c.toBlob(b => resolve(b), "image/jpeg", 0.75);
        videoEl.removeEventListener("seeked", seek);
      };
      videoEl.addEventListener("seeked", seek, { once: true });
      videoEl.currentTime = timeSec;
    });
  }

  async function captureFrames(videoEl: HTMLVideoElement): Promise<Blob[]> {
    const dur = videoEl.duration || durationSec || 5;
    const offsets = [0, 0.25, 0.5, 0.75, 0.9].map(p => Math.min(p * dur, dur - 0.1));
    const frames: Blob[] = [];
    for (const t of offsets) {
      const b = await captureFrameAt(videoEl, t).catch(() => null);
      if (b) frames.push(b);
    }
    return frames;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function checkNsfw(img: HTMLImageElement, model: any): Promise<boolean> {
    try {
      const preds = await model.classify(img);
      type P = { className: string; probability: number };
      const get = (n: string) => (preds as P[]).find(p => p.className === n)?.probability ?? 0;
      return get("Porn") > 0.6 || get("Hentai") > 0.6 || get("Sexy") > 0.5;
    } catch { return false; }
  }

  async function scanAllFrames(videoEl: HTMLVideoElement): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nsfwjs = await import("nsfwjs") as any;
    const model = await (nsfwjs.default ?? nsfwjs).load();
    for (const frame of await captureFrames(videoEl)) {
      const url = URL.createObjectURL(frame);
      const img = new Image(); img.src = url;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      const flagged = await checkNsfw(img, model);
      URL.revokeObjectURL(url);
      if (flagged) return true;
    }
    return false;
  }

  async function uploadStory() {
    if (!recordedBlob) return;
    setPhase("uploading");
    const reviewVideo = document.querySelector<HTMLVideoElement>("#story-review-video");
    if (reviewVideo) {
      const flagged = await scanAllFrames(reviewVideo).catch(() => false);
      if (flagged) { setError("This content was flagged by our NSFW filter and cannot be posted."); setPhase("error"); return; }
      reviewVideo.currentTime = 0;
    }
    const thumbnail = reviewVideo ? await captureFrameAt(reviewVideo, 0).catch(() => null) : null;
    const fd = new FormData();
    fd.append("video", recordedBlob, "story.webm");
    if (thumbnail) fd.append("thumbnail", thumbnail, "thumb.jpg");
    fd.append("duration", String(Math.min(durationSec, 30)));
    const res = await fetch("/api/stories", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Upload failed"); setPhase("error"); return; }
    stopCamera();
    onUploaded();
    onClose();
  }

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 20000, background: "#000",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    fontFamily: "monospace",
  };

  if (phase === "permissions") return (
    <div style={{ position: "fixed", inset: 0, zIndex: 20000, background: "#0a0a0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, fontFamily: "monospace" }}>
      <button onClick={() => { stopCamera(); onClose(); }} style={{ position: "absolute", top: 20, left: 20, background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      <div style={{ fontSize: 56 }}>📸</div>
      <div style={{ textAlign: "center", padding: "0 32px" }}>
        <p style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Create a Story</p>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>Flock needs access to your camera and microphone to record a story.</p>
      </div>
      <button
        onClick={startCamera}
        style={{ padding: "14px 36px", borderRadius: 14, background: "linear-gradient(135deg, #7c3aed, #2563eb)", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
      >
        Allow Camera &amp; Mic
      </button>
    </div>
  );

  if (phase === "error") return (
    <div style={overlay}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🚫</div>
      {error.split("\n\n").map((line, i) => (
        <p key={i} style={{ color: i === 0 ? "#ff6666" : "rgba(255,255,255,0.6)", fontSize: i === 0 ? 15 : 13, textAlign: "center", padding: "0 28px", margin: "4px 0", lineHeight: 1.5 }}>{line}</p>
      ))}
      <button onClick={onClose} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 10, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 14 }}>Close</button>
    </div>
  );

  return (
    <div style={overlay}>
      {/* Hidden raw camera video (input to canvas) */}
      <video ref={hiddenVideoRef} style={{ display: "none" }} playsInline muted autoPlay />

      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
        <button onClick={() => { stopCamera(); onClose(); }} style={{ background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Story</span>
        {(phase === "preview" || phase === "recording") ? (
          <button onClick={() => setAddingText(true)} style={{ background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>Aa</button>
        ) : <div style={{ width: 40 }} />}
      </div>

      {/* Canvas preview (live, filtered) */}
      {(phase === "preview" || phase === "recording") && (
        <canvas ref={canvasRef} width={W} height={H}
          style={{ width: "100%", maxWidth: 400, flex: 1, objectFit: "cover", borderRadius: 12 }} />
      )}

      {/* Review playback */}
      {phase === "review" && (
        <video id="story-review-video" src={recordedUrl ?? undefined}
          autoPlay loop playsInline controls={false}
          style={{ width: "100%", maxWidth: 400, flex: 1, objectFit: "cover", borderRadius: 12 }} />
      )}

      {/* Uploading spinner */}
      {phase === "uploading" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Checking content &amp; uploading…</p>
        </div>
      )}

      {/* Progress bar */}
      {phase === "recording" && (
        <>
          <div style={{ position: "absolute", top: 70, left: 16, right: 16, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2 }}>
            <div style={{ height: "100%", background: "#ff4444", borderRadius: 2, width: `${((30 - countdown) / 30) * 100}%`, transition: "width 0.2s" }} />
          </div>
          <div style={{ position: "absolute", top: 80, right: 20, background: "rgba(255,0,0,0.8)", borderRadius: 6, padding: "2px 8px", color: "#fff", fontSize: 13, fontWeight: 700 }}>{countdown}s</div>
        </>
      )}

      {/* Filter picker */}
      {(phase === "preview" || phase === "recording") && (
        <div style={{ position: "absolute", bottom: 128, left: 0, right: 0, display: "flex", gap: 8, justifyContent: "center", padding: "0 12px", overflowX: "auto", scrollbarWidth: "none" }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: activeFilter === f.key ? "rgba(124,58,237,0.85)" : "rgba(0,0,0,0.55)",
              border: `2px solid ${activeFilter === f.key ? "#7c3aed" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 10, padding: "6px 10px", cursor: "pointer", flexShrink: 0,
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 18 }}>{f.emoji}</span>
              <span style={{ fontSize: 9, color: "#fff", fontWeight: 600 }}>{f.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bottom controls */}
      <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 20, alignItems: "center" }}>
        {phase === "preview" && (
          <button onClick={startRecording} style={{ width: 72, height: 72, borderRadius: "50%", background: "#fff", border: "4px solid rgba(255,255,255,0.4)", cursor: "pointer", boxShadow: "0 0 0 6px rgba(255,255,255,0.15)" }} />
        )}
        {phase === "recording" && (
          <button onClick={stopRecording} style={{ width: 72, height: 72, borderRadius: "50%", background: "#ff4444", border: "4px solid rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff" }}>■</button>
        )}
        {phase === "review" && (
          <>
            <button onClick={() => { setBlob(null); setUrl(null); setTextLayers([]); setPhase("preview"); startCamera(); }} style={{ padding: "12px 24px", borderRadius: 12, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Retake</button>
            <button onClick={uploadStory} style={{ padding: "12px 32px", borderRadius: 12, background: "rgba(124,58,237,0.8)", border: "1px solid rgba(124,58,237,0.9)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Share Story</button>
          </>
        )}
      </div>

      {/* Text input modal */}
      {addingText && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, zIndex: 20 }}>
          <input
            autoFocus
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                if (textInput.trim()) { setTextLayers(prev => [...prev, { text: textInput.trim(), color: textColor }]); setTextInput(""); }
                setAddingText(false);
              }
              if (e.key === "Escape") setAddingText(false);
            }}
            placeholder="Type something…"
            maxLength={60}
            style={{ fontSize: 22, fontWeight: 700, background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.3)", borderRadius: 12, padding: "12px 20px", color: "#fff", width: "80%", textAlign: "center", outline: "none" }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            {["#ffffff", "#ffee00", "#ff4488", "#44ffcc", "#44aaff", "#ff8800"].map(c => (
              <div key={c} onClick={() => setTextColor(c)} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: `3px solid ${textColor === c ? "#fff" : "rgba(255,255,255,0.2)"}`, cursor: "pointer", transition: "border 0.1s" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setAddingText(false)} style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 14 }}>Cancel</button>
            <button onClick={() => {
              if (textInput.trim()) { setTextLayers(prev => [...prev, { text: textInput.trim(), color: textColor }]); setTextInput(""); }
              setAddingText(false);
            }} style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(124,58,237,0.8)", border: "none", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Add</button>
          </div>
          {textLayers.length > 0 && (
            <button onClick={() => { setTextLayers([]); setAddingText(false); }} style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(255,80,80,0.2)", border: "1px solid rgba(255,80,80,0.4)", color: "#ff8080", cursor: "pointer", fontSize: 12 }}>Clear all text</button>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
