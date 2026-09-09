// Shared game catalog — single source of truth for HubClient + GlobalPartyWidget

export interface CatalogGame {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  multiplayer: boolean;
  comingSoon?: boolean;
  launchType: "emulator" | "nav" | "iframe";
  href?: string;
  iframeUrl?: string;
}

export const ALL_GAMES: CatalogGame[] = [
  {
    id: "outbreak", title: "Outbreak", desc: "Co-op zombie survival roguelike", emoji: "🧟",
    multiplayer: true, launchType: "nav", href: "/outbreak",
  },
  {
    id: "tightrope", title: "Tightrope Terror", desc: "Balance your way across the void", emoji: "🎪",
    multiplayer: false, launchType: "iframe", iframeUrl: "/games/tightrope/index.html",
  },
  {
    id: "matty", title: "Matty Milkers", desc: "Raw milk platformer adventure", emoji: "🥛",
    multiplayer: false, launchType: "iframe", iframeUrl: "/games/matty-milkers/index.html",
  },
  {
    id: "wingman", title: "Wingman", desc: "Dating platformer — charm your way", emoji: "💘",
    multiplayer: false, launchType: "iframe", iframeUrl: "/games/wingman/index.html",
  },
  {
    id: "chess", title: "Chess", desc: "Classic 1v1 with ELO rating", emoji: "♟️",
    multiplayer: true, launchType: "nav", href: "/chess",
  },
  {
    id: "pong", title: "Paddle", desc: "Classic back-and-forth pong", emoji: "🏓",
    multiplayer: true, launchType: "nav", href: "/pong",
  },
  {
    id: "emulator", title: "SNES", desc: "Classic retro games + netplay", emoji: "🕹️",
    multiplayer: true, launchType: "emulator", href: "/emulator",
  },
  {
    id: "emberkin", title: "Emberkin", desc: "Hatch it. Raise it. Find out what it becomes.", emoji: "🥚",
    multiplayer: true, launchType: "nav", href: "/emberkin",
  },
  {
    id: "reakt", title: "REAKT", desc: "Co-op 3D FPS with fracture chains", emoji: "💥",
    multiplayer: true, comingSoon: true, launchType: "nav", href: "/reakt",
  },
  {
    id: "draftmasters", title: "DraftMasters", desc: "Auction draft anything — $20, five picks, one winner", emoji: "🔨",
    multiplayer: true, launchType: "nav", href: "/draftmasters",
  },
  {
    id: "nerd-alert", title: "Nerd Alert!", desc: "Jeopardy with all your geek favorites", emoji: "⚡",
    multiplayer: true, launchType: "nav", href: "/nerd-alert",
  },
];

export const GAME_SECTIONS = [
  {
    label: "BATTLE ARENA", icon: "⚔️",
    games: ALL_GAMES.filter(g => ["outbreak", "tightrope", "matty", "wingman"].includes(g.id)),
  },
  {
    label: "TABLE GAMES", icon: "🎲",
    games: ALL_GAMES.filter(g => ["chess", "pong", "draftmasters"].includes(g.id)),
  },
  {
    label: "SOULBOUND", icon: "🥚",
    games: ALL_GAMES.filter(g => g.id === "emberkin"),
  },
  {
    label: "PARTY", icon: "🎉",
    games: ALL_GAMES.filter(g => ["nerd-alert"].includes(g.id)),
  },
  {
    label: "RETRO", icon: "🕹️",
    games: ALL_GAMES.filter(g => g.id === "emulator"),
  },
  {
    label: "COMING SOON", icon: "🚀",
    games: ALL_GAMES.filter(g => g.comingSoon),
  },
];

// Games available to party-launch (multiplayer, not coming soon)
export const PARTY_GAMES = ALL_GAMES.filter(g => g.multiplayer && !g.comingSoon);
