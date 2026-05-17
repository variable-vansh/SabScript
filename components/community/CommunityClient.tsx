"use client";

import { useCallback, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import SubmissionForm from "@/components/community/SubmissionForm";
import SubmissionsTable from "@/components/community/SubmissionsTable";
import { fetcher } from "@/lib/fetcher";

export type SubmissionRow = {
  id: string;
  content: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  netScore: number;
  wordCount: number;
  endsStory: boolean;
  commentsCount: number;
  currentUserVote: 1 | -1 | null;
  user: { id: string; username: string | null };
};

type RoundOption = {
  id: string;
  roundNumber: number;
  status: "open" | "overtime" | "closed";
  startsAt: string;
  endsAt: string;
};

type CommunityClientProps = {
  story: { id: string; title: string; status: string; segmentsCount: number };
  roundOptions: RoundOption[];
  initialRoundId: string | null;
  activeRoundId: string | null;
  initialSubmissions: SubmissionRow[];
};

type SubmissionsResponse = {
  submissions: SubmissionRow[];
};

export default function CommunityClient({
  story,
  roundOptions,
  initialRoundId,
  activeRoundId,
  initialSubmissions,
}: CommunityClientProps) {
  const { data: session } = useSession();
  const currentUsername = session?.user?.username ?? null;
  const canVote = Boolean(session?.user?.id);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(initialRoundId);

  // Keep a ref to the latest submissions so mutate updaters always have data
  const submissionsRef = useRef<SubmissionRow[]>(initialSubmissions);

  const fetchKey = selectedRoundId
    ? `/api/submissions?storyId=${story.id}&roundId=${selectedRoundId}`
    : null;

  const {
    data: rawData,
    mutate: mutateSubmissions,
    isLoading,
  } = useSWR<SubmissionRow[]>(
    fetchKey,
    async (url: string) => {
      const payload = await fetcher<SubmissionsResponse>(url);
      return payload.submissions;
    },
    {
      fallbackData:
        selectedRoundId === initialRoundId ? initialSubmissions : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 5_000,
    },
  );

  const submissions = rawData ?? [];
  // Keep ref in sync
  submissionsRef.current = submissions;

  // Wrapped mutate that falls back to ref when SWR cache is empty
  const safeMutate = useCallback(
    (
      updater: SubmissionRow[] | ((current: SubmissionRow[]) => SubmissionRow[]),
      opts?: { revalidate?: boolean },
    ) => {
      if (typeof updater === "function") {
        return mutateSubmissions(
          (current) => updater(current ?? submissionsRef.current),
          opts,
        );
      }
      return mutateSubmissions(updater, opts);
    },
    [mutateSubmissions],
  );

  const activeRound = roundOptions.find((r) => r.id === activeRoundId) ?? null;
  const selectedRound = roundOptions.find((r) => r.id === selectedRoundId) ?? null;

  const alreadySubmitted =
    selectedRoundId === activeRoundId
      ? submissions.some((s) => currentUsername && s.user.username === currentUsername)
      : false;

  const canSubmit =
    Boolean(session?.user?.id) &&
    Boolean(currentUsername) &&
    Boolean(activeRound && ["open", "overtime"].includes(activeRound.status));

  return (
    <div className="space-y-6">
      {/* Round selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="round-select" className="text-sm font-medium">
          Round:
        </label>
        <select
          id="round-select"
          value={selectedRoundId ?? ""}
          onChange={(e) => setSelectedRoundId(e.target.value || null)}
          className="border border-gray-300 px-2 py-1 text-sm"
        >
          {roundOptions.map((r) => (
            <option key={r.id} value={r.id}>
              Round {r.roundNumber} ({r.status})
            </option>
          ))}
        </select>
        {selectedRound && ["open", "overtime"].includes(selectedRound.status) && (
          <span className="text-xs text-gray-500">
            Ends: {new Date(selectedRound.endsAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Submissions list */}
      <SubmissionsTable
        storyId={story.id}
        submissions={submissions}
        safeMutate={safeMutate}
        canVote={canVote}
        loading={isLoading}
      />

      {/* Submission form */}
      {selectedRoundId === activeRoundId && (
        <SubmissionForm
          roundId={activeRoundId}
          isAuthenticated={Boolean(session?.user?.id)}
          canSubmit={canSubmit}
          userHasSubmitted={alreadySubmitted}
          onCreated={(created) => {
            const newSub: SubmissionRow = {
              id: created.id,
              content: created.content,
              createdAt: created.createdAt,
              upvotes: 0,
              downvotes: 0,
              netScore: 0,
              wordCount: created.wordCount,
              endsStory: created.endsStory,
              commentsCount: 0,
              currentUserVote: null,
              user: { id: session?.user?.id ?? "me", username: currentUsername },
            };
            void safeMutate(
              (current) => [newSub, ...current],
              { revalidate: false },
            );
          }}
        />
      )}
    </div>
  );
}
