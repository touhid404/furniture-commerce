ALTER TABLE "User" ADD COLUMN "username" TEXT, ADD COLUMN "requiresPasswordChange" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
ALTER TABLE "MediaAsset" ADD COLUMN "thumbnailKey" TEXT NOT NULL DEFAULT '';
