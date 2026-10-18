import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/client.js';
import { audit, atomic, fail, id } from '../services/core.js';
import { deleteObject, imageDownload, storageBucket, uploadObject } from '../services/storage.js';
export const media = Router();
export const publicMedia = Router();
publicMedia.get('/:id', async (req, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: id.parse(req.params.id) } });
  if (!asset || !asset.objectKey) fail(404, 'NOT_FOUND', 'Image was not found.');
  const url = await imageDownload(asset.bucket, asset.objectKey);
  res.set('Cache-Control', 'public, max-age=300').redirect(302, url);
});
media.get('/', async (_req, res) =>
  res.json({
    data: await prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
  }),
);
media.post(
  '/',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '2mb' }),
  async (req, res) => {
    const bytes: unknown = req.body;
    if (!Buffer.isBuffer(bytes) || !bytes.length)
      fail(422, 'IMAGE_INVALID', 'Choose a JPEG, PNG or WebP image.');
    const mime = req.get('content-type');
    const ext =
      mime === 'image/png' &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? 'png'
        : mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          ? 'jpg'
          : mime === 'image/webp' &&
              bytes.toString('ascii', 0, 4) === 'RIFF' &&
              bytes.toString('ascii', 8, 12) === 'WEBP'
            ? 'webp'
            : null;
    if (!ext)
      fail(
        422,
        'IMAGE_INVALID',
        'The image contents do not match its type. SVG and executable uploads are not accepted.',
      );
    let name = 'Product image';
    try {
      name = decodeURIComponent(req.get('X-File-Name') ?? name).slice(0, 120);
    } catch {
      fail(422, 'IMAGE_INVALID', 'The file name is invalid.');
    }
    const assetId = randomUUID(),
      objectKey = `uploads/${assetId}.${ext}`,
      url = `/media/${assetId}`;
    await uploadObject(objectKey, bytes, mime!);
    try {
      const asset = await atomic(async (tx) => {
        const m = await tx.mediaAsset.create({
          data: {
            id: assetId,
            name,
            url,
            objectKey,
            bucket: storageBucket,
            size: bytes.length,
            mimeType: mime!,
            actorId: req.shopSession!.userId,
          },
        });
        await audit(tx, req.shopSession!.userId!, 'MEDIA_UPLOADED', m.id, { url, objectKey });
        return m;
      });
      res.status(201).json({ data: asset });
    } catch (e) {
      await deleteObject(storageBucket, objectKey).catch(() => {});
      throw e;
    }
  },
);
media.delete('/:id', async (req, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: id.parse(req.params.id) } });
  if (!asset) fail(404, 'NOT_FOUND', 'Image was not found.');
  if (await prisma.product.count({ where: { imageUrl: asset.url } }))
    fail(409, 'MEDIA_IN_USE', 'Remove this image from its products before deleting it.');
  await atomic(async (tx) => {
    await tx.mediaAsset.delete({ where: { id: asset.id } });
    await tx.outboxJob.create({
      data: { type: 'DELETE_MEDIA', payload: { bucket: asset.bucket, key: asset.objectKey } },
    });
    await audit(tx, req.shopSession!.userId!, 'MEDIA_DELETED', asset.id);
  });
  res.json({ data: { ok: true } });
});
