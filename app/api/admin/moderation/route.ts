import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminUser, requireModeratorUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseBody, ModerationActionSchema } from "@/lib/validations";
import { isManageableUserRole } from "@/lib/roles";

async function logModerationAction(input: {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.moderationLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason ?? null,
      ...(input.metadata ? { metadata: input.metadata as object } : {}),
    },
  });
}

async function collectCommentDescendants(rootCommentId: string) {
  const ids = new Set<string>([rootCommentId]);
  let frontier = [rootCommentId];

  while (frontier.length > 0) {
    const children = await prisma.comment.findMany({
      where: { replyToId: { in: frontier } },
      select: { id: true },
    });
    frontier = [];
    for (const child of children) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        frontier.push(child.id);
      }
    }
  }

  return Array.from(ids);
}

export async function GET(request: NextRequest) {
  const moderator = await requireModeratorUser();
  if ("error" in moderator) return moderator.error;

  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 30), 1), 100);

  const logs = await prisma.moderationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { admin: { select: { id: true, username: true, email: true } } },
  });

  return NextResponse.json({
    logs: logs.map((entry) => ({
      id: entry.id,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason,
      metadata: entry.metadata,
      createdAt: entry.createdAt.toISOString(),
      admin: entry.admin,
    })),
  });
}

export async function POST(request: Request) {
  const moderator = await requireModeratorUser();
  if ("error" in moderator) return moderator.error;

  const raw = await request.json();
  const parsed = parseBody(ModerationActionSchema, raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const body = parsed.data;
  const reason = body.reason?.trim() || undefined;

  if (body.action === "remove_comment") {
    const rootComment = await prisma.comment.findUnique({
      where: { id: body.commentId },
      select: { id: true, parentType: true, parentId: true },
    });
    if (!rootComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const commentIds = await collectCommentDescendants(rootComment.id);
    await prisma.comment.deleteMany({ where: { id: { in: commentIds } } });

    if (rootComment.parentType === "submission") {
      const submission = await prisma.submission.findUnique({
        where: { id: rootComment.parentId },
        select: { round: { select: { storyId: true } } },
      });
      if (submission?.round.storyId) {
        revalidatePath(`/stories/${submission.round.storyId}/community`);
      }
    } else {
      revalidatePath("/");
      revalidatePath(`/seeds/${rootComment.parentId}`);
    }

    await logModerationAction({
      adminUserId: moderator.userId,
      action: "remove_comment",
      targetType: "comment",
      targetId: rootComment.id,
      reason,
      metadata: { deletedCount: commentIds.length, parentType: rootComment.parentType, parentId: rootComment.parentId },
    });

    return NextResponse.json({ ok: true, action: body.action, targetId: rootComment.id, deletedCount: commentIds.length });
  }

  if (body.action === "remove_submission") {
    const submission = await prisma.submission.findUnique({
      where: { id: body.submissionId },
      select: { id: true, wordCount: true, round: { select: { storyId: true } } },
    });
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const deletedComments = await prisma.comment.deleteMany({
      where: { parentType: "submission", parentId: submission.id },
    });

    await prisma.$transaction(async (tx) => {
      await tx.submission.delete({ where: { id: submission.id } });
      const story = await tx.story.findUnique({
        where: { id: submission.round.storyId },
        select: { submissionCount: true },
      });
      await tx.story.update({
        where: { id: submission.round.storyId },
        data: { submissionCount: Math.max((story?.submissionCount ?? 1) - 1, 0) },
      });
    });

    revalidatePath("/");
    revalidatePath(`/stories/${submission.round.storyId}`);
    revalidatePath(`/stories/${submission.round.storyId}/community`);

    await logModerationAction({
      adminUserId: moderator.userId,
      action: "remove_submission",
      targetType: "submission",
      targetId: submission.id,
      reason,
      metadata: { storyId: submission.round.storyId, deletedCommentCount: deletedComments.count },
    });

    return NextResponse.json({ ok: true, action: body.action, targetId: submission.id });
  }

  if (body.action === "remove_seed") {
    const premise = await prisma.premise.findUnique({
      where: { id: body.premiseId },
      select: { id: true },
    });
    if (!premise) {
      return NextResponse.json({ error: "Seed not found" }, { status: 404 });
    }

    const [deletedComments, deletedVotes] = await Promise.all([
      prisma.comment.deleteMany({ where: { parentType: "premise", parentId: premise.id } }),
      prisma.premiseVote.deleteMany({ where: { premiseId: premise.id } }),
    ]);

    await prisma.premise.delete({ where: { id: premise.id } });

    revalidatePath("/");
    revalidatePath(`/seeds/${premise.id}`);

    await logModerationAction({
      adminUserId: moderator.userId,
      action: "remove_seed",
      targetType: "premise",
      targetId: premise.id,
      reason,
      metadata: { deletedCommentCount: deletedComments.count, deletedVoteCount: deletedVotes.count },
    });

    return NextResponse.json({ ok: true, action: body.action, targetId: premise.id });
  }

  if (body.action === "set_user_role") {
    const admin = await requireAdminUser();
    if ("error" in admin) return admin.error;

    const userId = body.userId?.trim();
    const email = body.email?.trim().toLowerCase();
    const role = body.role;

    if (!isManageableUserRole(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (!userId && !email) {
      return NextResponse.json({ error: "userId or email is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email },
      select: { id: true, email: true, username: true, role: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.update({ where: { id: targetUser.id }, data: { role } });

    await logModerationAction({
      adminUserId: admin.userId,
      action: "set_user_role",
      targetType: "user",
      targetId: targetUser.id,
      reason,
      metadata: { previousRole: targetUser.role, nextRole: role },
    });

    return NextResponse.json({ ok: true, action: body.action, targetId: targetUser.id, previousRole: targetUser.role, nextRole: role });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
