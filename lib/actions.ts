"use server";

import { auth } from "@/auth";
import {
  addVideo, addWallPost, sendMessage, sendFriendRequest,
  acceptFriendRequest, updateUser, getUserByUsername
} from "./db";
import { moderateText } from "./moderation";
import { revalidatePath } from "next/cache";

async function requireAuth(): Promise<{ id: string; name?: string | null; email?: string | null }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return { ...session.user, id: session.user.id };
}

export async function actionUploadVideo(title: string, url: string) {
  const user = await requireAuth();
  if (!user.id) throw new Error("No user id");
  await addVideo(user.id, title, url);
  revalidatePath("/watch");
}

export async function actionPostWallComment(profileId: string, content: string) {
  const user = await requireAuth();
  const mod = moderateText(content);
  if (!mod.ok) throw new Error(mod.reason ?? "Content not allowed");
  await addWallPost(user.id, profileId, content);
  revalidatePath(`/profile`);
}

export async function actionSendMessage(receiverId: string, content: string) {
  const user = await requireAuth();
  await sendMessage(user.id, receiverId, content);
}

export async function actionSendFriendRequest(addresseeId: string) {
  const user = await requireAuth();
  await sendFriendRequest(user.id, addresseeId);
  revalidatePath("/profile");
}

export async function actionAcceptFriendRequest(requesterId: string) {
  const user = await requireAuth();
  await acceptFriendRequest(requesterId, user.id);
  revalidatePath("/profile");
}

export async function actionUpdateProfile(fields: {
  username?: string;
  display_name?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatar_url?: string;
  banner_url?: string;
  profile_song_title?: string;
  profile_song_artist?: string;
  profile_song_url?: string;
  discord_handle?: string;
  steam_handle?: string;
}) {
  const user = await requireAuth();
  if (fields.username) {
    const existing = await getUserByUsername(fields.username);
    if (existing && existing.id !== user.id) {
      throw new Error("Username already taken");
    }
  }
  await updateUser(user.id, fields);
  revalidatePath("/profile");
}
