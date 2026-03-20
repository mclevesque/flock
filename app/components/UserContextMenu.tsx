"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuUser {
  username: string;
  userId: string;
  x: number;
  y: number;
}

interface Props {
  user: ContextMenuUser;
  isHost?: boolean;
  onClose: () => void;
  onBoot?: (userId: string) => void;
  onMute?: (userId: string) => void;
  extraItems?: { label: string; icon: string; onClick: () => void }[];
}

export default function UserContextMenu({ user, isHost, onClose, onBoot, onMute, extraItems }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  // Adjust position so menu doesn't go off-screen
  const menuW = 190, menuH = 180;
  const x = Math.min(user.x, window.innerWidth - menuW - 8);
  const y = Math.min(user.y, window.innerHeight - menuH - 8);

  const items = [
    {
      label: "View Profile",
      icon: "👤",
      onClick: () => { window.location.href = `/profile/${user.username}`; onClose(); },
    },
    {
      label: "Send Message",
      icon: "💬",
      onClick: () => { window.location.href = `/messages?with=${user.userId}`; onClose(); },
    },
    ...(extraItems ?? []),
    ...(isHost && onBoot ? [{
      label: "Boot from Room",
      icon: "🚪",
      onClick: () => { onBoot(user.userId); onClose(); },
      danger: true,
    }] : []),
    ...(isHost && onMute ? [{
      label: "Mute in Chat",
      icon: "🔇",
      onClick: () => { onMute(user.userId); onClose(); },
    }] : []),
  ];

  const menu = (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 9999,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-bright)",
        borderRadius: 12,
        padding: "6px 0",
        minWidth: menuW,
        boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
        animation: "fadeIn 0.1s ease",
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ padding: "8px 14px 10px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-purple-bright)" }}>@{user.username}</div>
      </div>

      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.onClick}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 14px",
            background: "none",
            border: "none",
            color: (item as { danger?: boolean }).danger ? "#f87171" : "var(--text-primary)",
            fontSize: 13,
            cursor: "pointer",
            textAlign: "left",
            transition: "background 0.1s",
            fontFamily: "inherit",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
        >
          <span style={{ fontSize: 15, width: 20, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(menu, document.body);
}
