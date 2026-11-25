'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useUiStore } from '@/domains/ui/store/useUiStore';

export function UiOverlays() {
  const { toasts, dismissToast, confirmDialog, closeConfirm } = useUiStore();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!confirmDialog) return;
    setIsConfirming(true);
    try {
      await confirmDialog.onConfirm();
    } finally {
      setIsConfirming(false);
      closeConfirm();
    }
  };

  return (
    <>
      {/* TOASTS DISCRETOS NO CANTO INFERIOR DIREITO */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto flex items-center gap-3 rounded-xl border border-zinc-800 bg-[#161920]/95 px-4 py-2.5 text-xs text-zinc-100 shadow-2xl backdrop-blur-xl"
            >
              {toast.variant === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : toast.variant === 'danger' ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              ) : (
                <Info className="h-4 w-4 shrink-0 text-indigo-400" />
              )}

              <span className="font-medium">{toast.message}</span>

              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismissToast(toast.id);
                  }}
                  className="rounded-lg bg-indigo-600/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 transition hover:bg-indigo-600 hover:text-white"
                >
                  {toast.action.label}
                </button>
              )}

              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded p-0.5 text-zinc-500 hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* MODAL DE CONFIRMAÇÃO PREMIUM (Substitui confirm() nativo) */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeConfirm}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#161920] p-6 shadow-2xl"
            >
              <div className="mb-2 flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    confirmDialog.variant === 'danger'
                      ? 'bg-rose-500/15 text-rose-400'
                      : 'bg-indigo-500/15 text-indigo-400'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-100">{confirmDialog.title}</h3>
              </div>

              <p className="mb-6 text-xs leading-relaxed text-zinc-400">
                {confirmDialog.description}
              </p>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={handleConfirm}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-50 ${
                    confirmDialog.variant === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  {isConfirming ? 'Aplicando...' : confirmDialog.confirmLabel ?? 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}