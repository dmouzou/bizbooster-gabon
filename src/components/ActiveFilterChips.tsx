import React from 'react';
import { X, RotateCcw } from 'lucide-react';

export interface ActiveFilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

export interface ActiveFilterChipsProps {
  chips: ActiveFilterChip[];
  onResetAll?: () => void;
  className?: string;
}

export const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  chips,
  onResetAll,
  className = '',
}) => {
  if (!chips || chips.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Filtres actifs"
      className={`flex items-center gap-1.5 overflow-x-auto px-4 py-1.5 no-scrollbar select-none ${className}`}
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors shrink-0 cursor-pointer min-h-[32px]"
          aria-label={`Supprimer le filtre ${chip.label}`}
        >
          <span className="truncate max-w-[160px]">{chip.label}</span>
          <X className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
        </button>
      ))}

      {chips.length > 1 && onResetAll && (
        <button
          type="button"
          onClick={onResetAll}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer min-h-[32px]"
          aria-label="Effacer tous les filtres"
        >
          <RotateCcw className="w-3 h-3 text-slate-400" />
          <span>Effacer tout</span>
        </button>
      )}
    </div>
  );
};
