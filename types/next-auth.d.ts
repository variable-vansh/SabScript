import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    username?: string;
    user: {
      id: string;
      username: string | null;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string | null;
    role?: string;
  }
}
