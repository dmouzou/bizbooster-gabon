import React from 'react';

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'vip' | 'verified' | 'success' | 'warning' | 'error' | 'neutral' | 'urgent';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Pill: React.FC<PillProps> = ({
  variant = 'neutral',
  icon,
  children,
  className = '',
  ...props
}) => {
  const variants = {
    vip: 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-2xs border border-amber-300',
    verified: 'bg-emerald-50 text-emerald-800 border border-emerald-300/80 font-bold',
    success: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold',
    warning: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
    error: 'bg-rose-100 text-rose-800 border border-rose-300 font-bold',
    urgent: 'bg-rose-600 text-white border border-rose-700 font-black',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200 font-semibold',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider select-none leading-none shrink-0 ${variants} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0 flex items-center justify-center">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

