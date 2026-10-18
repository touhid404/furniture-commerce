import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import '../env.js';
import { ApiError } from './core.js';
let client: S3Client | undefined;
export const storageBucket = process.env.STORAGE_BUCKET ?? 'assets';
function storage() {
  if (
    !process.env.AWS_ENDPOINT_URL_S3 ||
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY ||
    !process.env.AWS_REGION
  )
    throw new ApiError(503, 'STORAGE_UNCONFIGURED', 'Image storage is not configured.');
  client ??= new S3Client({
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return client;
}
export async function uploadObject(key: string, bytes: Buffer, mimeType: string) {
  try {
    await storage().send(
      new PutObjectCommand({
        Bucket: storageBucket,
        Key: key,
        Body: bytes,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      503,
      'STORAGE_UNAVAILABLE',
      'The image could not be stored. Please try again.',
    );
  }
}
export async function imageDownload(bucket: string, key: string) {
  return getSignedUrl(storage(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 3600,
  });
}
export async function deleteObject(bucket: string, key: string) {
  await storage().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
export async function checkStorage() {
  await storage().send(new HeadBucketCommand({ Bucket: storageBucket }));
  return { status: 'connected', bucket: storageBucket };
}
