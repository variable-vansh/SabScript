"use client";

import { useState } from "react";
import SeedsListClient from "@/components/premises/SeedsListClient";
import SeedComposeForm from "@/components/premises/SeedComposeForm";

type SeedRow = {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  netScore: number;
  user: { id: string; username: string | null };
};

type SeedsPageClientProps = {
  premises: SeedRow[];
  total: number;
};

export default function SeedsPageClient({ premises, total }: SeedsPageClientProps) {
  const [composing, setComposing] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Seeds</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">{total} active</span>
          <button
            type="button"
            onClick={() => setComposing(!composing)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {composing ? "Cancel" : "Submit a seed"}
          </button>
        </div>
      </div>

      {composing && (
        <SeedComposeForm onClose={() => setComposing(false)} />
      )}

      <SeedsListClient premises={premises} />
    </div>
  );
}
