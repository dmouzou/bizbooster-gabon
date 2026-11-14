import React from 'react';
import { Home, Search, Plus, Heart, User } from 'lucide-react';

export type BottomNavTab = 'home' | 'search' | 'favorites' | 'account';

export interface BottomTabBarProps {
  activeTab: BottomNavTab;
  onTabChange: (tab: BottomNavTab) => void;
  onPublishClick: () => void;
  favoritesCount?: number;
  unreadNotificationsCount?: number;
  isLoggedIn?: boolean;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
  onPublishClick,
  favoritesCount = 0,
}) => {
  return (
    <nav
      aria-label="Navigation principale mobile"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 lg:hidden pb-[env(safe-area-inset-bottom)] shadow-lg select-none"
    >
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto relative">
        {/* Tab 1: Accueil */}
        <button
          type="button"
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] transition-colors cursor-pointer ${
            activeTab === 'home'
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="Accueil"
          aria-current={activeTab === 'home' ? 'page' : undefined}
        >
          <Home className="w-5 h-5" />
          <span className="text-xs mt-0.5 leading-none">Accueil</span>
        </button>

        {/* Tab 2: Recherche */}
        <button
          type="button"
          onClick={() => onTabChange('search')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] transition-colors cursor-pointer ${
            activeTab === 'search'
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="Recherche"
          aria-current={activeTab === 'search' ? 'page' : undefined}
        >
          <Search className="w-5 h-5" />
          <span className="text-xs mt-0.5 leading-none">Recherche</span>
        </button>

        {/* Tab 3 (Center): Raised 56px circular Publier button */}
        <div className="flex-1 flex justify-center items-center h-full relative">
          <button
            type="button"
            onClick={onPublishClick}
            aria-label="Publier une annonce gratuitement ou avec boost"
            className="w-14 h-14 -translate-y-3.5 rounded-full bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white shadow-xl shadow-emerald-900/25 border-4 border-white flex items-center justify-center transition-all transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab 4: Favoris */}
        <button
          type="button"
          onClick={() => onTabChange('favorites')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] transition-colors cursor-pointer relative ${
            activeTab === 'favorites'
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="Favoris"
          aria-current={activeTab === 'favorites' ? 'page' : undefined}
        >
          <div className="relative">
            <Heart className="w-5 h-5" />
            {favoritesCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
                {favoritesCount > 9 ? '9+' : favoritesCount}
              </span>
            )}
          </div>
          <span className="text-xs mt-0.5 leading-none">Favoris</span>
        </button>

        {/* Tab 5: Compte */}
        <button
          type="button"
          onClick={() => onTabChange('account')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] transition-colors cursor-pointer ${
            activeTab === 'account'
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="Mon Compte"
          aria-current={activeTab === 'account' ? 'page' : undefined}
        >
          <User className="w-5 h-5" />
          <span className="text-xs mt-0.5 leading-none">Compte</span>
        </button>
      </div>
    </nav>
  );
};

