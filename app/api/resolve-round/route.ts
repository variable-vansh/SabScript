import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { resolveExpiredRounds } from "@/lib/round-resolution";

function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return provided === secret;
}

export async function POST(request: Request) {
  const lazyAllowed =
    request.headers.get("x-lazy-resolve") === "1" ||
    new URL(request.url).searchParams.get("lazy") === "1";

  if (!isAuthorizedCronRequest(request) && !lazyAllowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const expiringRoundStoryIds = await prisma.round.findMany({
    where: {
      status: { in: ["open", "overtime"] },
      endsAt: { lte: now },
    },
    select: { storyId: true },
  });

  const roundSummary = await resolveExpiredRounds(now);

  revalidatePath("/");

  const storyIds = [...new Set(expiringRoundStoryIds.map((row) => row.storyId))];
  for (const storyId of storyIds) {
    revalidatePath(`/stories/${storyId}`);
    revalidatePath(`/stories/${storyId}/community`);
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    rounds: roundSummary,
  });
}
