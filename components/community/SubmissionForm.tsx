"use client";

import { useState } from "react";
import { countWords } from "@/lib/utils";

type SubmissionFormProps = {
  roundId: string | null;
  isAuthenticated: boolean;
  canSubmit: boolean;
  userHasSubmitted: boolean;
  onCreated: (created: {
    id: string;
    content: string;
    createdAt: string;
    wordCount: number;
    endsStory: boolean;
  }) => void;
};

export default function SubmissionForm({
  roundId,
  isAuthenticated,
  canSubmit,
  userHasSubmitted,
  onCreated,
}: SubmissionFormProps) {
  const [content, setContent] = useState("");
  const [endsStory, setEndsStory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = countWords(content);
  const isValid = wordCount >= 100 && wordCount <= 200;

  if (!isAuthenticated) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to submit a continuation.</p>;
  }

  if (userHasSubmitted) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">You already submitted for this round.</p>;
  }

  if (!canSubmit || !roundId) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Submissions are not open for this round.</p>;
  }

  async function handleSubmit() {
    if (!isValid || submitting || !roundId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId, content: content.trim(), endsStory }),
      });

      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Failed to submit.");
        return;
      }

      onCreated({
        id: payload.id,
        content: content.trim(),
        createdAt: payload.createdAt ?? new Date().toISOString(),
        wordCount,
        endsStory,
      });
      setContent("");
      setEndsStory(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <h3 className="text-sm font-medium">Write the next segment…</h3>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-sm leading-6 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600"
        rows={5}
        placeholder="100–200 words"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className={`text-xs ${isValid ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
            {wordCount} / 100–200 words
          </span>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={endsStory}
              onChange={(e) => setEndsStory(e.target.checked)}
            />
            This ends the story
          </label>
        </div>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!isValid || submitting}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">2 submissions allowed per voting cycle</p>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
