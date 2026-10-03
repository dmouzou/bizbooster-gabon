import React from 'react';
import { Heart, Building, MapPin, RotateCcw, Cross, Sparkles, Filter } from 'lucide-react';
import { NecrologieMinistry } from '../types';
import { NECROLOGIE_MINISTRIES } from '../data/categoriesData';
import { GABON_PROVINCES } from '../data/gabonLocations';

interface NecrologieFilterBarProps {
  selectedMinistry?: NecrologieMinistry | 'ALL';
  onChangeMinistry: (ministry: NecrologieMinistry | 'ALL') => void;
  selectedProvince?: string;
  selectedCity?: string;
  onChangeProvince: (prov: string) => void;
  onChangeCity: (city: string) => void;
  onResetFilters: () => void;
}

export const NecrologieFilterBar: React.FC<NecrologieFilterBarProps> = ({
  selectedMinistry = 'ALL',
  onChangeMinistry,
  selectedProvince = '',
  selectedCity = '',
  onChangeProvince,
  onChangeCity,
  onResetFilters,
}) => {
  const currentProvinceData = GABON_PROVINCES.find((p) => p.name === selectedProvince);
  const cities = currentProvinceData?.cities || [];
  const hasActiveFilters = selectedMinistry !== 'ALL' || Boolean(selectedProvince) || Boolean(selectedCity);

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
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded-sm">
                Gabon
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Hommages, faire-part et condoléances classés par ministères et corps professionnels
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

      {/* Ministries Sub-menu (Item 8 Requirement) */}
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

      {/* Spatial filters: Province and City */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Province
          </label>
          <div className="relative">
            <select
              value={selectedProvince}
              onChange={(e) => {
                onChangeProvince(e.target.value);
                onChangeCity('');
              }}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
            >
              <option value="">Toutes les provinces (9)</option>
              {GABON_PROVINCES.map((p) => (
                <option key={p.code} value={p.name}>
                  {p.name} ({p.capital})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Ville / Localité
          </label>
          <select
            value={selectedCity}
            onChange={(e) => onChangeCity(e.target.value)}
            disabled={!selectedProvince}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden disabled:opacity-40"
          >
            <option value="">Toutes les villes</option>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
