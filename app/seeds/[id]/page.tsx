import { notFound } from "next/navigation";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import StarToggleButton from "@/components/actions/StarToggleButton";
import PremiseVotePanel from "@/components/premises/PremiseVotePanel";
import ReportButton from "@/components/moderation/ReportButton";
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
        where: {
          userId_targetType_targetId: {
            userId,
            targetType: "premise",
            targetId: premise.id,
          },
        },
        select: { id: true },
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Friday promotion info */}
      <FridayCountdown />

      <article className="space-y-4">
        <div className="flex items-start gap-4">
          <PremiseVotePanel
            premiseId={premise.id}
            initialUpvotes={premise.upvotes}
            initialDownvotes={premise.downvotes}
            initialNetScore={premise.netScore}
            initialCurrentUserVote={(userVote?.value as 1 | -1 | null | undefined) ?? null}
          />
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold">{premise.title}</h1>
              <div className="flex items-center gap-2">
                <ReportButton targetType="premise" targetId={premise.id} />
                <StarToggleButton
                  targetType="premise"
                  targetId={premise.id}
                  initiallyStarred={Boolean(premiseStar)}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                />
              </div>
            </div>
            <p className="whitespace-pre-line leading-7">{premise.content}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {premise.username ? (
                <Link href={`/profile/${premise.username}`} className="hover:underline">
                  @{premise.username}
                </Link>
              ) : (
                <span>@anonymous</span>
              )}
              {" · "}{premise.wordCount} words
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
