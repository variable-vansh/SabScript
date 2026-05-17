"use client";

import { useState } from "react";

type ModerationActionButtonProps = {
  action: "remove_comment" | "remove_submission" | "remove_seed" | "set_user_role" | "remove_discussion";
  targetId: string;
  parentType?: "submission" | "premise";
  triggerLabel: string;
  compact?: boolean;
  onSuccess?: () => void;
};

export default function ModerationActionButton({
  action,
  targetId,
  parentType,
  triggerLabel,
  compact = false,
  onSuccess,
}: ModerationActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAction() {
    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = { action, reason: reason.trim() || undefined };

    if (action === "remove_comment") body.commentId = targetId;
    else if (action === "remove_submission") body.submissionId = targetId;
    else if (action === "remove_seed") body.premiseId = targetId;
    else if (action === "remove_discussion") {
      body.parentType = parentType;
      body.parentId = targetId;
    } else if (action === "set_user_role") {
      body.userId = targetId;
      body.role = "banned";
    }

    try {
      const res = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json();
        setError(payload.error ?? "Action failed.");
        return;
      }

      setOpen(false);
      setReason("");
      onSuccess?.();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-xs text-red-500 hover:underline ${compact ? "" : "border border-red-300 px-2 py-1"}`}
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-2 border border-red-200 bg-red-50 p-2">
      <p className="text-xs font-medium text-red-700">Confirm: {action.replace(/_/g, " ")}</p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="w-full border border-gray-300 px-2 py-1 text-xs"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleAction()}
          disabled={loading}
          className="border border-red-400 px-2 py-0.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          {loading ? "..." : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="text-xs text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
