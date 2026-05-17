import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuthedUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseBody, StarToggleSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const authUser = await requireAuthedUser();
  if ("error" in authUser) return authUser.error;

  const raw = await request.json();
  const parsed = parseBody(StarToggleSchema, raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { targetType, targetId } = parsed.data;

  if (targetType === "comment") {
    const comment = await prisma.comment.findUnique({
      where: { id: targetId },
      select: { id: true, parentType: true, parentId: true },
    });
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
  } else {
    const premise = await prisma.premise.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!premise) {
      return NextResponse.json({ error: "Seed not found" }, { status: 404 });
    }
  }

  const existing = await prisma.star.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: authUser.userId,
        targetType,
        targetId,
      },
    },
    select: { id: true },
  });

  let starred = false;
  if (existing) {
    await prisma.star.delete({ where: { id: existing.id } });
  } else {
    await prisma.star.create({
      data: { userId: authUser.userId, targetType, targetId },
    });
    starred = true;
  }

  revalidatePath("/profile");
  if (targetType === "premise") {
    revalidatePath("/");
    revalidatePath(`/seeds/${targetId}`);
  }

  return NextResponse.json({ targetType, targetId, starred });
}
