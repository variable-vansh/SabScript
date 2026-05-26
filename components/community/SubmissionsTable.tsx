"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import type { SubmissionRow } from "@/components/community/CommunityClient";
import ReportButton from "@/components/moderation/ReportButton";

type SafeMutate = (
  updater: SubmissionRow[] | ((current: SubmissionRow[]) => SubmissionRow[]),
  opts?: { revalidate?: boolean },
) => Promise<SubmissionRow[] | undefined>;

type SubmissionsTableProps = {
  submissions: SubmissionRow[];
  safeMutate: SafeMutate;
  canVote: boolean;
  loading: boolean;
};

type BaseSort = "top" | "new" | "rising";
type TopTimeFilter = "1h" | "3h" | "6h" | "12h" | "24h" | "all";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncateWords(text: string, maxWords: number): { truncated: string; isTruncated: boolean } {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return { truncated: text, isTruncated: false };
  return { truncated: words.slice(0, maxWords).join(" ") + "…", isTruncated: true };
}

export default function SubmissionsTable({
  submissions,
  safeMutate,
  canVote,
  loading,
}: SubmissionsTableProps) {
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [baseSort, setBaseSort] = useState<BaseSort>("top");
  const [topTimeFilter, setTopTimeFilter] = useState<TopTimeFilter>("24h");

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sortedSubmissions = useMemo(() => {
    let copy = [...submissions];

    if (baseSort === "top") {
      if (topTimeFilter !== "all") {
        const hours = parseInt(topTimeFilter);
        const cutoff = Date.now() - hours * 3600000;
        copy = copy.filter((s) => new Date(s.createdAt).getTime() >= cutoff);
      }
      return copy.sort((a, b) => b.netScore - a.netScore);
    }
    if (baseSort === "new") {
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    // rising
    const now = Date.now();
    return copy.sort((a, b) => {
      const ageA = Math.max(1, (now - new Date(a.createdAt).getTime()) / 3600000);
      const ageB = Math.max(1, (now - new Date(b.createdAt).getTime()) / 3600000);
      return b.netScore / ageB - a.netScore / ageA;
    });
  }, [submissions, baseSort, topTimeFilter]);

  async function handleVote(submissionId: string, value: 1 | -1) {
    if (votingIds.has(submissionId)) return;
    if (!canVote) {
      await signIn("google");
      return;
    }

    const snapshot = [...submissions];
    setVotingIds((s) => new Set(s).add(submissionId));

    void safeMutate(
      (current) =>
        current.map((s) => {
          if (s.id !== submissionId) return s;
          const prev = s.currentUserVote;
          let { upvotes, downvotes, netScore } = s;
          let currentUserVote: 1 | -1 | null = value;

          if (prev === null) {
            if (value === 1) { upvotes += 1; netScore += 1; }
            else { downvotes += 1; netScore -= 1; }
          } else if (prev === value) {
            if (value === 1) { upvotes -= 1; netScore -= 1; }
            else { downvotes -= 1; netScore += 1; }
            currentUserVote = null;
          } else {
            if (value === 1) { upvotes += 1; downvotes -= 1; netScore += 2; }
            else { upvotes -= 1; downvotes += 1; netScore -= 2; }
          }

          return { ...s, upvotes, downvotes, netScore, currentUserVote };
        }),
      { revalidate: false },
    );

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, value }),
      });
      if (!res.ok) throw new Error("Vote failed");
      const payload = await res.json();

      void safeMutate(
        (current) =>
          current.map((s) =>
            s.id === submissionId
              ? {
                  ...s,
                  upvotes: payload.upvotes ?? s.upvotes,
                  downvotes: payload.downvotes ?? s.downvotes,
                  netScore: payload.netScore ?? s.netScore,
                  currentUserVote: payload.currentUserVote ?? null,
                }
              : s,
          ),
        { revalidate: false },
      );
    } catch {
      void safeMutate(snapshot, { revalidate: true });
    } finally {
      setVotingIds((s) => {
        const next = new Set(s);
        next.delete(submissionId);
        return next;
      });
    }
  }

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading submissions...</p>;
  if (submissions.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">No submissions yet.</p>;

  return (
    <div className="space-y-3">
      {/* Sort toggle — two-level UI */}
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          {(["top", "new", "rising"] as const).map((mode) => (
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
            {(["1h", "3h", "6h", "12h", "24h", "all"] as const).map((tf) => (
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
                {tf === "all" ? "All time" : tf}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Submission cards */}
      {sortedSubmissions.map((sub) => {
        const isExpanded = expandedIds.has(sub.id);
        const { truncated, isTruncated } = truncateWords(sub.content, 75);

        return (
          <div key={sub.id} className="rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="flex items-start gap-3 p-4">
              {/* Vote controls */}
              <div className="flex flex-col items-center gap-1 text-xs shrink-0">
                <button
                  type="button"
                  disabled={!canVote || votingIds.has(sub.id)}
                  onClick={() => void handleVote(sub.id, 1)}
                  className={`px-1 ${sub.currentUserVote === 1 ? "font-bold text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"}`}
                >
                  ▲
                </button>
                <span className="font-medium">{sub.netScore}</span>
                <button
                  type="button"
                  disabled={!canVote || votingIds.has(sub.id)}
                  onClick={() => void handleVote(sub.id, -1)}
                  className={`px-1 ${sub.currentUserVote === -1 ? "font-bold text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"}`}
                >
                  ▼
                </button>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-line text-sm leading-6">
                  {isExpanded ? sub.content : truncated}
                </p>
                {isTruncated && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(sub.id)}
                    className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {isExpanded ? "Show less" : "Read more"}
                  </button>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {sub.user.username ? (
                    <Link href={`/profile/${sub.user.username}`} className="hover:underline">
                      @{sub.user.username}
                    </Link>
                  ) : (
                    <span>@anonymous</span>
                  )}
                  <span>{timeAgo(sub.createdAt)}</span>
                  <span>{sub.upvotes}↑ {sub.downvotes}↓</span>
                  {sub.endsStory && (
                    <span className="font-medium text-orange-600 dark:text-orange-400">Ends story</span>
                  )}
                  <ReportButton targetType="submission" targetId={sub.id} />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {sortedSubmissions.length === 0 && submissions.length > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No submissions in this time window.</p>
      )}
    </div>
  );
}
