import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuthedUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { countWords } from "@/lib/utils";
import { parseBody, PremiseCreateSchema } from "@/lib/validations";

const WEEKLY_PREMISE_LIMIT = 2;

function truncate(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()}...`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const status = searchParams.get("status");
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 10), 1), 50);
  const skip = (page - 1) * limit;

  const where = { ...(status ? { status } : {}) };

  const allowedSorts = new Set(["createdAt", "netScore", "upvotes", "title"]);
  const orderBy = allowedSorts.has(sortBy)
    ? { [sortBy]: order }
    : { createdAt: "desc" as const };

  const [premises, total] = await Promise.all([
    prisma.premise.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: { user: { select: { id: true, username: true } } },
    }),
    prisma.premise.count({ where }),
  ]);

  const premiseIds = premises.map((p) => p.id);
  const commentCounts =
    premiseIds.length > 0
      ? await prisma.comment.groupBy({
          by: ["parentId"],
          where: { parentType: "premise", parentId: { in: premiseIds } },
          _count: { _all: true },
        })
      : [];

  const commentMap = new Map(commentCounts.map((c) => [c.parentId, c._count._all]));

  return NextResponse.json({
    data: premises.map((premise) => ({
      id: premise.id,
      title: premise.title,
      content: premise.content,
      contentPreview: truncate(premise.content, 100),
      wordCount: premise.wordCount,
      createdAt: premise.createdAt,
      status: premise.status,
      upvotes: premise.upvotes,
      downvotes: premise.downvotes,
      netScore: premise.netScore,
      user: premise.user,
      commentsCount: commentMap.get(premise.id) ?? 0,
    })),
    pagination: { page, limit, total, hasMore: page * limit < total },
  });
}

export async function POST(request: Request) {
  const authUser = await requireAuthedUser({ requireUsername: true });
  if ("error" in authUser) return authUser.error;

  const raw = await request.json();
  const parsed = parseBody(PremiseCreateSchema, raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { title, content: rawContent } = parsed.data;
  const content = rawContent.trim();
  const wordCount = countWords(content);

  if (wordCount < 100 || wordCount > 150) {
    return NextResponse.json(
      { error: "Premise must be between 100 and 150 words." },
      { status: 400 },
    );
  }

  const weekWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentCount = await prisma.premise.count({
    where: {
      userId: authUser.userId,
      createdAt: { gte: weekWindowStart },
    },
  });

  if (recentCount >= WEEKLY_PREMISE_LIMIT) {
    return NextResponse.json(
      { error: "You can submit up to 2 seeds per 7 days. Try again later." },
      { status: 429 },
    );
  }

  const premise = await prisma.premise.create({
    data: {
      userId: authUser.userId,
      title: title.trim(),
      content,
      wordCount,
      status: "voting",
    },
    include: { user: { select: { id: true, username: true } } },
  });

  revalidatePath("/");
  revalidatePath(`/seeds/${premise.id}`);

  return NextResponse.json(premise, { status: 201 });
}
