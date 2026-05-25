"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import ModerationActionButton from "@/components/moderation/ModerationActionButton";
import { fetcher } from "@/lib/fetcher";
import { REPORT_REASON_LABELS } from "@/lib/validations";
import type { ReportReason } from "@/lib/validations";

// ── Types ───────────────────────────────────────────────────────────

type ReportDetail = {
  reason: string;
  reporter: string;
  createdAt: string;
};

type ReportGroup = {
  targetType: string;
  targetId: string;
  reportCount: number;
  latestReport: string | null;
  reports: ReportDetail[];
  preview: Record<string, unknown>;
  link: string | null;
  authorUsername: string | null;
};

type ReportsResponse = {
  groups: ReportGroup[];
};

type LogEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
  admin: { id: string; username: string | null; email: string };
};

type LogsResponse = {
  logs: LogEntry[];
};

// ── Helpers ─────────────────────────────────────────────────────────

function urgencyColor(count: number) {
  if (count >= 5) return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800";
  if (count >= 3) return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800";
  return "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
}

function targetBadge(type: string) {
  const colors: Record<string, string> = {
    submission: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    comment: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    premise: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
    profile: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
  };
  return colors[type] ?? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
}

function getActionForType(type: string): "remove_submission" | "remove_comment" | "remove_seed" | "set_user_role" {
  if (type === "submission") return "remove_submission";
  if (type === "comment") return "remove_comment";
  if (type === "premise") return "remove_seed";
  return "set_user_role";
}

function getActionLabel(type: string) {
  if (type === "profile") return "Ban User";
  return "Delete";
}

function getTargetIdField(type: string, targetId: string): string {
  return targetId;
}

// ── Component ───────────────────────────────────────────────────────

export default function ModerationDashboard() {
  const [tab, setTab] = useState<"reports" | "log">("reports");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Moderation</h1>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setTab("reports")}
          className={`px-3 py-1.5 text-sm font-medium ${
            tab === "reports"
              ? "border-b-2 border-gray-800 dark:border-gray-200 text-gray-900 dark:text-gray-100"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Reports Queue
        </button>
        <button
          type="button"
          onClick={() => setTab("log")}
          className={`px-3 py-1.5 text-sm font-medium ${
            tab === "log"
              ? "border-b-2 border-gray-800 dark:border-gray-200 text-gray-900 dark:text-gray-100"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Moderation Log
        </button>
      </div>

      {tab === "reports" ? <ReportsQueue /> : <ModerationLog />}
    </div>
  );
}

// ── Reports Queue ───────────────────────────────────────────────────

function ReportsQueue() {
  const { data, isLoading, error, mutate } = useSWR<ReportsResponse>(
    "/api/reports",
    fetcher,
    { revalidateOnFocus: false },
  );

  const groups = data?.groups ?? [];

  async function dismissReports(targetType: string, targetId: string) {
    try {
      await fetch("/api/reports", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      });
      void mutate();
    } catch {
      // silent
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading reports...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">Failed to load reports.</p>;
  if (groups.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">No pending reports. 🎉</p>;

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const preview = group.preview;
        const uniqueReasons = [...new Set(group.reports.map((r) => r.reason))];
        const action = getActionForType(group.targetType);

        return (
          <div
            key={`${group.targetType}:${group.targetId}`}
            className={`border p-4 ${urgencyColor(group.reportCount)}`}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* Badge + count */}
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase ${targetBadge(group.targetType)}`}>
                    {group.targetType}
                  </span>
                  <span className="text-xs font-bold">
                    {group.reportCount} report{group.reportCount !== 1 ? "s" : ""}
                  </span>
                  {group.authorUsername && (
                    <Link
                      href={`/profile/${group.authorUsername}`}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      @{group.authorUsername}
                    </Link>
                  )}
                </div>

                {/* Content preview */}
                <div className="mt-1.5">
                  {group.targetType === "profile" ? (
                    <p className="text-sm">
                      User: <span className="font-medium">{(preview.username as string) ?? "unknown"}</span>
                      {typeof preview.role === "string" && (
                        <span className="ml-2 text-xs text-gray-500">role: {preview.role}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      {(preview.title as string) ?? (preview.content as string) ?? "Content unavailable"}
                    </p>
                  )}
                </div>

                {/* Reasons */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {uniqueReasons.map((reason) => (
                    <span
                      key={reason}
                      className="inline-block border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-400 rounded"
                    >
                      {REPORT_REASON_LABELS[reason as ReportReason] ?? reason}
                    </span>
                  ))}
                </div>

                {/* Link to content */}
                {group.link && (
                  <Link
                    href={group.link}
                    className="mt-1.5 inline-block text-xs text-blue-600 hover:underline"
                  >
                    View content →
                  </Link>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col items-end gap-1.5">
                <ModerationActionButton
                  action={action}
                  targetId={getTargetIdField(group.targetType, group.targetId)}
                  triggerLabel={getActionLabel(group.targetType)}
                  onSuccess={() => dismissReports(group.targetType, group.targetId)}
                />
                <button
                  type="button"
                  onClick={() => void dismissReports(group.targetType, group.targetId)}
                  className="text-[10px] text-gray-400 hover:underline"
                >
                  Dismiss
                </button>
              </div>
            </div>

            {/* Reporter details (collapsed) */}
            <details className="mt-2">
              <summary className="cursor-pointer text-[10px] text-gray-500 hover:text-gray-700">
                Show {group.reports.length} individual report{group.reports.length !== 1 ? "s" : ""}
              </summary>
              <ul className="mt-1 space-y-0.5">
                {group.reports.map((r, i) => (
                  <li key={i} className="text-[10px] text-gray-500">
                    <span className="font-medium">{r.reporter}</span> —{" "}
                    {REPORT_REASON_LABELS[r.reason as ReportReason] ?? r.reason} ·{" "}
                    {new Date(r.createdAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        );
      })}
    </div>
  );
}

// ── Moderation Log ──────────────────────────────────────────────────

function ModerationLog() {
  const { data, isLoading, error } = useSWR<LogsResponse>(
    "/api/admin/moderation?limit=50",
    fetcher,
    { revalidateOnFocus: false },
  );

  const logs = data?.logs ?? [];

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">Failed to load moderation logs.</p>;

  if (logs.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No moderation actions yet.</p>;
  }

  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500 dark:text-gray-400">
            <th className="px-4 py-2">Action</th>
            <th className="px-4 py-2">Target</th>
            <th className="px-4 py-2">Reason</th>
            <th className="px-4 py-2">Admin</th>
            <th className="px-4 py-2">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {logs.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-2 text-xs">{entry.action}</td>
              <td className="px-4 py-2 text-xs">
                {entry.targetType}:{entry.targetId.slice(0, 8)}
              </td>
              <td className="px-4 py-2 text-xs text-gray-500">
                {entry.reason ?? "—"}
              </td>
              <td className="px-4 py-2 text-xs">
                @{entry.admin.username ?? entry.admin.email}
              </td>
              <td className="px-4 py-2 text-xs text-gray-500">
                {new Date(entry.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
