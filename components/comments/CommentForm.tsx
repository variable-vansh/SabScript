"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

type CommentFormProps = {
  canComment: boolean;
  shouldPromptSignIn: boolean;
  compact?: boolean;
  submitLabel?: string;
  placeholder?: string;
  onSubmitComment: (content: string) => Promise<void>;
};

export default function CommentForm({
  canComment,
  shouldPromptSignIn,
  compact = false,
  submitLabel = "Comment",
  placeholder = "Write a comment...",
  onSubmitComment,
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canComment) {
    if (shouldPromptSignIn) {
      return (
        <button
          type="button"
          onClick={() => void signIn("google")}
          className="text-sm text-gray-500 hover:underline"
        >
          Sign in to comment
        </button>
      );
    }
    return null;
  }

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    if (trimmed.length > 1000) {
      setError("Comment must be under 1000 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmitComment(trimmed);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        rows={compact ? 2 : 3}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-sm placeholder-gray-400 dark:placeholder-gray-500"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{content.length}/1000</span>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!content.trim() || submitting}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Posting..." : submitLabel}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
