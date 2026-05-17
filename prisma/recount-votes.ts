import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type VoteCount = {
  upvotes: number;
  downvotes: number;
  netScore: number;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildCounts(
  rows: Array<{ key: string; value: number; count: number }>,
): Map<string, VoteCount> {
  const counts = new Map<string, VoteCount>();

  for (const row of rows) {
    const current = counts.get(row.key) ?? { upvotes: 0, downvotes: 0, netScore: 0 };
    if (row.value === 1) current.upvotes = row.count;
    if (row.value === -1) current.downvotes = row.count;
    current.netScore = current.upvotes - current.downvotes;
    counts.set(row.key, current);
  }

  return counts;
}

async function recountSubmissions() {
  const [submissions, grouped] = await Promise.all([
    prisma.submission.findMany({ select: { id: true } }),
    prisma.vote.groupBy({
      by: ["submissionId", "value"],
      _count: { _all: true },
    }),
  ]);

  const counts = buildCounts(
    grouped.map((row) => ({
      key: row.submissionId,
      value: row.value,
      count: row._count._all,
    })),
  );

  for (const group of chunk(submissions, 100)) {
    await prisma.$transaction(
      group.map((submission) => {
        const tally = counts.get(submission.id) ?? {
          upvotes: 0,
          downvotes: 0,
          netScore: 0,
        };

        return prisma.submission.update({
          where: { id: submission.id },
          data: tally,
        });
      }),
    );
  }
}

async function recountPremises() {
  const [premises, grouped] = await Promise.all([
    prisma.premise.findMany({ select: { id: true } }),
    prisma.premiseVote.groupBy({
      by: ["premiseId", "value"],
      _count: { _all: true },
    }),
  ]);

  const counts = buildCounts(
    grouped.map((row) => ({
      key: row.premiseId,
      value: row.value,
      count: row._count._all,
    })),
  );

  for (const group of chunk(premises, 100)) {
    await prisma.$transaction(
      group.map((premise) => {
        const tally = counts.get(premise.id) ?? {
          upvotes: 0,
          downvotes: 0,
          netScore: 0,
        };

        return prisma.premise.update({
          where: { id: premise.id },
          data: tally,
        });
      }),
    );
  }
}

async function recountComments() {
  const [comments, grouped] = await Promise.all([
    prisma.comment.findMany({ select: { id: true } }),
    prisma.commentVote.groupBy({
      by: ["commentId", "value"],
      _count: { _all: true },
    }),
  ]);

  const counts = buildCounts(
    grouped.map((row) => ({
      key: row.commentId,
      value: row.value,
      count: row._count._all,
    })),
  );

  for (const group of chunk(comments, 100)) {
    await prisma.$transaction(
      group.map((comment) => {
        const tally = counts.get(comment.id) ?? {
          upvotes: 0,
          downvotes: 0,
          netScore: 0,
        };

        return prisma.comment.update({
          where: { id: comment.id },
          data: tally,
        });
      }),
    );
  }
}

async function main() {
  await recountSubmissions();
  await recountPremises();
  await recountComments();
  console.log("Vote recount complete for submissions, premises, and comments.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
