import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getConfirmation, subscribeConfirmation } from '../lib/confirmation.js';
export function ActionConfirmation() {
  const action = useSyncExternalStore(subscribeConfirmation, getConfirmation),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!action || !dialog.current) return;
    const previous = document.activeElement;
    dialog.current.showModal();
    return () => {
      dialog.current?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [action]);
  return action ? (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-message"
      className="confirmation-dialog"
      onCancel={(event) => {
        event.preventDefault();
        action.finish(false);
      }}
    >
      <h2 id="confirmation-title">{action.title}</h2>
      <p id="confirmation-message">{action.message}</p>
      <div className="button-row">
        <button className="button outline" autoFocus onClick={() => action.finish(false)}>
          Cancel
        </button>
        <button
          className={`button${action.danger ? ' danger' : ''}`}
          onClick={() => action.finish(true)}
        >
          Confirm
        </button>
      </div>
    </dialog>
  ) : null;
}
