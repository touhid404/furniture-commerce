import { useEffect, useState } from 'react';
import { send } from './api.js';
import type { Cart } from './types.js';
export interface Promotion {
  code: string;
  percent: number;
  currency: string;
  subtotalMinor: string;
  discountMinor: string;
  totalMinor: string;
  expiresAt: string | null;
  items: { variantId: string; quantity: number; unitPriceMinor: string }[];
}
const cached = new Map<string, { data: Promotion; expires: number }>();
const pending = new Map<string, Promise<Promotion>>();
const signature = (cart: Cart, code = cart.couponCode ?? '') =>
  JSON.stringify({
    code: code.trim().toUpperCase(),
    marketId: cart.marketId,
    items: cart.items
      .map((i) => ({ variantId: i.variantId, quantity: i.quantity }))
      .sort((a, b) => a.variantId.localeCompare(b.variantId)),
  });
export function previewPromotion(cart: Cart, code: string, fresh = false) {
  const key = signature(cart, code),
    saved = cached.get(key);
  if (!fresh && saved && saved.expires > Date.now()) return Promise.resolve(saved.data);
  if (pending.has(key)) return pending.get(key)!;
  const promise = send<Promotion>('/promotions/preview', JSON.parse(key))
    .then((data) => {
      if (cached.size >= 20) cached.delete(cached.keys().next().value!);
      cached.set(key, {
        data,
        expires: Math.min(
          Date.now() + 15000,
          data.expiresAt ? new Date(data.expiresAt).getTime() : Infinity,
        ),
      });
      return data;
    })
    .finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
export function usePromotion(cart: Cart) {
  const key = signature(cart),
    [result, setResult] = useState<{ key: string; data?: Promotion; error?: string }>({ key: '' });
  useEffect(() => {
    let active = true;
    if (!cart.couponCode || !cart.items.length) return;
    const timer = setTimeout(() => {
      previewPromotion(cart, cart.couponCode!)
        .then((data) => {
          if (active) setResult({ key, data });
        })
        .catch((error) => {
          if (active) setResult({ key, error: error.message });
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);
  return {
    data: result.key === key ? result.data : undefined,
    error: result.key === key ? result.error : undefined,
    checking: !!cart.couponCode && !!cart.items.length && result.key !== key,
  };
}
