import { prisma } from "@/lib/prisma";

const ROUND_DURATION_MS = 24 * 60 * 60 * 1000;
const OVERTIME_LOOKBACK_MS = 6 * 60 * 60 * 1000;

type ResolutionResult =
  | "overtime_triggered"
  | "resolved_with_winner"
  | "resolved_without_winner"
  | "resolved_story_ended"
  | "skipped";

export type RoundResolutionSummary = {
  expiredRounds: number;
  resolvedRounds: number;
  overtimeTriggered: number;
  skippedRounds: number;
  storiesEnded: number;
};

type ResolveExpiredRoundsOptions = {
  storyId?: string;
};

function addDuration(date: Date, milliseconds: number) {
  return new Date(date.getTime() + milliseconds);
}

async function resolveRound(roundId: string, now: Date): Promise<ResolutionResult> {
  return prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        storyId: true,
        roundNumber: true,
        status: true,
        endsAt: true,
        overtimeTriggered: true,
      },
    });

    if (!round) return "skipped";
    if (!["open", "overtime"].includes(round.status)) return "skipped";
    if (round.endsAt > now) return "skipped";

    const rankedSubmissions = await tx.submission.findMany({
      where: { roundId: round.id },
      orderBy: [{ netScore: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        userId: true,
        content: true,
        wordCount: true,
        netScore: true,
        endsStory: true,
        createdAt: true,
      },
    });

    const topSubmission = rankedSubmissions[0] ?? null;

    // Overtime check (only on first pass, open status)
    if (round.status === "open" && !round.overtimeTriggered && topSubmission) {
      const lateWindowStart = addDuration(round.endsAt, -OVERTIME_LOOKBACK_MS);
      const challengerThreshold = 0.6 * topSubmission.netScore;

      const challenger = rankedSubmissions.find(
        (s) =>
          s.id !== topSubmission.id &&
          s.createdAt > lateWindowStart &&
          s.netScore >= challengerThreshold,
      );

      if (challenger) {
        const timeDiffMs = Math.abs(
          topSubmission.createdAt.getTime() - challenger.createdAt.getTime(),
        );

        await tx.round.update({
          where: { id: round.id },
          data: {
            status: "overtime",
            overtimeTriggered: true,
            overtimeChallengerId: challenger.id,
            originalEndsAt: round.endsAt,
            endsAt: addDuration(round.endsAt, timeDiffMs),
          },
        });

        return "overtime_triggered";
      }
    }

    const winner = rankedSubmissions[0] ?? null;

    if (winner) {
      // Create canonical segment
      await tx.segment.create({
        data: {
          storyId: round.storyId,
          roundNumber: round.roundNumber,
          content: winner.content,
          contributedBy: winner.userId,
        },
      });

      // Close round
      await tx.round.update({
        where: { id: round.id },
        data: { status: "closed", winningSubmissionId: winner.id },
      });

      // Update story word count
      await tx.story.update({
        where: { id: round.storyId },
        data: { wordCount: { increment: winner.wordCount } },
      });

      // Check if story should end
      const story = await tx.story.findUnique({
        where: { id: round.storyId },
        select: { maxSegments: true, _count: { select: { segments: true } } },
      });

      const segmentCount = story?._count.segments ?? 0;
      const storyEnds = winner.endsStory || (story && segmentCount >= story.maxSegments);

      if (storyEnds) {
        await tx.story.update({
          where: { id: round.storyId },
          data: { status: "completed" },
        });
        return "resolved_story_ended";
      }

      // Open next round
      await tx.round.create({
        data: {
          storyId: round.storyId,
          roundNumber: round.roundNumber + 1,
          startsAt: now,
          endsAt: addDuration(now, ROUND_DURATION_MS),
          status: "open",
        },
      });

      return "resolved_with_winner";
    }

    // No submissions — close round, open new one
    await tx.round.update({
      where: { id: round.id },
      data: { status: "closed", winningSubmissionId: null },
    });

    await tx.round.create({
      data: {
        storyId: round.storyId,
        roundNumber: round.roundNumber + 1,
        startsAt: now,
        endsAt: addDuration(now, ROUND_DURATION_MS),
        status: "open",
      },
    });

    return "resolved_without_winner";
  });
}

export async function resolveExpiredRounds(
  now = new Date(),
  options: ResolveExpiredRoundsOptions = {},
): Promise<RoundResolutionSummary> {
  const expiredRounds = await prisma.round.findMany({
    where: {
      ...(options.storyId ? { storyId: options.storyId } : {}),
      status: { in: ["open", "overtime"] },
      endsAt: { lte: now },
    },
    orderBy: { endsAt: "asc" },
    select: { id: true },
  });

  const summary: RoundResolutionSummary = {
    expiredRounds: expiredRounds.length,
    resolvedRounds: 0,
    overtimeTriggered: 0,
    skippedRounds: 0,
    storiesEnded: 0,
  };

  for (const round of expiredRounds) {
    const result = await resolveRound(round.id, now);
    if (result === "overtime_triggered") summary.overtimeTriggered += 1;
    if (result === "resolved_with_winner" || result === "resolved_without_winner")
      summary.resolvedRounds += 1;
    if (result === "resolved_story_ended") {
      summary.resolvedRounds += 1;
      summary.storiesEnded += 1;
    }
    if (result === "skipped") summary.skippedRounds += 1;
  }

  return summary;
}
