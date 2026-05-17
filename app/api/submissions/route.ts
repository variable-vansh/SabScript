import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuthedUser } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countWords } from "@/lib/utils";
import { parseBody, SubmissionCreateSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const storyId = request.nextUrl.searchParams.get("storyId")?.trim();
  const roundId = request.nextUrl.searchParams.get("roundId")?.trim();

  if (!storyId || !roundId) {
    return NextResponse.json({ error: "storyId and roundId are required" }, { status: 400 });
  }

  const round = await prisma.round.findFirst({
    where: { id: roundId, storyId },
    select: { id: true, roundNumber: true, status: true, startsAt: true, endsAt: true },
  });

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const submissions = await prisma.submission.findMany({
    where: { roundId: round.id },
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

  const subIds = submissions.map((s) => s.id);

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

  const commentMap = new Map(commentCounts.map((r) => [r.parentId, r._count._all]));
  const voteMap = new Map(voteRows.map((r) => [r.submissionId, r.value as 1 | -1]));

  return NextResponse.json({
    round: {
      id: round.id,
      roundNumber: round.roundNumber,
      status: round.status,
      startsAt: round.startsAt.toISOString(),
      endsAt: round.endsAt.toISOString(),
    },
    submissions: submissions.map((s) => ({
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
    })),
  });
}

export async function POST(request: Request) {
  const authUser = await requireAuthedUser({ requireUsername: true });
  if ("error" in authUser) return authUser.error;

  const raw = await request.json();
  const parsed = parseBody(SubmissionCreateSchema, raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { roundId, content: rawContent, endsStory } = parsed.data;
  const content = rawContent.trim();
  const wordCount = countWords(content);

  if (wordCount < 100 || wordCount > 200) {
    return NextResponse.json(
      { error: "Submission must be between 100 and 200 words." },
      { status: 400 },
    );
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { id: true, storyId: true, status: true },
  });

  if (!round || !["open", "overtime"].includes(round.status)) {
    return NextResponse.json(
      { error: "Round is not available for submissions." },
      { status: 400 },
    );
  }

  try {
    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.submission.create({
        data: { roundId, userId: authUser.userId, content, wordCount, endsStory },
      });

      await tx.story.update({
        where: { id: round.storyId },
        data: { submissionCount: { increment: 1 } },
      });

      return created;
    });

    revalidatePath("/");
    revalidatePath(`/stories/${round.storyId}`);
    revalidatePath(`/stories/${round.storyId}/community`);

    return NextResponse.json(submission, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You already have a submission in this round." },
        { status: 409 },
      );
    }
    throw error;
  }
}
