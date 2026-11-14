import React, { useMemo } from 'react';
import {
  DollarSign,
  Clock,
  Sparkles,
  Crown,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { MainCategory, PriceUnit, TransactionType, UserProfile } from '../../../types';
import { isAdVipCornerEligible, VIP_CORNER_INFO } from '../../../utils/vipCorner';
import { formatFCFA } from '../../../utils/formatters';
import { PreviewQuoteResult } from '../../../services/singpay';

interface Step4PricingProps {
  mainCategory: MainCategory;
  transactionType: TransactionType;
  propertyType?: string;
  vehicleCategory?: string;
  price: number | '';
  onPriceChange: (val: number | '') => void;
  priceMax: number | '';
  onPriceMaxChange: (val: number | '') => void;
  priceUnit: PriceUnit;
  onPriceUnitChange: (val: PriceUnit) => void;
  durationDays: number;
  onDurationDaysChange: (val: number) => void;
  isBoostFeatured: boolean;
  onIsBoostFeaturedChange: (val: boolean) => void;
  currentUser?: UserProfile | null;
  serverQuote: PreviewQuoteResult | null;
  quoteLoading: boolean;
  quoteError: string | null;
  isExempt: boolean;
  totalBillCalculated: number;
  photoCount: number;
  hasVideo: boolean;
}

export const Step4Pricing: React.FC<Step4PricingProps> = ({
  mainCategory,
  transactionType,
  propertyType,
  vehicleCategory,
  price,
  onPriceChange,
  priceMax,
  onPriceMaxChange,
  priceUnit,
  onPriceUnitChange,
  durationDays,
  onDurationDaysChange,
  isBoostFeatured,
  onIsBoostFeaturedChange,
  currentUser,
  serverQuote,
  quoteLoading,
  quoteError,
  isExempt,
  totalBillCalculated,
  photoCount,
  hasVideo,
}) => {
  const isFreeCategory =
    mainCategory === 'NECROLOGIE' ||
    mainCategory === 'AVIS_DE_RECHERCHE' ||
    mainCategory === 'EVENEMENTS';

  const isEmploiCategory =
    mainCategory === 'EMPLOI' || mainCategory === 'AUTRES_EMPLOIS';

  const isVipEligible = useMemo(() => {
    return isAdVipCornerEligible({
      mainCategory,
      transactionType,
      price: Number(price) || 0,
      priceUnit,
      propertyType: propertyType as any,
      vehicleData: { category: vehicleCategory as any },
    });
  }, [mainCategory, transactionType, price, priceUnit, propertyType, vehicleCategory]);

  const hasFreeBoost = Boolean(
    currentUser?.freeBoostsRemaining && currentUser.freeBoostsRemaining > 0
  );

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* 1. Prix ou Salaire de l'annonce */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-600 shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            {isEmploiCategory
              ? 'Rémunération / Salaire proposé ou désiré (en FCFA)'
              : isFreeCategory
              ? "Tarification de l'annonce"
              : 'Prix du bien ou de la prestation (en FCFA)'}
          </h3>
        </div>

        {isFreeCategory ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {mainCategory === 'EVENEMENTS'
                ? "Pour les événements, l'entrée peut être gratuite (0 FCFA) ou payante selon votre billetterie."
                : "Cette catégorie d'utilité publique ne comporte pas de prix d'achat/vente (affichage gratuit)."}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {isEmploiCategory ? 'Montant minimum ou salaire *' : 'Prix en FCFA *'}
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => onPriceChange(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 250000"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                id="publish-price-input"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Période / Unité
              </label>
              <select
                value={priceUnit}
                onChange={(e) => onPriceUnitChange(e.target.value as PriceUnit)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
              >
                <option value="total">Prix total net</option>
                <option value="mois">Par mois</option>
                <option value="jour">Par jour</option>
                <option value="heure">Par heure</option>
                <option value="trimestre">Par trimestre</option>
                <option value="an">Par an</option>
              </select>
            </div>
          </div>
        )}

        {isEmploiCategory && (
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Fourchette haute / Salaire max (facultatif)
            </label>
            <input
              type="number"
              value={priceMax}
              onChange={(e) => onPriceMaxChange(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 350000"
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
            />
          </div>
        )}
      </div>

      {/* 2. Coin VIP Badge si éligible */}
      {isVipEligible && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-400 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
            <Crown className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <span className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
              Coin VIP Éligible
            </span>
            <h4 className="font-extrabold text-slate-900 mt-1">
              Votre bien intègre automatiquement le Coin VIP BIZBOOSTER !
            </h4>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              En raison de son standing élevé, cette publication bénéficiera d'une visibilité prioritaire et du badge VIP doré sans frais supplémentaires.
            </p>
          </div>
        </div>
      )}

      {/* 3. Durée de publication */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-600 shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Durée de visibilité de l'annonce
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onDurationDaysChange(15)}
            className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer min-h-[56px] ${
              durationDays === 15
                ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400 text-emerald-950 font-black'
                : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-100'
            }`}
          >
            <span className="text-sm block">15 Jours</span>
            <span className="text-[10px] text-slate-500 font-normal">Diffusion courte</span>
          </button>

          <button
            type="button"
            onClick={() => onDurationDaysChange(30)}
            className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer min-h-[56px] ${
              durationDays === 30
                ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400 text-emerald-950 font-black'
                : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-100'
            }`}
          >
            <span className="text-sm block">30 Jours (Recommandé)</span>
            <span className="text-[10px] text-slate-500 font-normal">Diffusion maximale</span>
          </button>
        </div>
      </div>

      {/* 4. Option Boost "En tête de liste" */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 block">
                Option Boost : En tête de liste (7 jours)
              </span>
              <span className="text-[11px] text-emerald-800">
                {hasFreeBoost
                  ? `Inclus dans votre formule (${currentUser?.freeBoostsRemaining} restant(s))`
                  : '+ 5 000 FCFA'}
              </span>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer min-h-[36px]">
            <input
              type="checkbox"
              checked={isBoostFeatured}
              onChange={(e) => onIsBoostFeaturedChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </div>

      {/* 5. Récapitulatif du devis officiel (Calculé par le serveur) */}
      <div className="bg-emerald-950 text-white rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-emerald-300 font-bold uppercase tracking-wider">
            Montant total à régler
          </span>
          {quoteLoading && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
        </div>

        {quoteError && (
          <div className="bg-red-900/60 border border-red-700 rounded-xl p-2.5 text-xs text-red-200">
            {quoteError}
          </div>
        )}

        <div className="flex items-baseline justify-between pt-1 border-t border-emerald-900">
          <div className="text-xs text-emerald-200">
            {isExempt ? (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
                Compte Partenaire VIP Exonéré
              </span>
            ) : (
              <span>
                {durationDays} jours · {photoCount} photo(s) {hasVideo ? '· 1 vidéo' : ''} {isBoostFeatured ? '· Boost 7j' : ''}
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-amber-400">
            {formatFCFA(totalBillCalculated)}
          </div>
        </div>
      </div>
    </div>
  );
};

