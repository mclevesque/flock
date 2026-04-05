// Stremio account auth + addon helpers
// All communication happens client-side — greatsouls.net never touches stream data

const STREMIO_API = "https://api.strem.io/api";
const CINEMETA_URL = "https://v3-cinemeta.strem.io";
const LS_KEY = "gs_stremio_auth";

export interface StremioAuth {
  authKey: string;
  email: string;
}

export interface StremioAddon {
  manifest: {
    id: string;
    name: string;
    description?: string;
    types?: string[];
    catalogs?: { type: string; id: string; name?: string }[];
    resources?: string[];
  };
  transportUrl: string;
  flags?: Record<string, unknown>;
}

export interface CatalogItem {
  id: string;
  type: string;
  name: string;
  poster?: string;
  posterShape?: string;
  background?: string;
  year?: string;
  imdbRating?: string;
  description?: string;
  genres?: string[];
  runtime?: string;
}

export interface MetaDetail extends CatalogItem {
  cast?: string[];
  director?: string[];
  videos?: { id: string; title: string; season: number; episode: number; released?: string; thumbnail?: string }[];
  releaseInfo?: string;
  links?: { name: string; category: string; url: string }[];
}

export interface StreamResult {
  url?: string;
  infoHash?: string;
  fileIdx?: number;
  title?: string;
  name?: string;
  behaviorHints?: Record<string, unknown>;
}

export interface ClassifiedStream extends StreamResult {
  addonName: string;
  quality: string;
  streamType: "http" | "torrent" | "external";
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function stremioLogin(email: string, password: string): Promise<StremioAuth> {
  const res = await fetch(`${STREMIO_API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, type: "Login" }),
  });
  const data = await res.json();
  if (data.error) {
    const msg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    throw new Error(msg);
  }
  // Stremio API returns { result: { authKey, user } } on success
  const authKey = data.result?.authKey ?? data.authKey;
  if (!authKey) throw new Error("Login failed — no auth key returned. Check your email and password.");
  const auth: StremioAuth = { authKey, email };
  try { localStorage.setItem(LS_KEY, JSON.stringify(auth)); } catch {}
  return auth;
}

export function getStoredAuth(): StremioAuth | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StremioAuth;
  } catch { return null; }
}

export function clearAuth() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

// ── Addons ────────────────────────────────────────────────────────────────────

export async function getUserAddons(authKey: string): Promise<StremioAddon[]> {
  const res = await fetch(`${STREMIO_API}/addonCollectionGet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "AddonCollectionGet", authKey }),
  });
  const data = await res.json();
  if (data.error) {
    const msg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    throw new Error(msg);
  }
  const addons = (data.result?.addons ?? data.addons ?? []) as StremioAddon[];
  console.log(`[Soul Cinema] Loaded ${addons.length} addons:`,
    addons.map(a => `${a.manifest.name} (${a.transportUrl})`).join(", "));
  return addons;
}

// ── Catalog (Cinemeta — public, CORS-enabled) ────────────────────────────────

export async function fetchCatalog(
  type: "movie" | "series",
  catalogId: string,
  skip = 0
): Promise<CatalogItem[]> {
  const url = `${CINEMETA_URL}/catalog/${type}/${catalogId}/skip=${skip}.json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.metas ?? []) as CatalogItem[];
}

export async function searchCatalog(
  type: "movie" | "series",
  query: string
): Promise<CatalogItem[]> {
  const url = `${CINEMETA_URL}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.metas ?? []) as CatalogItem[];
}

export async function fetchMeta(type: string, id: string): Promise<MetaDetail | null> {
  const url = `${CINEMETA_URL}/meta/${type}/${id}.json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.meta ?? null) as MetaDetail | null;
}

// ── Streams (fetched client-side from user's addons) ─────────────────────────

function parseQuality(title?: string): string {
  if (!title) return "Unknown";
  const t = title.toLowerCase();
  if (/2160p|4k|uhd/.test(t)) return "4K";
  if (/1080p|full\s*hd/.test(t)) return "1080p";
  if (/720p|hd/.test(t)) return "720p";
  if (/480p|sd/.test(t)) return "480p";
  return "Unknown";
}

function classifyStream(s: StreamResult): "http" | "torrent" | "external" {
  if (s.url && /^https?:\/\//.test(s.url)) return "http";
  if (s.infoHash) return "torrent";
  return "external";
}

export async function fetchStreams(
  addons: StremioAddon[],
  type: string,
  id: string
): Promise<ClassifiedStream[]> {
  const streamAddons = addons.filter(a => {
    const resources = a.manifest.resources ?? [];
    return resources.includes("stream") || resources.some(
      (r: unknown) => typeof r === "object" && r !== null && (r as { name?: string }).name === "stream"
    );
  });
  console.log(`[Soul Cinema] ${streamAddons.length} stream addons out of ${addons.length} total:`,
    streamAddons.map(a => a.manifest.name));

  const results = await Promise.allSettled(
    streamAddons.map(async (addon) => {
      // transportUrl is like "https://torrentio.strem.fun/manifest.json" — strip manifest.json
      const base = addon.transportUrl.replace(/\/manifest\.json$/, "").replace(/\/$/, "");
      const addonUrl = `${base}/stream/${type}/${id}.json`;
      // Proxy through our server to avoid CORS blocks
      const res = await fetch("/api/stremio/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: addonUrl }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        console.log(`[Soul Cinema] ${addon.manifest.name} returned ${res.status} for ${addonUrl.slice(0, 80)}`);
        return [];
      }
      const data = await res.json();
      console.log(`[Soul Cinema] ${addon.manifest.name}: ${data.streams?.length ?? 0} streams`);
      return ((data.streams ?? []) as StreamResult[]).map((s): ClassifiedStream => ({
        ...s,
        addonName: addon.manifest.name,
        quality: parseQuality(s.title ?? s.name),
        streamType: classifyStream(s),
      }));
    })
  );

  const streams: ClassifiedStream[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") streams.push(...r.value);
  }

  // Sort: HTTP first, then by quality
  const qOrder: Record<string, number> = { "4K": 0, "1080p": 1, "720p": 2, "480p": 3, "Unknown": 4 };
  streams.sort((a, b) => {
    if (a.streamType === "http" && b.streamType !== "http") return -1;
    if (a.streamType !== "http" && b.streamType === "http") return 1;
    return (qOrder[a.quality] ?? 5) - (qOrder[b.quality] ?? 5);
  });

  return streams;
}

// ── Torrent playback URL (via local Stremio desktop) ─────────────────────────

export function buildTorrentUrl(infoHash: string, fileIdx = 0): string {
  const descriptor = btoa(JSON.stringify({ infoHash, fileIdx }));
  return `http://127.0.0.1:11470/stream/${descriptor}/stream.mp4`;
}

export async function isStremioDesktopRunning(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:11470/stats.json", {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
