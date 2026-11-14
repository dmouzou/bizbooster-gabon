import React from 'react';
import { formatFCFA } from '../../utils/formatters';

export interface PriceProps {
  amount?: number | null;
  period?: 'mois' | 'jour' | 'an' | string;
  isFree?: boolean;
  freeLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Price: React.FC<PriceProps> = ({
  amount,
  period,
  isFree = false,
  freeLabel = 'Gratuit',
  size = 'md',
  className = '',
}) => {
  if (isFree || amount === 0) {
    return (
      <span className={`font-black text-emerald-600 select-none ${className}`}>
        {freeLabel}
      </span>
    );
  }

  if (amount === undefined || amount === null || isNaN(amount)) {
    return null;
  }

  const sizes = {
    sm: 'text-xs',
    md: 'text-sm font-extrabold',
    lg: 'text-base font-black',
    xl: 'text-xl font-black',
  }[size];

  const formatted = formatFCFA(amount);

  return (
    <span className={`inline-flex items-baseline gap-1 select-none ${sizes} ${className}`}>
      <span className="text-slate-900">{formatted}</span>
      {period && <span className="text-xs font-semibold text-slate-500 lowercase">{`/${period}`}</span>}
    </span>
  );
};

