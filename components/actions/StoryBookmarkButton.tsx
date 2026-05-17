"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

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
      className="inline-block border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {bookmarked ? "Bookmarked" : "Bookmark"}
    </button>
  );
}
