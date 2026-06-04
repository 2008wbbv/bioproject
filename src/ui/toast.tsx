/**
 * Lightweight toast notifications (replaces alert()). A provider holds a queue;
 * `useToast()` pushes messages that auto-dismiss. Polished feedback for imports,
 * copied links, exports, errors.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type ToastKind = "info" | "success" | "error";
export interface ToastAction {
  label: string;
  run: () => void;
}
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

interface Ctx {
  toast: (message: string, kind?: ToastKind, action?: ToastAction) => void;
}

const ToastContext = createContext<Ctx | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info", action?: ToastAction) => {
      const id = nextId++;
      setToasts((ts) => [...ts, { id, kind, message, action }]);
      setTimeout(() => remove(id), action ? 7000 : 4000);
    },
    [remove],
  );

  const value = useMemo<Ctx>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role="status">
            <span onClick={() => remove(t.id)}>{t.message}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action!.run();
                  remove(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
