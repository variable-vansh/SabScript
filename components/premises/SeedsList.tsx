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
    return <p className="text-sm text-gray-500">No active seeds.</p>;
  }

  return (
    <div className="space-y-3">
      {premises.map((seed) => (
        <Link
          key={seed.id}
          href={`/seeds/${seed.id}`}
          className="block border border-gray-200 p-4 hover:bg-gray-50"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium">{seed.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{seed.contentPreview}</p>
            </div>
            <div className="flex flex-col items-center text-sm">
              <span className="font-medium">{seed.netScore}</span>
              <span className="text-xs text-gray-400">votes</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            @{seed.user.username ?? "anonymous"} · {seed.wordCount} words
          </div>
        </Link>
      ))}
    </div>
  );
}
