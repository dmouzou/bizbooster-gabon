import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  snapPoint?: 'auto' | 'half' | 'full';
  showCloseButton?: boolean;
  className?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  snapPoint = 'auto',
  showCloseButton = true,
  className = '',
}) => {
  const [startY, setStartY] = useState<number | null>(null);
  const [currentTranslateY, setCurrentTranslateY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock background scroll when open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === null) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) {
      setCurrentTranslateY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (currentTranslateY > 120) {
      onClose();
    }
    setStartY(null);
    setCurrentTranslateY(0);
  };

  const heightClasses = {
    auto: 'max-h-[90dvh]',
    half: 'h-[50dvh]',
    full: 'h-[92dvh]',
  }[snapPoint];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'sheet-title' : undefined}
      aria-describedby={description ? 'sheet-description' : undefined}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center select-none"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Surface (Bottom sheet on mobile, centered dialog on sm+) */}
      <div
        ref={sheetRef}
        style={{
          transform: currentTranslateY > 0 ? `translateY(${currentTranslateY}px)` : undefined,
          transition: startY !== null ? 'none' : 'transform 200ms ease-out',
        }}
        className={`relative z-10 w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200/80 shadow-2xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] sm:pb-0 ${heightClasses} animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 select-text ${className}`}
      >
        {/* Mobile drag handle */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="sm:hidden pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing shrink-0"
        >
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 gap-3">
            <div className="min-w-0">
              {title && (
                <h2 id="sheet-title" className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  {title}
                </h2>
              )}
              {description && (
                <p id="sheet-description" className="text-xs text-slate-500 mt-0.5 truncate">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <IconButton
                aria-label="Fermer la fenêtre"
                variant="ghost"
                size="sm"
                icon={<X className="w-5 h-5 text-slate-500" />}
                onClick={onClose}
              />
            )}
          </div>
        )}

        {/* Body content */}
        <div className="p-5 overflow-y-auto flex-1 overscroll-contain">
          {children}
        </div>

        {/* Optional sticky footer */}
        {footer && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/70 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

