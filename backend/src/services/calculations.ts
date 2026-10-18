export function calculateTotals(
  subtotal: bigint,
  discountPercent: number,
  shipping: bigint,
  taxRate: number,
  inclusive: boolean,
  shippingTaxable = false,
) {
  const discount = (subtotal * BigInt(discountPercent)) / 100n;
  const net = subtotal - discount;
  const taxable = net + (shippingTaxable ? shipping : 0n);
  const tax = inclusive
    ? (taxable * BigInt(taxRate) + BigInt(10000 + taxRate) / 2n) / BigInt(10000 + taxRate)
    : (taxable * BigInt(taxRate) + 5000n) / 10000n;
  return {
    subtotalMinor: subtotal,
    discountMinor: discount,
    shippingMinor: shipping,
    taxMinor: tax,
    totalMinor: net + shipping + (inclusive ? 0n : tax),
  };
}
export const csvCell = (v: unknown) =>
  '"' +
  String(v ?? '')
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""') +
  '"';

// Guest carts belong only to their creating session; null user IDs never grant ownership.
export function ownsCart(
  cart: { userId: string | null; sessionId: string | null },
  session: { userId: string | null; id: string },
): boolean {
  return session.userId !== null ? cart.userId === session.userId : cart.sessionId === session.id;
}

export function retryableTransaction(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  if (error.code === 'P2034' || error.code === 'P2002') return true;
  if (error.code !== 'P2010') return false;
  const conflict = (value: unknown, depth = 0): boolean => {
    if (!value || typeof value !== 'object' || depth > 5) return false;
    return Object.entries(value).some(
      ([key, item]) =>
        (['code', 'originalCode'].includes(key) && (item === '40001' || item === '40P01')) ||
        conflict(item, depth + 1),
    );
  };
  return 'meta' in error && conflict(error.meta);
}
