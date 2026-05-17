import Link from "next/link";
import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

const getHomeData = unstable_cache(
  async () => {
    const [stories, premises] = await Promise.all([
      prisma.story.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          wordCount: true,
          submissionCount: true,
          createdAt: true,
        },
      }),
      prisma.premise.findMany({
        where: { status: "voting" },
        orderBy: [{ netScore: "desc" }, { createdAt: "desc" }],
        take: 10,
        select: {
          id: true,
          title: true,
          netScore: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      stories: stories.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      premises: premises.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    };
  },
  ["home-data"],
  { revalidate: 60 },
);

export default async function HomePage() {
  const [session, { stories, premises }] = await Promise.all([auth(), getHomeData()]);

  const bookmarkedStories = session?.user?.id
    ? await prisma.bookmark.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          story: {
            select: {
              id: true,
              title: true,
              status: true,
              wordCount: true,
              submissionCount: true,
            },
          },
        },
      })
    : [];

  return (
    <div className="space-y-8">
      {session?.user?.id && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Bookmarked stories</h2>
            <Link href="/profile" className="text-sm text-gray-500 hover:underline">
              View profile →
            </Link>
          </div>
          {bookmarkedStories.length === 0 ? (
            <p className="text-sm text-gray-500">No bookmarks yet. Open a story and click Bookmark.</p>
          ) : (
            <ul className="divide-y divide-gray-200 border border-gray-200">
              {bookmarkedStories.map(({ story }) => (
                <li key={story.id}>
                  <Link
                    href={`/stories/${story.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <div>
                      <span className="font-medium">{story.title}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {story.wordCount} words · {story.submissionCount} submissions
                      </span>
                    </div>
                    <span
                      className={`text-xs font-medium uppercase ${
                        story.status === "active" ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      {story.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Stories</h2>
          <Link href="/stories" className="text-sm text-gray-500 hover:underline">
            View all →
          </Link>
        </div>
        {stories.length === 0 ? (
          <p className="text-sm text-gray-500">No stories yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200">
            {stories.map((story) => (
              <li key={story.id}>
                <Link
                  href={`/stories/${story.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <span className="font-medium">{story.title}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      {story.wordCount} words · {story.submissionCount} submissions
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium uppercase ${
                      story.status === "active" ? "text-green-600" : "text-gray-400"
                    }`}
                  >
                    {story.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Seeds</h2>
          <Link href="/seeds" className="text-sm text-gray-500 hover:underline">
            View all →
          </Link>
        </div>
        {premises.length === 0 ? (
          <p className="text-sm text-gray-500">No active seeds.</p>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200">
            {premises.map((premise) => (
              <li key={premise.id}>
                <Link
                  href={`/seeds/${premise.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <span className="font-medium">{premise.title}</span>
                  <span className="text-sm text-gray-500">{premise.netScore} votes</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
