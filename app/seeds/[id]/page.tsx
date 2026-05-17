import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import StarToggleButton from "@/components/actions/StarToggleButton";
import CommentThread from "@/components/comments/CommentThread";
import PremiseVotePanel from "@/components/premises/PremiseVotePanel";
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

    const comments = await prisma.comment.findMany({
      where: { parentType: "premise", parentId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { username: true } } },
    });

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
      comments: comments.map((c) => ({
        id: c.id,
        parentType: c.parentType as "submission" | "premise",
        parentId: c.parentId,
        userId: c.userId,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
        replyToId: c.replyToId,
        upvotes: c.upvotes,
        downvotes: c.downvotes,
        netScore: c.netScore,
        currentUserVote: null as 1 | -1 | null,
        user: { username: c.user.username },
      })),
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

  const [premiseStar, commentStars] = userId
    ? await Promise.all([
        prisma.star.findUnique({
          where: {
            userId_targetType_targetId: {
              userId,
              targetType: "premise",
              targetId: premise.id,
            },
          },
          select: { id: true },
        }),
        data.comments.length > 0
          ? prisma.star.findMany({
              where: {
                userId,
                targetType: "comment",
                targetId: { in: data.comments.map((comment) => comment.id) },
              },
              select: { targetId: true },
            })
          : Promise.resolve([]),
      ])
    : [null, [] as Array<{ targetId: string }>];

  const starredCommentIds = new Set(commentStars.map((star) => star.targetId));
  const comments = data.comments.map((comment) => ({
    ...comment,
    starredByMe: starredCommentIds.has(comment.id),
  }));

  return (
    <div className="space-y-6">
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
              <StarToggleButton
                targetType="premise"
                targetId={premise.id}
                initiallyStarred={Boolean(premiseStar)}
                className="border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
              />
            </div>
            <p className="whitespace-pre-line leading-7">{premise.content}</p>
            <p className="text-xs text-gray-500">
              @{premise.username ?? "anonymous"} · {premise.wordCount} words
            </p>
          </div>
        </div>
      </article>

      <CommentThread
        parentType="premise"
        parentId={premise.id}
        initialComments={comments}
      />
    </div>
  );
}
