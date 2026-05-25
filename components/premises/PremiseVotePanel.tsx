"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

type PremiseVotePanelProps = {
  premiseId: string;
  initialUpvotes: number;
  initialDownvotes: number;
  initialNetScore: number;
  initialCurrentUserVote: 1 | -1 | null;
};

export default function PremiseVotePanel({
  premiseId,
  initialUpvotes,
  initialDownvotes,
  initialNetScore,
  initialCurrentUserVote,
}: PremiseVotePanelProps) {
  const { data: session } = useSession();
  const canVote = Boolean(session?.user?.id);
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [netScore, setNetScore] = useState(initialNetScore);
  const [currentVote, setCurrentVote] = useState(initialCurrentUserVote);
  const [voting, setVoting] = useState(false);

  async function handleVote(value: 1 | -1) {
    if (voting) return;
    if (!canVote) {
      await signIn("google");
      return;
    }

    // Optimistic
    const prevUp = upvotes;
    const prevDown = downvotes;
    const prevNet = netScore;
    const prevVote = currentVote;

    let newUp = upvotes;
    let newDown = downvotes;
    let newNet = netScore;
    let newVote: 1 | -1 | null = value;

    if (currentVote === null) {
      if (value === 1) { newUp += 1; newNet += 1; }
      else { newDown += 1; newNet -= 1; }
    } else if (currentVote === value) {
      if (value === 1) { newUp -= 1; newNet -= 1; }
      else { newDown -= 1; newNet += 1; }
      newVote = null;
    } else {
      if (value === 1) { newUp += 1; newDown -= 1; newNet += 2; }
      else { newUp -= 1; newDown += 1; newNet -= 2; }
    }

    setUpvotes(newUp);
    setDownvotes(newDown);
    setNetScore(newNet);
    setCurrentVote(newVote);
    setVoting(true);

    try {
      const res = await fetch("/api/premise-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premiseId, value }),
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setUpvotes(payload.upvotes ?? newUp);
      setDownvotes(payload.downvotes ?? newDown);
      setNetScore(payload.netScore ?? newNet);
      setCurrentVote(payload.currentUserVote ?? null);
    } catch {
      setUpvotes(prevUp);
      setDownvotes(prevDown);
      setNetScore(prevNet);
      setCurrentVote(prevVote);
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 text-sm">
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
  );
}
