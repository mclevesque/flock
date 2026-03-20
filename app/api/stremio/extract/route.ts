import { NextRequest, NextResponse } from "next/server";
import { inflateSync } from "zlib";

// Stremio web URLs encode stream data as zlib-compressed JSON in base64.
// This endpoint extracts the actual playable stream URL from them.

export async function POST(req: NextRequest) {
  const { url } = await req.json().catch(() => ({}));
  if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

  // ── web.strem.io/#/player/BASE64 ──────────────────────────────────────────
  const playerMatch = (url as string).match(/#\/player\/([^&?#\s]+)/);
  if (playerMatch) {
    try {
      const encoded = decodeURIComponent(playerMatch[1]);
      const buf = Buffer.from(encoded, "base64");
      const json = inflateSync(buf).toString("utf8");
      const data = JSON.parse(json) as Record<string, unknown>;

      const stream = (data.stream ?? data) as Record<string, unknown>;
      const streamUrl = (stream.url ?? stream.streamUrl ?? data.url ?? data.streamUrl) as string | undefined;
      const infoHash = (stream.infoHash ?? stream.infohash) as string | undefined;
      const fileIdx = (stream.fileIdx ?? stream.file_idx ?? 0) as number;
      const streamingServerUrl = (data.streamingServerUrl ?? "http://127.0.0.1:11470") as string;
      const title = (stream.title ?? data.title ?? "") as string;

      // Direct HTTP URL → playable immediately
      if (streamUrl && (streamUrl.startsWith("http://") || streamUrl.startsWith("https://"))) {
        return NextResponse.json({
          ok: true,
          streamUrl,
          streamingServerUrl,
          title,
          type: "http",
        });
      }

      // Torrent stream → build the Stremio desktop streaming URL
      if (infoHash) {
        // Stremio desktop server streams torrents at:
        // http://127.0.0.1:11470/stream/{base64(JSON)}/video.mp4
        const streamDescriptor = Buffer.from(JSON.stringify({ infoHash, fileIdx })).toString("base64");
        const localUrl = `${streamingServerUrl}/stream/${streamDescriptor}/stream.mkv`;
        return NextResponse.json({
          ok: true,
          streamUrl: localUrl,
          streamingServerUrl,
          title,
          type: "torrent",
          infoHash,
          fileIdx,
          note: "This is a torrent stream. Make sure Stremio desktop is running.",
        });
      }

      return NextResponse.json({
        ok: false,
        error: "Could not extract a playable URL from this Stremio link.",
        parsed: { streamUrl, infoHash, stream },
      }, { status: 400 });
    } catch (e) {
      return NextResponse.json({
        ok: false,
        error: "Failed to decode Stremio URL: " + String(e),
      }, { status: 400 });
    }
  }

  // Not a Stremio player URL — return it as-is (it might be a direct stream already)
  return NextResponse.json({ ok: true, streamUrl: url, type: "direct" });
}
