import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import SeedDetailClient from "@/components/premises/SeedDetailClient";
import FridayCountdown from "@/components/premises/FridayCountdown";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SeedDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const revalidate = 60;

const getSeedData = unstable_cache(
  async (id: string) => {
    const premise = await prisma.premise.findUnique({
      where: { id },
      include: { user: { select: { username: true } } },
    });
    if (!premise) return null;
    return {
      premise: {
        id: premise.id,
        title: premise.title,
        content: premise.content,
        wordCount: premise.wordCount,
        upvotes: premise.upvotes,
        downvotes: premise.downvotes,
        netScore: premise.netScore,
        username: premise.user.username,
      },
    };
  },
  ["seed-detail"],
  { revalidate: 60 },
);

export default async function SeedDetailPage({ params }: SeedDetailPageProps) {
  const { id } = await params;
  const [data, session] = await Promise.all([getSeedData(id), auth()]);
  if (!data) notFound();

  const { premise } = data;
  const userId = session?.user?.id ?? null;

  const userVote = userId
    ? await prisma.premiseVote.findUnique({
        where: { premiseId_userId: { premiseId: id, userId } },
        select: { value: true },
      })
    : null;

  const premiseStar = userId
    ? await prisma.star.findUnique({
        where: { userId_targetType_targetId: { userId, targetType: "premise", targetId: premise.id } },
        select: { id: true },
      })
    : null;

  return (
    <div className="space-y-6">
      <FridayCountdown />
      <SeedDetailClient
        premise={premise}
        initialUserVote={(userVote?.value as 1 | -1 | null | undefined) ?? null}
        initiallyStarred={Boolean(premiseStar)}
      />
    </div>
  );
}
