"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

type StarToggleButtonProps = {
  targetType: "comment" | "premise";
  targetId: string;
  initiallyStarred: boolean;
  className?: string;
};

export default function StarToggleButton({
  targetType,
  targetId,
  initiallyStarred,
  className,
}: StarToggleButtonProps) {
  const { data: session } = useSession();
  const [starred, setStarred] = useState(initiallyStarred);
  const [saving, setSaving] = useState(false);

  async function onToggle() {
    if (saving) return;
    if (!session?.user?.id) {
      await signIn("google");
      return;
    }

    const prev = starred;
    setStarred(!prev);
    setSaving(true);

    try {
      const res = await fetch("/api/stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      });
      if (!res.ok) throw new Error("Star toggle failed");
      const payload = (await res.json()) as { starred?: boolean };
      setStarred(Boolean(payload.starred));
    } catch {
      setStarred(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onToggle()}
      disabled={saving}
      className={className ?? "text-xs text-gray-400 hover:text-gray-700"}
    >
      {starred ? "★ Starred" : "☆ Star"}
    </button>
  );
}
