import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuthedUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseBody, PremiseVoteSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const authUser = await requireAuthedUser();
  if ("error" in authUser) return authUser.error;

  const raw = await request.json();
  const parsed = parseBody(PremiseVoteSchema, raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { premiseId, value } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Premise"
      WHERE id = ${premiseId}
      FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      return { error: "Premise not found", status: 404 as const };
    }

    const existingVote = await tx.premiseVote.findUnique({
      where: { premiseId_userId: { premiseId, userId: authUser.userId } },
      select: { id: true, value: true },
    });

    let upvoteDelta = 0;
    let downvoteDelta = 0;
    let netScoreDelta = 0;
    let currentUserVote: 1 | -1 | null = value;

    if (!existingVote) {
      await tx.premiseVote.create({ data: { premiseId, userId: authUser.userId, value } });
      if (value === 1) { upvoteDelta = 1; netScoreDelta = 1; }
      else { downvoteDelta = 1; netScoreDelta = -1; }
    } else if (existingVote.value === value) {
      await tx.premiseVote.delete({ where: { id: existingVote.id } });
      currentUserVote = null;
      if (value === 1) { upvoteDelta = -1; netScoreDelta = -1; }
      else { downvoteDelta = -1; netScoreDelta = 1; }
    } else {
      await tx.premiseVote.update({ where: { id: existingVote.id }, data: { value } });
      if (existingVote.value === 1 && value === -1) { upvoteDelta = -1; downvoteDelta = 1; netScoreDelta = -2; }
      else if (existingVote.value === -1 && value === 1) { upvoteDelta = 1; downvoteDelta = -1; netScoreDelta = 2; }
    }

    const updated = await tx.premise.update({
      where: { id: premiseId },
      data: {
        upvotes: { increment: upvoteDelta },
        downvotes: { increment: downvoteDelta },
        netScore: { increment: netScoreDelta },
      },
      select: { id: true, upvotes: true, downvotes: true, netScore: true },
    });

    return { data: { ...updated, currentUserVote }, premiseId };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  revalidatePath("/");
  revalidatePath(`/seeds/${result.premiseId}`);

  return NextResponse.json(result.data);
}
