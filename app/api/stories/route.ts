import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "title",
  "submissionCount",
  "wordCount",
]);

type SortField = "createdAt" | "title" | "submissionCount" | "wordCount";
type SortOrder = "asc" | "desc";

function truncate(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()}...`;
}

function parseSortField(value: string | null): SortField {
  if (value && ALLOWED_SORT_FIELDS.has(value)) return value as SortField;
  return "createdAt";
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = parseSortField(searchParams.get("sortBy"));
  const order: SortOrder = searchParams.get("order") === "asc" ? "asc" : "desc";
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 10), 1), 50);
  const skip = (page - 1) * limit;

  const where = {
    ...(status === "active" || status === "completed" ? { status } : {}),
    ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [stories, total] = await Promise.all([
    prisma.story.findMany({
      where,
      orderBy: { [sortBy]: order },
      skip,
      take: limit,
      include: {
        rounds: {
          where: { status: { in: ["open", "overtime"] } },
          orderBy: { roundNumber: "desc" },
          take: 1,
          select: { roundNumber: true, endsAt: true, status: true },
        },
      },
    }),
    prisma.story.count({ where }),
  ]);

  return NextResponse.json({
    data: stories.map((story) => ({
      id: story.id,
      title: story.title,
      premise: truncate(story.premise, 100),
      submissionCount: story.submissionCount,
      wordCount: story.wordCount,
      status: story.status,
      createdAt: story.createdAt,
      currentRound: story.rounds[0] ?? null,
    })),
    pagination: { page, limit, total, hasMore: page * limit < total },
  });
}
