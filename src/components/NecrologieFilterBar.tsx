import React from 'react';
import { Heart, Building, MapPin, RotateCcw, Cross, Sparkles, Filter } from 'lucide-react';
import { NecrologieMinistry } from '../types';
import { NECROLOGIE_MINISTRIES } from '../data/categoriesData';
import { GABON_PROVINCES } from '../data/gabonLocations';

interface NecrologieFilterBarProps {
  selectedMinistry?: NecrologieMinistry | 'ALL';
  onChangeMinistry: (ministry: NecrologieMinistry | 'ALL') => void;
  onResetFilters: () => void;
}

export const NecrologieFilterBar: React.FC<NecrologieFilterBarProps> = ({
  selectedMinistry = 'ALL',
  onChangeMinistry,
  onResetFilters,
}) => {
  const hasActiveFilters = selectedMinistry !== 'ALL';

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-md space-y-4">
      {/* Title banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-800 text-amber-400 border border-slate-700">
            <Heart className="w-5 h-5 fill-amber-400/20" />
          </div>
          <div>
            <h4 className="font-black text-sm text-white flex items-center gap-2">
              <span>Rubrique Nécrologie & Avis d'Obsèques</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400/15 text-amber-300 border border-amber-400/20 px-2 py-0.5 rounded-sm">
                Diffusion Nationale
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Hommages, faire-part et condoléances diffusés sur l'ensemble du territoire gabonais, classés par corps professionnels
            </p>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser les filtres</span>
          </button>
        )}
      </div>

      {/* Ministries Sub-menu (Corps professionnel) */}
      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
          Corps professionnel / Ministère :
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChangeMinistry('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedMinistry === 'ALL'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            Tous les ministères
          </button>

          {NECROLOGIE_MINISTRIES.map((min) => {
            const isSelected = selectedMinistry === min;
            return (
              <button
                key={min}
                type="button"
                onClick={() => onChangeMinistry(min)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 shadow-sm ring-2 ring-amber-400/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {min}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
