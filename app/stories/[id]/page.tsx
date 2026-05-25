import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import StoryReaderClient from "@/components/stories/StoryReaderClient";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type StoryPageProps = {
  params: Promise<{ id: string }>;
};

export const revalidate = 30;

const getStoryData = unstable_cache(
  async (id: string) => {
    const story = await prisma.story.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        premise: true,
        status: true,
        wordCount: true,
        maxSegments: true,
        createdAt: true,
        segments: {
          orderBy: { roundNumber: "asc" },
          select: {
            id: true,
            roundNumber: true,
            content: true,
            createdAt: true,
            contributor: { select: { username: true } },
          },
        },
        rounds: {
          where: { status: { in: ["open", "overtime"] } },
          orderBy: { roundNumber: "desc" },
          take: 1,
          select: { id: true, roundNumber: true, endsAt: true, status: true },
        },
      },
    });

    if (!story) return null;

    return {
      ...story,
      createdAt: story.createdAt.toISOString(),
      segments: story.segments.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      })),
      currentRound: story.rounds[0]
        ? {
            ...story.rounds[0],
            endsAt: story.rounds[0].endsAt.toISOString(),
          }
        : null,
    };
  },
  ["story-detail"],
  { revalidate: 30 },
);

export default async function StoryDetailPage({ params }: StoryPageProps) {
  const { id } = await params;
  const session = await auth();
  const story = await getStoryData(id);
  if (!story) notFound();

  const initiallyBookmarked = session?.user?.id
    ? Boolean(
        await prisma.bookmark.findUnique({
          where: {
            userId_storyId: {
              userId: session.user.id,
              storyId: story.id,
            },
          },
          select: { id: true },
        }),
      )
    : false;

  return (
    <StoryReaderClient
      story={story}
      initiallyBookmarked={initiallyBookmarked}
    />
  );
}
