"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import StarToggleButton from "@/components/actions/StarToggleButton";
import ReportButton from "@/components/moderation/ReportButton";

type SeedDetailClientProps = {
  premise: {
    id: string;
    title: string;
    content: string;
    wordCount: number;
    upvotes: number;
    downvotes: number;
    netScore: number;
    username: string | null;
  };
  initialUserVote: 1 | -1 | null;
  initiallyStarred: boolean;
};

function truncateWords(text: string, maxWords: number): { truncated: string; isTruncated: boolean } {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return { truncated: text, isTruncated: false };
  return { truncated: words.slice(0, maxWords).join(" ") + "…", isTruncated: true };
}

export default function SeedDetailClient({ premise, initialUserVote, initiallyStarred }: SeedDetailClientProps) {
  const { data: session } = useSession();
  const canVote = Boolean(session?.user?.id);
  const [upvotes, setUpvotes] = useState(premise.upvotes);
  const [downvotes, setDownvotes] = useState(premise.downvotes);
  const [netScore, setNetScore] = useState(premise.netScore);
  const [currentVote, setCurrentVote] = useState(initialUserVote);
  const [voting, setVoting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { truncated, isTruncated } = truncateWords(premise.content, 75);

  async function handleVote(value: 1 | -1) {
    if (voting) return;
    if (!canVote) { await signIn("google"); return; }

    const prevUp = upvotes, prevDown = downvotes, prevNet = netScore, prevVote = currentVote;
    let newUp = upvotes, newDown = downvotes, newNet = netScore;
    let newVote: 1 | -1 | null = value;

    if (currentVote === null) {
      if (value === 1) { newUp += 1; newNet += 1; } else { newDown += 1; newNet -= 1; }
    } else if (currentVote === value) {
      if (value === 1) { newUp -= 1; newNet -= 1; } else { newDown -= 1; newNet += 1; }
      newVote = null;
    } else {
      if (value === 1) { newUp += 1; newDown -= 1; newNet += 2; } else { newUp -= 1; newDown += 1; newNet -= 2; }
    }

    setUpvotes(newUp); setDownvotes(newDown); setNetScore(newNet); setCurrentVote(newVote);
    setVoting(true);
    try {
      const res = await fetch("/api/premise-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premiseId: premise.id, value }),
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setUpvotes(payload.upvotes ?? newUp);
      setDownvotes(payload.downvotes ?? newDown);
      setNetScore(payload.netScore ?? newNet);
      setCurrentVote(payload.currentUserVote ?? null);
    } catch {
      setUpvotes(prevUp); setDownvotes(prevDown); setNetScore(prevNet); setCurrentVote(prevVote);
    } finally { setVoting(false); }
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="flex items-start gap-3 p-4">
        {/* Vote controls — identical style to submission cards */}
        <div className="flex flex-col items-center gap-1 text-xs shrink-0">
          <button
            type="button"
            disabled={!canVote || voting}
            onClick={() => void handleVote(1)}
            className={`px-1 ${currentVote === 1 ? "font-bold text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"}`}
          >
            ▲
          </button>
          <span className="font-medium">{netScore}</span>
          <button
            type="button"
            disabled={!canVote || voting}
            onClick={() => void handleVote(-1)}
            className={`px-1 ${currentVote === -1 ? "font-bold text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"}`}
          >
            ▼
          </button>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold">{premise.title}</h1>
            <div className="flex items-center gap-2 shrink-0">
              <ReportButton targetType="premise" targetId={premise.id} />
              <StarToggleButton
                targetType="premise"
                targetId={premise.id}
                initiallyStarred={initiallyStarred}
                className="rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              />
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-6">
            {expanded ? premise.content : truncated}
          </p>
          {isTruncated && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {premise.username ? (
              <Link href={`/profile/${premise.username}`} className="hover:underline">@{premise.username}</Link>
            ) : (
              <span>@anonymous</span>
            )}
            <span>{upvotes}↑ {downvotes}↓</span>
            <span>{premise.wordCount} words</span>
          </div>
        </div>
      </div>
    </div>
  );
}
