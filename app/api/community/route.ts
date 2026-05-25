import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const storyId = request.nextUrl.searchParams.get("storyId")?.trim();
  if (!storyId) {
    return NextResponse.json({ error: "storyId is required" }, { status: 400 });
  }

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

  let submissions: Array<{
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

    const [commentCounts, voteRows] = await Promise.all([
      subIds.length > 0
        ? prisma.comment.groupBy({
            by: ["parentId"],
            where: { parentType: "submission", parentId: { in: subIds } },
            _count: { _all: true },
          })
        : [],
      userId && subIds.length > 0
        ? prisma.vote.findMany({
            where: { userId, submissionId: { in: subIds } },
            select: { submissionId: true, value: true },
          })
        : [],
    ]);

    const commentMap = new Map(commentCounts.map((c) => [c.parentId, c._count._all]));
    const voteMap = new Map(voteRows.map((v) => [v.submissionId, v.value as 1 | -1]));

    submissions = subs.map((s) => ({
      id: s.id,
      content: s.content,
      createdAt: s.createdAt.toISOString(),
      upvotes: s.upvotes,
      downvotes: s.downvotes,
      netScore: s.netScore,
      wordCount: s.wordCount,
      endsStory: s.endsStory,
      commentsCount: commentMap.get(s.id) ?? 0,
      currentUserVote: voteMap.get(s.id) ?? null,
      user: s.user,
    }));
  }

  return NextResponse.json({
    roundOptions,
    initialRoundId,
    activeRoundId: activeRound?.id ?? null,
    submissions,
  });
}
