ALTER TABLE "Product" ADD COLUMN "mediaAssetId" UUID;
ALTER TABLE "Product" ADD CONSTRAINT "Product_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
