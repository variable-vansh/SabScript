import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuthedUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseBody, VoteSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const authUser = await requireAuthedUser();
  if ("error" in authUser) return authUser.error;

  const raw = await request.json();
  const parsed = parseBody(VoteSchema, raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { submissionId, value } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Submission"
      WHERE id = ${submissionId}
      FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      return { error: "Submission not found", status: 404 as const };
    }

    const submissionContext = await tx.submission.findUnique({
      where: { id: submissionId },
      select: {
        round: {
          select: {
            storyId: true,
          },
        },
      },
    });

    if (!submissionContext?.round.storyId) {
      return { error: "Submission not found", status: 404 as const };
    }

    const existingVote = await tx.vote.findUnique({
      where: {
        submissionId_userId: {
          submissionId,
          userId: authUser.userId,
        },
      },
      select: { id: true, value: true },
    });

    let upvoteDelta = 0;
    let downvoteDelta = 0;
    let netScoreDelta = 0;
    let currentUserVote: 1 | -1 | null = value;

    if (!existingVote) {
      await tx.vote.create({
        data: {
          submissionId,
          userId: authUser.userId,
          value,
        },
      });
      if (value === 1) {
        upvoteDelta = 1;
        netScoreDelta = 1;
      } else {
        downvoteDelta = 1;
        netScoreDelta = -1;
      }
    } else if (existingVote.value === value) {
      await tx.vote.delete({ where: { id: existingVote.id } });
      currentUserVote = null;
      if (value === 1) {
        upvoteDelta = -1;
        netScoreDelta = -1;
      } else {
        downvoteDelta = -1;
        netScoreDelta = 1;
      }
    } else {
      await tx.vote.update({
        where: { id: existingVote.id },
        data: { value },
      });
      if (existingVote.value === 1 && value === -1) {
        upvoteDelta = -1;
        downvoteDelta = 1;
        netScoreDelta = -2;
      } else if (existingVote.value === -1 && value === 1) {
        upvoteDelta = 1;
        downvoteDelta = -1;
        netScoreDelta = 2;
      }
    }

    const updated = await tx.submission.update({
      where: { id: submissionId },
      data: {
        upvotes: { increment: upvoteDelta },
        downvotes: { increment: downvoteDelta },
        netScore: { increment: netScoreDelta },
      },
      select: { id: true, upvotes: true, downvotes: true, netScore: true },
    });

    return {
      data: {
        ...updated,
        currentUserVote,
      },
      storyId: submissionContext.round.storyId,
      submissionId,
    };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  revalidatePath(`/stories/${result.storyId}`);
  revalidatePath(`/stories/${result.storyId}/community`);

  return NextResponse.json(result.data);
}
