"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SeedComposeForm({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  async function handleSubmit() {
    if (!session?.user?.id) {
      await signIn("google");
      return;
    }
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/premises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Failed to submit seed.");
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Submit a new seed</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Cancel
        </button>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Seed title"
        maxLength={100}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600"
      />

      <div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your seed premise (100–150 words)..."
          rows={5}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <span className={wordCount < 100 || wordCount > 150 ? "text-red-500 dark:text-red-400" : ""}>
            {wordCount}/150 words
          </span>
          <span>100–150 required</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || !title.trim() || wordCount < 100 || wordCount > 150}
          className="rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-1.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
