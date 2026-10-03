import React from 'react';
import {
  PlusCircle,
  Grid,
  ShieldCheck,
  User,
  LogOut,
} from 'lucide-react';
import { MainCategory, UserProfile, isUserAdmin } from '../types';

interface HeaderProps {
  currentTab: 'catalog' | 'user-dashboard';
  setCurrentTab: (tab: 'catalog' | 'user-dashboard') => void;
  activeCategory: MainCategory | 'ALL';
  setActiveCategory: (cat: MainCategory | 'ALL') => void;
  onOpenPublishModal: () => void;
  onOpenPhoneAuth: () => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
  totalActiveAdsCount: number;
  onSwitchToAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  onOpenPublishModal,
  onOpenPhoneAuth,
  currentUser,
  onLogout,
  totalActiveAdsCount,
  onSwitchToAdmin,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top micro-bar: Gabon context & assurances (hidden on small mobile to maximize content view) */}
      <div className="bg-emerald-950 text-emerald-100 text-xs py-1.5 px-4 hidden sm:block">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="font-semibold tracking-wide text-[11px] sm:text-xs">
              BIZBOOSTER GABON • Portail Annonces Particuliers & Professionnels
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-emerald-200 text-xs">
            <span className="hidden md:flex items-center gap-1 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              Paiements sécurisés Airtel Money & Moov Money
            </span>
            <span className="text-emerald-400 font-bold text-[11px]">
              Consultation 100% Gratuite
            </span>
          </div>
        </div>
      </div>

      {/* Main navigation header (Strictly Frontend App) */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
        {/* Logo and Brand */}
        <div className="flex items-center justify-between w-full md:w-auto min-w-0">
          <div
            onClick={() => setCurrentTab('catalog')}
            className="cursor-pointer flex items-center gap-1.5 sm:gap-3 group shrink-0 min-w-0"
            id="brand-logo"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 flex items-center justify-center text-white font-black text-base sm:text-xl shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform border border-emerald-500/30 shrink-0">
              <span className="text-amber-400">B</span>Z
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-base sm:text-xl tracking-tight text-slate-900 whitespace-nowrap">
                  BIZ<span className="text-emerald-600">BOOSTER</span>
                </span>
                <span className="bg-amber-100 text-amber-800 text-[8px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-sm uppercase tracking-wider shrink-0 hidden min-[360px]:inline-block">
                  Gabon
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium hidden xs:block truncate">
                Vente & Location • Annonces Commerciales
              </p>
            </div>
          </div>

          {/* Mobile Actions: Phone login & Publish */}
          <div className="flex items-center gap-1.5 sm:gap-2 md:hidden shrink-0 ml-1">
            {currentUser && isUserAdmin(currentUser) && (
              <button
                onClick={onSwitchToAdmin}
                className="p-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 border border-amber-300 text-xs font-black flex items-center gap-1 shadow-2xs shrink-0 cursor-pointer"
                title="Accéder au Cockpit Administrateur"
                id="mobile-header-admin-btn"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                <span className="text-[10px] font-black hidden min-[360px]:inline">Admin</span>
              </button>
            )}

            {currentUser ? (
              <button
                onClick={() => setCurrentTab('user-dashboard')}
                className="p-1 sm:p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 sm:gap-1.5 shadow-2xs shrink-0"
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] sm:text-[11px] font-black shrink-0">
                  {(currentUser.name || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[60px] sm:max-w-[75px] truncate font-bold text-[11px] sm:text-xs">{currentUser.name.split(' ')[0]}</span>
              </button>
            ) : (
              <button
                onClick={onOpenPhoneAuth}
                className="py-1.5 px-2 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 shadow-2xs transition-colors shrink-0 whitespace-nowrap"
              >
                Connexion
              </button>
            )}

            <button
              onClick={onOpenPublishModal}
              className="flex items-center gap-1 bg-emerald-600 active:bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-2.5 sm:px-3 rounded-xl shadow-xs transition-all shrink-0 whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Publier</span>
            </button>
          </div>
        </div>

        {/* Center Tabs: Strictly Frontend Only (Catalogue & Espace Annonceur) - Shown on desktop */}
        <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 justify-center">
          {/* TAB 1: CATALOGUE (PUBLIC & FREE) */}
          <button
            onClick={() => setCurrentTab('catalog')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === 'catalog'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="tab-catalog"
          >
            <Grid className="w-3.5 h-3.5 text-emerald-600" />
            <span>Catalogue Public ({totalActiveAdsCount})</span>
          </button>

          {/* TAB 2: USER DEDICATED DASHBOARD */}
          <button
            onClick={() => {
              if (currentUser) {
                setCurrentTab('user-dashboard');
              } else {
                onOpenPhoneAuth();
              }
            }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === 'user-dashboard'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="tab-user-dashboard"
          >
            <User className="w-3.5 h-3.5 text-indigo-600" />
            <span>{currentUser ? 'Mon Espace Annonceur' : 'Espace Annonceur'}</span>
            {currentUser && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Right CTA & Profile status */}
        <div className="hidden md:flex items-center gap-3">
          {currentUser && isUserAdmin(currentUser) && (
            <button
              onClick={onSwitchToAdmin}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-xs font-black px-3.5 py-2 rounded-xl shadow-xs border border-amber-300 transition-all cursor-pointer transform hover:scale-102"
              title="Accéder au Cockpit Administrateur et Modération"
              id="header-admin-cockpit-btn"
            >
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>Cockpit Admin</span>
            </button>
          )}

          {currentUser ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <div className="text-right">
                <span className="block text-xs font-bold text-slate-800 leading-tight">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {currentUser.contactPhone}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white p-1.5 rounded-lg transition-all shadow-xs cursor-pointer flex items-center justify-center"
                title="Se déconnecter"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenPhoneAuth}
              className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors border border-slate-200/80"
              id="header-login-btn"
            >
              <User className="w-3.5 h-3.5 text-slate-600" />
              <span>Connexion (+241)</span>
            </button>
          )}

          <button
            onClick={onOpenPublishModal}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-md shadow-emerald-700/15 hover:shadow-lg transition-all active:scale-98"
            id="desktop-publish-button"
          >
            <PlusCircle className="w-4 h-4 text-emerald-100" />
            <span>Déposer une annonce</span>
          </button>
        </div>
      </div>
    </header>
  );
};
