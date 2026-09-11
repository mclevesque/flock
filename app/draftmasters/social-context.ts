"use client";

import { createContext, useContext } from "react";
import type { DraftMedia } from "./useDraftMedia";
import type { PlayerRecord } from "./types";

/**
 * The shape of DraftMasters' social layer, shared by everything that reads it.
 *
 * Kept apart from SocialProvider so the drawer, the tabs and the room can all
 * import the hook without importing the provider that renders them.
 */

export interface SocialMe {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
}

export interface SocialFriend {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  online: boolean;
  inDraft: boolean;
  unread: number;
  last: { text: string; fromMe: boolean; at: string } | null;
  record: PlayerRecord | null;
}

export interface SocialPending {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
}

export interface ChatMsg {
  id: number;
  from: string;
  to: string;
  text: string;
  at: string;
  /** Sent from this tab and not yet confirmed by the server. */
  pending?: boolean;
}

export interface ActiveRoomInfo {
  code: string;
  isHost: boolean;
  at: string;
}

/** What arrives on the per-user notifications party. Same shape the hub sends. */
export interface PushMessage {
  type: string;
  senderId?: string;
  receiverId?: string;
  content?: string;
  preview?: string;
  messageId?: number;
  createdAt?: string;
  timestamp?: number;
  from?: { userId: string; username: string; avatarUrl?: string };
}

export interface ChatVoice {
  /** The friend this tab is in voice with, if any. */
  withId: string | null;
  media: DraftMedia;
  /** They have joined the same voice room. */
  peerHere: boolean;
  /** They muted their own mic. */
  peerMuted: boolean;
  join: (friendId: string) => void;
  leave: () => void;
  /** Tell the other side your mic flipped. */
  announceMute: (micOn: boolean) => void;
}

export interface Social {
  /** False outside the provider — signed out, or a page that has none. */
  ready: boolean;
  me: SocialMe | null;
  friends: SocialFriend[];
  pending: SocialPending[];
  activeRoom: ActiveRoomInfo | null;
  loaded: boolean;
  unreadTotal: number;
  isOpen: boolean;
  chatWith: string | null;
  inGame: boolean;
  voice: ChatVoice | null;

  refresh: () => Promise<void>;
  /** Open the drawer; with an id, straight into that chat. */
  open: (friendId?: string | null) => void;
  close: () => void;
  act: (body: Record<string, unknown>) => Promise<{ ok: boolean; note?: string; error?: string; sent?: string[] }>;
  invite: (userIds: string[], code: string) => Promise<{ sent: string[]; error?: string }>;
  markRead: (friendId: string) => void;
  /** Server-side "this is my room now", for Back to your game on another device. */
  rememberRoom: (code: string | null, host?: boolean) => void;
  /** Go to a room: straight in if the game is on screen, by navigation if not. */
  joinRoom: (code: string) => void;
  setJoinHandler: (fn: ((code: string) => void) | null) => void;
  setInGame: (inGame: boolean) => void;
  subscribe: (fn: (msg: PushMessage) => void) => () => void;
}

const noop = () => {};

export const SocialContext = createContext<Social>({
  ready: false,
  me: null,
  friends: [],
  pending: [],
  activeRoom: null,
  loaded: false,
  unreadTotal: 0,
  isOpen: false,
  chatWith: null,
  inGame: false,
  voice: null,
  refresh: async () => {},
  open: noop,
  close: noop,
  act: async () => ({ ok: false, error: "Sign in first." }),
  invite: async () => ({ sent: [], error: "Sign in first." }),
  markRead: noop,
  rememberRoom: noop,
  joinRoom: (code) => {
    window.location.href = `/draftmasters?room=${encodeURIComponent(code)}`;
  },
  setJoinHandler: noop,
  setInGame: noop,
  subscribe: () => noop,
});

export function useSocial(): Social {
  return useContext(SocialContext);
}
