"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type StoryRow = {
  id: string;
  title: string;
  status: string;
  wordCount: number;
  submissionCount: number;
  createdAt: string;
  currentRound: {
    roundNumber: number;
    endsAt: string;
    status: "open" | "overtime";
  } | null;
};

type SortMode = "newest" | "oldest" | "most-words" | "most-submissions";
type FilterMode = "all" | "active" | "completed";

export default function StoriesListClient({ stories }: { stories: StoryRow[] }) {
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const filtered = useMemo(() => {
    if (filterMode === "all") return stories;
    if (filterMode === "active") return stories.filter((s) => s.status === "active");
    return stories.filter((s) => s.status !== "active");
  }, [stories, filterMode]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    switch (sortMode) {
      case "newest":
        return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "oldest":
        return copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case "most-words":
        return copy.sort((a, b) => b.wordCount - a.wordCount);
      case "most-submissions":
        return copy.sort((a, b) => b.submissionCount - a.submissionCount);
      default:
        return copy;
    }
  }, [filtered, sortMode]);

  const sortOptions: { key: SortMode; label: string }[] = [
    { key: "newest", label: "Newest" },
    { key: "oldest", label: "Oldest" },
    { key: "most-words", label: "Most Words" },
    { key: "most-submissions", label: "Most Active" },
  ];

  const filterOptions: { key: FilterMode; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
  ];

  if (stories.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No stories yet.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {filterOptions.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterMode(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterMode === key
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-1">
          {sortOptions.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortMode(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                sortMode === key
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">{sorted.length} stories</p>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500 dark:text-gray-400">
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Words</th>
              <th className="px-4 py-2">Submissions</th>
              <th className="px-4 py-2">Round</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {sorted.map((story) => (
              <tr key={story.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/stories/${story.id}`} className="font-medium hover:underline">
                    {story.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium uppercase ${
                      story.status === "active"
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {story.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{story.wordCount}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{story.submissionCount}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {story.currentRound
                    ? `R${story.currentRound.roundNumber} (${story.currentRound.status})`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
