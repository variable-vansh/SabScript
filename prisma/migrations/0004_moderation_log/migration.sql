CREATE TABLE "ModerationLog" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModerationLog_adminUserId_createdAt_idx"
ON "ModerationLog"("adminUserId", "createdAt");

CREATE INDEX "ModerationLog_targetType_targetId_createdAt_idx"
ON "ModerationLog"("targetType", "targetId", "createdAt");

CREATE INDEX "ModerationLog_createdAt_idx"
ON "ModerationLog"("createdAt");

ALTER TABLE "ModerationLog"
ADD CONSTRAINT "ModerationLog_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
