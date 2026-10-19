import type { Cart, CartItem, Product, Variant } from './types.js';
export const CART_KEY = 'elnavo.cart.v1';
export const LEGACY_CART_KEY = 'kvist.cart.v1';
export const emptyCart = (marketId: string, currency: string): Cart => ({
  id: 'local',
  version: 1,
  marketId,
  currency,
  items: [],
  subtotalMinor: '0',
  couponCode: null,
});
export function totalCart(cart: Cart): Cart {
  return {
    ...cart,
    version: cart.version + 1,
    subtotalMinor: cart.items
      .reduce((sum, i) => sum + BigInt(i.unitPriceMinor) * BigInt(i.quantity), 0n)
      .toString(),
  };
}
export function parseCart(raw: string | null, fallback: Cart): Cart {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (
      !value ||
      value.marketId !== fallback.marketId ||
      value.currency !== fallback.currency ||
      !Array.isArray(value.items) ||
      value.items.length > 200
    )
      return fallback;
    const seen = new Set<string>();
    const items = value.items
      .filter((item: CartItem) => {
        if (
          !item ||
          typeof item.variantId !== 'string' ||
          !/^[a-f0-9-]{36}$/i.test(item.variantId) ||
          seen.has(item.variantId) ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 100 ||
          !/^\d{1,13}$/.test(item.unitPriceMinor)
        )
          return false;
        if (
          !['name', 'slug', 'art', 'color', 'background', 'imageUrl', 'label'].every(
            (key) =>
              typeof item[key as keyof CartItem] === 'string' &&
              String(item[key as keyof CartItem]).length <= 500,
          )
        )
          return false;
        // Image URLs are rendered by the browser, but untrusted script/data URLs are never retained.
        if (
          item.imageUrl &&
          !item.imageUrl.startsWith('/media/') &&
          !item.imageUrl.startsWith('https://')
        )
          return false;
        seen.add(item.variantId);
        return true;
      })
      .map((item: CartItem) => ({ ...item, id: item.variantId }));
    return totalCart({
      ...fallback,
      items,
      couponCode: typeof value.couponCode === 'string' ? value.couponCode.slice(0, 30) : null,
    });
  } catch {
    return fallback;
  }
}
export function addItem(
  cart: Cart,
  product: Product,
  variant: Variant,
  quantity: number,
  max: number,
): Cart {
  if (!Number.isInteger(quantity) || quantity < 1 || !variant.available)
    throw Error('Choose an available quantity.');
  const previous = cart.items.find((i) => i.variantId === variant.id),
    nextQuantity = (previous?.quantity ?? 0) + quantity;
  if (nextQuantity > Math.min(max, variant.available)) throw Error('That quantity is unavailable.');
  const item: CartItem = {
    id: variant.id,
    variantId: variant.id,
    quantity: nextQuantity,
    name: product.name,
    slug: product.slug,
    art: product.art,
    color: product.color,
    background: product.background,
    imageUrl: product.imageUrl,
    label: variant.label,
    available: variant.available,
    unitPriceMinor: variant.priceMinor,
    purchasable: true,
  };
  return totalCart({
    ...cart,
    items: previous
      ? cart.items.map((i) => (i.variantId === variant.id ? item : i))
      : [...cart.items, item],
  });
}
export function changeQuantity(cart: Cart, itemId: string, quantity: number, max: number): Cart {
  const item = cart.items.find((i) => i.id === itemId);
  if (
    !item ||
    !Number.isInteger(quantity) ||
    quantity < 0 ||
    quantity > Math.min(max, item.available)
  )
    throw Error('Choose an available quantity.');
  return totalCart({
    ...cart,
    items: quantity
      ? cart.items.map((i) => (i.id === itemId ? { ...i, quantity } : i))
      : cart.items.filter((i) => i.id !== itemId),
  });
}
export function subtractPurchased(
  cart: Cart,
  purchased: { variantId: string; quantity: number }[],
): Cart {
  return totalCart({
    ...cart,
    couponCode: null,
    items: cart.items
      .map((i) => ({
        ...i,
        quantity: Math.max(
          0,
          i.quantity - (purchased.find((p) => p.variantId === i.variantId)?.quantity ?? 0),
        ),
      }))
      .filter((i) => i.quantity > 0),
  });
}
