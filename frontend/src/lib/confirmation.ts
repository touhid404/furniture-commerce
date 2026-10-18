export interface Confirmation {
  title: string;
  message: string;
  danger?: boolean;
}
export class ActionCancelled extends Error {
  constructor() {
    super('Action cancelled');
  }
}
let current: (Confirmation & { finish: (accepted: boolean) => void }) | null = null;
const listeners = new Set<() => void>();
let queue: Promise<unknown> = Promise.resolve();
export const subscribeConfirmation = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getConfirmation = () => current;
export function confirmAction(options: Confirmation): Promise<boolean> {
  const result = queue.then(
    () =>
      new Promise<boolean>((resolve) => {
        current = {
          ...options,
          finish: (accepted) => {
            current = null;
            for (const listener of listeners) listener();
            resolve(accepted);
          },
        };
        for (const listener of listeners) listener();
      }),
  );
  queue = result.catch(() => {});
  return result;
}
export function adminConfirmation(path: string, method: string): Confirmation {
  if (path === '/auth/logout')
    return {
      title: 'Sign out of store admin?',
      message: 'You will need to sign in again to manage the store.',
    };
  if (method === 'DELETE')
    return {
      title: 'Delete this record?',
      message:
        'This action removes the selected record. Records used by orders or products are protected.',
      danger: true,
    };
  if (path.includes('/refunds'))
    return {
      title: 'Record this refund?',
      message:
        'Confirm the amount and reference are correct and the cash refund has already been paid. This records a manual refund; it does not transfer money.',
      danger: true,
    };
  if (path.includes('/cancellations'))
    return {
      title: 'Cancel this order?',
      message: 'This releases its allocated stock and updates the order status.',
      danger: true,
    };
  if (path.includes('/cod-collections'))
    return {
      title: 'Record cash collected?',
      message: 'Confirm the full cash payment has been received for this order.',
    };
  if (path.includes('/inventory/'))
    return {
      title: 'Adjust inventory?',
      message:
        'Confirm the stock adjustment and reason are correct. The change is recorded in the inventory ledger.',
    };
  if (path.includes('/prices'))
    return {
      title: 'Update this price?',
      message:
        'The new price applies to future purchases in this price book. Existing orders keep their recorded price.',
    };
  if (path === '/admin/config')
    return {
      title: 'Save store settings?',
      message:
        'Validated store variables will take effect for new requests. Customers may need to review checkout again.',
    };
  if (path.includes('/publish'))
    return {
      title: 'Publish this content?',
      message: 'This revision will become visible on the storefront.',
    };
  return {
    title: method === 'POST' ? 'Confirm this action?' : 'Save these changes?',
    message: 'Please review the entered details. Confirm to update the store.',
  };
}
