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

type SortMode = "top" | "new" | "rising";

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
  const [sortMode, setSortMode] = useState<SortMode>("top");

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sortedSubmissions = useMemo(() => {
    const copy = [...submissions];
    switch (sortMode) {
      case "top":
        return copy.sort((a, b) => b.netScore - a.netScore);
      case "new":
        return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "rising": {
        // Rising = highest score relative to recency
        const now = Date.now();
        return copy.sort((a, b) => {
          const ageA = Math.max(1, (now - new Date(a.createdAt).getTime()) / 3600000);
          const ageB = Math.max(1, (now - new Date(b.createdAt).getTime()) / 3600000);
          return (b.netScore / ageB) - (a.netScore / ageA);
        });
      }
      default:
        return copy;
    }
  }, [submissions, sortMode]);

  async function handleVote(submissionId: string, value: 1 | -1) {
    if (votingIds.has(submissionId)) return;
    if (!canVote) {
      await signIn("google");
      return;
    }

    // Snapshot for rollback
    const snapshot = [...submissions];
    setVotingIds((s) => new Set(s).add(submissionId));

    // Optimistic update
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

      // Reconcile with server
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
      // Rollback
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

  const sortOptions: { key: SortMode; label: string }[] = [
    { key: "top", label: "Top" },
    { key: "new", label: "New" },
    { key: "rising", label: "Rising" },
  ];

  return (
    <div className="space-y-3">
      {/* Sort toggle */}
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
    </div>
  );
}
