/**
 * Standalone Theater API — YouTube-sync cinema room
 * Used by /stremio page (Theater tab) independently of the town.
 * Shares the same DB tables as town theater (town_theater / town_theater_chat / etc.)
 * but uses partyId = "stremio-main" so it has its own state.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getTheaterState, setTheaterVideo, setTheaterSeat, clearTheaterSeat, clearTheaterAll,
  pauseTheater, unpauseTheater, seekTheater,
  addTheaterChat, getTheaterChat,
  setScreenshareOffer, setScreenshareAnswer, getScreenshareAnswer,
  setViewerOffer, getAllViewerOffers, clearViewerOffer, clearAllViewerOffers,
  setTheaterJukebox,
} from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

// Standalone theater uses a fixed party ID so it doesn't conflict with town's theater
const PARTY_ID = "stremio-main";

export async function GET() {
  try {
    const [theater_state, theater_chat] = await Promise.all([
      getTheaterState(PARTY_ID).catch(() => null),
      getTheaterChat(PARTY_ID).catch(() => []),
    ]);
    return NextResponse.json({ theater_state, theater_chat });
  } catch (err) {
    console.error("Theater GET error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (body.action === "theater-set-video") {
    const videoUrl = String(body.videoUrl ?? "").trim();
    if (!videoUrl) return NextResponse.json({ error: "videoUrl required" }, { status: 400 });
    await setTheaterVideo(videoUrl, Date.now(), u.id, PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-sit") {
    const seatIdx = body.seatIdx;
    if (seatIdx == null) return NextResponse.json({ error: "seatIdx required" }, { status: 400 });
    await clearTheaterSeat(u.id, PARTY_ID);
    await setTheaterSeat(Number(seatIdx), u.id, u.name ?? "Viewer", PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-stand") {
    await clearTheaterSeat(u.id, PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-clear-video") {
    await setTheaterVideo("", 0, "", PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-reset-all") {
    await clearTheaterAll(PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-pause") {
    await pauseTheater(Date.now(), PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-unpause") {
    await unpauseTheater(Date.now(), PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-seek") {
    const newStartedAt = body.newStartedAt;
    if (!newStartedAt) return NextResponse.json({ error: "newStartedAt required" }, { status: 400 });
    await seekTheater(Number(newStartedAt), PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-chat") {
    const message = String(body.message ?? "").trim();
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });
    await addTheaterChat(u.id, u.name ?? "Anonymous", u.image ?? `/api/avatar/${u.id}`, message, PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-screenshare-offer") {
    await setScreenshareOffer(body.offer ?? null, PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-screenshare-answer") {
    const { viewerId, answer } = body;
    if (!viewerId || !answer) return NextResponse.json({ error: "Missing params" }, { status: 400 });
    await setScreenshareAnswer(viewerId, answer);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-screenshare-get-answer") {
    const answer = await getScreenshareAnswer(u.id).catch(() => null);
    return NextResponse.json({ answer });
  }

  if (body.action === "theater-ss-viewer-offer") {
    await setViewerOffer(u.id, body.offer);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-ss-get-viewer-offers") {
    const offers = await getAllViewerOffers().catch(() => []);
    return NextResponse.json({ offers });
  }

  if (body.action === "theater-ss-host-answer") {
    const { viewerId, answer } = body;
    if (!viewerId || !answer) return NextResponse.json({ error: "Missing params" }, { status: 400 });
    await setScreenshareAnswer(viewerId, answer);
    await clearViewerOffer(viewerId);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-ss-get-my-answer") {
    const answer = await getScreenshareAnswer(u.id).catch(() => null);
    if (answer) await clearAllViewerOffers().catch(() => {});
    return NextResponse.json({ answer });
  }

  if (body.action === "theater-ss-stop") {
    await setScreenshareOffer(null, PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-jukebox-play") {
    const jukeboxUrl = String(body.jukeboxUrl ?? "").trim();
    if (!jukeboxUrl) return NextResponse.json({ error: "jukeboxUrl required" }, { status: 400 });
    await setTheaterJukebox(jukeboxUrl, Date.now(), u.name ?? "Someone", PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "theater-jukebox-stop") {
    await setTheaterJukebox(null, null, null, PARTY_ID);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
