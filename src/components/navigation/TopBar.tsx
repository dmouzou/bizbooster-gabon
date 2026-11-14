import React from 'react';
import { Bell, Shield } from 'lucide-react';
import { BizboosterLogo } from '../BizboosterLogo';
import { IconButton } from '../ui/IconButton';

export interface TopBarProps {
  onOpenNotifications: () => void;
  unreadNotificationsCount?: number;
  onSwitchToAdmin?: () => void;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onSwitchToAdmin,
  className = '',
}) => {
  return (
    <header
      className={`w-full bg-white border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between gap-3 sticky top-0 z-30 select-none ${className}`}
    >
      {/* Brand logo left */}
      <a href="/" className="flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg">
        <BizboosterLogo variant="horizontal" iconSize={30} showTagline={false} />
      </a>

      {/* Right controls */}
      <div className="flex items-center gap-1.5">
        {onSwitchToAdmin && (
          <button
            type="button"
            onClick={onSwitchToAdmin}
            aria-label="Accéder au Cockpit Administrateur"
            title="Cockpit Administrateur"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-amber-300 text-xs font-bold border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Admin</span>
          </button>
        )}

        {/* Notifications button with unread counter */}
        <div className="relative">
          <IconButton
            aria-label={`Notifications ${unreadNotificationsCount > 0 ? `(${unreadNotificationsCount} non lues)` : ''}`}
            variant="ghost"
            size="md"
            icon={<Bell className="w-5 h-5 text-slate-700" />}
            onClick={onOpenNotifications}
          />
          {unreadNotificationsCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-600 rounded-full ring-2 ring-white"
            />
          )}
        </div>
      </div>
    </header>
  );
};

