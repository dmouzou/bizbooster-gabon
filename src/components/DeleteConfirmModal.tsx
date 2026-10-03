import React from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  adTitle?: string;
  confirmText?: string;
  cancelText?: string;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Supprimer cette annonce ?',
  message = 'Êtes-vous sûr de vouloir supprimer cette annonce ? Cette action est irréversible et retirera définitivement votre annonce du catalogue BIZBOOSTER.',
  adTitle,
  confirmText = 'Supprimer définitivement',
  cancelText = 'Annuler',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col relative my-auto animate-in zoom-in-95 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-sm border border-red-200 inline-block mb-1.5">
            BIZBOOSTER Gabon
          </span>
          <h3 className="text-lg font-black text-slate-900 leading-snug">{title}</h3>
          {adTitle && (
            <p className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2.5 my-2 truncate">
              « {adTitle} »
            </p>
          )}
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{message}</p>
        </div>

        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onConfirm();
            }}
            className="flex-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-black py-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
