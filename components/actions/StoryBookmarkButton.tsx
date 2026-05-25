"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { Bookmark, BookmarkCheck } from "lucide-react";

type StoryBookmarkButtonProps = {
  storyId: string;
  initiallyBookmarked: boolean;
};

export default function StoryBookmarkButton({
  storyId,
  initiallyBookmarked,
}: StoryBookmarkButtonProps) {
  const { data: session } = useSession();
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked);
  const [saving, setSaving] = useState(false);

  async function onToggle() {
    if (saving) return;
    if (!session?.user?.id) {
      await signIn("google");
      return;
    }

    const prev = bookmarked;
    setBookmarked(!prev);
    setSaving(true);

    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      if (!res.ok) throw new Error("Bookmark toggle failed");
      const payload = (await res.json()) as { bookmarked?: boolean };
      setBookmarked(Boolean(payload.bookmarked));
    } catch {
      setBookmarked(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onToggle()}
      disabled={saving}
      className={`rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        bookmarked
          ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
          : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
      title={bookmarked ? "Bookmarked" : "Bookmark"}
    >
      {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
    </button>
  );
}
