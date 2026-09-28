import React, { useMemo } from 'react';
import { Car, Wrench, Shield, Check, RotateCcw } from 'lucide-react';
import { RollingStockCategory, TransactionType } from '../types';
import {
  CAR_BRANDS_AND_MODELS,
  DUMP_TRUCK_BRANDS,
  TANKER_TRUCK_TYPES,
  HEAVY_MACHINERY_TYPES,
  MOTORBIKE_TYPES,
  BICYCLE_TYPES,
} from '../data/vehiclesData';

interface VehiclesFilterBarProps {
  // Support both prop naming conventions
  subcategory?: RollingStockCategory | 'ALL';
  selectedSubcategory?: RollingStockCategory | 'ALL';
  setSubcategory?: (sub: RollingStockCategory | 'ALL') => void;
  onChangeSubcategory?: (sub: RollingStockCategory | 'ALL') => void;

  brand?: string;
  selectedBrand?: string;
  setBrand?: (brand: string) => void;
  onChangeBrand?: (brand: string) => void;

  model?: string;
  selectedModel?: string;
  setModel?: (model: string) => void;
  onChangeModel?: (model: string) => void;

  transactionType?: TransactionType | 'ALL';
  selectedTransaction?: TransactionType | 'ALL';
  setTransactionType?: (type: TransactionType | 'ALL') => void;
  onChangeTransaction?: (type: TransactionType | 'ALL') => void;

  onReset?: () => void;
  onResetFilters?: () => void;
}

export const VehiclesFilterBar: React.FC<VehiclesFilterBarProps> = (props) => {
  const selectedSubcategory = props.selectedSubcategory ?? props.subcategory ?? 'ALL';
  const onChangeSubcategory = props.onChangeSubcategory ?? props.setSubcategory ?? (() => {});

  const selectedBrand = props.selectedBrand ?? props.brand ?? '';
  const onChangeBrand = props.onChangeBrand ?? props.setBrand ?? (() => {});

  const selectedModel = props.selectedModel ?? props.model ?? '';
  const onChangeModel = props.onChangeModel ?? props.setModel ?? (() => {});

  const selectedTransaction = props.selectedTransaction ?? props.transactionType ?? 'ALL';
  const onChangeTransaction = props.onChangeTransaction ?? props.setTransactionType ?? (() => {});

  const onResetFilters = props.onResetFilters ?? props.onReset ?? (() => {});

  const subcategories: RollingStockCategory[] = [
    'Voitures',
    'Camions Bennes',
    'Camions Citernes',
    'Engins de chantiers',
    'Motos',
    'Vélos',
  ];

  // Available models based on selected brand (for cars)
  const currentBrandModels = useMemo(() => {
    if (selectedSubcategory !== 'Voitures' || !selectedBrand) return [];
    const found = CAR_BRANDS_AND_MODELS.find(
      (b) => b.brand.toLowerCase() === selectedBrand.toLowerCase() || b.brand === selectedBrand
    );
    return found ? found.models : [];
  }, [selectedSubcategory, selectedBrand]);

  const hasActiveFilters =
    selectedSubcategory !== 'ALL' ||
    selectedBrand !== '' ||
    selectedModel !== '' ||
    selectedTransaction !== 'ALL';

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 mb-6 shadow-lg border border-slate-800">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white font-black text-xs px-2 py-0.5 rounded-sm uppercase tracking-wider">
              Parc Roulant
            </span>
            <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
              Filtre Matériel Roulant (Marques & Modèles)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Sélectionnez votre type de matériel, la marque puis le modèle exact.
          </p>
        </div>

        {/* Transaction Type: Vente vs Location (Louer une voiture / louer un engin de chantier) */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 self-stretch sm:self-auto">
          <button
            onClick={() => onChangeTransaction('ALL')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedTransaction === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
            id="filter-vehicle-trans-all"
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
            id="filter-vehicle-trans-vente"
          >
            {selectedTransaction === 'VENTE' && <Check className="w-3.5 h-3.5" />}
            Vente
          </button>
          <button
            onClick={() => onChangeTransaction('LOCATION')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedTransaction === 'LOCATION'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-emerald-300 hover:text-white'
            }`}
            id="filter-vehicle-trans-location"
          >
            {selectedTransaction === 'LOCATION' && <Check className="w-3.5 h-3.5" />}
            Location
          </button>
        </div>
      </div>

      {/* Subcategory Pills */}
      <div
        onWheel={(e) => {
          if (e.currentTarget && e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
        className="flex items-center gap-2 overflow-x-auto py-3 custom-scrollbar border-b border-slate-800/80"
      >
        <button
          onClick={() => {
            onChangeSubcategory('ALL');
            onChangeBrand('');
            onChangeModel('');
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
            selectedSubcategory === 'ALL'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Tout le matériel roulant
        </button>
        {subcategories.map((sub) => (
          <button
            key={sub}
            onClick={() => {
              onChangeSubcategory(sub);
              onChangeBrand('');
              onChangeModel('');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              selectedSubcategory === sub
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {sub}
          </button>
        ))}
      </div>

      {/* Cascading dropdowns: Marque & Modèle */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4">
        {/* Voitures: Brands & Models */}
        {selectedSubcategory === 'Voitures' && (
          <>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Car className="w-3.5 h-3.5 text-blue-400" />
                Marque Voiture (Toyota, Hyundai, Nissan...)
              </label>
              <select
                value={selectedBrand}
                onChange={(e) => {
                  onChangeBrand(e.target.value);
                  onChangeModel('');
                }}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-400"
                id="filter-car-brand"
              >
                <option value="">Toutes les marques</option>
                {CAR_BRANDS_AND_MODELS.map((b) => (
                  <option key={b.brand} value={b.brand}>
                    {b.brand}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Car className="w-3.5 h-3.5 text-blue-400" />
                Modèle (ex: Santa Fe, Hilux, Tucson...)
              </label>
              <select
                value={selectedModel}
                onChange={(e) => onChangeModel(e.target.value)}
                disabled={!selectedBrand}
                className={`w-full rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${
                  selectedBrand
                    ? 'bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-blue-400'
                    : 'bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                id="filter-car-model"
              >
                <option value="">
                  {selectedBrand ? 'Tous les modèles de la marque' : '← Choisissez une marque'}
                </option>
                {currentBrandModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Camions Bennes: Brands as per doc (IVECO, MERCEDES, HOWO, SHACMAN...) */}
        {selectedSubcategory === 'Camions Bennes' && (
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              Marque Camion Benne (Howo, Iveco, Mercedes...)
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => onChangeBrand(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Toutes les marques</option>
              {DUMP_TRUCK_BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Camions Citernes */}
        {selectedSubcategory === 'Camions Citernes' && (
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              Type de Citerne
            </label>
            <select
              value={selectedModel}
              onChange={(e) => onChangeModel(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Tous types de citernes</option>
              {TANKER_TRUCK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Engins de chantiers: Pelleteuses, Compacteurs, Nivelleuses, Chargeurs, Bulldozers... */}
        {selectedSubcategory === 'Engins de chantiers' && (
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Wrench className="w-3.5 h-3.5 text-blue-400" />
              Type d'Engin de Chantier
            </label>
            <select
              value={selectedModel}
              onChange={(e) => onChangeModel(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Tous les engins (Pelleteuse, Bulldozer...)</option>
              {HEAVY_MACHINERY_TYPES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reset button if active */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <button
              onClick={onResetFilters}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser les filtres véhicules</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
