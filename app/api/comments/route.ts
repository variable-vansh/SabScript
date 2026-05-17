import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuthedUser } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, CommentCreateSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const parentType = request.nextUrl.searchParams.get("parentType");
  const parentId = request.nextUrl.searchParams.get("parentId")?.trim();

  if (!parentType || !["submission", "premise"].includes(parentType)) {
    return NextResponse.json(
      { error: "parentType must be 'submission' or 'premise'" },
      { status: 400 },
    );
  }

  if (!parentId) {
    return NextResponse.json({ error: "parentId is required" }, { status: 400 });
  }

  const comments = await prisma.comment.findMany({
    where: { parentType, parentId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { username: true } } },
  });

  const commentIds = comments.map((comment) => comment.id);
  const commentStars =
    userId && commentIds.length > 0
      ? await prisma.star.findMany({
          where: {
            userId,
            targetType: "comment",
            targetId: { in: commentIds },
          },
          select: { targetId: true },
        })
      : [];
  const starredByMe = new Set(commentStars.map((star) => star.targetId));

  return NextResponse.json(
    comments.map((comment) => ({
      id: comment.id,
      parentType: comment.parentType,
      parentId: comment.parentId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      replyToId: comment.replyToId,
      upvotes: comment.upvotes,
      downvotes: comment.downvotes,
      netScore: comment.netScore,
      currentUserVote: null,
      starredByMe: starredByMe.has(comment.id),
      user: { username: comment.user.username },
    })),
  );
}

export async function POST(request: Request) {
  const authUser = await requireAuthedUser();
  if ("error" in authUser) return authUser.error;

  const raw = await request.json();
  const parsed = parseBody(CommentCreateSchema, raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { parentType, parentId, content, replyToId } = parsed.data;

  let submissionStoryId: string | null = null;

  if (parentType === "submission") {
    const submission = await prisma.submission.findUnique({
      where: { id: parentId },
      select: { id: true, round: { select: { storyId: true } } },
    });
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    submissionStoryId = submission.round.storyId;
  } else {
    const premise = await prisma.premise.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!premise) {
      return NextResponse.json({ error: "Premise not found" }, { status: 404 });
    }
  }

  if (replyToId) {
    const replyTarget = await prisma.comment.findUnique({
      where: { id: replyToId },
      select: { id: true, parentType: true, parentId: true },
    });

    if (!replyTarget) {
      return NextResponse.json({ error: "Reply target comment not found" }, { status: 404 });
    }
    if (replyTarget.parentType !== parentType || replyTarget.parentId !== parentId) {
      return NextResponse.json({ error: "Reply target must belong to the same thread." }, { status: 400 });
    }
  }

  const comment = await prisma.comment.create({
    data: {
      parentType,
      parentId,
      userId: authUser.userId,
      content,
      replyToId: replyToId ?? null,
    },
    include: { user: { select: { id: true, username: true } } },
  });

  if (parentType === "submission" && submissionStoryId) {
    revalidatePath(`/stories/${submissionStoryId}/community`);
  } else {
    revalidatePath("/");
    revalidatePath(`/seeds/${parentId}`);
  }

  return NextResponse.json(comment, { status: 201 });
}
