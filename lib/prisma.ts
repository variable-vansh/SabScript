import { Prisma, PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [{ emit: "event", level: "query" }, "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV === "development") {
  prisma.$on("query" as never, (event: Prisma.QueryEvent) => {
    if (event.duration > 100) {
      console.warn(
        `[prisma-slow-query] durationMs=${event.duration} query=${event.query} params=${event.params}`,
      );
    }
  });
}

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
