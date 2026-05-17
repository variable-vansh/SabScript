"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { canAccessModeration } from "@/lib/roles";

export default function Header() {
  const { data: session } = useSession();
  const canModerate = canAccessModeration(session?.user?.role);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold">
            SabScript
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/stories" className="hover:underline">
              Stories
            </Link>
            <Link href="/seeds" className="hover:underline">
              Seeds
            </Link>
            {session?.user && (
              <Link href="/profile" className="hover:underline">
                Profile
              </Link>
            )}
            {canModerate && (
              <Link href="/moderation" className="hover:underline">
                Moderation
              </Link>
            )}
          </nav>
        </div>
        <div className="text-sm">
          {session?.user ? (
            <div className="flex items-center gap-3">
              <span>@{session.user.username ?? "user"}</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-gray-500 hover:underline"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void signIn("google")}
              className="hover:underline"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
