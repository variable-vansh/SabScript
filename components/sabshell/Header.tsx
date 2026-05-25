"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { Sun, Moon, ChevronDown, User, Shield, LogOut } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { canAccessModeration } from "@/lib/roles";

export default function Header() {
  const { data: session } = useSession();
  const canModerate = canAccessModeration(session?.user?.role);
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const username = session?.user?.username ?? "user";
  const avatarLetter = username.charAt(0).toUpperCase();

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f0f] transition-colors">
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
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {/* Dark/Light mode toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Account area */}
          {session?.user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-7 w-7 rounded-full"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {avatarLetter}
                  </span>
                )}
                <span className="hidden sm:inline">@{username}</span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <User size={15} className="text-gray-400" />
                    View Profile
                  </Link>
                  {canModerate && (
                    <Link
                      href="/moderation"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Shield size={15} className="text-gray-400" />
                      Moderation
                    </Link>
                  )}
                  <div className="border-t border-gray-100 dark:border-gray-700" />
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); void signOut(); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <LogOut size={15} className="text-gray-400" />
                    Sign out
                  </button>
                </div>
              )}
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
