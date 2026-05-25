import Link from "next/link";

type StoryRow = {
  id: string;
  title: string;
  status: string;
  wordCount: number;
  submissionCount: number;
  createdAt: string;
  currentRound: {
    roundNumber: number;
    endsAt: string;
    status: "open" | "overtime";
  } | null;
};

export default function StoriesTable({ stories }: { stories: StoryRow[] }) {
  if (stories.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No stories yet.</p>;
  }

  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500 dark:text-gray-400">
            <th className="px-4 py-2">Title</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Words</th>
            <th className="px-4 py-2">Submissions</th>
            <th className="px-4 py-2">Round</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {stories.map((story) => (
            <tr key={story.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3">
                <Link href={`/stories/${story.id}`} className="font-medium hover:underline">
                  {story.title}
                </Link>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs font-medium uppercase ${
                    story.status === "active" ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {story.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{story.wordCount}</td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{story.submissionCount}</td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                {story.currentRound
                  ? `R${story.currentRound.roundNumber} (${story.currentRound.status})`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
