import React from 'react';
import { Loader2 } from 'lucide-react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon: React.ReactNode;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      icon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    // Strictly >= 44x44 px bounding box across all sizes for touch accessibility
    const baseStyles =
      'inline-flex items-center justify-center font-semibold select-none transition-all duration-200 rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-[0.95] disabled:pointer-events-none disabled:opacity-50 min-h-[44px] min-w-[44px]';

    const variants = {
      primary: 'bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white shadow-sm border border-emerald-800/20',
      secondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border border-slate-200',
      outline: 'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-800 border border-slate-300',
      ghost: 'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-transparent',
      danger: 'bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-600 border border-rose-200',
    }[variant];

    const sizes = {
      sm: 'w-11 h-11 p-2 text-sm',
      md: 'w-11 h-11 p-2.5 text-base',
      lg: 'w-12 h-12 p-3 text-lg min-h-[48px] min-w-[48px]',
    }[size];

    return (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants} ${sizes} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          <span className="shrink-0 flex items-center justify-center">{icon}</span>
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

