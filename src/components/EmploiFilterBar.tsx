import React from 'react';
import { Briefcase, UserCheck, Users, MapPin, RotateCcw } from 'lucide-react';
import { JobAdKind, DomesticJobType } from '../types';
import { DOMESTIC_JOB_TYPES } from '../data/categoriesData';
import { GABON_PROVINCES } from '../data/gabonLocations';

interface EmploiFilterBarProps {
  selectedKind?: JobAdKind | 'ALL';
  selectedJobKind?: JobAdKind | 'ALL';
  onChangeKind?: (kind: JobAdKind | 'ALL') => void;
  onChangeJobKind?: (kind: JobAdKind | 'ALL') => void;
  selectedJobType: string | 'ALL';
  onChangeJobType: (jobType: string | 'ALL') => void;
  selectedProvince: string;
  onChangeProvince: (prov: string) => void;
  selectedCity: string;
  onChangeCity: (city: string) => void;
  onResetFilters: () => void;
}

export const EmploiFilterBar: React.FC<EmploiFilterBarProps> = ({
  selectedKind,
  selectedJobKind,
  onChangeKind,
  onChangeJobKind,
  selectedJobType,
  onChangeJobType,
  selectedProvince,
  onChangeProvince,
  selectedCity,
  onChangeCity,
  onResetFilters,
}) => {
  const currentKind = selectedJobKind || selectedKind || 'ALL';
  const handleKindChange = (kind: JobAdKind | 'ALL') => {
    if (onChangeJobKind) onChangeJobKind(kind);
    if (onChangeKind) onChangeKind(kind);
  };

  const currentProvinceData = GABON_PROVINCES.find((p) => p.name === selectedProvince);
  const cities = currentProvinceData?.cities || [];
  const hasActiveFilters =
    currentKind !== 'ALL' ||
    selectedJobType !== 'ALL' ||
    Boolean(selectedProvince) ||
    Boolean(selectedCity);

  return (
    <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-4 border border-purple-800/60 shadow-md space-y-4">
      {/* Title banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-800/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-900/60 text-purple-300 border border-purple-700/60">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-sm text-white flex items-center gap-2">
              <span>Rubrique Emploi & Personnel Domestique</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-900/80 text-purple-200 px-2 py-0.5 rounded-sm">
                Gabon
              </span>
            </h4>
            <p className="text-[11px] text-purple-200/80">
              Distinction entre recruteurs (offres) et candidats cherchant à travailler (demandes)
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

      {/* Distinction Offres vs Demandes (Point 8) */}
      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-purple-200 mb-2">
          Type d'annonce Emploi :
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleKindChange('ALL')}
            className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
              currentKind === 'ALL'
                ? 'bg-white text-purple-950 border-white shadow-sm'
                : 'bg-purple-900/40 hover:bg-purple-900/70 text-purple-200 border-purple-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Toutes les annonces Emploi</span>
          </button>

          <button
            type="button"
            onClick={() => handleKindChange('OFFRE_EMPLOI')}
            className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
              currentKind === 'OFFRE_EMPLOI'
                ? 'bg-purple-500 text-white border-purple-400 shadow-md ring-2 ring-purple-300/40'
                : 'bg-purple-900/40 hover:bg-purple-900/70 text-purple-200 border-purple-800'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>💼 Offres d'emploi (Recruteurs)</span>
          </button>

          <button
            type="button"
            onClick={() => handleKindChange('DEMANDE_EMPLOI')}
            className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
              currentKind === 'DEMANDE_EMPLOI'
                ? 'bg-teal-500 text-white border-teal-400 shadow-md ring-2 ring-teal-300/40'
                : 'bg-purple-900/40 hover:bg-purple-900/70 text-purple-200 border-purple-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>🙋 Demandes d'emploi (Candidats)</span>
          </button>
        </div>
      </div>

      {/* Métiers et Localisation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-purple-900/50">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-purple-300 mb-1">
            Métier Domestique
          </label>
          <select
            value={selectedJobType}
            onChange={(e) => onChangeJobType(e.target.value)}
            className="w-full bg-purple-950/70 border border-purple-700/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-purple-400"
          >
            <option value="ALL">Tous les métiers</option>
            {DOMESTIC_JOB_TYPES.map((jt) => (
              <option key={jt} value={jt}>
                {jt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-purple-300 mb-1">
            Province du Gabon
          </label>
          <select
            value={selectedProvince}
            onChange={(e) => {
              onChangeProvince(e.target.value);
              onChangeCity('');
            }}
            className="w-full bg-purple-950/70 border border-purple-700/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-purple-400"
          >
            <option value="">Toutes les provinces</option>
            {GABON_PROVINCES.map((p) => (
              <option key={p.code} value={p.name}>
                {p.name} ({p.capital})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-purple-300 mb-1">
            Ville / Commune
          </label>
          <select
            value={selectedCity}
            onChange={(e) => onChangeCity(e.target.value)}
            disabled={!selectedProvince || cities.length === 0}
            className="w-full bg-purple-950/70 border border-purple-700/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-purple-400 disabled:opacity-40"
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
