import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidUsername, normalizeUsername } from "@/lib/utils";

type UsernameBody = {
  username?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as UsernameBody;
  const rawUsername = body.username?.trim();

  if (!rawUsername || !isValidUsername(rawUsername)) {
    return NextResponse.json(
      {
        error:
          "Username must be 3-30 characters and use only letters, numbers, and underscores.",
      },
      { status: 400 },
    );
  }

  const normalizedUsername = normalizeUsername(rawUsername);

  const existingUser = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    select: { id: true },
  });

  if (existingUser && existingUser.id !== userId) {
    return NextResponse.json(
      { error: "That username is already taken." },
      { status: 409 },
    );
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { username: normalizedUsername },
  });

  revalidatePath("/");
  if (currentUser?.username && currentUser.username !== normalizedUsername) {
    revalidatePath(`/profile/${currentUser.username}`);
  }
  revalidatePath(`/profile/${normalizedUsername}`);

  return NextResponse.json({ username: normalizedUsername }, { status: 200 });
}
