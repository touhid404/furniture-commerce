import { z } from 'zod';
import { retryableTransaction } from './calculations.js';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '../db/client.js';
import type { Prisma } from '../generated/prisma/client.js';
export const id = z.string().uuid();
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message);
}
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
export type Tx = Prisma.TransactionClient;
export async function atomic<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: 'Serializable',
        timeout: 20000,
        maxWait: 15000,
      });
    } catch (e) {
      if (retryableTransaction(e) && i < 2) {
        await new Promise((resolve) => setTimeout(resolve, 30 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error('Transaction retry exhausted');
}
export const audit = (
  tx: Tx,
  actorId: string | undefined,
  action: string,
  target: string,
  details: unknown = {},
) =>
  tx.auditLog.create({
    data: { actorId, action, target, details: json(details) },
  });
export const event = (tx: Tx, orderId: string, type: string, message: string, actorId?: string) =>
  tx.orderEvent.create({ data: { orderId, type, message, actorId } });
export const email = (tx: Tx, to: string, subject: string, text: string) =>
  tx.outboxJob.create({
    data: { type: 'EMAIL', payload: { to, subject, text } },
  });
export async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId}::uuid FOR UPDATE`;
  return tx.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      shipment: true,
      returns: true,
      events: { orderBy: { createdAt: 'asc' } },
      refunds: true,
    },
  });
}
export async function moveStock(
  tx: Tx,
  variantId: string,
  onHand: number,
  allocated: number,
  reason: string,
  eventKey: string,
  actorId?: string,
) {
  const rows = await tx.$queryRaw<
    Array<{ id: string }>
  >`UPDATE "Inventory" SET "onHand"="onHand"+${onHand},"allocated"="allocated"+${allocated},version=version+1 WHERE "variantId"=${variantId}::uuid AND "onHand"+${onHand} >= "allocated"+${allocated} AND "allocated"+${allocated} >= 0 AND "onHand"+${onHand} >= 0 RETURNING id`;
  if (!rows[0]) fail(409, 'STOCK_CHANGED', 'Stock changed. Refresh your bag and try again.');
  await tx.inventoryMovement.create({
    data: {
      inventoryId: rows[0].id,
      deltaOnHand: onHand,
      deltaAllocated: allocated,
      reason,
      eventKey,
      actorId,
    },
  });
}
export const safeUrl = z
  .string()
  .max(2000)
  .refine((v) => !v || v.startsWith('/media/') || /^https:\/\//.test(v), 'Use an HTTPS image URL');
export const addressSchema = z
  .object({
    recipient: z.string().trim().min(2).max(100),
    line1: z.string().trim().min(4).max(200),
    line2: z.string().trim().max(200).default(''),
    city: z.string().trim().min(2).max(100),
    region: z.string().trim().max(100).default(''),
    postalCode: z.string().trim().max(20).default(''),
    country: z.string().regex(/^[A-Z]{2}$/),
    phone: z.string().trim().min(5).max(30),
  })
  .strict();
export { csvCell } from './calculations.js';
export const newKey = () => randomUUID();

export function canonical(value: unknown): string {
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
