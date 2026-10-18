export function calculateTotals(
  subtotal: bigint,
  discountPercent: number,
  shipping: bigint,
  taxRate: number,
  inclusive: boolean,
) {
  const discount = (subtotal * BigInt(discountPercent)) / 100n;
  const net = subtotal - discount;
  const tax = inclusive
    ? (net * BigInt(taxRate) + BigInt(10000 + taxRate) / 2n) /
      BigInt(10000 + taxRate)
    : (net * BigInt(taxRate) + 5000n) / 10000n;
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
  String(v ?? "")
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""') +
  '"';

// Guest carts belong only to their creating session; null user IDs never grant ownership.
export function ownsCart(
  cart: { userId: string | null; sessionId: string | null },
  session: { userId: string | null; id: string },
): boolean {
  return session.userId !== null
    ? cart.userId === session.userId
    : cart.sessionId === session.id;
}
