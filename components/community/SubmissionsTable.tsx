"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import type { SubmissionRow } from "@/components/community/CommunityClient";
import CommentThread from "@/components/comments/CommentThread";

type SafeMutate = (
  updater: SubmissionRow[] | ((current: SubmissionRow[]) => SubmissionRow[]),
  opts?: { revalidate?: boolean },
) => Promise<SubmissionRow[] | undefined>;

type SubmissionsTableProps = {
  storyId: string;
  submissions: SubmissionRow[];
  safeMutate: SafeMutate;
  canVote: boolean;
  loading: boolean;
};

export default function SubmissionsTable({
  storyId,
  submissions,
  safeMutate,
  canVote,
  loading,
}: SubmissionsTableProps) {
  const { data: session } = useSession();
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  function toggleComments(submissionId: string) {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(submissionId)) next.delete(submissionId);
      else next.add(submissionId);
      return next;
    });
  }

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

  if (loading) return <p className="text-sm text-gray-500">Loading submissions...</p>;
  if (submissions.length === 0) return <p className="text-sm text-gray-500">No submissions yet.</p>;

  return (
    <div className="space-y-3">
      {submissions.map((sub) => (
        <div key={sub.id} className="border border-gray-200">
          <div className="flex items-start gap-4 p-4">
            {/* Vote controls */}
            <div className="flex flex-col items-center gap-1 text-xs">
              <button
                type="button"
                disabled={!canVote || votingIds.has(sub.id)}
                onClick={() => void handleVote(sub.id, 1)}
                className={`px-1 ${sub.currentUserVote === 1 ? "font-bold text-green-600" : "text-gray-400 hover:text-gray-600"}`}
              >
                ▲
              </button>
              <span className="font-medium">{sub.netScore}</span>
              <button
                type="button"
                disabled={!canVote || votingIds.has(sub.id)}
                onClick={() => void handleVote(sub.id, -1)}
                className={`px-1 ${sub.currentUserVote === -1 ? "font-bold text-red-600" : "text-gray-400 hover:text-gray-600"}`}
              >
                ▼
              </button>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-line text-sm leading-6">{sub.content}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                <span>@{sub.user.username ?? "anonymous"}</span>
                <span>{sub.wordCount} words</span>
                <span>{sub.upvotes}↑ {sub.downvotes}↓</span>
                {sub.endsStory && (
                  <span className="font-medium text-orange-600">Ends story</span>
                )}
                <button
                  type="button"
                  onClick={() => toggleComments(sub.id)}
                  className="hover:underline"
                >
                  {sub.commentsCount} comments {expandedComments.has(sub.id) ? "▾" : "▸"}
                </button>
              </div>
            </div>
          </div>

          {/* Inline comments */}
          {expandedComments.has(sub.id) && (
            <div className="border-t border-gray-200 bg-gray-50 p-4">
              <CommentThread
                parentType="submission"
                parentId={sub.id}
                initialComments={[]}
                fetchOnMount
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
