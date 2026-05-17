import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuthedUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseBody, BookmarkToggleSchema } from "@/lib/validations";

export async function GET() {
  const authUser = await requireAuthedUser();
  if ("error" in authUser) return authUser.error;

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: authUser.userId },
    orderBy: { createdAt: "desc" },
    include: {
      story: {
        select: {
          id: true,
          title: true,
          status: true,
          wordCount: true,
          submissionCount: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    data: bookmarks.map((bookmark) => ({
      id: bookmark.id,
      storyId: bookmark.storyId,
      createdAt: bookmark.createdAt.toISOString(),
      story: {
        ...bookmark.story,
        createdAt: bookmark.story.createdAt.toISOString(),
      },
    })),
  });
}

export async function POST(request: NextRequest) {
  const authUser = await requireAuthedUser();
  if ("error" in authUser) return authUser.error;

  const raw = await request.json();
  const parsed = parseBody(BookmarkToggleSchema, raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { storyId } = parsed.data;

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true },
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const existing = await prisma.bookmark.findUnique({
    where: { userId_storyId: { userId: authUser.userId, storyId } },
    select: { id: true },
  });

  let bookmarked = false;
  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
  } else {
    await prisma.bookmark.create({
      data: { userId: authUser.userId, storyId },
    });
    bookmarked = true;
  }

  revalidatePath("/");
  revalidatePath(`/stories/${storyId}`);
  revalidatePath("/profile");

  return NextResponse.json({ storyId, bookmarked });
}
