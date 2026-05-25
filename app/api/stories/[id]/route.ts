import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveExpiredRounds } from "@/lib/round-resolution";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const now = new Date();

  // Lazily resolve any expired rounds for this story
  const maybeCurrentRound = await prisma.round.findFirst({
    where: { storyId: id, status: { in: ["open", "overtime"] } },
    orderBy: { roundNumber: "desc" },
    select: { id: true, endsAt: true },
  });

  if (maybeCurrentRound && maybeCurrentRound.endsAt <= now) {
    await resolveExpiredRounds(now, { storyId: id });
  }

  const story = await prisma.story.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      premise: true,
      createdAt: true,
      status: true,
      submissionCount: true,
      wordCount: true,
      maxSegments: true,
      _count: { select: { segments: true } },
      segments: {
        orderBy: { roundNumber: "asc" },
        select: {
          id: true,
          roundNumber: true,
          content: true,
          createdAt: true,
          contributor: { select: { username: true } },
        },
      },
      rounds: {
        where: { status: { in: ["open", "overtime"] } },
        orderBy: { roundNumber: "desc" },
        take: 1,
        select: {
          id: true,
          roundNumber: true,
          startsAt: true,
          endsAt: true,
          status: true,
          overtimeTriggered: true,
          originalEndsAt: true,
          submissions: {
            orderBy: [{ netScore: "desc" }, { createdAt: "asc" }],
            select: {
              id: true,
              content: true,
              wordCount: true,
              createdAt: true,
              upvotes: true,
              downvotes: true,
              netScore: true,
              endsStory: true,
              user: { select: { username: true } },
            },
          },
        },
      },
    },
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const currentRound = story.rounds[0] ?? null;
  const submissionIds = currentRound?.submissions.map((s) => s.id) ?? [];

  const userVotes =
    userId && submissionIds.length > 0
      ? await prisma.vote.findMany({
          where: { userId, submissionId: { in: submissionIds } },
          select: { submissionId: true, value: true },
        })
      : [];

  const voteBySubmissionId = new Map(userVotes.map((v) => [v.submissionId, v.value]));

  return NextResponse.json({
    id: story.id,
    title: story.title,
    premise: story.premise,
    createdAt: story.createdAt,
    status: story.status,
    submissionCount: story.submissionCount,
    wordCount: story.wordCount,
    maxSegments: story.maxSegments,
    segmentsCount: story._count.segments,
    segments: story.segments.map((s) => ({
      id: s.id,
      roundNumber: s.roundNumber,
      content: s.content,
      createdAt: s.createdAt,
      contributor: s.contributor,
    })),
    currentRound: currentRound
      ? {
          id: currentRound.id,
          roundNumber: currentRound.roundNumber,
          startsAt: currentRound.startsAt,
          endsAt: currentRound.endsAt,
          status: currentRound.status,
          overtimeTriggered: currentRound.overtimeTriggered,
          originalEndsAt: currentRound.originalEndsAt,
          submissions: currentRound.submissions.map((s) => ({
            id: s.id,
            content: s.content,
            wordCount: s.wordCount,
            createdAt: s.createdAt,
            upvotes: s.upvotes,
            downvotes: s.downvotes,
            netScore: s.netScore,
            endsStory: s.endsStory,
            user: s.user,
            currentUserVote: voteBySubmissionId.get(s.id) ?? null,
          })),
        }
      : null,
  });
}
