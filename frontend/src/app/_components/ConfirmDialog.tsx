'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';

/**
 * Animated replacement for `window.confirm`, which cannot be styled and stalls
 * the whole tab. Rendered inline rather than in a portal — nothing in this app
 * clips it, and it keeps the component free of mount-time DOM work.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus lands on the non-destructive action.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    cancelRef.current?.focus();

    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onCancel}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            initial={{ scale: 0.94, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="relative w-full max-w-md rounded-2xl border border-ash-600 bg-ash-900 p-6 shadow-lift"
          >
            <div className="flex items-start gap-3">
              {/* The one place a hue survives: a destructive action should not
                  look like every other button on the page. */}
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2
                  id="confirm-title"
                  className="text-lg font-semibold text-ash-50"
                >
                  {title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ash-100">
                  {body}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-ash-500 bg-ash-700 px-4 py-2 text-sm font-semibold text-ash-50 transition hover:bg-ash-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-lg bg-ash-50 px-4 py-2 text-sm font-semibold text-ash-950 transition hover:bg-white"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
