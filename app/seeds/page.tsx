import Link from "next/link";
import { unstable_cache } from "next/cache";
import SeedsList from "@/components/premises/SeedsList";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

const getSeedsData = unstable_cache(
  async () => {
    const [premises, total] = await Promise.all([
      prisma.premise.findMany({
        where: { status: "voting" },
        orderBy: [{ netScore: "desc" }, { createdAt: "desc" }],
        take: 20,
        include: { user: { select: { id: true, username: true } } },
      }),
      prisma.premise.count({ where: { status: "voting" } }),
    ]);

    return {
      premises: premises.map((p) => ({
        id: p.id,
        title: p.title,
        contentPreview: p.content.length > 120 ? p.content.slice(0, 120) + "..." : p.content,
        wordCount: p.wordCount,
        createdAt: p.createdAt.toISOString(),
        upvotes: p.upvotes,
        downvotes: p.downvotes,
        netScore: p.netScore,
        user: p.user,
      })),
      total,
    };
  },
  ["seeds-list"],
  { revalidate: 60 },
);

export default async function SeedsPage() {
  const { premises, total } = await getSeedsData();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Seeds</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{total} active</span>
          <Link
            href="/seeds?compose=1"
            className="border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Submit a seed
          </Link>
        </div>
      </div>
      <SeedsList premises={premises} />
    </div>
  );
}
