import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserById, getUserByUsername, createUser, createUserWithPassword, updateUser } from "@/lib/db";

const nextAuthConfig = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
        guestToken: {},
      },
      async authorize(credentials) {
        // ── Guest / Warrior mode ─────────────────────────────────────────────
        if (credentials?.guestToken) {
          const validToken = process.env.GUEST_TOKEN ?? "ryft_warrior_guest";
          if (credentials.guestToken !== validToken) return null;
          const WARRIOR_ID = "warrior_guest";
          try {
            const existing = await getUserById(WARRIOR_ID);
            if (existing) return { id: WARRIOR_ID, name: "warrior", email: null, image: null };
          } catch { /* create below */ }
          try {
            await createUser(WARRIOR_ID, "warrior", "WARRIOR", "/warrior-avatar.svg");
          } catch { /* may already exist from race */ }
          return { id: WARRIOR_ID, name: "warrior", email: null, image: null };
        }

        // ── Normal credentials login ──────────────────────────────────────────
        const username = (credentials?.username as string ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
        const password = credentials?.password as string ?? "";
        if (!username || !password || username.length < 2 || password.length < 3) return null;
        try {
          const existing = await getUserByUsername(username);
          if (existing) {
            if (!existing.password_hash) return null;
            const valid = await bcrypt.compare(password, existing.password_hash as string);
            if (!valid) return null;
            return { id: existing.id as string, name: existing.username as string, email: null, image: null };
          }
          const hash = await bcrypt.hash(password, 10);
          const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          await createUserWithPassword(id, username, username, hash);
          return { id, name: username, email: null, image: null };
        } catch {
          return null;
        }
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
  ],
  callbacks: {
    // Explicitly persist user.id into the JWT so session.user.id is always reliable
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async signIn({ user, profile }) {
      if (!user.id || !profile) return true;
      try {
        const existing = await getUserById(user.id);
        if (!existing) {
          const username =
            (profile?.login as string) ??
            (profile?.email as string)?.split("@")[0]?.replace(/[^a-z0-9_]/gi, "").slice(0, 20) ??
            `user${user.id.slice(0, 6)}`;
          await createUser(user.id, username, user.name ?? username, user.image ?? "");
        } else if (user.image) {
          // Re-login via GitHub — sync their avatar if they don't have a custom one set
          const currentAvatar = existing.avatar_url as string | null;
          if (!currentAvatar || currentAvatar.length === 0) {
            await updateUser(user.id, { avatar_url: user.image });
          }
        }
      } catch {
        // DB not set up yet — allow sign in anyway
      }
      return true;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
});

export const { handlers, signIn, signOut } = nextAuthConfig;
const nextAuthSession = nextAuthConfig.auth;

// ─── Hybrid auth() ───────────────────────────────────────────────────────────
// Checks NextAuth (credentials/GitHub users) first, then falls back to Clerk
// (Google / Discord users). All 81 API routes import this without changes.
import { auth as clerkServerAuth } from "@clerk/nextjs/server";

export async function auth() {
  // 1. Try NextAuth session (existing username/password + GitHub users)
  try {
    const naSession = await nextAuthSession();
    if (naSession?.user?.id) return naSession;
  } catch {
    // NextAuth not configured or no session
  }

  // 2. Fall back to Clerk session (Google / Discord OAuth users)
  try {
    const { userId, sessionClaims } = await clerkServerAuth();
    if (!userId) return null;
    const meta = (sessionClaims?.publicMetadata ?? {}) as {
      username?: string;
      avatar_url?: string;
    };
    return {
      user: {
        id: userId,
        name: meta.username ?? null,
        image: meta.avatar_url ?? null,
        email: null as string | null,
      },
    };
  } catch {
    return null;
  }
}
