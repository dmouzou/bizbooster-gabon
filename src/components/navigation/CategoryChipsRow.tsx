import React from 'react';
import {
  Grid,
  Home,
  Car,
  Briefcase,
  Calendar,
  ShoppingBag,
  GraduationCap,
  Wrench,
  AlertTriangle,
  Flower2,
} from 'lucide-react';
import { MainCategory } from '../../types';
import { Chip } from '../ui/Chip';

export interface CategoryItem {
  id: 'ALL' | MainCategory;
  label: string;
  icon: React.ReactNode;
}

export const CATEGORY_ITEMS: CategoryItem[] = [
  { id: 'ALL', label: 'Tout', icon: <Grid className="w-4 h-4" /> },
  { id: 'IMMOBILIER', label: 'Immobilier', icon: <Home className="w-4 h-4" /> },
  { id: 'MATERIEL_ROULANT', label: 'Véhicules', icon: <Car className="w-4 h-4" /> },
  { id: 'EMPLOI', label: 'Emploi', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'EVENEMENTS', label: 'Événements', icon: <Calendar className="w-4 h-4" /> },
  { id: 'BRIC_A_BRAC', label: 'Bric-à-brac', icon: <ShoppingBag className="w-4 h-4" /> },
  { id: 'COURS_A_DOMICILE', label: 'Cours & Soutien', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'AUTRES_EMPLOIS', label: 'Autres Métiers', icon: <Wrench className="w-4 h-4" /> },
  { id: 'NECROLOGIE', label: 'Nécrologie', icon: <Flower2 className="w-4 h-4" /> },
  { id: 'AVIS_DE_RECHERCHE', label: 'Avis de Recherche', icon: <AlertTriangle className="w-4 h-4" /> },
];

export interface CategoryChipsRowProps {
  selectedCategory: 'ALL' | MainCategory;
  onSelectCategory: (category: 'ALL' | MainCategory) => void;
  categoryCounts?: Record<string, number>;
  className?: string;
}

export const CategoryChipsRow: React.FC<CategoryChipsRowProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts = {},
  className = '',
}) => {
  return (
    <div
      role="radiogroup"
      aria-label="Filtrer par catégorie"
      className={`w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory flex items-center gap-2.5 px-4 py-2 select-none ${className}`}
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {CATEGORY_ITEMS.map((item) => {
        const isSelected = selectedCategory === item.id;
        const count = categoryCounts[item.id];

        return (
          <div key={item.id} className="snap-start shrink-0">
            <Chip
              label={item.label}
              icon={item.icon}
              count={count}
              active={isSelected}
              onClick={() => onSelectCategory(item.id)}
            />
          </div>
        );
      })}
    </div>
  );
};

