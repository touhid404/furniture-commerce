import sharp from 'sharp';
export async function processImage(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > 2 * 1024 * 1024)
    throw Error('Choose an image smaller than 2 MB.');
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
    const meta = await image.metadata();
    const expected = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
    if (
      !expected ||
      meta.format !== expected ||
      (meta.pages ?? 1) > 1 ||
      !meta.width ||
      !meta.height
    )
      throw Error('Choose a single JPEG, PNG or WebP image.');
    const card = await image
      .rotate()
      .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    return { card, extension: meta.format === 'jpeg' ? 'jpg' : meta.format };
  } catch {
    throw Error('The image is invalid or exceeds the supported dimensions.');
  }
}
