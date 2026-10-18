import { z } from 'zod';
import type { Response } from 'express';
export const pageInput = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  q: z.string().trim().max(100).default(''),
});
export type PageInput = z.infer<typeof pageInput>;
export const pageWindow = (query: PageInput) => ({
  skip: (query.page - 1) * query.limit,
  take: query.limit,
});
export async function sendPage<T>(
  res: Response,
  query: PageInput,
  rows: Promise<T[]>,
  count: Promise<number>,
) {
  const [data, total] = await Promise.all([rows, count]);
  const pages = Math.ceil(total / query.limit);
  res.json({
    data,
    meta: {
      total,
      totalItems: total,
      page: query.page,
      currentPage: query.page,
      limit: query.limit,
      pages,
      totalPages: pages,
      hasNextPage: query.page < pages,
    },
  });
}
