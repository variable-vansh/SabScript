"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        setOpen(false);
        setError(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading]);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-xs text-red-500 hover:underline ${compact ? "" : "border border-red-300 px-2 py-1"}`}
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close action popup"
            onClick={() => {
              if (loading) return;
              setOpen(false);
              setError(null);
            }}
          />
          <div className="relative w-full max-w-md border border-gray-200 bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-gray-800">
              Confirm moderation action
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {action.replace(/_/g, " ")} for target {targetId.slice(0, 8)}...
            </p>

            <label className="mt-3 block text-xs font-medium text-gray-700">
              Reason
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Add internal reason for audit trail (optional)"
                rows={3}
                className="mt-1 w-full resize-y border border-gray-300 px-2 py-1.5 text-xs"
              />
            </label>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleAction()}
                disabled={loading}
                className="border border-red-400 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {loading ? "Applying..." : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (loading) return;
                  setOpen(false);
                  setError(null);
                }}
                className="text-xs text-gray-500 hover:underline"
              >
                Cancel
              </button>
            </div>

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
