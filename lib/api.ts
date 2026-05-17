import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessModeration, isAdminRole } from "@/lib/roles";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAuthedUser(options?: { requireUsername?: boolean }) {
  const session = await auth();
  const userId = session?.user?.id;
  const username = session?.user?.username ?? null;
  const role = session?.user?.role ?? "user";

  if (!userId) {
    return { error: jsonError("Unauthorized", 401) } as const;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (dbUser?.role === "banned") {
    return { error: jsonError("Your account has been suspended.", 403) } as const;
  }

  if (options?.requireUsername && !username) {
    return { error: jsonError("Username required", 403) } as const;
  }

  return { userId, username, role: dbUser?.role ?? role } as const;
}

export async function requireAdminUser() {
  const authUser = await requireAuthedUser();
  if ("error" in authUser) return authUser;

  if (!isAdminRole(authUser.role)) {
    return { error: jsonError("Forbidden", 403) } as const;
  }

  return { ...authUser, role: "admin" as const };
}

export async function requireModeratorUser() {
  const authUser = await requireAuthedUser();
  if ("error" in authUser) return authUser;

  if (!canAccessModeration(authUser.role)) {
    return { error: jsonError("Forbidden", 403) } as const;
  }

  return authUser;
}
