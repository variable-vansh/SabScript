import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ROUND_DURATION_MS = 24 * 60 * 60 * 1000;
const TOP_WEEKLY_COUNT = 2;
const TOP_CUMULATIVE_COUNT = 2;

/**
 * Weekly seed resolution — called via cron every Friday evening US time.
 * Selects the top 4 seeds:
 *   - Top 2 by votes received that week (PremiseVote.createdAt >= 7 days ago)
 *   - Top 2 by cumulative netScore
 *
 * Deduplicates (a seed can qualify in both categories but only becomes one story).
 * Each promoted seed becomes a Story with one initial Round.
 */
export async function POST(request: Request) {
  // Simple auth: check for a secret key (cron protection)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Top 2 by weekly votes
  const weeklyVoteAgg = await prisma.premiseVote.groupBy({
    by: ["premiseId"],
    where: {
      createdAt: { gte: weekAgo },
      premise: { status: "voting" },
    },
    _sum: { value: true },
    orderBy: { _sum: { value: "desc" } },
    take: TOP_WEEKLY_COUNT,
  });

  const weeklyPremiseIds = weeklyVoteAgg.map((r) => r.premiseId);

  // 2. Top 2 by cumulative netScore (excluding already-selected weekly ones)
  const cumulativeTop = await prisma.premise.findMany({
    where: {
      status: "voting",
      id: { notIn: weeklyPremiseIds },
    },
    orderBy: { netScore: "desc" },
    take: TOP_CUMULATIVE_COUNT,
    select: { id: true },
  });

  const cumulativePremiseIds = cumulativeTop.map((p) => p.id);

  // Merge and deduplicate
  const allPremiseIds = [...new Set([...weeklyPremiseIds, ...cumulativePremiseIds])];

  if (allPremiseIds.length === 0) {
    return NextResponse.json({ promoted: 0, message: "No seeds to promote." });
  }

  // Load the full premises
  const premises = await prisma.premise.findMany({
    where: { id: { in: allPremiseIds } },
    select: { id: true, title: true, content: true },
  });

  const created: { storyId: string; premiseId: string; title: string }[] = [];

  for (const premise of premises) {
    const story = await prisma.$transaction(async (tx) => {
      // Create the story
      const newStory = await tx.story.create({
        data: {
          title: premise.title,
          premise: premise.content,
          status: "active",
          wordCount: 0,
          submissionCount: 0,
        },
      });

      // Open first round
      await tx.round.create({
        data: {
          storyId: newStory.id,
          roundNumber: 1,
          startsAt: now,
          endsAt: new Date(now.getTime() + ROUND_DURATION_MS),
          status: "open",
        },
      });

      // Mark premise as promoted
      await tx.premise.update({
        where: { id: premise.id },
        data: { status: "promoted" },
      });

      return newStory;
    });

    created.push({
      storyId: story.id,
      premiseId: premise.id,
      title: premise.title,
    });
  }

  return NextResponse.json({
    promoted: created.length,
    stories: created,
  });
}
