import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ModerationDashboard from "@/components/moderation/ModerationDashboard";
import { canAccessModeration } from "@/lib/roles";

export default async function ModerationPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !canAccessModeration(user.role)) {
    return (
      <p className="text-sm text-gray-500">
        You do not have permission to view this page.
      </p>
    );
  }

  return <ModerationDashboard />;
}
