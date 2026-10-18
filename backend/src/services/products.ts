import { z } from 'zod';
import { id, safeUrl } from './core.js';
export const productInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(120),
    categoryId: id,
    description: z.string().min(10).max(5000),
    materials: z.string().max(2000).default(''),
    dimensions: z.string().max(500).default(''),
    care: z.string().max(1000).default(''),
    art: z.enum(['chair', 'lamp', 'pendant', 'table', 'sofa', 'vase', 'textile']).default('chair'),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    background: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    badge: z.string().max(30).default(''),
    imageUrl: safeUrl.default(''),
    featuredRank: z.number().int().min(0).max(1000).default(0),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
    sku: z.string().trim().min(2).max(60),
    label: z.string().max(100).default('Standard'),
    priceMinor: z.coerce.bigint().min(0n).max(1000000000000n),
    onHand: z.number().int().min(0).max(100000),
    version: z.number().int().optional(),
  })
  .strict();
