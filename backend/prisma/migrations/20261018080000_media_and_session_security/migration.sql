ALTER TABLE "Session" ADD COLUMN "mfaVerified" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "MediaAsset" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "actorId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaAsset_size_check" CHECK ("size" > 0 AND "size" <= 2097152)
);
CREATE UNIQUE INDEX "MediaAsset_url_key" ON "MediaAsset"("url");
