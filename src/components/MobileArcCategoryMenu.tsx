import React, { useEffect } from 'react';
import { X, Layers, Building2, Car, Package, Briefcase, GraduationCap, Heart, Search, UserCheck } from 'lucide-react';
import { MainCategory } from '../types';

interface MobileArcCategoryMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeCategory: MainCategory | 'ALL';
  onSelectCategory: (category: MainCategory | 'ALL') => void;
  categoryCounts: Record<MainCategory | 'ALL', number>;
}

interface CategoryItem {
  id: MainCategory | 'ALL';
  label: string;
  icon: React.ReactNode;
  color: string;
}

const CATEGORIES: CategoryItem[] = [
  {
    id: 'ALL',
    label: 'Toutes',
    icon: <Layers className="w-4 h-4" />,
    color: 'emerald',
  },
  {
    id: 'IMMOBILIER',
    label: 'Immobilier',
    icon: <Building2 className="w-4 h-4" />,
    color: 'emerald',
  },
  {
    id: 'MATERIEL_ROULANT',
    label: 'Véhicules',
    icon: <Car className="w-4 h-4" />,
    color: 'blue',
  },
  {
    id: 'BRIC_A_BRAC',
    label: 'Bric-à-Brac',
    icon: <Package className="w-4 h-4" />,
    color: 'amber',
  },
  {
    id: 'EMPLOI',
    label: 'Emploi Maisons',
    icon: <Briefcase className="w-4 h-4" />,
    color: 'purple',
  },
  {
    id: 'COURS_A_DOMICILE',
    label: 'Cours Domicile',
    icon: <GraduationCap className="w-4 h-4" />,
    color: 'indigo',
  },
  {
    id: 'NECROLOGIE',
    label: 'Nécrologie',
    icon: <Heart className="w-4 h-4" />,
    color: 'slate',
  },
  {
    id: 'AVIS_DE_RECHERCHE',
    label: 'Avis Recherche',
    icon: <Search className="w-4 h-4" />,
    color: 'rose',
  },
  {
    id: 'AUTRES_EMPLOIS',
    label: 'Autres Emplois',
    icon: <UserCheck className="w-4 h-4" />,
    color: 'teal',
  },
];

export const MobileArcCategoryMenu: React.FC<MobileArcCategoryMenuProps> = ({
  isOpen,
  onClose,
  activeCategory,
  onSelectCategory,
  categoryCounts,
}) => {
  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Parameters for semi-circular arc radiating from the anchored left close button
  // 9 items distributed between -72 deg and +72 deg
  const totalItems = CATEGORIES.length;
  const startAngle = -74; // in degrees
  const endAngle = 74;   // in degrees
  const angleStep = (endAngle - startAngle) / (totalItems - 1);
  const radius = 175; // px from origin anchor

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-start select-none md:hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Menu des catégories"
    >
      {/* 1. Arrière-plan flouté au déclenchement du menu */}
      <div
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* 2. Bouton de fermeture ancré à gauche (visible uniquement dans ce menu) */}
      <div className="relative z-20 pl-3 sm:pl-4 flex items-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu des catégories"
          id="close-arc-menu-button"
          className="w-12 h-12 rounded-full bg-slate-900 border-2 border-emerald-400 text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-emerald-500/20"
        >
          <X className="w-6 h-6 text-emerald-400 stroke-[2.5]" />
        </button>

        {/* 3. Les cartes de catégories disposées le long d'un arc semi-circulaire */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none w-0 h-0">
          {CATEGORIES.map((cat, index) => {
            const angleDeg = startAngle + index * angleStep;
            const angleRad = (angleDeg * Math.PI) / 180;
            const x = Math.round(radius * Math.cos(angleRad));
            const y = Math.round(radius * Math.sin(angleRad));
            const isSelected = activeCategory === cat.id;
            const count = categoryCounts[cat.id] || 0;

            return (
              <div
                key={cat.id}
                className="absolute pointer-events-auto transition-transform duration-300"
                style={{
                  transform: `translate(${x}px, ${y}px) translateY(-50%)`,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectCategory(cat.id);
                    onClose();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border shadow-xl text-left transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-white ring-2 ring-emerald-300 shadow-emerald-500/30'
                      : 'bg-slate-900/90 text-slate-100 border-slate-700/80 hover:bg-slate-800 hover:border-slate-500 backdrop-blur-md'
                  }`}
                  id={`arc-category-${cat.id.toLowerCase()}`}
                >
                  <div
                    className={`p-1 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-emerald-400'
                    }`}
                  >
                    {cat.icon}
                  </div>
                  <span className="text-[11px] font-black tracking-tight">{cat.label}</span>
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? 'bg-white text-emerald-950'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Guide text at top of screen */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none z-10">
        <span className="inline-block bg-slate-900/90 text-emerald-300 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-500/30 backdrop-blur-md shadow-lg">
          Touchez une catégorie pour filtrer
        </span>
      </div>
    </div>
  );
};
