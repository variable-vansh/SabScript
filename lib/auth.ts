import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { normalizeUsername } from "@/lib/utils";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { role: true },
        });
        if (dbUser?.role === "banned") return false;
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.username =
          (user as { username?: string | null }).username ?? null;
        token.role = (user as { role?: string | null }).role ?? "user";
      }

      if (trigger === "update" && session?.username) {
        token.username = normalizeUsername(session.username);
      }

      if (
        token.sub &&
        (typeof token.username === "undefined" || typeof token.role === "undefined")
      ) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { username: true, role: true },
        });
        token.username = dbUser?.username ?? null;
        token.role = dbUser?.role ?? "user";
      }

      if (typeof token.username === "string") {
        token.username = normalizeUsername(token.username);
      }

      if (typeof token.role !== "string") {
        token.role = "user";
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.username =
          typeof token.username === "string" ? token.username : null;
        session.user.role = typeof token.role === "string" ? token.role : "user";
      }

      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
});
