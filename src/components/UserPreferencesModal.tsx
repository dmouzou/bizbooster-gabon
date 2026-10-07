import React, { useState, useEffect } from 'react';
import { Sparkles, Check, X, Building2, Car, Package, Briefcase, GraduationCap, Heart, Search, UserCheck, MapPin } from 'lucide-react';
import { MainCategory } from '../types';
import { GABON_PROVINCES } from '../data/gabonLocations';

export interface UserPreferences {
  preferredCategories: MainCategory[];
  preferredProvinces: string[];
  configuredAt?: string;
}

interface UserPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePreferences: (prefs: UserPreferences) => void;
}

const CATEGORY_CHOICES: { id: MainCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'IMMOBILIER', label: 'Immobilier (Vente & Location)', icon: <Building2 className="w-4 h-4" /> },
  { id: 'MATERIEL_ROULANT', label: 'Véhicules & Matériel Roulant', icon: <Car className="w-4 h-4" /> },
  { id: 'EMPLOI', label: 'Emploi & Métiers de maison', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'AUTRES_EMPLOIS', label: 'Autres Emplois (Offres & CV)', icon: <UserCheck className="w-4 h-4" /> },
  { id: 'BRIC_A_BRAC', label: 'Bric-à-Brac & Équipements', icon: <Package className="w-4 h-4" /> },
  { id: 'COURS_A_DOMICILE', label: 'Cours à Domicile', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'NECROLOGIE', label: 'Avis d’Obsèques & Nécrologie', icon: <Heart className="w-4 h-4" /> },
  { id: 'AVIS_DE_RECHERCHE', label: 'Avis de Recherche & Vigilance', icon: <Search className="w-4 h-4" /> },
];

export const UserPreferencesModal: React.FC<UserPreferencesModalProps> = ({
  isOpen,
  onClose,
  onSavePreferences,
}) => {
  const [selectedCats, setSelectedCats] = useState<MainCategory[]>(['IMMOBILIER', 'MATERIEL_ROULANT']);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>(['Estuaire']);

  if (!isOpen) return null;

  const toggleCategory = (catId: MainCategory) => {
    setSelectedCats((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const toggleProvince = (provName: string) => {
    setSelectedProvinces((prev) =>
      prev.includes(provName) ? prev.filter((p) => p !== provName) : [...prev, provName]
    );
  };

  const handleSave = () => {
    const prefs: UserPreferences = {
      preferredCategories: selectedCats,
      preferredProvinces: selectedProvinces,
      configuredAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem('bizbooster_user_preferences', JSON.stringify(prefs));
    } catch (_) {}
    onSavePreferences(prefs);
    onClose();
  };

  const handleSkip = () => {
    try {
      localStorage.setItem('bizbooster_user_preferences_skipped', 'true');
    } catch (_) {}
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pref-modal-title"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[90dvh] sm:max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header - Fixed at top */}
        <div className="shrink-0 p-4 sm:p-6 pb-3 border-b border-slate-100 flex items-start justify-between gap-3 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Bienvenue sur BizBooster Gabon
              </span>
              <h2 id="pref-modal-title" className="text-base sm:text-lg font-black text-slate-900 mt-0.5 sm:mt-1">
                Personnalisez vos annonces
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Fermer ou passer cette étape"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
          <p className="text-xs text-slate-600 leading-relaxed">
            Pour une expérience sur-mesure dès votre première visite, sélectionnez vos centres d'intérêt. Nous afficherons en priorité les annonces qui correspondent le mieux à vos besoins.
          </p>

          {/* Section 1: Catégories préférées */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              1. Catégories qui vous intéressent :
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORY_CHOICES.map((cat) => {
                const isChecked = selectedCats.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-400/50 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                        isChecked
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-slate-500 shrink-0">{cat.icon}</span>
                      <span className="truncate">{cat.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Provinces préférées */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>2. Votre province principale (Optionnel) :</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GABON_PROVINCES.map((prov) => {
                const isChecked = selectedProvinces.includes(prov.name);
                return (
                  <button
                    key={prov.code}
                    type="button"
                    onClick={() => toggleProvince(prov.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    {prov.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pinned Sticky Footer - Always visible on mobile */}
        <div className="shrink-0 p-3.5 sm:p-5 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="w-full sm:flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs sm:text-sm py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            id="save-preferences-button"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Enregistrer mes préférences</span>
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer text-center"
            id="skip-preferences-button"
          >
            Passer cette étape
          </button>
        </div>
      </div>
    </div>
  );
};
