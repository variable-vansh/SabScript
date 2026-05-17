import { NextResponse } from "next/server";
import { requireAuthedUser, requireModeratorUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseBody, ReportCreateSchema } from "@/lib/validations";

// ── POST: Create a report ───────────────────────────────────────────
export async function POST(request: Request) {
  const user = await requireAuthedUser();
  if ("error" in user) return user.error;

  const raw = await request.json();
  const parsed = parseBody(ReportCreateSchema, raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { targetType, targetId, reason } = parsed.data;

  // Prevent self-reporting for profiles
  if (targetType === "profile" && targetId === user.userId) {
    return jsonError("You cannot report yourself.", 400);
  }

  // Validate target exists
  let targetExists = false;
  if (targetType === "submission") {
    targetExists = !!(await prisma.submission.findUnique({ where: { id: targetId }, select: { id: true } }));
  } else if (targetType === "comment") {
    targetExists = !!(await prisma.comment.findUnique({ where: { id: targetId }, select: { id: true } }));
  } else if (targetType === "premise") {
    targetExists = !!(await prisma.premise.findUnique({ where: { id: targetId }, select: { id: true } }));
  } else if (targetType === "profile") {
    targetExists = !!(await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }));
  }

  if (!targetExists) {
    return jsonError("Target not found.", 404);
  }

  // Upsert to handle unique constraint (one report per user per target)
  try {
    await prisma.report.upsert({
      where: {
        reporterId_targetType_targetId: {
          reporterId: user.userId,
          targetType,
          targetId,
        },
      },
      update: { reason },
      create: {
        reporterId: user.userId,
        targetType,
        targetId,
        reason,
      },
    });
  } catch {
    return jsonError("Could not create report.", 500);
  }

  return NextResponse.json({ ok: true });
}

