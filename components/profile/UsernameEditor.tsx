"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";

type UsernameEditorProps = {
  initialUsername: string;
};

export default function UsernameEditor({ initialUsername }: UsernameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(initialUsername);
  const [draft, setDraft] = useState(initialUsername);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEditing() {
    setDraft(username);
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setDraft(username);
    setError(null);
  }

  async function saveUsername() {
    const trimmed = draft.trim().toLowerCase();
    if (!trimmed || trimmed === username) {
      cancelEditing();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });

      const payload = await res.json();

      if (!res.ok) {
        setError(payload.error ?? "Failed to update username.");
        return;
      }

      setUsername(payload.username);
      setEditing(false);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") void saveUsername();
    if (e.key === "Escape") cancelEditing();
  }

  if (editing) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-gray-400">@</span>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-lg font-bold focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600"
            maxLength={30}
          />
          <button
            type="button"
            onClick={() => void saveUsername()}
            disabled={saving}
            className="rounded-lg p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
            title="Save"
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            disabled={saving}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="text-xl font-bold">@{username}</h1>
      <button
        type="button"
        onClick={startEditing}
        className="rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Edit username"
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}
