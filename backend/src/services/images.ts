import { processImage } from './image-processing.js';
import { randomUUID } from 'node:crypto';
import { atomic, audit, fail } from './core.js';
import { uploadObject, deleteObject, storageBucket } from './storage.js';

export async function prepareImage(bytes: Buffer, mime: string) {
  try {
    return await processImage(bytes, mime);
  } catch (error) {
    fail(422, 'IMAGE_INVALID', error instanceof Error ? error.message : 'Invalid image.');
  }
}

export async function createImageAsset(
  bytes: Buffer,
  mime: string,
  name: string,
  actorId?: string,
) {
  const { card, extension } = await prepareImage(bytes, mime);
  const assetId = randomUUID(),
    objectKey = `uploads/${assetId}.${extension}`,
    thumbnailKey = `uploads/${assetId}.card.webp`,
    url = `/media/${assetId}`;
  try {
    await uploadObject(objectKey, bytes, mime);
    await uploadObject(thumbnailKey, card, 'image/webp');
    return await atomic(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          id: assetId,
          name,
          url,
          objectKey,
          thumbnailKey,
          bucket: storageBucket,
          size: bytes.length,
          mimeType: mime,
          actorId,
        },
      });
      if (actorId) await audit(tx, actorId, 'MEDIA_UPLOADED', asset.id, { url, objectKey });
      return asset;
    });
  } catch (error) {
    await Promise.allSettled([
      deleteObject(storageBucket, objectKey),
      deleteObject(storageBucket, thumbnailKey),
    ]);
    throw error;
  }
}