// ── GET: Aggregated reports for moderators ───────────────────────────
export async function GET() {
  const moderator = await requireModeratorUser();
  if ("error" in moderator) return moderator.error;

  // Aggregate reports grouped by targetType+targetId, sorted by count desc
  const groups = await prisma.report.groupBy({
    by: ["targetType", "targetId"],
    _count: { id: true },
    _max: { createdAt: true },
    orderBy: { _count: { id: "desc" } },
    take: 100,
  });

  // Fetch all reports for these groups (for reason lists)
  const allTargets = groups.map((g) => ({ targetType: g.targetType, targetId: g.targetId }));
  const reports = allTargets.length > 0
    ? await prisma.report.findMany({
        where: {
          OR: allTargets.map((t) => ({ targetType: t.targetType, targetId: t.targetId })),
        },
        select: {
          targetType: true,
          targetId: true,
          reason: true,
          createdAt: true,
          reporter: { select: { username: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Build a map of reasons per group
  const reasonsByKey = new Map<string, { reason: string; reporter: string; createdAt: string }[]>();
  for (const r of reports) {
    const key = `${r.targetType}:${r.targetId}`;
    const list = reasonsByKey.get(key) ?? [];
    list.push({
      reason: r.reason,
      reporter: r.reporter.username ?? "anonymous",
      createdAt: r.createdAt.toISOString(),
    });
    reasonsByKey.set(key, list);
  }

  // Fetch previews for each unique target
  const submissionIds = groups.filter((g) => g.targetType === "submission").map((g) => g.targetId);
  const commentIds = groups.filter((g) => g.targetType === "comment").map((g) => g.targetId);
  const premiseIds = groups.filter((g) => g.targetType === "premise").map((g) => g.targetId);
  const profileIds = groups.filter((g) => g.targetType === "profile").map((g) => g.targetId);

  const [submissions, comments, premises, profiles] = await Promise.all([
    submissionIds.length > 0
      ? prisma.submission.findMany({
          where: { id: { in: submissionIds } },
          select: {
            id: true,
            content: true,
            user: { select: { username: true } },
            round: { select: { storyId: true, story: { select: { title: true } } } },
          },
        })
      : [],
    commentIds.length > 0
      ? prisma.comment.findMany({
          where: { id: { in: commentIds } },
          select: {
            id: true,
            content: true,
            parentType: true,
            parentId: true,
            user: { select: { username: true } },
          },
        })
      : [],
    premiseIds.length > 0
      ? prisma.premise.findMany({
          where: { id: { in: premiseIds } },
          select: {
            id: true,
            title: true,
            content: true,
            user: { select: { username: true } },
          },
        })
      : [],
    profileIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: profileIds } },
          select: { id: true, username: true, email: true, role: true },
        })
      : [],
  ]);

  const submissionParentIdsFromComments = comments
    .filter((comment) => comment.parentType === "submission")
    .map((comment) => comment.parentId);
  const submissionParentsById = submissionParentIdsFromComments.length > 0
    ? await prisma.submission.findMany({
        where: { id: { in: submissionParentIdsFromComments } },
        select: { id: true, round: { select: { storyId: true } } },
      })
    : [];
  const submissionParentMap = new Map(
    submissionParentsById.map((submission) => [submission.id, submission.round.storyId]),
  );

  const submissionMap = new Map(submissions.map((s) => [s.id, s]));
  const commentMap = new Map(comments.map((c) => [c.id, c]));
  const premiseMap = new Map(premises.map((p) => [p.id, p]));
  const profileMap = new Map(profiles.map((u) => [u.id, u]));

  function snippet(text: string, maxLen = 120) {
    return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
  }

  const result = groups.map((g) => {
    const key = `${g.targetType}:${g.targetId}`;
    let preview: Record<string, unknown> = {};
    let link: string | null = null;
    let authorUsername: string | null = null;

    if (g.targetType === "submission") {
      const sub = submissionMap.get(g.targetId);
      if (sub) {
        preview = { content: snippet(sub.content), storyTitle: sub.round.story.title };
        link = `/stories/${sub.round.storyId}/community`;
        authorUsername = sub.user.username;
      }
    } else if (g.targetType === "comment") {
      const c = commentMap.get(g.targetId);
      if (c) {
        preview = { content: snippet(c.content), parentType: c.parentType, parentId: c.parentId };
        if (c.parentType === "premise") {
          link = `/seeds/${c.parentId}`;
        } else {
          const storyId = submissionParentMap.get(c.parentId);
          link = storyId ? `/stories/${storyId}/community` : null;
        }
        authorUsername = c.user.username;
      }
    } else if (g.targetType === "premise") {
      const p = premiseMap.get(g.targetId);
      if (p) {
        preview = { title: p.title, content: snippet(p.content) };
        link = `/seeds/${p.id}`;
        authorUsername = p.user.username;
      }
    } else if (g.targetType === "profile") {
      const u = profileMap.get(g.targetId);
      if (u) {
        preview = { username: u.username, email: u.email, role: u.role };
        link = u.username ? `/profile/${u.username}` : null;
        authorUsername = u.username;
      }
    }

    return {
      targetType: g.targetType,
      targetId: g.targetId,
      reportCount: g._count.id,
      latestReport: g._max.createdAt?.toISOString() ?? null,
      reports: reasonsByKey.get(key) ?? [],
      preview,
      link,
      authorUsername,
    };
  });

  return NextResponse.json({ groups: result });
}

// ── DELETE: Dismiss reports for a target (moderator action) ──────────
export async function DELETE(request: Request) {
  const moderator = await requireModeratorUser();
  if ("error" in moderator) return moderator.error;

  const { targetType, targetId } = await request.json();
  if (!targetType || !targetId) {
    return jsonError("targetType and targetId required", 400);
  }

  const deleted = await prisma.report.deleteMany({
    where: { targetType, targetId },
  });

  return NextResponse.json({ ok: true, deleted: deleted.count });
}
