import React, { useMemo, useState } from 'react';
import { MapPin, Home, Tag, RotateCcw, Check, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { GABON_PROVINCES } from '../data/gabonLocations';
import { PROPERTY_TYPES } from '../data/categoriesData';
import { PropertyType, TransactionType } from '../types';

interface ImmobilierFilterBarProps {
  // Support both prop naming styles
  province?: string;
  selectedProvince?: string;
  setProvince?: (province: string) => void;
  onChangeProvince?: (province: string) => void;

  city?: string;
  selectedCity?: string;
  setCity?: (city: string) => void;
  onChangeCity?: (city: string) => void;

  neighborhood?: string;
  selectedNeighborhood?: string;
  setNeighborhood?: (neighborhood: string) => void;
  onChangeNeighborhood?: (neighborhood: string) => void;

  transactionType?: TransactionType | 'ALL';
  selectedTransaction?: TransactionType | 'ALL';
  setTransactionType?: (type: TransactionType | 'ALL') => void;
  onChangeTransaction?: (type: TransactionType | 'ALL') => void;

  propertyType?: PropertyType | 'ALL';
  selectedPropertyType?: PropertyType | 'ALL';
  setPropertyType?: (type: PropertyType | 'ALL') => void;
  onChangePropertyType?: (type: PropertyType | 'ALL') => void;

  onReset?: () => void;
  onResetFilters?: () => void;
}

export const ImmobilierFilterBar: React.FC<ImmobilierFilterBarProps> = (props) => {
  const selectedProvince = props.selectedProvince ?? props.province ?? '';
  const onChangeProvince = props.onChangeProvince ?? props.setProvince ?? (() => {});

  const selectedCity = props.selectedCity ?? props.city ?? '';
  const onChangeCity = props.onChangeCity ?? props.setCity ?? (() => {});

  const selectedNeighborhood = props.selectedNeighborhood ?? props.neighborhood ?? '';
  const onChangeNeighborhood = props.onChangeNeighborhood ?? props.setNeighborhood ?? (() => {});

  const selectedTransaction = props.selectedTransaction ?? props.transactionType ?? 'ALL';
  const onChangeTransaction = props.onChangeTransaction ?? props.setTransactionType ?? (() => {});

  const selectedPropertyType = props.selectedPropertyType ?? props.propertyType ?? 'ALL';
  const onChangePropertyType = props.onChangePropertyType ?? props.setPropertyType ?? (() => {});

  const onResetFilters = props.onResetFilters ?? props.onReset ?? (() => {});

  // Find current province object to get list of cities (case-insensitive match)
  const currentProvinceObj = useMemo(() => {
    if (!selectedProvince) return undefined;
    return GABON_PROVINCES.find(
      (p) => p.name.toLowerCase() === selectedProvince.toLowerCase() || p.name === selectedProvince
    );
  }, [selectedProvince]);

  // Find current city object to get list of neighborhoods (case-insensitive match)
  const currentCityObj = useMemo(() => {
    if (!currentProvinceObj || !selectedCity) return undefined;
    return currentProvinceObj.cities.find(
      (c) => c.name.toLowerCase() === selectedCity.toLowerCase() || c.name === selectedCity
    );
  }, [currentProvinceObj, selectedCity]);

  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const hasActiveFilters =
    selectedProvince !== '' ||
    selectedCity !== '' ||
    selectedNeighborhood !== '' ||
    selectedTransaction !== 'ALL' ||
    selectedPropertyType !== 'ALL';

  const hasActiveSpatialFilters = Boolean(
    selectedProvince || selectedCity || selectedNeighborhood || selectedPropertyType !== 'ALL'
  );

  return (
    <div className="bg-emerald-950 text-white rounded-2xl p-4 sm:p-5 mb-6 shadow-lg border border-emerald-800">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-emerald-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-600 text-amber-300 font-black text-xs px-2 py-0.5 rounded-sm uppercase tracking-wider">
              Rubriques Spatiales
            </span>
            <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
              Filtre Spécifique Immobilier au Gabon
            </h3>
          </div>
          <p className="text-xs text-emerald-300 mt-1">
            Sélectionnez directement votre province, ville et quartier pour cibler sans perdre de temps.
          </p>
        </div>

        {/* Transaction Type Segmented Toggle: VENTE vs LOCATION (Crucial prompt requirement) */}
        <div className="flex items-center bg-emerald-900/90 p-1 rounded-xl border border-emerald-700/80 self-stretch sm:self-auto">
          <button
            onClick={() => onChangeTransaction('ALL')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedTransaction === 'ALL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-200 hover:text-white'
            }`}
            id="filter-transaction-all"
          >
            Tous
          </button>
          <button
            onClick={() => onChangeTransaction('VENTE')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedTransaction === 'VENTE'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-amber-300 hover:text-white'
            }`}
            id="filter-transaction-vente"
          >
            {selectedTransaction === 'VENTE' && <Check className="w-3.5 h-3.5" />}
            À VENDRE (Achat)
          </button>
          <button
            onClick={() => onChangeTransaction('LOCATION')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedTransaction === 'LOCATION'
                ? 'bg-emerald-400 text-emerald-950 shadow-xs'
                : 'text-emerald-200 hover:text-white'
            }`}
            id="filter-transaction-location"
          >
            {selectedTransaction === 'LOCATION' && <Check className="w-3.5 h-3.5" />}
            À LOUER (Location)
          </button>
        </div>
      </div>

      {/* Mobile Toggle Button */}
      <div className="lg:hidden pt-3">
        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
          className="w-full flex items-center justify-between bg-emerald-900/90 border border-emerald-700/80 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Filtres localisation & types de bien</span>
            {hasActiveSpatialFilters && (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {selectedCity || selectedProvince || 'Filtres actifs'}
              </span>
            )}
          </div>
          {isMobileFiltersOpen ? <ChevronUp className="w-4 h-4 text-emerald-300" /> : <ChevronDown className="w-4 h-4 text-emerald-300" />}
        </button>
      </div>

      {/* Spatial Cascading Dropdowns: Province -> Ville -> Quartier + Type de bien */}
      <div className={`${isMobileFiltersOpen || hasActiveSpatialFilters ? 'grid' : 'hidden lg:grid'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4`}>
        {/* 1. Province (9 options Gabon) */}
        <div>
          <label className="block text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            1. Province (9 provinces)
          </label>
          <select
            value={selectedProvince}
            onChange={(e) => {
              onChangeProvince(e.target.value);
              onChangeCity('');
              onChangeNeighborhood('');
            }}
            className="w-full bg-emerald-900 border border-emerald-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            id="filter-province-select"
          >
            <option value="">Toutes les 9 provinces</option>
            {GABON_PROVINCES.map((p) => (
              <option key={p.code} value={p.name}>
                {p.name} ({p.capital})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Ville / Localité */}
        <div>
          <label className="block text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            2. Ville / Localité
          </label>
          <select
            value={selectedCity}
            onChange={(e) => {
              onChangeCity(e.target.value);
              onChangeNeighborhood('');
            }}
            disabled={!selectedProvince}
            className={`w-full rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${
              selectedProvince
                ? 'bg-emerald-900 border-emerald-700 text-white focus:ring-2 focus:ring-amber-400'
                : 'bg-emerald-900/40 border-emerald-800 text-emerald-400/50 cursor-not-allowed'
            }`}
            id="filter-city-select"
          >
            <option value="">
              {selectedProvince ? 'Toutes les villes de la province' : '← Choisissez d\'abord une province'}
            </option>
            {currentProvinceObj?.cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.neighborhoods.length} quartiers)
              </option>
            ))}
          </select>
        </div>

        {/* 3. Quartier */}
        <div>
          <label className="block text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            3. Quartier
          </label>
          <select
            value={selectedNeighborhood}
            onChange={(e) => onChangeNeighborhood(e.target.value)}
            disabled={!selectedCity}
            className={`w-full rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${
              selectedCity
                ? 'bg-emerald-900 border-emerald-700 text-white focus:ring-2 focus:ring-amber-400'
                : 'bg-emerald-900/40 border-emerald-800 text-emerald-400/50 cursor-not-allowed'
            }`}
            id="filter-neighborhood-select"
          >
            <option value="">
              {selectedCity ? 'Tous les quartiers' : '← Choisissez d\'abord une ville'}
            </option>
            {currentCityObj?.neighborhoods.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Type de bien */}
        <div>
          <label className="block text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Home className="w-3.5 h-3.5 text-amber-400" />
            Type de Bien
          </label>
          <div className="flex gap-2">
            <select
              value={selectedPropertyType}
              onChange={(e) => onChangePropertyType(e.target.value as PropertyType | 'ALL')}
              className="flex-1 bg-emerald-900 border border-emerald-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-400"
              id="filter-property-type-select"
            >
              <option value="ALL">Tous types (Villa, Terrain...)</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={onResetFilters}
                className="bg-emerald-800 hover:bg-emerald-700 text-emerald-200 hover:text-white px-2.5 py-2 rounded-xl text-xs flex items-center gap-1 transition-colors shrink-0"
                title="Réinitialiser les filtres"
                id="reset-immo-filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
