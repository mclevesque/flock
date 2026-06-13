"use client";
import { useState, useEffect } from "react";
import { C, display } from "./_ui";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function BudiInstall() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(true); // assume installed until checked (avoid flash)
  const [dismissed, setDismissed] = useState(false);
  const [iosSheet, setIosSheet] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    setStandalone(isStandalone);

    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    try { if (localStorage.getItem("budi_install_dismissed") === "1") setDismissed(true); } catch { /* ignore */ }

    // Use any prompt already captured by the root PWAInstall, or capture a fresh one
    const stashed = (window as unknown as { __pwaInstallPrompt?: BIPEvent }).__pwaInstallPrompt;
    if (stashed) setDeferred(stashed);
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => setStandalone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem("budi_install_dismissed", "1"); } catch { /* ignore */ }
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => {});
      setDeferred(null);
      setStandalone(true);
    } else if (isIOS) {
      setIosSheet(true);
    }
  }

  // Already installed, dismissed, or no install path available → show nothing
  if (standalone || dismissed) return null;
  if (!deferred && !isIOS) return null;

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "11px 12px",
      }}>
        <img src="/budi-icon-512.png" alt="" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>save budi as an app</div>
          <div style={{ fontSize: 12, color: C.muted }}>add it to your home screen</div>
        </div>
        <button onClick={install} style={{
          border: "none", borderRadius: 12, padding: "9px 18px", fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit", color: "#000", minHeight: 40,
          background: `linear-gradient(110deg, ${C.pink}, ${C.violet})`,
        }}>add</button>
        <button onClick={dismiss} aria-label="dismiss" style={{
          background: "transparent", border: "none", color: C.muted, fontSize: 16, cursor: "pointer", padding: 4,
        }}>✕</button>
      </div>

      {iosSheet && (
        <div onClick={() => setIosSheet(false)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: display }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 460, background: C.surface, borderTop: `1px solid ${C.border}`,
            borderRadius: "24px 24px 0 0", padding: "20px 22px calc(26px + env(safe-area-inset-bottom))", color: C.text,
          }}>
            <div style={{ width: 40, height: 4, background: C.border, borderRadius: 99, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <img src="/budi-icon-512.png" alt="" style={{ width: 44, height: 44, borderRadius: 12 }} />
              <div style={{ fontSize: 19, fontWeight: 700 }}>add budi to your home screen</div>
            </div>
            <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
              <li style={iosStep}>
                <span style={iosNum}>1</span>
                <span>tap the <b>Share</b> button
                  <svg width="15" height="17" viewBox="0 0 15 17" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-3px", margin: "0 4px" }} aria-hidden="true">
                    <path d="M7.5 10.5V2.2" />
                    <path d="M4.7 5l2.8-2.8L10.3 5" />
                    <path d="M4.5 7H3a1 1 0 00-1 1v6.5a1 1 0 001 1h9a1 1 0 001-1V8a1 1 0 00-1-1h-1.5" />
                  </svg>
                  at the bottom of Safari</span>
              </li>
              <li style={iosStep}><span style={iosNum}>2</span><span>scroll down and tap <b>“Add to Home Screen”</b></span></li>
              <li style={iosStep}><span style={iosNum}>3</span><span>tap <b>Add</b> — budi lands on your home screen like a real app</span></li>
            </ol>
            <button onClick={() => setIosSheet(false)} style={{
              width: "100%", marginTop: 20, background: C.surface2, border: `1px solid ${C.border}`, color: C.text,
              borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>got it</button>
          </div>
        </div>
      )}
    </>
  );
}

const iosStep: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, fontSize: 15, lineHeight: 1.4 };
const iosNum: React.CSSProperties = {
  width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
  background: C.pink, color: "#000", fontWeight: 800, fontSize: 14,
};
