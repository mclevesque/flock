"use client";
import { useRef, useState, useEffect } from "react";
import { C, display, type BudiLog } from "./_ui";

type Phase = "permissions" | "preview" | "recording" | "review" | "posting" | "error";
type Mode = "video" | "voice";

export default function BudiRecorder({ onClose, onPosted, defaultLogId }: {
  onClose: () => void;
  onPosted: () => void;
  defaultLogId?: string;
}) {
  const [mode, setMode] = useState<Mode>("video");
  const [phase, setPhase] = useState<Phase>("permissions");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [countdown, setCountdown] = useState(30);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<BudiLog[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultLogId ? [defaultLogId] : []));

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function cleanup() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }

  // Destinations: the logs the user can post to
  useEffect(() => {
    fetch("/api/budi/logs").then(r => r.json()).then(d => {
      const ls = (d.logs ?? []) as BudiLog[];
      setLogs(ls);
      setSelected(prev => {
        if (prev.size) return prev;
        const solo = ls.find(l => l.kind === "solo");
        return new Set(defaultLogId ? [defaultLogId] : solo ? [solo.id] : []);
      });
    }).catch(() => {});
  }, [defaultLogId]);

  // Stop tracks/timers on unmount
  useEffect(() => () => cleanup(), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startCamera(m: Mode) {
    setError("");
    try {
      const constraints: MediaStreamConstraints = m === "video"
        ? { video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } }, audio: true }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (m === "video" && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }
      setPhase("preview");
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      setError(denied
        ? "Camera/mic access was blocked. Allow it in your browser settings, then try again."
        : "Couldn't reach your camera or mic. Make sure nothing else is using it.");
      setPhase("error");
    }
  }

  async function flip() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    cleanup();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; await videoRef.current.play().catch(() => {}); }
    } catch { /* keep going */ }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mime = mode === "video"
      ? (MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "")
      : (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "");
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const b = new Blob(chunksRef.current, { type: mode === "video" ? "video/webm" : "audio/webm" });
      setBlob(b);
      setMediaUrl(URL.createObjectURL(b));
      setPhase("review");
    };
    rec.start(100);
    recorderRef.current = rec;
    setPhase("recording");
    setCountdown(30);
    const t0 = Date.now();
    timerRef.current = setInterval(() => {
      const el = (Date.now() - t0) / 1000;
      setCountdown(Math.ceil(Math.max(0, 30 - el)));
      setDuration(el);
      if (el >= 30) stopRecording();
    }, 200);
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    recorderRef.current?.stop();
  }

  function captureThumb(): Promise<Blob | null> {
    if (mode !== "video" || !mediaUrl) return Promise.resolve(null);
    return new Promise(resolve => {
      const v = document.createElement("video");
      v.src = mediaUrl; v.muted = true; v.playsInline = true;
      v.onloadeddata = () => { v.currentTime = Math.min(0.1, (v.duration || 1) / 2); };
      v.onseeked = () => {
        const c = document.createElement("canvas"); c.width = 360; c.height = 640;
        const ctx = c.getContext("2d"); if (!ctx) return resolve(null);
        ctx.drawImage(v, 0, 0, 360, 640);
        c.toBlob(b => resolve(b), "image/jpeg", 0.75);
      };
      v.onerror = () => resolve(null);
    });
  }

  async function post() {
    if (!blob || selected.size === 0) return;
    setPhase("posting");
    const thumb = await captureThumb().catch(() => null);
    const fd = new FormData();
    fd.append("media", blob, mode === "video" ? "clip.webm" : "voice.webm");
    if (thumb) fd.append("thumbnail", thumb, "thumb.jpg");
    fd.append("duration", String(Math.min(duration, 30)));
    fd.append("caption", caption);
    fd.append("mediaType", mode === "video" ? "video" : "audio");
    fd.append("logIds", JSON.stringify([...selected]));
    const res = await fetch("/api/budi/clips", { method: "POST", body: fd });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Couldn't post your clip.");
      setPhase("error");
      return;
    }
    cleanup();
    onPosted();
  }

  function retake() {
    setBlob(null);
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setMediaUrl(null); setDuration(0);
    startCamera(mode);
  }

  function toggleSel(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 20000, background: "#000",
    color: C.text, fontFamily: display, display: "flex", flexDirection: "column",
  };
  const roundBtn: React.CSSProperties = {
    width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.12)",
    border: "none", color: "#fff", fontSize: 20, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  // ── Permissions ──
  if (phase === "permissions") return (
    <div style={{ ...overlay, alignItems: "center", justifyContent: "center", gap: 22, padding: 28, textAlign: "center" }}>
      <button onClick={onClose} style={{ ...roundBtn, position: "absolute", top: "max(16px, env(safe-area-inset-top))", left: 16 }}>✕</button>
      <div style={{ fontSize: 26, fontWeight: 700 }}>new clip</div>
      <div style={{ display: "flex", gap: 10, background: C.surface2, padding: 5, borderRadius: 999 }}>
        {(["video", "voice"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "10px 22px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit",
            fontSize: 15, fontWeight: 700, background: mode === m ? "#fff" : "transparent", color: mode === m ? "#000" : C.muted,
          }}>{m === "video" ? "🎥 video" : "🎙 voice note"}</button>
        ))}
      </div>
      <p style={{ color: C.muted, fontSize: 14, maxWidth: 280, lineHeight: 1.6, margin: 0 }}>
        budi records live (up to 30s) — no uploading from your gallery. tip: rotate your phone for a wider shot.
      </p>
      <button onClick={() => startCamera(mode)} style={{
        border: "none", borderRadius: 14, padding: "15px 28px", fontSize: 16, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit", color: "#000", minHeight: 50,
        background: `linear-gradient(110deg, ${C.pink}, ${C.violet})`,
      }}>allow {mode === "video" ? "camera & mic" : "mic"}</button>
    </div>
  );

  // ── Error ──
  if (phase === "error") return (
    <div style={{ ...overlay, alignItems: "center", justifyContent: "center", gap: 16, padding: 28, textAlign: "center" }}>
      <div style={{ fontSize: 40 }}>😕</div>
      <p style={{ fontSize: 15, color: "#ff8fde", maxWidth: 300, lineHeight: 1.6, margin: 0 }}>{error}</p>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={() => setPhase("permissions")} style={{ ...roundBtn, width: "auto", height: "auto", borderRadius: 12, padding: "11px 20px", fontSize: 15 }}>try again</button>
        <button onClick={onClose} style={{ ...roundBtn, width: "auto", height: "auto", borderRadius: 12, padding: "11px 20px", fontSize: 15 }}>close</button>
      </div>
    </div>
  );

  // ── Posting ──
  if (phase === "posting") return (
    <div style={{ ...overlay, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ width: 46, height: 46, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: C.pink, borderRadius: "50%", animation: "budispin 1s linear infinite" }} />
      <p style={{ color: C.muted, fontSize: 14 }}>posting…</p>
      <style>{`@keyframes budispin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Review ──
  if (phase === "review") {
    const groups = logs.filter(l => l.kind !== "solo");
    const solo = logs.find(l => l.kind === "solo");
    return (
      <div style={{ ...overlay }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "max(14px, env(safe-area-inset-top)) 16px 8px" }}>
          <button onClick={retake} style={roundBtn}>↺</button>
          <span style={{ fontWeight: 700 }}>post to…</span>
          <button onClick={onClose} style={roundBtn}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 12px" }}>
          {mode === "video" ? (
            <video src={mediaUrl ?? undefined} autoPlay loop playsInline controls={false}
              style={{ width: "100%", maxHeight: "42dvh", objectFit: "cover", borderRadius: 18, background: "#111" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0" }}>
              <div style={{ fontSize: 44 }}>🎙</div>
              <audio src={mediaUrl ?? undefined} controls style={{ width: "100%" }} />
            </div>
          )}

          <input value={caption} onChange={e => setCaption(e.target.value)} maxLength={200}
            placeholder="add a caption (optional)"
            style={{ width: "100%", marginTop: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 15px", color: C.text, fontSize: 16, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />

          <div style={{ marginTop: 16, fontSize: 13, color: C.muted, fontWeight: 700, letterSpacing: "0.04em" }}>
            post to ({selected.size})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {[solo, ...groups].filter(Boolean).map(l => {
              const log = l as BudiLog;
              const on = selected.has(log.id);
              return (
                <button key={log.id} onClick={() => toggleSel(log.id)} style={{
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  background: on ? "rgba(255,62,201,0.12)" : C.surface,
                  border: `1px solid ${on ? C.pink : C.border}`, borderRadius: 14, padding: "12px 14px", color: C.text,
                }}>
                  <span style={{ fontSize: 20 }}>{log.kind === "solo" ? "⭐" : "👥"}</span>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{log.name}</span>
                  <span style={{
                    width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: on ? C.pink : "transparent", border: `2px solid ${on ? C.pink : C.border}`, color: "#000", fontSize: 14, fontWeight: 900,
                  }}>{on ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "10px 16px calc(16px + env(safe-area-inset-bottom))", borderTop: `1px solid ${C.border}` }}>
          <button onClick={post} disabled={selected.size === 0} style={{
            width: "100%", border: "none", borderRadius: 14, padding: 15, fontSize: 16, fontWeight: 700,
            cursor: selected.size === 0 ? "default" : "pointer", fontFamily: "inherit", color: "#000", minHeight: 50,
            background: `linear-gradient(110deg, ${C.pink}, ${C.violet})`, opacity: selected.size === 0 ? 0.5 : 1,
          }}>post to {selected.size} {selected.size === 1 ? "log" : "logs"}</button>
        </div>
      </div>
    );
  }

  // ── Preview / Recording ──
  const rec = phase === "recording";
  return (
    <div style={{ ...overlay, alignItems: "center" }}>
      <div style={{ position: "absolute", top: "max(14px, env(safe-area-inset-top))", left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", zIndex: 5 }}>
        <button onClick={() => { cleanup(); onClose(); }} style={roundBtn}>✕</button>
        {rec
          ? <span style={{ background: "rgba(255,0,80,0.85)", borderRadius: 8, padding: "4px 12px", fontWeight: 700, fontSize: 14 }}>● {countdown}s</span>
          : <span style={{ fontWeight: 700, fontSize: 15 }}>{mode === "video" ? "🎥 video" : "🎙 voice note"}</span>}
        {mode === "video" && !rec
          ? <button onClick={flip} style={roundBtn}>⟳</button>
          : <span style={{ width: 44 }} />}
      </div>

      {mode === "video" ? (
        <video ref={videoRef} playsInline muted autoPlay
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: facing === "user" ? "scaleX(-1)" : "none" }} />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{
            width: 140, height: 140, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 56, background: `linear-gradient(135deg, ${C.pink}, ${C.violet})`,
            animation: rec ? "budipulse 1.1s ease-in-out infinite" : "none",
          }}>🎙</div>
          <p style={{ color: C.muted, fontSize: 14 }}>{rec ? "recording…" : "tap the button to record"}</p>
          <style>{`@keyframes budipulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }`}</style>
        </div>
      )}

      {rec && (
        <div style={{ position: "absolute", top: "calc(max(14px, env(safe-area-inset-top)) + 52px)", left: 16, right: 16, height: 4, background: "rgba(255,255,255,0.25)", borderRadius: 2 }}>
          <div style={{ height: "100%", background: C.pink, borderRadius: 2, width: `${((30 - countdown) / 30) * 100}%`, transition: "width 0.2s" }} />
        </div>
      )}

      <div style={{ position: "absolute", bottom: "calc(34px + env(safe-area-inset-bottom))", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        {rec ? (
          <button onClick={stopRecording} aria-label="stop" style={{ width: 74, height: 74, borderRadius: "50%", background: C.pink, border: "5px solid rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 26, height: 26, background: "#fff", borderRadius: 6 }} />
          </button>
        ) : (
          <button onClick={startRecording} aria-label="record" style={{ width: 74, height: 74, borderRadius: "50%", background: "#fff", border: "5px solid rgba(255,255,255,0.4)", cursor: "pointer", boxShadow: "0 0 0 5px rgba(255,255,255,0.15)" }} />
        )}
      </div>
    </div>
  );
}
