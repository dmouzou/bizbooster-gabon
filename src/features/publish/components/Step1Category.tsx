import React, { useMemo } from 'react';
import {
  Building2,
  Car,
  Package,
  Briefcase,
  GraduationCap,
  Heart,
  Search,
  UserCheck,
  PartyPopper,
  DollarSign,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { MainCategory, TransactionType, UserProfile } from '../../../types';
import { GABON_PROVINCES } from '../../../data/gabonLocations';

interface Step1CategoryProps {
  mainCategory: MainCategory;
  onMainCategoryChange: (cat: MainCategory) => void;
  transactionType: TransactionType;
  onTransactionTypeChange: (type: TransactionType) => void;
  province: string;
  onProvinceChange: (province: string) => void;
  city: string;
  onCityChange: (city: string) => void;
  neighborhood: string;
  onNeighborhoodChange: (neighborhood: string) => void;
  saveNeighborhoodToProfile: boolean;
  onSaveNeighborhoodToProfileChange: (save: boolean) => void;
  currentUser?: UserProfile | null;
  simultaneousAdsCount: number;
  maxQuota: number;
  isUltimateCeilingReached: boolean;
  requiresSubscription: boolean;
  error?: string | null;
}

export const Step1Category: React.FC<Step1CategoryProps> = ({
  mainCategory,
  onMainCategoryChange,
  transactionType,
  onTransactionTypeChange,
  province,
  onProvinceChange,
  city,
  onCityChange,
  neighborhood,
  onNeighborhoodChange,
  saveNeighborhoodToProfile,
  onSaveNeighborhoodToProfileChange,
  currentUser,
  simultaneousAdsCount,
  maxQuota,
  isUltimateCeilingReached,
  requiresSubscription,
  error,
}) => {
  const profileNeighborhood = currentUser?.location?.neighborhood?.trim() || '';
  const profileProvince = currentUser?.location?.province?.trim() || '';
  const profileCity = currentUser?.location?.city?.trim() || '';

  const currentProvinceData = useMemo(() => {
    return GABON_PROVINCES.find((p) => p.name === province) || GABON_PROVINCES[0];
  }, [province]);

  const currentCityData = useMemo(() => {
    return currentProvinceData.cities.find((c) => c.name === city) || currentProvinceData.cities[0];
  }, [currentProvinceData, city]);

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Quota & Ceiling Alert */}
      {isUltimateCeilingReached ? (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-black text-red-900 uppercase">
              Plafond maximal atteint (10 / 10 annonces actives)
            </p>
            <p className="text-red-700 mt-1 leading-relaxed">
              Conformément aux règles de diffusion BIZBOOSTER Gabon, chaque annonceur est soumis au plafond maximal de 10 annonces simultanées en cours.
              Veuillez attendre l'expiration d'une annonce ou en supprimer une depuis votre espace pour déposer une nouvelle offre.
            </p>
          </div>
        </div>
      ) : requiresSubscription ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-black text-amber-900 uppercase">
              Limite de {maxQuota} annonce{maxQuota > 1 ? 's' : ''} atteinte ({simultaneousAdsCount} actives)
            </p>
            <p className="text-amber-800 mt-1 leading-relaxed">
              Pour afficher plus de {maxQuota} annonces simultanément, vous devez passer à un forfait supérieur (Pro : jusqu'à 4, Élite : jusqu'à 7 ou Business : jusqu'à 10). Vous pourrez choisir votre formule à l'étape suivante.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-semibold">
            Vos annonces simultanées en cours :
          </span>
          <span className="font-extrabold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
            {simultaneousAdsCount} / {maxQuota} max {currentUser?.subscriptionTier ? `(${currentUser.subscriptionTier})` : '(Standard)'}
          </span>
        </div>
      )}

      {/* Category Selector */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
          Choisissez la catégorie principale
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => onMainCategoryChange('IMMOBILIER')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer min-h-[56px] ${
              mainCategory === 'IMMOBILIER'
                ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400 text-emerald-950 font-black'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
            }`}
          >
            <Building2 className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
            <span className="text-xs block">IMMOBILIER</span>
          </button>

          <button
            type="button"
            onClick={() => onMainCategoryChange('MATERIEL_ROULANT')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer min-h-[56px] ${
              mainCategory === 'MATERIEL_ROULANT'
                ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-400 text-blue-950 font-black'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
            }`}
          >
            <Car className="w-5 h-5 mx-auto mb-1 text-blue-600" />
            <span className="text-xs block">MATÉRIEL ROULANT</span>
          </button>

          <button
            type="button"
            onClick={() => onMainCategoryChange('BRIC_A_BRAC')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer min-h-[56px] ${
              mainCategory === 'BRIC_A_BRAC'
                ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-400 text-amber-950 font-black'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
            }`}
          >
            <Package className="w-5 h-5 mx-auto mb-1 text-amber-600" />
            <span className="text-xs block">BRIC-À-BRAC</span>
          </button>

          <button
            type="button"
            onClick={() => onMainCategoryChange('EMPLOI')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer min-h-[56px] ${
              mainCategory === 'EMPLOI'
                ? 'bg-purple-50 border-purple-600 ring-2 ring-purple-400 text-purple-950 font-black'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
            }`}
          >
            <Briefcase className="w-5 h-5 mx-auto mb-1 text-purple-600" />
            <span className="text-xs block">EMPLOI MAISONS</span>
          </button>

          <button
            type="button"
            onClick={() => onMainCategoryChange('COURS_A_DOMICILE')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer min-h-[56px] ${
              mainCategory === 'COURS_A_DOMICILE'
                ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-400 text-indigo-950 font-black'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
            }`}
          >
            <GraduationCap className="w-5 h-5 mx-auto mb-1 text-indigo-600" />
            <span className="text-xs block">COURS À DOMICILE</span>
          </button>

          <button
            type="button"
            onClick={() => onMainCategoryChange('NECROLOGIE')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer min-h-[56px] ${
              mainCategory === 'NECROLOGIE'
                ? 'bg-slate-800 border-slate-900 ring-2 ring-slate-700 text-white font-black'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
            }`}
          >
            <Heart className="w-5 h-5 mx-auto mb-1 text-rose-500" />
            <span className="text-xs block">NÉCROLOGIE</span>
          </button>

          <button
            type="button"
            onClick={() => onMainCategoryChange('AVIS_DE_RECHERCHE')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer min-h-[56px] ${
              mainCategory === 'AVIS_DE_RECHERCHE'
                ? 'bg-red-50 border-red-600 ring-2 ring-red-400 text-red-950 font-black'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
            }`}
          >
            <Search className="w-5 h-5 mx-auto mb-1 text-red-600" />
            <span className="text-xs block">AVIS DE RECHERCHE</span>
          </button>

          <button
            type="button"
            onClick={() => onMainCategoryChange('AUTRES_EMPLOIS')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer min-h-[56px] ${
              mainCategory === 'AUTRES_EMPLOIS'
                ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-400 text-teal-950 font-black'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
            }`}
          >
            <UserCheck className="w-5 h-5 mx-auto mb-1 text-teal-600" />
            <span className="text-xs block">AUTRES EMPLOIS</span>
          </button>

          <button
            type="button"
            onClick={() => onMainCategoryChange('EVENEMENTS')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer min-h-[56px] col-span-2 sm:col-span-1 ${
              mainCategory === 'EVENEMENTS'
                ? 'bg-fuchsia-50 border-fuchsia-600 ring-2 ring-fuchsia-400 text-fuchsia-950 font-black'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
            }`}
          >
            <PartyPopper className="w-5 h-5 mx-auto mb-1 text-fuchsia-600" />
            <span className="text-xs block">ÉVÉNEMENTS</span>
          </button>
        </div>
      </div>

      {/* Vente vs Location pour Immobilier & Matériel Roulant */}
      {(mainCategory === 'IMMOBILIER' || mainCategory === 'MATERIEL_ROULANT') && (
        <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
              Détail obligatoire
            </span>
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
              Précisez la nature de votre transaction : Vendez-vous ou Louez-vous ?
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              type="button"
              onClick={() => onTransactionTypeChange('VENTE')}
              className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all font-black text-xs cursor-pointer min-h-[48px] ${
                transactionType === 'VENTE'
                  ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-amber-50/40'
              }`}
              id="publish-trans-vente"
            >
              <DollarSign className="w-4 h-4" />
              <span>JE VENDS MON BIEN (Vente)</span>
            </button>

            <button
              type="button"
              onClick={() => onTransactionTypeChange('LOCATION')}
              className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all font-black text-xs cursor-pointer min-h-[48px] ${
                transactionType === 'LOCATION'
                  ? 'bg-emerald-600 border-emerald-700 text-white shadow-md ring-2 ring-emerald-400/50'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-emerald-50/40'
              }`}
              id="publish-trans-location"
            >
              <Building2 className="w-4 h-4" />
              <span>JE LOUE MON BIEN (Location)</span>
            </button>
          </div>
        </div>
      )}

      {/* Localisation spatiale au Gabon */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
              Localisation spatiale au Gabon (9 Provinces)
            </span>
          </div>
          <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
            Quartier détaillé
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              1. Province du Gabon *
            </label>
            <select
              value={province}
              onChange={(e) => {
                const newProv = e.target.value;
                onProvinceChange(newProv);
                const pObj = GABON_PROVINCES.find((p) => p.name === newProv);
                if (pObj && pObj.cities.length > 0) {
                  onCityChange(pObj.cities[0].name);
                  onNeighborhoodChange(pObj.cities[0].neighborhoods[0] || '');
                }
              }}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
              id="publish-province-select"
            >
              {GABON_PROVINCES.map((p) => (
                <option key={p.code} value={p.name}>
                  {p.name} ({p.capital})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              2. Ville / Commune *
            </label>
            <select
              value={city}
              onChange={(e) => {
                const newCity = e.target.value;
                onCityChange(newCity);
                const cObj = currentProvinceData.cities.find((c) => c.name === newCity);
                if (cObj && cObj.neighborhoods.length > 0) {
                  onNeighborhoodChange(cObj.neighborhoods[0]);
                }
              }}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
              id="publish-city-select"
            >
              {currentProvinceData.cities.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quartier Détaillé */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-700">
              3. Quartier / Précision du secteur *
            </label>
            <span className="text-[10px] text-slate-400">
              Tapez librement pour détailler votre quartier
            </span>
          </div>

          {/* Profil quartier par défaut */}
          {profileNeighborhood ? (
            <div className="mb-2 p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[11px] text-emerald-950 truncate">
                  Quartier habituel de votre profil : <strong>{profileNeighborhood}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onNeighborhoodChange(profileNeighborhood);
                  if (profileProvince) onProvinceChange(profileProvince);
                  if (profileCity) onCityChange(profileCity);
                }}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 min-h-[36px] ${
                  neighborhood.trim().toLowerCase() === profileNeighborhood.toLowerCase()
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                {neighborhood.trim().toLowerCase() === profileNeighborhood.toLowerCase() ? '✓ Quartier actif' : 'Utiliser ce quartier'}
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer mb-2 min-h-[32px]">
              <input
                type="checkbox"
                checked={saveNeighborhoodToProfile}
                onChange={(e) => onSaveNeighborhoodToProfileChange(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Enregistrer ce quartier comme quartier par défaut dans mon profil</span>
            </label>
          )}

          <div className="relative">
            <input
              type="text"
              list="publish-neighborhood-suggestions"
              value={neighborhood}
              onChange={(e) => onNeighborhoodChange(e.target.value)}
              placeholder="Ex: Louis, Angondjé (Carrefour GP), Nzeng-Ayong, Oloumi..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400 min-h-[44px]"
              id="publish-neighborhood-input"
              required
            />
            <datalist id="publish-neighborhood-suggestions">
              {currentCityData.neighborhoods.map((q) => (
                <option key={q} value={q} />
              ))}
            </datalist>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-2 bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-800"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {currentCityData.neighborhoods.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-slate-400 font-semibold mr-1">Suggestions rapides :</span>
              {currentCityData.neighborhoods.slice(0, 6).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onNeighborhoodChange(q)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-all cursor-pointer min-h-[28px] ${
                    neighborhood === q
                      ? 'bg-emerald-600 text-white border-emerald-700 font-bold'
                      : 'bg-white hover:bg-emerald-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

