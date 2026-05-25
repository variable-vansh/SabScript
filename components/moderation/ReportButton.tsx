"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/validations";
import type { ReportReason } from "@/lib/validations";

type ReportButtonProps = {
  targetType: "submission" | "comment" | "premise" | "profile";
  targetId: string;
};

export default function ReportButton({ targetType, targetId }: ReportButtonProps) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const popoverRef = useRef<HTMLDivElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  // Don't render for logged-out users
  if (!userId) return null;

  // Don't render report button for own profile
  if (targetType === "profile" && targetId === userId) return null;

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);
    setStatus("idle");

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason: selected }),
      });

      if (res.ok) {
        setStatus("success");
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          setOpen(false);
          setStatus("idle");
          setSelected(null);
        }, 1200);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        title="Report"
        aria-label="Report"
      >
        ⚑
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden"
        >
          <div className="border-b border-gray-100 dark:border-gray-700 px-3 py-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Report — select reason</p>
          </div>

          <div className="max-h-48 overflow-y-auto p-1">
            {REPORT_REASONS.map((reason) => (
              <label
                key={reason}
                className={`flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  selected === reason ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400" : "text-gray-600 dark:text-gray-400"
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={reason}
                  checked={selected === reason}
                  onChange={() => setSelected(reason)}
                  className="accent-red-500"
                />
                {REPORT_REASON_LABELS[reason]}
              </label>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!selected || loading}
              className="border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 rounded"
            >
              {loading ? "…" : "Submit"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setSelected(null); setStatus("idle"); }}
              className="text-xs text-gray-400 hover:underline"
            >
              Cancel
            </button>
            {status === "success" && (
              <span className="text-xs text-green-600 dark:text-green-400">Reported ✓</span>
            )}
            {status === "error" && (
              <span className="text-xs text-red-500 dark:text-red-400">Failed</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
