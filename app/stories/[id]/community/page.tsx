import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import CommunityClient from "@/components/community/CommunityClient";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CommunityPageProps = {
  params: Promise<{ id: string }>;
};

export const revalidate = 30;

const getCommunityData = unstable_cache(
  async (storyId: string) => {
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: {
        id: true,
        title: true,
        status: true,
        _count: { select: { segments: true } },
      },
    });
    if (!story) return null;

    const rounds = await prisma.round.findMany({
      where: { storyId },
      orderBy: { roundNumber: "desc" },
      take: 30,
      select: {
        id: true,
        roundNumber: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    });

    const roundOptions = rounds.map((r) => ({
      id: r.id,
      roundNumber: r.roundNumber,
      status: r.status as "open" | "overtime" | "closed",
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
    }));

    const activeRound =
      roundOptions.find((r) => ["open", "overtime"].includes(r.status)) ?? null;
    const initialRoundId = activeRound?.id ?? roundOptions[0]?.id ?? null;

    let initialSubmissions: Array<{
      id: string;
      content: string;
      createdAt: string;
      upvotes: number;
      downvotes: number;
      netScore: number;
      wordCount: number;
      endsStory: boolean;
      commentsCount: number;
      user: { id: string; username: string | null };
    }> = [];

    if (initialRoundId) {
      const subs = await prisma.submission.findMany({
        where: { roundId: initialRoundId },
        orderBy: [{ netScore: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          content: true,
          createdAt: true,
          upvotes: true,
          downvotes: true,
          netScore: true,
          wordCount: true,
          endsStory: true,
          user: { select: { id: true, username: true } },
        },
      });

      const subIds = subs.map((s) => s.id);
      const commentCounts =
        subIds.length > 0
          ? await prisma.comment.groupBy({
              by: ["parentId"],
              where: { parentType: "submission", parentId: { in: subIds } },
              _count: { _all: true },
            })
          : [];
      const commentMap = new Map(commentCounts.map((c) => [c.parentId, c._count._all]));

      initialSubmissions = subs.map((s) => ({
        id: s.id,
        content: s.content,
        createdAt: s.createdAt.toISOString(),
        upvotes: s.upvotes,
        downvotes: s.downvotes,
        netScore: s.netScore,
        wordCount: s.wordCount,
        endsStory: s.endsStory,
        commentsCount: commentMap.get(s.id) ?? 0,
        user: s.user,
      }));
    }

    return {
      story: { id: story.id, title: story.title, status: story.status, segmentsCount: story._count.segments },
      roundOptions,
      initialRoundId,
      activeRoundId: activeRound?.id ?? null,
      initialSubmissions,
    };
  },
  ["community-data"],
  { revalidate: 30 },
);

export default async function CommunityPage({ params }: CommunityPageProps) {
  const { id } = await params;
  const [data, session] = await Promise.all([getCommunityData(id), auth()]);
  if (!data) notFound();

  const userId = session?.user?.id ?? null;
  let userVotesMap: Record<string, 1 | -1> = {};
  if (userId && data.initialSubmissions.length > 0) {
    const votes = await prisma.vote.findMany({
      where: { userId, submissionId: { in: data.initialSubmissions.map((s) => s.id) } },
      select: { submissionId: true, value: true },
    });
    userVotesMap = Object.fromEntries(votes.map((v) => [v.submissionId, v.value as 1 | -1]));
  }

  const submissions = data.initialSubmissions.map((s) => ({
    ...s,
    currentUserVote: (userVotesMap[s.id] ?? null) as 1 | -1 | null,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{data.story.title} — Community</h1>
        <a href={`/stories/${data.story.id}`} className="text-sm text-gray-500 hover:underline">
          ← Back to story
        </a>
      </div>
      <CommunityClient
        story={data.story}
        roundOptions={data.roundOptions}
        initialRoundId={data.initialRoundId}
        activeRoundId={data.activeRoundId}
        initialSubmissions={submissions}
      />
    </div>
  );
}
