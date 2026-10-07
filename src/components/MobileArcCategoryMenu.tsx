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
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}

const CATEGORIES: CategoryItem[] = [
  {
    id: 'ALL',
    label: 'TOUTES LES CATÉGORIES',
    subtitle: 'Catalogue complet',
    icon: <Layers className="w-4 h-4" />,
    color: 'emerald',
  },
  {
    id: 'IMMOBILIER',
    label: '1. IMMOBILIER',
    subtitle: '9 provinces • Vente & Location',
    icon: <Building2 className="w-4 h-4" />,
    color: 'emerald',
  },
  {
    id: 'MATERIEL_ROULANT',
    label: '2. MATÉRIEL ROULANT',
    subtitle: 'Voitures, Camions, Engins, Motos',
    icon: <Car className="w-4 h-4" />,
    color: 'blue',
  },
  {
    id: 'BRIC_A_BRAC',
    label: '3. BRIC-À-BRAC',
    subtitle: 'Téléphonie, Électroménager, Meubles',
    icon: <Package className="w-4 h-4" />,
    color: 'amber',
  },
  {
    id: 'EMPLOI',
    label: '4. EMPLOI & MAISONS',
    subtitle: 'Nounous, Cuisiniers, Gardiens',
    icon: <Briefcase className="w-4 h-4" />,
    color: 'purple',
  },
  {
    id: 'COURS_A_DOMICILE',
    label: '5. COURS À DOMICILE',
    subtitle: 'Maths, PC, SVT, Français...',
    icon: <GraduationCap className="w-4 h-4" />,
    color: 'indigo',
  },
  {
    id: 'NECROLOGIE',
    label: '6. NÉCROLOGIE',
    subtitle: 'Éducation, Police, Armée, Santé...',
    icon: <Heart className="w-4 h-4" />,
    color: 'slate',
  },
  {
    id: 'AVIS_DE_RECHERCHE',
    label: '7. AVIS DE RECHERCHE',
    subtitle: 'Personnes, Objets, Animaux perdus',
    icon: <Search className="w-4 h-4" />,
    color: 'rose',
  },
  {
    id: 'AUTRES_EMPLOIS',
    label: '8. AUTRES EMPLOIS',
    subtitle: 'Demandeurs avec CV, Offres, Stages',
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center select-none md:hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Menu des catégories"
    >
      {/* 1. Arrière-plan flouté au déclenchement du menu */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* 2. Container avec menu catégorie et bouton de fermeture en croix placé en bas */}
      <div className="relative z-20 w-full max-w-sm mx-auto px-3.5 flex flex-col items-center gap-2.5 max-h-[92vh]">
        {/* Header : Texte d'indication positionné au-dessus sans aucun chevauchement */}
        <div className="shrink-0 text-center pb-0.5 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 bg-slate-900/95 text-emerald-300 text-[11px] font-bold px-4 py-1.5 rounded-full border border-emerald-500/30 backdrop-blur-md shadow-lg">
            <span>✨</span>
            <span>Touchez une catégorie pour filtrer</span>
          </span>
        </div>

        {/* Colonne verticale des catégories (avec px-2 pour que les bordures et rings ne soient jamais tronqués à gauche) */}
        <div className="w-full max-h-[73vh] overflow-y-auto space-y-2.5 py-2 px-2 overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb]:rounded-full">
          {CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;
            const count = categoryCounts[cat.id] || 0;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onSelectCategory(cat.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-white ring-2 ring-emerald-300 shadow-xl shadow-emerald-500/25'
                    : 'bg-slate-900/90 text-slate-100 border-slate-700/80 hover:bg-slate-800 hover:border-slate-500 backdrop-blur-md shadow-md'
                }`}
                id={`arc-category-${cat.id.toLowerCase()}`}
                title={`${cat.label} • ${cat.subtitle}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-emerald-400'
                    }`}
                  >
                    {cat.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-tight truncate">
                      {cat.label}
                    </div>
                    <p
                      className={`text-[9px] font-medium truncate ${
                        isSelected ? 'text-emerald-100' : 'text-slate-400'
                      }`}
                    >
                      {cat.subtitle}
                    </p>
                  </div>
                </div>

                <span
                  className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-white text-emerald-950 shadow-xs'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bouton de fermeture en croix placé en bas à côté/en dessous du menu catégorie */}
        <div className="shrink-0 flex items-center justify-center pt-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu des catégories"
            id="close-arc-menu-button"
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900/95 border-2 border-emerald-400 text-white font-bold text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-emerald-500/20"
          >
            <X className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
            <span>Fermer le menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
