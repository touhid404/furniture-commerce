import express, { Router } from 'express';
import { prisma } from '../db/client.js';
import { audit, atomic, fail, id } from '../services/core.js';
import { imageDownload } from '../services/storage.js';
import { pageInput, pageWindow, sendPage } from '../services/pagination.js';
import { createImageAsset } from '../services/images.js';
export const media = Router();
export const publicMedia = Router();
publicMedia.get('/:id', async (req, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: id.parse(req.params.id) } });
  if (!asset || !asset.objectKey) fail(404, 'NOT_FOUND', 'Image was not found.');
  const url = await imageDownload(
    asset.bucket,
    req.query.size === 'card' && asset.thumbnailKey ? asset.thumbnailKey : asset.objectKey,
  );
  res.set('Cache-Control', 'public, max-age=300').redirect(302, url);
});
media.get('/', async (req, res) => {
  const query = pageInput.parse(req.query),
    where = query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {};
  await sendPage(
    res,
    query,
    prisma.mediaAsset.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...pageWindow(query),
    }),
    prisma.mediaAsset.count({ where }),
  );
});
media.post(
  '/',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '2mb' }),
  async (req, res) => {
    const bytes: unknown = req.body;
    if (!Buffer.isBuffer(bytes) || !bytes.length)
      fail(422, 'IMAGE_INVALID', 'Choose a JPEG, PNG or WebP image.');
    const mime = req.get('content-type') ?? '';
    let name = 'Product image';
    try {
      name = decodeURIComponent(req.get('X-File-Name') ?? name).slice(0, 120);
    } catch {
      fail(422, 'IMAGE_INVALID', 'The file name is invalid.');
    }
    const asset = await createImageAsset(bytes, mime, name, req.shopSession!.userId!);
    res.status(201).json({ data: asset });
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
    if (asset.thumbnailKey)
      await tx.outboxJob.create({
        data: { type: 'DELETE_MEDIA', payload: { bucket: asset.bucket, key: asset.thumbnailKey } },
      });
    await audit(tx, req.shopSession!.userId!, 'MEDIA_DELETED', asset.id);
  });
  res.json({ data: { ok: true } });
});
