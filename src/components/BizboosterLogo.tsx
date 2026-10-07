import React from 'react';

interface BizboosterLogoProps {
  variant?: 'horizontal' | 'stacked' | 'mark';
  iconSize?: number;
  className?: string;
  theme?: 'light' | 'dark';
  showTagline?: boolean;
}

/**
 * Official BIZBOOSTER Logo component conforming to brand assets:
 * Gabonese flag colors:
 * - Yellow spine: #FCD116
 * - Green bolt: #009E60
 * - Blue dot accent: #4664B2
 * Tagline: BUY · SELL · GROW
 */
export const BizboosterLogo: React.FC<BizboosterLogoProps> = ({
  variant = 'horizontal',
  iconSize = 36,
  className = '',
  theme = 'light',
  showTagline = true,
}) => {
  // SVG Mark component (Image 3)
  const LogoMark = (
    <svg
      width={iconSize}
      height={Math.round(iconSize * 0.96)}
      viewBox="140 8 100 96"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="BIZBOOSTER Logo Mark"
      className="shrink-0 transition-transform duration-200 group-hover:scale-105"
    >
      <polygon points="150,20 159,18 149,94" fill="#FCD116" />
      <path
        d="M150,20 L212,14 L172,48 L216,44 L150,94"
        fill="none"
        stroke="#009E60"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="150" cy="94" r="6" fill="#4664B2" />
    </svg>
  );

  if (variant === 'mark') {
    return <div className={`inline-flex items-center ${className}`}>{LogoMark}</div>;
  }

  const isDark = theme === 'dark';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subtextColor = isDark ? 'text-slate-400' : 'text-slate-500';

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <div className="mb-2">{LogoMark}</div>
        <div className="font-black text-2xl tracking-wider leading-none whitespace-nowrap">
          <span className="text-[#E5A000] font-black drop-shadow-[0_0.5px_0.5px_rgba(0,0,0,0.1)]">BIZ</span>
          <span className="text-[#009E60] font-black">BOOSTER</span>
        </div>
        {showTagline && (
          <div className={`text-[10px] font-bold tracking-[0.25em] mt-1.5 uppercase ${subtextColor}`}>
            BUY · SELL · GROW
          </div>
        )}
      </div>
    );
  }

  // Horizontal variant (Ideal for navigation headers)
  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 ${className}`}>
      {LogoMark}
      <div className="min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <span className="font-black text-lg sm:text-xl tracking-tight leading-none whitespace-nowrap">
            <span className="text-[#E5A000] font-black drop-shadow-[0_0.5px_0.5px_rgba(0,0,0,0.1)]">BIZ</span>
            <span className="text-[#009E60] font-black">BOOSTER</span>
          </span>
        </div>
        {showTagline && (
          <span className={`text-[9px] sm:text-[10px] font-bold tracking-[0.18em] uppercase ${subtextColor} leading-tight mt-0.5 truncate`}>
            BUY · SELL · GROW
          </span>
        )}
      </div>
    </div>
  );
};
