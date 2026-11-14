import React from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
  count?: number | string;
  icon?: React.ReactNode;
  onRemove?: () => void;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    {
      active = false,
      label,
      count,
      icon,
      onRemove,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={active}
        disabled={disabled}
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm select-none transition-all duration-200 cursor-pointer min-h-[44px] shrink-0 border focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 active:scale-[0.97] ${
          active
            ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
            : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs hover:border-slate-300'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
        {...props}
      >
        {icon && <span className="shrink-0 flex items-center justify-center">{icon}</span>}
        <span className="truncate">{label}</span>
        {count !== undefined && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              active
                ? 'bg-emerald-800/80 text-emerald-100'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {count}
          </span>
        )}
      </button>
    );
  }
);

Chip.displayName = 'Chip';

