import { unstable_cache } from "next/cache";
import StoriesTable from "@/components/stories/StoriesTable";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

const getStoriesPageData = unstable_cache(
  async () => {
    const [stories, total] = await Promise.all([
      prisma.story.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 20,
        include: {
          rounds: {
            where: { status: { in: ["open", "overtime"] } },
            orderBy: { roundNumber: "desc" },
            take: 1,
            select: { roundNumber: true, endsAt: true, status: true },
          },
        },
      }),
      prisma.story.count(),
    ]);

    return {
      stories: stories.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        wordCount: s.wordCount,
        submissionCount: s.submissionCount,
        createdAt: s.createdAt.toISOString(),
        currentRound: s.rounds[0]
          ? {
              roundNumber: s.rounds[0].roundNumber,
              endsAt: s.rounds[0].endsAt.toISOString(),
              status: s.rounds[0].status as "open" | "overtime",
            }
          : null,
      })),
      total,
    };
  },
  ["stories-list"],
  { revalidate: 60 },
);

export default async function StoriesPage() {
  const { stories, total } = await getStoriesPageData();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Stories</h1>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>
      <StoriesTable stories={stories} />
    </div>
  );
}
