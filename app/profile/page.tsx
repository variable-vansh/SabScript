import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import UsernameEditor from "@/components/profile/UsernameEditor";

function snippet(text: string, words = 20) {
  const split = text.trim().split(/\s+/);
  if (split.length <= words) return text;
  return `${split.slice(0, words).join(" ")}...`;
}

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to view your profile.</p>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      username: true,
      createdAt: true,
      bookmarks: {
        orderBy: { createdAt: "desc" },
        take: 30,
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
      },
      stars: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          targetType: true,
          targetId: true,
          createdAt: true,
        },
      },
      submissions: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          round: {
            include: { story: { select: { id: true, title: true } } },
          },
        },
      },
      premises: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          title: true,
          status: true,
          netScore: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) return null;

  const starredPremiseIds = user.stars
    .filter((star) => star.targetType === "premise")
    .map((star) => star.targetId);

  const starredPremisesRaw =
    starredPremiseIds.length > 0
      ? await prisma.premise.findMany({
          where: { id: { in: starredPremiseIds } },
          select: { id: true, title: true, status: true, netScore: true },
        })
      : [];

  const starredPremiseById = new Map(starredPremisesRaw.map((p) => [p.id, p]));
  const starredPremises = starredPremiseIds
    .map((id) => starredPremiseById.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="space-y-6">
      <header>
        <UsernameEditor initialUsername={user.username ?? "writer"} />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Joined {new Date(user.createdAt).toLocaleDateString()}
        </p>
      </header>

      {/* Bookmarks */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">
          Bookmarks ({user.bookmarks.length})
        </h2>
        {user.bookmarks.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No bookmarked stories yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            {user.bookmarks.map((bookmark) => (
              <li key={bookmark.story.id} className="px-4 py-3">
                <Link
                  href={`/stories/${bookmark.story.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {bookmark.story.title}
                </Link>
                <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {bookmark.story.wordCount} words · {bookmark.story.submissionCount} submissions · {bookmark.story.status}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Submissions */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">
          Submissions ({user.submissions.length})
        </h2>
        {user.submissions.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No submissions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            {user.submissions.map((sub) => (
              <li key={sub.id} className="px-4 py-3">
                <Link
                  href={`/stories/${sub.round.story.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {sub.round.story.title}
                </Link>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{snippet(sub.content)}</p>
                <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {sub.netScore} votes ·{" "}
                  {sub.round.winningSubmissionId === sub.id ? "Won" : "Lost"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Seeds */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">
          Seeds ({user.premises.length})
        </h2>
        {user.premises.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No seeds yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            {user.premises.map((seed) => (
              <li key={seed.id} className="px-4 py-3">
                <Link
                  href={`/seeds/${seed.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {seed.title}
                </Link>
                <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {seed.netScore} votes · {seed.status}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Starred Seeds */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">
          Starred Seeds ({starredPremises.length})
        </h2>
        {starredPremises.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No starred seeds yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            {starredPremises.map((seed) => (
              <li key={seed.id} className="px-4 py-3">
                <Link href={`/seeds/${seed.id}`} className="text-sm font-medium hover:underline">
                  {seed.title}
                </Link>
                <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {seed.netScore} votes · {seed.status}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
