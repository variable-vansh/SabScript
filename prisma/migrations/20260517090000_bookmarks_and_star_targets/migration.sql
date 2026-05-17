-- Create bookmarks table if it doesn't already exist.
CREATE TABLE IF NOT EXISTS "Bookmark" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Bookmark_pkey'
  ) THEN
    ALTER TABLE "Bookmark"
    ADD CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id");
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_userId_storyId_key"
ON "Bookmark"("userId", "storyId");

CREATE INDEX IF NOT EXISTS "Bookmark_userId_createdAt_idx"
ON "Bookmark"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Bookmark_userId_fkey'
  ) THEN
    ALTER TABLE "Bookmark"
    ADD CONSTRAINT "Bookmark_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Bookmark_storyId_fkey'
  ) THEN
    ALTER TABLE "Bookmark"
    ADD CONSTRAINT "Bookmark_storyId_fkey"
    FOREIGN KEY ("storyId") REFERENCES "Story"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Evolve old Story stars into polymorphic stars.
ALTER TABLE "Star" ADD COLUMN IF NOT EXISTS "targetType" TEXT;
ALTER TABLE "Star" ADD COLUMN IF NOT EXISTS "targetId" TEXT;

UPDATE "Star"
SET
  "targetType" = COALESCE("targetType", 'story'),
  "targetId" = COALESCE("targetId", "storyId")
WHERE "targetType" IS NULL OR "targetId" IS NULL;

ALTER TABLE "Star" ALTER COLUMN "targetType" SET NOT NULL;
ALTER TABLE "Star" ALTER COLUMN "targetId" SET NOT NULL;

DROP INDEX IF EXISTS "Star_userId_storyId_key";
DROP INDEX IF EXISTS "Star_storyId_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "Star_userId_targetType_targetId_key"
ON "Star"("userId", "targetType", "targetId");

CREATE INDEX IF NOT EXISTS "Star_userId_targetType_createdAt_idx"
ON "Star"("userId", "targetType", "createdAt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Star' AND column_name = 'storyId'
  ) THEN
    ALTER TABLE "Star" DROP CONSTRAINT IF EXISTS "Star_storyId_fkey";
    ALTER TABLE "Star" DROP COLUMN "storyId";
  END IF;
END
$$;
