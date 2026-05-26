import { unstable_cache } from "next/cache";
import FridayCountdown from "@/components/premises/FridayCountdown";
import SeedsPageClient from "@/components/premises/SeedsPageClient";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

const getSeedsData = unstable_cache(
  async () => {
    const [premises, total] = await Promise.all([
      prisma.premise.findMany({
        where: { status: "voting" },
        orderBy: [{ netScore: "desc" }, { createdAt: "desc" }],
        take: 50,
        include: { user: { select: { id: true, username: true } } },
      }),
      prisma.premise.count({ where: { status: "voting" } }),
    ]);

    return {
      premises: premises.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
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
    <div className="space-y-4">
      <FridayCountdown />
      <SeedsPageClient premises={premises} total={total} />
    </div>
  );
}
