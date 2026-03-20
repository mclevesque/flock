"use client";
import dynamic from "next/dynamic";

const VoicePopupClient = dynamic(() => import("./VoicePopupClient"), { ssr: false });

export default function VoicePopupPage() {
  return <VoicePopupClient />;
}
