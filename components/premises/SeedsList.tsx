import Link from "next/link";

type SeedRow = {
  id: string;
  title: string;
  contentPreview: string;
  wordCount: number;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  netScore: number;
  user: { id: string; username: string | null };
};

export default function SeedsList({ premises }: { premises: SeedRow[] }) {
  if (premises.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No active seeds.</p>;
  }

  return (
    <div className="space-y-3">
      {premises.map((seed) => (
        <div
          key={seed.id}
          className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Link href={`/seeds/${seed.id}`} className="hover:underline">
                <h3 className="font-medium">{seed.title}</h3>
              </Link>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{seed.contentPreview}</p>
              <Link
                href={`/seeds/${seed.id}`}
                className="mt-1 inline-block text-xs text-gray-500 dark:text-gray-400 hover:underline"
              >
                View seed →
              </Link>
            </div>
            <div className="flex flex-col items-center text-sm">
              <span className="font-medium">{seed.netScore}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">votes</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {seed.user.username ? (
              <Link
                href={`/profile/${seed.user.username}`}
                className="hover:underline"
              >
                @{seed.user.username}
              </Link>
            ) : (
              <span>@anonymous</span>
            )}
            {" · "}{seed.wordCount} words
          </div>
        </div>
      ))}
    </div>
  );
}
