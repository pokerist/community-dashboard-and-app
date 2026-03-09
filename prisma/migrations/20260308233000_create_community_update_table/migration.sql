-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."CommunityUpdate" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "imageFileId" TEXT,
  "authorId" TEXT NOT NULL,
  "authorName" TEXT,
  "authorPhotoUrl" TEXT,
  "communityId" TEXT,
  "publishDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunityUpdate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommunityUpdate_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "public"."User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommunityUpdate_communityId_fkey"
    FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS "CommunityUpdate_communityId_idx"
  ON "public"."CommunityUpdate"("communityId");

CREATE INDEX IF NOT EXISTS "CommunityUpdate_publishDate_idx"
  ON "public"."CommunityUpdate"("publishDate");

CREATE INDEX IF NOT EXISTS "CommunityUpdate_isPublished_publishDate_idx"
  ON "public"."CommunityUpdate"("isPublished", "publishDate");
