import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastData {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}

type ToastListener = (toasts: ToastData[]) => void;
let listeners: ToastListener[] = [];
let currentToasts: ToastData[] = [];

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 4000) {
  const id = Math.random().toString(36).substring(2, 9);
  currentToasts = [...currentToasts, { id, message, type, duration }];
  listeners.forEach((l) => l(currentToasts));
}

export function hideToast(id: string) {
  currentToasts = currentToasts.filter((t) => t.id !== id);
  listeners.forEach((l) => l(currentToasts));
}

const ToastItem: React.FC<{ toast: ToastData; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const { message, type = 'info', duration = 4000 } = toast;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const bgStyles = {
    success: 'bg-emerald-900/95 text-emerald-100 border-emerald-500/40',
    error: 'bg-rose-900/95 text-rose-100 border-rose-500/40',
    info: 'bg-slate-900/95 text-slate-100 border-slate-700/60',
  }[type];

  const Icon = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }[type];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md w-full transition-all animate-in fade-in slide-in-from-bottom-4 ${bgStyles}`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <p className="text-xs font-semibold flex-1 leading-tight">{message}</p>
      <button
        onClick={onDismiss}
        className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
        aria-label="Fermer la notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastData[]>(currentToasts);

  useEffect(() => {
    const listener = (newToasts: ToastData[]) => setToasts([...newToasts]);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none w-[90%] max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => hideToast(toast.id)} />
      ))}
    </div>
  );
};
