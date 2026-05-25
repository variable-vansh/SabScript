"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Users, Share2, X } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import useSWR from "swr";
import ReadingProgressBar from "@/components/stories/ReadingProgressBar";
import SegmentInfo from "@/components/stories/SegmentInfo";
import CommunityClient from "@/components/community/CommunityClient";
import type { SubmissionRow } from "@/components/community/CommunityClient";
import { fetcher } from "@/lib/fetcher";

type Segment = {
  id: string;
  roundNumber: number;
  content: string;
  createdAt: string;
  contributor: { username: string | null };
};

type RoundOption = {
  id: string;
  roundNumber: number;
  status: "open" | "overtime" | "closed";
  startsAt: string;
  endsAt: string;
};

type StoryData = {
  id: string;
  title: string;
  premise: string | null;
  status: string;
  wordCount: number;
  maxSegments: number;
  createdAt: string;
  segments: Segment[];
  currentRound: {
    id: string;
    roundNumber: number;
    endsAt: string;
    status: string;
  } | null;
};

type StoryReaderClientProps = {
  story: StoryData;
  initiallyBookmarked: boolean;
};

type CommunityDataResponse = {
  roundOptions: RoundOption[];
  initialRoundId: string | null;
  activeRoundId: string | null;
  submissions: SubmissionRow[];
};

export default function StoryReaderClient({
  story,
  initiallyBookmarked,
}: StoryReaderClientProps) {
  const { data: session } = useSession();
  const [panelOpen, setPanelOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch community data only when panel opens
  const { data: communityData, isLoading: communityLoading } = useSWR<CommunityDataResponse>(
    panelOpen ? `/api/community?storyId=${story.id}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10_000 }
  );

  const handleBookmarkToggle = useCallback(async () => {
    if (saving) return;
    if (!session?.user?.id) {
      await signIn("google");
      return;
    }
    const prev = bookmarked;
    setBookmarked(!prev);
    setSaving(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: story.id }),
      });
      if (!res.ok) throw new Error();
      const payload = (await res.json()) as { bookmarked?: boolean };
      setBookmarked(Boolean(payload.bookmarked));
    } catch {
      setBookmarked(prev);
    } finally {
      setSaving(false);
    }
  }, [saving, session, bookmarked, story.id]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/stories/${story.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, [story.id]);

  return (
    <>
      <ReadingProgressBar />

      <div className="flex gap-0">
        {/* Story column */}
        <article
          className={`transition-all duration-300 ease-in-out min-w-0 ${
            panelOpen ? "w-[38%] shrink-0" : "w-full"
          }`}
        >
          {/* Header */}
          <header className="space-y-2 border-b border-gray-200 dark:border-gray-800 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold">{story.title}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{story.wordCount} words</span>
                  <span>·</span>
                  <span>{story.segments.length} segments</span>
                  <span>·</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      story.status === "active"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {story.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleBookmarkToggle()}
                  disabled={saving}
                  className={`rounded-lg p-2 transition-colors disabled:opacity-60 ${
                    bookmarked
                      ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
                      : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                  title={bookmarked ? "Bookmarked" : "Bookmark"}
                >
                  {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                </button>

                {story.status === "active" && (
                  <button
                    type="button"
                    onClick={() => setPanelOpen(!panelOpen)}
                    className={`rounded-lg p-2 transition-colors ${
                      panelOpen
                        ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                        : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    title="Community"
                  >
                    <Users size={18} />
                  </button>
                )}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => void handleShare()}
                    className="rounded-lg p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Share"
                  >
                    <Share2 size={18} />
                  </button>
                  {copied && (
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 dark:bg-gray-700 px-2 py-1 text-xs text-white shadow-lg">
                      Copied!
                    </span>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Premise */}
          {story.premise && (
            <section className="mt-6 space-y-1">
              <h2 className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Premise</h2>
              <p className="whitespace-pre-line leading-7">{story.premise}</p>
            </section>
          )}

          {/* Segments */}
          <div className="mt-6 space-y-6">
            {story.segments.map((segment, idx) => (
              <section key={segment.id} className="relative space-y-2">
                <div className="absolute top-0 right-0">
                  <SegmentInfo
                    username={segment.contributor.username}
                    createdAt={segment.createdAt}
                  />
                </div>
                <p className="whitespace-pre-line leading-7 pr-6">{segment.content}</p>
                {idx < story.segments.length - 1 && <hr className="border-gray-200 dark:border-gray-800" />}
              </section>
            ))}
          </div>
        </article>

        {/* Community panel */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            panelOpen ? "w-[62%] opacity-100" : "w-0 opacity-0"
          }`}
        >
          {panelOpen && (
            <div className="ml-4 h-full border-l border-gray-200 dark:border-gray-800 pl-4">
              <div className="sticky top-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Community</h2>
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Close panel"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="overflow-y-auto max-h-[calc(100vh-8rem)]">
                  {communityLoading ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading community…</p>
                  ) : communityData ? (
                    <CommunityClient
                      story={{ id: story.id, title: story.title, status: story.status, segmentsCount: story.segments.length }}
                      roundOptions={communityData.roundOptions}
                      initialRoundId={communityData.initialRoundId}
                      activeRoundId={communityData.activeRoundId}
                      initialSubmissions={communityData.submissions}
                    />
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No community data available.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: community panel below on small screens */}
      <style>{`
        @media (max-width: 768px) {
          .flex.gap-0 {
            flex-direction: column;
          }
          .flex.gap-0 > article {
            width: 100% !important;
          }
          .flex.gap-0 > div:last-child {
            width: 100% !important;
            margin-top: 1.5rem;
          }
          .flex.gap-0 > div:last-child > div {
            margin-left: 0;
            border-left: none;
            padding-left: 0;
            border-top: 1px solid;
            padding-top: 1rem;
          }
        }
      `}</style>
    </>
  );
}
