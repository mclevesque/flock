import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserById, getUserByUsername, createUser, createUserWithPassword } from "@/lib/db";

const nextAuthConfig = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
        guestToken: {},
        gsPortal: {},
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

        // ── Great Souls portal login (username only, no password) ────────────
        if (credentials?.gsPortal === "true") {
          const username = (credentials?.username as string ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
          if (!username || username.length < 2) return null;
          try {
            const existing = await getUserByUsername(username);
            if (!existing) return null;
            if (!existing.gs_portal) return null; // only gs_portal accounts can skip password
            return { id: existing.id as string, name: existing.username as string, email: null, image: null };
          } catch {
            return null;
          }
        }

        // ── Normal credentials login ──────────────────────────────────────────
        const username = (credentials?.username as string ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
        const password = credentials?.password as string ?? "";
        if (!username || !password || username.length < 2 || password.length < 3) return null;
        try {
          const existing = await getUserByUsername(username);
          if (existing) {
            if (!existing.password_hash) { console.error("[AUTH] No password_hash for user:", username); return null; }
            const valid = await bcrypt.compare(password, existing.password_hash as string);
            if (!valid) { console.error("[AUTH] bcrypt.compare failed for user:", username); return null; }
            return { id: existing.id as string, name: existing.username as string, email: null, image: null };
          }
          const hash = await bcrypt.hash(password, 10);
          const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          await createUserWithPassword(id, username, username, hash);
          return { id, name: username, email: null, image: null };
        } catch (err) {
          console.error("[AUTH] credentials login error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
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

export async function auth() {
  try {
    const session = await nextAuthConfig.auth();
    if (session?.user?.id) return session;
  } catch {
    // NextAuth not configured or no session
  }
  return null;
}
