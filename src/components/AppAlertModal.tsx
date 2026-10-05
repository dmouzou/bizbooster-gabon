import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, HelpCircle, X } from 'lucide-react';

export type AlertType = 'success' | 'error' | 'info' | 'confirm';

export interface AlertModalConfig {
  isOpen: boolean;
  type?: AlertType;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

interface AppAlertModalProps {
  config: AlertModalConfig | null;
  onClose: () => void;
}

export const AppAlertModal: React.FC<AppAlertModalProps> = ({ config, onClose }) => {
  if (!config || !config.isOpen) return null;
  if (typeof document === 'undefined') return null;

  const type = config.type || 'info';
  const isConfirm = type === 'confirm';

  const handleConfirm = () => {
    if (config.onConfirm) {
      config.onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    if (config.onCancel) {
      config.onCancel();
    }
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-7 h-7" />
          </div>
        );
      case 'error':
        return (
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
            <AlertTriangle className="w-7 h-7" />
          </div>
        );
      case 'confirm':
        return (
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-xs">
            <HelpCircle className="w-7 h-7" />
          </div>
        );
      case 'info':
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
            <Info className="w-7 h-7" />
          </div>
        );
    }
  };

  const defaultTitle =
    type === 'success'
      ? 'Opération réussie'
      : type === 'error'
      ? 'Attention / Erreur'
      : type === 'confirm'
      ? 'Confirmation requise'
      : 'Information BIZBOOSTER';

  return createPortal(
    <div
      className="fixed inset-0 z-[150] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Brand Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
              BIZBOOSTER Gabon
            </span>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0">{getIcon()}</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-black text-slate-900 mb-1.5 leading-snug">
                {config.title || defaultTitle}
              </h3>
              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                {config.message}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            {isConfirm ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {config.cancelLabel || 'Annuler'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black transition-all shadow-md cursor-pointer"
                >
                  {config.confirmLabel || 'Confirmer'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-black transition-all shadow-md cursor-pointer text-center"
              >
                {config.confirmLabel || 'OK'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
