import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import StoryBookmarkButton from "@/components/actions/StoryBookmarkButton";
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
    <article className="space-y-6">
      <header className="space-y-2 border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold">{story.title}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{story.wordCount} words</span>
          <span>{story.segments.length} segments</span>
          <span
            className={`font-medium uppercase ${
              story.status === "active" ? "text-green-600" : "text-gray-400"
            }`}
          >
            {story.status}
          </span>
        </div>
        <div className="mt-2">
          <StoryBookmarkButton storyId={story.id} initiallyBookmarked={initiallyBookmarked} />
        </div>
        {story.currentRound && (
          <div className="mt-2">
            <Link
              href={`/stories/${story.id}/community`}
              className="inline-block border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Go to Community — Round {story.currentRound.roundNumber} ({story.currentRound.status})
            </Link>
          </div>
        )}
        {!story.currentRound && story.status === "active" && (
          <div className="mt-2">
            <Link
              href={`/stories/${story.id}/community`}
              className="inline-block border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Go to Community
            </Link>
          </div>
        )}
      </header>

      {story.premise && (
        <section className="space-y-1">
          <h2 className="text-xs font-medium uppercase text-gray-500">Premise</h2>
          <p className="whitespace-pre-line leading-7">{story.premise}</p>
        </section>
      )}

      <div className="space-y-6">
        {story.segments.map((segment, idx) => (
          <section key={segment.id} className="space-y-2">
            <p className="whitespace-pre-line leading-7">{segment.content}</p>
            <p className="text-xs text-gray-400">
              {segment.contributor.username ? (
                <Link href={`/profile/${segment.contributor.username}`} className="hover:underline">
                  @{segment.contributor.username}
                </Link>
              ) : (
                <span>@anonymous</span>
              )}{" "}
              · Round {segment.roundNumber}
            </p>
            {idx < story.segments.length - 1 && <hr className="border-gray-200" />}
          </section>
        ))}
      </div>
    </article>
  );
}
