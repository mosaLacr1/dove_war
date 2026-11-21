import { useEffect } from 'react';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'warn' | 'error';
}

interface ToastsProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 2600);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <button type="button" className={`toast toast-${toast.kind}`} onClick={() => onDismiss(toast.id)}>
      {toast.text}
    </button>
  );
}
