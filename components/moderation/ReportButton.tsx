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
        setTimeout(() => {
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
          className="absolute right-0 top-full z-50 mt-1 w-56 border border-gray-200 bg-white shadow-lg"
        >
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="text-xs font-semibold text-gray-700">Report — select reason</p>
          </div>

          <div className="max-h-48 overflow-y-auto p-1">
            {REPORT_REASONS.map((reason) => (
              <label
                key={reason}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 ${
                  selected === reason ? "bg-red-50 text-red-700" : "text-gray-600"
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

          <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!selected || loading}
              className="border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
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
              <span className="text-xs text-green-600">Reported ✓</span>
            )}
            {status === "error" && (
              <span className="text-xs text-red-500">Failed</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
