import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Check, Sparkles } from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';
import {
  MainCategory,
  TransactionType,
  PropertyType,
  RollingStockCategory,
  JobAdKind,
  TutoringAdKind,
  TutoringSubject,
  TutoringLevel,
  NecrologieMinistry,
} from '../types';
import { GABON_PROVINCES } from '../data/gabonLocations';
import {
  PROPERTY_TYPES,
  DOMESTIC_JOB_TYPES,
  NECROLOGIE_MINISTRIES,
  TUTORING_SUBJECTS,
  TUTORING_LEVELS,
  AVIS_RECHERCHE_CATEGORIES,
  AUTRES_EMPLOIS_SUBCATEGORIES,
  EVENT_TYPES,
} from '../data/categoriesData';
import { CAR_BRANDS_AND_MODELS } from '../data/vehiclesData';

export interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeCategory: MainCategory | 'ALL';
  resultsCount: number;

  // Immobilier
  immoTransaction: TransactionType | 'ALL';
  onChangeImmoTransaction: (t: TransactionType | 'ALL') => void;
  immoPropertyType: PropertyType | 'ALL';
  onChangeImmoPropertyType: (p: PropertyType | 'ALL') => void;
  immoProvince: string;
  onChangeImmoProvince: (p: string) => void;
  immoCity: string;
  onChangeImmoCity: (c: string) => void;
  immoNeighborhood: string;
  onChangeImmoNeighborhood: (n: string) => void;

  // Matériel Roulant
  vehicleSubcategory: RollingStockCategory | 'ALL';
  onChangeVehicleSubcategory: (s: RollingStockCategory | 'ALL') => void;
  vehicleBrand: string;
  onChangeVehicleBrand: (b: string) => void;
  vehicleModel: string;
  onChangeVehicleModel: (m: string) => void;
  vehicleTransaction: TransactionType | 'ALL';
  onChangeVehicleTransaction: (t: TransactionType | 'ALL') => void;

  // Emploi
  emploiJobKind: JobAdKind | 'ALL';
  onChangeEmploiJobKind: (k: JobAdKind | 'ALL') => void;
  emploiJobType: string;
  onChangeEmploiJobType: (t: string) => void;
  emploiProvince: string;
  onChangeEmploiProvince: (p: string) => void;
  emploiCity: string;
  onChangeEmploiCity: (c: string) => void;

  // Cours à domicile
  tutoringKind: TutoringAdKind | 'ALL';
  onChangeTutoringKind: (k: TutoringAdKind | 'ALL') => void;
  tutoringSubject: TutoringSubject | 'ALL';
  onChangeTutoringSubject: (s: TutoringSubject | 'ALL') => void;
  tutoringLevel: TutoringLevel | 'ALL';
  onChangeTutoringLevel: (l: TutoringLevel | 'ALL') => void;
  tutoringProvince: string;
  onChangeTutoringProvince: (p: string) => void;
  tutoringCity: string;
  onChangeTutoringCity: (c: string) => void;

  // Nécrologie
  necroMinistry: NecrologieMinistry | 'ALL';
  onChangeNecroMinistry: (m: NecrologieMinistry | 'ALL') => void;

  // Avis de recherche
  avisFilterCategory: string;
  onChangeAvisFilterCategory: (c: string) => void;

  // Autres Emplois
  autresEmploisFilterSub: string;
  onChangeAutresEmploisFilterSub: (s: string) => void;

  // Événements
  eventFilterType: string;
  onChangeEventFilterType: (t: string) => void;

  // Global / All
  globalTransaction: TransactionType | 'ALL';
  onChangeGlobalTransaction: (t: TransactionType | 'ALL') => void;
  isVipCornerActive: boolean;
  onToggleVipCorner: () => void;

  // Reset
  onResetAllFilters: () => void;
}

const VEHICLE_SUBCATEGORIES: RollingStockCategory[] = [
  'Voitures',
  'Camions Bennes',
  'Camions Citernes',
  'Engins de chantiers',
  'Motos',
  'Vélos',
];

