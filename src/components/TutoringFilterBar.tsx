import React from 'react';
import { GraduationCap, BookOpen, RotateCcw, MapPin, CheckCircle } from 'lucide-react';
import { TutoringAdKind, TutoringLevel, TutoringSubject } from '../types';
import { TUTORING_LEVELS, TUTORING_SUBJECTS } from '../data/categoriesData';
import { GABON_PROVINCES } from '../data/gabonLocations';

interface TutoringFilterBarProps {
  selectedKind?: TutoringAdKind | 'ALL';
  onChangeKind: (kind: TutoringAdKind | 'ALL') => void;
  selectedSubject?: TutoringSubject | 'ALL';
  onChangeSubject: (subject: TutoringSubject | 'ALL') => void;
  selectedLevel?: TutoringLevel | 'ALL';
  onChangeLevel: (level: TutoringLevel | 'ALL') => void;
  selectedProvince?: string;
  selectedCity?: string;
  onChangeProvince: (prov: string) => void;
  onChangeCity: (city: string) => void;
  onResetFilters: () => void;
}

export const TutoringFilterBar: React.FC<TutoringFilterBarProps> = ({
  selectedKind = 'ALL',
  onChangeKind,
  selectedSubject = 'ALL',
  onChangeSubject,
  selectedLevel = 'ALL',
  onChangeLevel,
  selectedProvince = '',
  selectedCity = '',
  onChangeProvince,
  onChangeCity,
  onResetFilters,
}) => {
  const currentProvinceData = GABON_PROVINCES.find((p) => p.name === selectedProvince);
  const cities = currentProvinceData?.cities || [];
  const hasActiveFilters =
    selectedKind !== 'ALL' ||
    selectedSubject !== 'ALL' ||
    selectedLevel !== 'ALL' ||
    Boolean(selectedProvince) ||
    Boolean(selectedCity);

  return (
    <div className="bg-indigo-950 text-white rounded-2xl p-4 border border-indigo-900 shadow-md space-y-4">
      {/* Title banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-900/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-900 text-indigo-300 border border-indigo-800">
            <GraduationCap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h4 className="font-black text-sm text-white flex items-center gap-2">
              <span>Cours à Domicile & Répétitions</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-sm">
                Offres & Demandes
              </span>
            </h4>
            <p className="text-[11px] text-indigo-300">
              Soutien scolaire, préparation aux examens (CEPE, BEPC, BAC) et cours universitaires au Gabon
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

      {/* 1. Kind switcher: Offres vs Demandes */}
      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-indigo-300 mb-1.5">
          Type de publication :
        </label>
        <div className="inline-flex bg-indigo-900/80 p-1 rounded-xl border border-indigo-800 gap-1">
          <button
            type="button"
            onClick={() => onChangeKind('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedKind === 'ALL'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            Tout voir (Offres & Demandes)
          </button>
          <button
            type="button"
            onClick={() => onChangeKind('OFFRE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedKind === 'OFFRE'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            Offres de cours (Enseignants)
          </button>
          <button
            type="button"
            onClick={() => onChangeKind('DEMANDE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedKind === 'DEMANDE'
                ? 'bg-purple-500 text-white shadow-xs'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            Demandes de cours (Parents / Élèves)
          </button>
        </div>
      </div>

      {/* 2. Subjects Sub-menu (Item 9 Requirement) */}
      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-indigo-300 mb-2">
          Matières principales :
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChangeSubject('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedSubject === 'ALL'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-800'
            }`}
          >
            Toutes les matières
          </button>

          {TUTORING_SUBJECTS.map((sub) => {
            const isSelected = selectedSubject === sub;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => onChangeSubject(sub)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 shadow-sm ring-2 ring-amber-400/30'
                    : 'bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-800'
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Level and Location filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-indigo-900/80">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
            Niveau scolaire
          </label>
          <select
            value={selectedLevel}
            onChange={(e) => onChangeLevel(e.target.value as TutoringLevel | 'ALL')}
            className="w-full bg-indigo-900/90 border border-indigo-800 text-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
          >
            <option value="ALL">Tous niveaux scolaires</option>
            {TUTORING_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
            Province
          </label>
          <select
            value={selectedProvince}
            onChange={(e) => {
              onChangeProvince(e.target.value);
              onChangeCity('');
            }}
            className="w-full bg-indigo-900/90 border border-indigo-800 text-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
          >
            <option value="">Toutes les provinces (9)</option>
            {GABON_PROVINCES.map((p) => (
              <option key={p.code} value={p.name}>
                {p.name} ({p.capital})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
            Ville / Localité
          </label>
          <select
            value={selectedCity}
            onChange={(e) => onChangeCity(e.target.value)}
            disabled={!selectedProvince}
            className="w-full bg-indigo-900/90 border border-indigo-800 text-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden disabled:opacity-40"
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
