import { useEffect, useState } from 'react';
import { useStore } from '../app/Store.js';
import { useAction } from '../lib/hooks.js';
import { previewPromotion, usePromotion } from '../lib/promotions.js';
import { Notice } from './UI.js';
export function PromoCodeForm() {
  const { cart, updateCart } = useStore(),
    action = useAction(),
    [code, setCode] = useState(cart.couponCode ?? '');
  const preview = usePromotion(cart);
  useEffect(() => setCode(cart.couponCode ?? ''), [cart.couponCode]);
  return (
    <div className="promotion-control">
      <form
        className="coupon-form"
        onSubmit={(event) => {
          event.preventDefault();
          action.run(async () => {
            const result = await previewPromotion(cart, code, true);
            updateCart(
              {
                ...cart,
                couponCode: result.code,
                items: cart.items.map((item) => ({
                  ...item,
                  unitPriceMinor: result.items.find((i) => i.variantId === item.variantId)!
                    .unitPriceMinor,
                })),
              },
              cart.version,
            );
          });
        }}
      >
        <label className="sr-only" htmlFor="promotion-code">
          Promotion code
        </label>
        <input
          id="promotion-code"
          name="code"
          placeholder="Promotion code"
          value={code}
          maxLength={30}
          required
          onChange={(event) => setCode(event.target.value)}
        />
        <button className="button outline" disabled={action.busy}>
          {action.busy ? 'Checking…' : 'Apply'}
        </button>
      </form>
      {cart.couponCode && (
        <div className="promotion-applied">
          <span>
            {cart.couponCode}
            {preview.data ? ` · ${preview.data.percent}% off` : ''}
          </span>
          <button className="text-link" onClick={() => updateCart({ ...cart, couponCode: null })}>
            Remove {cart.couponCode}
          </button>
        </div>
      )}
      <Notice>{action.error || preview.error}</Notice>
      {preview.checking && (
        <p className="muted" role="status">
          Checking promotion…
        </p>
      )}
    </div>
  );
}
export function BagTotals() {
  const { cart, money } = useStore(),
    preview = usePromotion(cart),
    discount = preview.data && BigInt(preview.data.discountMinor) > 0n ? preview.data : null;
  return (
    <div className="bag-totals" aria-live="polite">
      <div className="split">
        <span>Subtotal</span>
        <strong>
          {discount ? <del>{money(discount.subtotalMinor)}</del> : money(cart.subtotalMinor)}
        </strong>
      </div>
      {discount && (
        <>
          <div className="split promotion-savings">
            <span>Savings · {discount.code}</span>
            <strong>−{money(discount.discountMinor)}</strong>
          </div>
          <div className="split total">
            <strong>Subtotal after discount</strong>
            <strong>{money(discount.totalMinor)}</strong>
          </div>
        </>
      )}
    </div>
  );
}