const FilterSection: React.FC<{
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, defaultOpen = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 pb-4 pt-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-800 py-1.5 cursor-pointer select-none"
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>
      {isOpen && <div className="pt-2 space-y-3">{children}</div>}
    </div>
  );
};

export const FilterSheet: React.FC<FilterSheetProps> = ({
  isOpen,
  onClose,
  activeCategory,
  resultsCount,
  immoTransaction,
  onChangeImmoTransaction,
  immoPropertyType,
  onChangeImmoPropertyType,
  immoProvince,
  onChangeImmoProvince,
  immoCity,
  onChangeImmoCity,
  immoNeighborhood,
  onChangeImmoNeighborhood,
  vehicleSubcategory,
  onChangeVehicleSubcategory,
  vehicleBrand,
  onChangeVehicleBrand,
  vehicleModel,
  onChangeVehicleModel,
  vehicleTransaction,
  onChangeVehicleTransaction,
  emploiJobKind,
  onChangeEmploiJobKind,
  emploiJobType,
  onChangeEmploiJobType,
  emploiProvince,
  onChangeEmploiProvince,
  emploiCity,
  onChangeEmploiCity,
  tutoringKind,
  onChangeTutoringKind,
  tutoringSubject,
  onChangeTutoringSubject,
  tutoringLevel,
  onChangeTutoringLevel,
  tutoringProvince,
  onChangeTutoringProvince,
  tutoringCity,
  onChangeTutoringCity,
  necroMinistry,
  onChangeNecroMinistry,
  avisFilterCategory,
  onChangeAvisFilterCategory,
  autresEmploisFilterSub,
  onChangeAutresEmploisFilterSub,
  eventFilterType,
  onChangeEventFilterType,
  globalTransaction,
  onChangeGlobalTransaction,
  isVipCornerActive,
  onToggleVipCorner,
  onResetAllFilters,
}) => {
  // Cascading locations for Immobilier
  const immoAvailableCities = useMemo(() => {
    if (!immoProvince) return [];
    return GABON_PROVINCES.find((p) => p.name === immoProvince)?.cities || [];
  }, [immoProvince]);

  const immoAvailableNeighborhoods = useMemo(() => {
    if (!immoCity) return [];
    return (
      immoAvailableCities.find((c) => c.name === immoCity)?.neighborhoods || []
    );
  }, [immoCity, immoAvailableCities]);

  // Available models for vehicle brand
  const vehicleAvailableModels = useMemo(() => {
    if (!vehicleBrand) return [];
    const brandData = CAR_BRANDS_AND_MODELS.find((b) => b.brand === vehicleBrand);
    return brandData ? brandData.models : [];
  }, [vehicleBrand]);

  const footer = (
    <div className="flex items-center gap-3 w-full">
      <Button
        variant="outline"
        size="md"
        onClick={onResetAllFilters}
        className="shrink-0"
      >
        <RotateCcw className="w-4 h-4 mr-1 text-slate-600" />
        <span>Réinitialiser</span>
      </Button>

      <Button
        variant="primary"
        size="md"
        fullWidth
        onClick={onClose}
        className="flex-1 shadow-sm font-bold"
      >
        <span>{`Voir ${resultsCount} résultat${resultsCount > 1 ? 's' : ''}`}</span>
      </Button>
    </div>
  );

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Filtrer les annonces"
      description="Affinez votre recherche selon vos critères"
      footer={footer}
      snapPoint="full"
    >
      <div className="space-y-4 pb-4">
        {/* VIP Corner Toggle */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="text-xs font-bold text-amber-950 block">
                Coin VIP uniquement
              </span>
              <span className="text-[11px] text-amber-800">
                Annonces de standing certifiées
              </span>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isVipCornerActive}
            onClick={onToggleVipCorner}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
              isVipCornerActive ? 'bg-amber-600' : 'bg-slate-300'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                isVipCornerActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* 1. IMMOBILIER */}
        {activeCategory === 'IMMOBILIER' && (
          <>
            <FilterSection title="Transaction & Bien">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Type d'opération
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ALL', 'LOCATION', 'VENTE'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onChangeImmoTransaction(t)}
                      className={`h-11 min-h-[44px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        immoTransaction === t
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t === 'ALL' ? 'Tout' : t === 'LOCATION' ? 'À Louer' : 'À Vendre'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Type de bien
                </label>
                <select
                  value={immoPropertyType}
                  onChange={(e) =>
                    onChangeImmoPropertyType(e.target.value as PropertyType | 'ALL')
                  }
                  className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">Tous les types de biens</option>
                  {PROPERTY_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </div>
            </FilterSection>

            <FilterSection title="Localisation au Gabon">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Province
                </label>
                <select
                  value={immoProvince}
                  onChange={(e) => {
                    onChangeImmoProvince(e.target.value);
                    onChangeImmoCity('');
                    onChangeImmoNeighborhood('');
                  }}
                  className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Toutes les 9 provinces</option>
                  {GABON_PROVINCES.map((p) => (
                    <option key={p.code} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {immoProvince && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Ville
                  </label>
                  <select
                    value={immoCity}
                    onChange={(e) => {
                      onChangeImmoCity(e.target.value);
                      onChangeImmoNeighborhood('');
                    }}
                    className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Toutes les villes</option>
                    {immoAvailableCities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {immoCity && immoAvailableNeighborhoods.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Quartier
                  </label>
                  <select
                    value={immoNeighborhood}
                    onChange={(e) => onChangeImmoNeighborhood(e.target.value)}
                    className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Tous les quartiers</option>
                    {immoAvailableNeighborhoods.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </FilterSection>
          </>
        )}

        {/* 2. MATERIEL ROULANT */}
        {activeCategory === 'MATERIEL_ROULANT' && (
          <>
            <FilterSection title="Catégorie & Transaction">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sous-catégorie
                </label>
                <select
                  value={vehicleSubcategory}
                  onChange={(e) =>
                    onChangeVehicleSubcategory(
                      e.target.value as RollingStockCategory | 'ALL'
                    )
                  }
                  className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">Tous les véhicules et engins</option>
                  {VEHICLE_SUBCATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Type d'opération
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ALL', 'VENTE', 'LOCATION'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onChangeVehicleTransaction(t)}
                      className={`h-11 min-h-[44px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        vehicleTransaction === t
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t === 'ALL' ? 'Tout' : t === 'LOCATION' ? 'À Louer' : 'À Vendre'}
                    </button>
                  ))}
                </div>
              </div>
            </FilterSection>

            <FilterSection title="Marque & Modèle">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Marque
                </label>
                <select
                  value={vehicleBrand}
                  onChange={(e) => {
                    onChangeVehicleBrand(e.target.value);
                    onChangeVehicleModel('');
                  }}
                  className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Toutes les marques</option>
                  {CAR_BRANDS_AND_MODELS.map((b) => (
                    <option key={b.brand} value={b.brand}>
                      {b.brand}
                    </option>
                  ))}
                </select>
              </div>

              {vehicleBrand && vehicleAvailableModels.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Modèle
                  </label>
                  <select
                    value={vehicleModel}
                    onChange={(e) => onChangeVehicleModel(e.target.value)}
                    className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Tous les modèles</option>
                    {vehicleAvailableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </FilterSection>
          </>
        )}

        {/* 3. EMPLOI */}
        {activeCategory === 'EMPLOI' && (
          <FilterSection title="Offre / Demande & Métier">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Type d'annonce
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['ALL', 'OFFRE_EMPLOI', 'DEMANDE_EMPLOI'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onChangeEmploiJobKind(k)}
                    className={`h-11 min-h-[44px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      emploiJobKind === k
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {k === 'ALL'
                      ? 'Tout'
                      : k === 'OFFRE_EMPLOI'
                      ? 'Offres d\'emploi'
                      : 'Demandeurs'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Secteur ou métier
              </label>
              <select
                value={emploiJobType}
                onChange={(e) => onChangeEmploiJobType(e.target.value)}
                className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Tous les métiers domestiques</option>
                {DOMESTIC_JOB_TYPES.map((job) => (
                  <option key={job} value={job}>
                    {job}
                  </option>
                ))}
              </select>
            </div>
          </FilterSection>
        )}

        {/* 4. COURS A DOMICILE */}
        {activeCategory === 'COURS_A_DOMICILE' && (
          <FilterSection title="Cours & Niveau">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['ALL', 'OFFRE', 'DEMANDE'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onChangeTutoringKind(k)}
                    className={`h-11 min-h-[44px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      tutoringKind === k
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {k === 'ALL' ? 'Tout' : k === 'OFFRE' ? 'Propose des cours' : 'Cherche des cours'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Matière
              </label>
              <select
                value={tutoringSubject}
                onChange={(e) =>
                  onChangeTutoringSubject(e.target.value as TutoringSubject | 'ALL')
                }
                className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Toutes les matières</option>
                {TUTORING_SUBJECTS.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Niveau scolaire
              </label>
              <select
                value={tutoringLevel}
                onChange={(e) =>
                  onChangeTutoringLevel(e.target.value as TutoringLevel | 'ALL')
                }
                className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Tous les niveaux scolaires</option>
                {TUTORING_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </FilterSection>
        )}

        {/* 5. NECROLOGIE */}
        {activeCategory === 'NECROLOGIE' && (
          <FilterSection title="Ministère / Corps de rattachement">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Ministère ou corporation
              </label>
              <select
                value={necroMinistry}
                onChange={(e) =>
                  onChangeNecroMinistry(e.target.value as NecrologieMinistry | 'ALL')
                }
                className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Tous les ministères et corps</option>
                {NECROLOGIE_MINISTRIES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </FilterSection>
        )}

        {/* 6. AVIS DE RECHERCHE */}
        {activeCategory === 'AVIS_DE_RECHERCHE' && (
          <FilterSection title="Catégorie d'avis">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Type de signalement
              </label>
              <select
                value={avisFilterCategory}
                onChange={(e) => onChangeAvisFilterCategory(e.target.value)}
                className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Tous les avis de recherche</option>
                {AVIS_RECHERCHE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </FilterSection>
        )}

        {/* 7. AUTRES EMPLOIS */}
        {activeCategory === 'AUTRES_EMPLOIS' && (
          <FilterSection title="Métier">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Sous-catégorie
              </label>
              <select
                value={autresEmploisFilterSub}
                onChange={(e) => onChangeAutresEmploisFilterSub(e.target.value)}
                className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Toutes les activités professionnelles</option>
                {AUTRES_EMPLOIS_SUBCATEGORIES.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </FilterSection>
        )}

        {/* 8. EVENEMENTS */}
        {activeCategory === 'EVENEMENTS' && (
          <FilterSection title="Type d'événement">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nature de l'événement
              </label>
              <select
                value={eventFilterType}
                onChange={(e) => onChangeEventFilterType(e.target.value)}
                className="w-full h-11 min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Tous les événements</option>
                {EVENT_TYPES.map((evt) => (
                  <option key={evt} value={evt}>
                    {evt}
                  </option>
                ))}
              </select>
            </div>
          </FilterSection>
        )}

        {/* 9. TOUT (Global) */}
        {activeCategory === 'ALL' && (
          <FilterSection title="Transaction Générale">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Type d'opération
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['ALL', 'LOCATION', 'VENTE'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChangeGlobalTransaction(t)}
                    className={`h-11 min-h-[44px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      globalTransaction === t
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'ALL' ? 'Tout' : t === 'LOCATION' ? 'À Louer' : 'À Vendre'}
                  </button>
                ))}
              </div>
            </div>
          </FilterSection>
        )}
      </div>
    </Sheet>
  );
};
