"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";

type SeedRow = {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  netScore: number;
  user: { id: string; username: string | null };
};

type BaseSort = "top" | "newest" | "oldest";
type TopTimeFilter = "today" | "3days" | "week" | "month" | "all";

function truncateWords(text: string, maxWords: number): { truncated: string; isTruncated: boolean } {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return { truncated: text, isTruncated: false };
  return { truncated: words.slice(0, maxWords).join(" ") + "…", isTruncated: true };
}

const TIME_FILTER_HOURS: Record<TopTimeFilter, number | null> = {
  today: 24,
  "3days": 72,
  week: 168,
  month: 720,
  all: null,
};

export default function SeedsListClient({ premises }: { premises: SeedRow[] }) {
  const { data: session } = useSession();
  const canVote = Boolean(session?.user?.id);
  const [baseSort, setBaseSort] = useState<BaseSort>("top");
  const [topTimeFilter, setTopTimeFilter] = useState<TopTimeFilter>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  const [localScores, setLocalScores] = useState<Record<string, { netScore: number; currentVote: 1 | -1 | null }>>({});

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sorted = useMemo(() => {
    let copy = [...premises];

    if (baseSort === "top") {
      if (topTimeFilter !== "all") {
        const hours = TIME_FILTER_HOURS[topTimeFilter]!;
        const cutoff = Date.now() - hours * 3600000;
        copy = copy.filter((s) => new Date(s.createdAt).getTime() >= cutoff);
      }
      return copy.sort((a, b) => {
        const aScore = localScores[a.id]?.netScore ?? a.netScore;
        const bScore = localScores[b.id]?.netScore ?? b.netScore;
        return bScore - aScore;
      });
    }
    if (baseSort === "newest") {
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [premises, baseSort, topTimeFilter, localScores]);

  async function handleVote(premiseId: string, value: 1 | -1) {
    if (votingIds.has(premiseId)) return;
    if (!canVote) { await signIn("google"); return; }

    const seed = premises.find((s) => s.id === premiseId);
    if (!seed) return;

    const current = localScores[premiseId] ?? { netScore: seed.netScore, currentVote: null };
    const prevScore = current.netScore;
    const prevVote = current.currentVote;

    let newScore = prevScore;
    let newVote: 1 | -1 | null = value;

    if (prevVote === null) {
      newScore += value === 1 ? 1 : -1;
    } else if (prevVote === value) {
      newScore += value === 1 ? -1 : 1;
      newVote = null;
    } else {
      newScore += value === 1 ? 2 : -2;
    }

    setLocalScores((prev) => ({ ...prev, [premiseId]: { netScore: newScore, currentVote: newVote } }));
    setVotingIds((s) => new Set(s).add(premiseId));

    try {
      const res = await fetch("/api/premise-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premiseId, value }),
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setLocalScores((prev) => ({
        ...prev,
        [premiseId]: {
          netScore: payload.netScore ?? newScore,
          currentVote: payload.currentUserVote ?? null,
        },
      }));
    } catch {
      setLocalScores((prev) => ({ ...prev, [premiseId]: { netScore: prevScore, currentVote: prevVote } }));
    } finally {
      setVotingIds((s) => { const next = new Set(s); next.delete(premiseId); return next; });
    }
  }

  if (premises.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No active seeds.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Sort controls */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          {(["top", "newest", "oldest"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setBaseSort(mode)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                baseSort === mode
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        {baseSort === "top" && (
          <div className="flex items-center gap-1">
            {(["today", "3days", "week", "month", "all"] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTopTimeFilter(tf)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  topTimeFilter === tf
                    ? "bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-900"
                    : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {tf === "all" ? "All time" : tf === "today" ? "Today" : tf === "3days" ? "3 Days" : tf === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">{sorted.length} seeds</p>

      {/* Seed cards */}
      <div className="space-y-3">
        {sorted.map((seed) => {
          const isExpanded = expandedIds.has(seed.id);
          const { truncated, isTruncated } = truncateWords(seed.content, 75);
          const score = localScores[seed.id]?.netScore ?? seed.netScore;
          const currentVote = localScores[seed.id]?.currentVote ?? null;

          return (
            <div
              key={seed.id}
              className="rounded-lg border border-gray-200 dark:border-gray-800"
            >
              <div className="flex items-start gap-3 p-4">
                {/* Vote controls */}
                <div className="flex flex-col items-center gap-1 text-xs shrink-0">
                  <button
                    type="button"
                    disabled={!canVote || votingIds.has(seed.id)}
                    onClick={() => void handleVote(seed.id, 1)}
                    className={`px-1 ${
                      currentVote === 1
                        ? "font-bold text-green-600 dark:text-green-400"
                        : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    }`}
                  >
                    ▲
                  </button>
                  <span className="font-medium">{score}</span>
                  <button
                    type="button"
                    disabled={!canVote || votingIds.has(seed.id)}
                    onClick={() => void handleVote(seed.id, -1)}
                    className={`px-1 ${
                      currentVote === -1
                        ? "font-bold text-red-600 dark:text-red-400"
                        : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    }`}
                  >
                    ▼
                  </button>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <Link href={`/seeds/${seed.id}`} className="hover:underline">
                    <h3 className="font-medium">{seed.title}</h3>
                  </Link>
                  <p className="mt-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-400 leading-6">
                    {isExpanded ? seed.content : truncated}
                  </p>
                  {isTruncated && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(seed.id)}
                      className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                  <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    {seed.user.username ? (
                      <Link href={`/profile/${seed.user.username}`} className="hover:underline">
                        @{seed.user.username}
                      </Link>
                    ) : (
                      <span>@anonymous</span>
                    )}
                    {" · "}{seed.wordCount} words
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && premises.length > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No seeds in this time window.</p>
      )}
    </div>
  );
}
