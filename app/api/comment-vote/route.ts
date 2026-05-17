import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuthedUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseBody, CommentVoteSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const authUser = await requireAuthedUser();
  if ("error" in authUser) return authUser.error;

  const raw = await request.json();
  const parsed = parseBody(CommentVoteSchema, raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { commentId, value } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Comment"
      WHERE id = ${commentId}
      FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      return { error: "Comment not found", status: 404 as const };
    }

    const commentContext = await tx.comment.findUnique({
      where: { id: commentId },
      select: { parentType: true, parentId: true },
    });

    if (!commentContext) {
      return { error: "Comment not found", status: 404 as const };
    }

    const existingVote = await tx.commentVote.findUnique({
      where: { commentId_userId: { commentId, userId: authUser.userId } },
      select: { id: true, value: true },
    });

    let upvoteDelta = 0;
    let downvoteDelta = 0;
    let netScoreDelta = 0;
    let currentUserVote: 1 | -1 | null = value;

    if (!existingVote) {
      await tx.commentVote.create({ data: { commentId, userId: authUser.userId, value } });
      if (value === 1) { upvoteDelta = 1; netScoreDelta = 1; }
      else { downvoteDelta = 1; netScoreDelta = -1; }
    } else if (existingVote.value === value) {
      await tx.commentVote.delete({ where: { id: existingVote.id } });
      currentUserVote = null;
      if (value === 1) { upvoteDelta = -1; netScoreDelta = -1; }
      else { downvoteDelta = -1; netScoreDelta = 1; }
    } else {
      await tx.commentVote.update({ where: { id: existingVote.id }, data: { value } });
      if (existingVote.value === 1 && value === -1) { upvoteDelta = -1; downvoteDelta = 1; netScoreDelta = -2; }
      else if (existingVote.value === -1 && value === 1) { upvoteDelta = 1; downvoteDelta = -1; netScoreDelta = 2; }
    }

    const updated = await tx.comment.update({
      where: { id: commentId },
      data: {
        upvotes: { increment: upvoteDelta },
        downvotes: { increment: downvoteDelta },
        netScore: { increment: netScoreDelta },
      },
      select: { id: true, upvotes: true, downvotes: true, netScore: true },
    });

    return {
      data: { ...updated, currentUserVote },
      parentType: commentContext.parentType,
      parentId: commentContext.parentId,
    };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.parentType === "submission") {
    const submission = await prisma.submission.findUnique({
      where: { id: result.parentId },
      select: { round: { select: { storyId: true } } },
    });
    if (submission?.round.storyId) {
      revalidatePath(`/stories/${submission.round.storyId}/community`);
    }
  } else if (result.parentType === "premise") {
    revalidatePath(`/seeds/${result.parentId}`);
  }

  return NextResponse.json(result.data);
}
