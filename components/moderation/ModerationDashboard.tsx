"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

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

export default function ModerationDashboard() {
  const { data, isLoading, error } = useSWR<LogsResponse>(
    "/api/admin/moderation?limit=50",
    fetcher,
    { revalidateOnFocus: false },
  );

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Moderation</h1>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-red-600">Failed to load moderation logs.</p>}

      {logs.length === 0 && !isLoading ? (
        <p className="text-sm text-gray-500">No moderation actions yet.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Target</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">Admin</th>
                <th className="px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
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
      )}
    </div>
  );
}
