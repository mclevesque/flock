import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Returns WebRTC ICE server config.
 * If TURN_SERVER_IP + TURN_SECRET are set, generates time-limited
 * HMAC-SHA1 credentials (coturn TURN REST API format).
 * Falls back to Google STUN only.
 */
export async function GET() {
  const turnIp = process.env.TURN_SERVER_IP;
  const turnSecret = process.env.TURN_SECRET;

  const stun = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  if (!turnIp || !turnSecret) {
    return NextResponse.json({ iceServers: stun });
  }

  // Time-limited credential: valid for 24 hours
  // Format: username = "<expiry_unix>:<user_label>"
  //         credential = base64(HMAC-SHA1(secret, username))
  const expiry = Math.floor(Date.now() / 1000) + 86400;
  const username = `${expiry}:greatsouls`;
  const credential = crypto
    .createHmac("sha1", turnSecret)
    .update(username)
    .digest("base64");

  const iceServers = [
    ...stun,
    {
      urls: [
        `turn:${turnIp}:3478?transport=udp`,
        `turn:${turnIp}:3478?transport=tcp`,
      ],
      username,
      credential,
    },
  ];

  return NextResponse.json({ iceServers }, {
    headers: { "Cache-Control": "no-store" },
  });
}
