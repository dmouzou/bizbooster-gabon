import React, { useState, useEffect, useRef } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

export interface SearchRowProps {
  value: string;
  onChange: (value: string) => void;
  onOpenFilterSheet?: () => void;
  hasActiveFilters?: boolean;
  placeholder?: string;
  className?: string;
}

export const SearchRow: React.FC<SearchRowProps> = ({
  value,
  onChange,
  onOpenFilterSheet,
  hasActiveFilters = false,
  placeholder = 'Rechercher une annonce...',
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setInternalValue(nextVal);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onChange(nextVal);
    }, 250);
  };

  const handleClear = () => {
    setInternalValue('');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onChange('');
  };

  return (
    <div className={`flex items-center gap-2.5 px-4 w-full select-none ${className}`}>
      {/* 48 px high search input box */}
      <div className="relative flex-1 flex items-center">
        <Search className="absolute left-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={internalValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          aria-label="Recherche textuelle"
          className="w-full h-12 min-h-[48px] pl-10 pr-9 bg-white border border-slate-200/90 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
        />
        {internalValue && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Effacer la recherche"
            className="absolute right-2.5 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 48x48 px Filter button */}
      {onOpenFilterSheet && (
        <button
          type="button"
          onClick={onOpenFilterSheet}
          aria-label="Ouvrir les filtres avancés"
          className={`h-12 w-12 min-h-[48px] min-w-[48px] rounded-xl border flex items-center justify-center relative transition-colors cursor-pointer shrink-0 shadow-2xs ${
            hasActiveFilters
              ? 'bg-emerald-700 text-white border-emerald-800'
              : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-200/90'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
          {hasActiveFilters && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-emerald-700" />
          )}
        </button>
      )}
    </div>
  );
};

