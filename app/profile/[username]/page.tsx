import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ReportButton from "@/components/moderation/ReportButton";

type PublicProfilePageProps = {
  params: Promise<{ username: string }>;
};

function snippet(text: string, words = 20) {
  const split = text.trim().split(/\s+/);
  if (split.length <= words) return text;
  return `${split.slice(0, words).join(" ")}...`;
}

export async function generateMetadata({ params }: PublicProfilePageProps) {
  const { username } = await params;
  return { title: `@${username} — SabScript` };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      createdAt: true,
      role: true,
      submissions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          content: true,
          netScore: true,
          createdAt: true,
          round: {
            select: {
              story: { select: { id: true, title: true } },
              winningSubmissionId: true,
            },
          },
        },
      },
      premises: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          netScore: true,
          createdAt: true,
        },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          parentType: true,
          parentId: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) notFound();

  const isOwnProfile = session?.user?.id === user.id;
  const submissionCommentParentIds = [...new Set(
    user.comments
      .filter((comment) => comment.parentType === "submission")
      .map((comment) => comment.parentId),
  )];
  const submissionCommentParents = submissionCommentParentIds.length > 0
    ? await prisma.submission.findMany({
        where: { id: { in: submissionCommentParentIds } },
        select: {
          id: true,
          round: {
            select: {
              story: { select: { id: true, title: true } },
            },
          },
        },
      })
    : [];
  const submissionCommentParentMap = new Map(
    submissionCommentParents.map((submission) => [submission.id, submission.round.story]),
  );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">@{user.username}</h1>
          <p className="text-sm text-gray-500">
            Joined {new Date(user.createdAt).toLocaleDateString()}
          </p>
          {user.role === "banned" && (
            <span className="mt-1 inline-block text-xs font-medium text-red-500">Banned</span>
          )}
        </div>
        {!isOwnProfile && (
          <ReportButton targetType="profile" targetId={user.id} />
        )}
      </header>

      {/* Stats */}
      <div className="flex gap-6 text-sm text-gray-500">
        <span>{user.submissions.length} submissions</span>
        <span>{user.premises.length} seeds</span>
        <span>{user.comments.length} comments</span>
      </div>

      {/* Submissions */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">
          Submissions ({user.submissions.length})
        </h2>
        {user.submissions.length === 0 ? (
          <p className="text-sm text-gray-400">No submissions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200">
            {user.submissions.map((sub) => (
              <li key={sub.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/stories/${sub.round.story.id}/community`}
                      className="text-sm font-medium hover:underline"
                    >
                      {sub.round.story.title}
                    </Link>
                    <p className="mt-1 text-sm text-gray-600">{snippet(sub.content)}</p>
                    <div className="mt-1 text-xs text-gray-400">
                      {sub.netScore} votes ·{" "}
                      {sub.round.winningSubmissionId === sub.id ? "Won" : "Lost"}
                    </div>
                  </div>
                  <ReportButton targetType="submission" targetId={sub.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Seeds */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">
          Seeds ({user.premises.length})
        </h2>
        {user.premises.length === 0 ? (
          <p className="text-sm text-gray-400">No seeds yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200">
            {user.premises.map((seed) => (
              <li key={seed.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/seeds/${seed.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {seed.title}
                    </Link>
                    <div className="mt-1 text-xs text-gray-400">
                      {seed.netScore} votes · {seed.status}
                    </div>
                  </div>
                  <ReportButton targetType="premise" targetId={seed.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Comments */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">
          Comments ({user.comments.length})
        </h2>
        {user.comments.length === 0 ? (
          <p className="text-sm text-gray-400">No comments yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200">
            {user.comments.map((comment) => {
              const submissionStory = submissionCommentParentMap.get(comment.parentId);
              const href = comment.parentType === "premise"
                ? `/seeds/${comment.parentId}`
                : submissionStory
                  ? `/stories/${submissionStory.id}/community`
                  : null;
              const label = comment.parentType === "premise"
                ? "on seed"
                : submissionStory
                  ? `on ${submissionStory.title} community`
                  : "on submission";
              return (
                <li key={comment.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-600">{snippet(comment.content)}</p>
                      <div className="mt-1 text-xs text-gray-400">
                        {href ? (
                          <Link href={href} className="hover:underline">
                            {label}
                          </Link>
                        ) : (
                          <span>{label}</span>
                        )}{" "}
                        · {new Date(comment.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <ReportButton targetType="comment" targetId={comment.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isOwnProfile && (
        <p className="text-xs text-gray-400">
          This is your public profile.{" "}
          <Link href="/profile" className="hover:underline">
            View full profile →
          </Link>
        </p>
      )}
    </div>
  );
}
