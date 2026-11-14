import React from 'react';
import {
  MapPin,
  Clock,
  Phone,
  ShieldCheck,
  Tag,
  CheckCircle2,
  Sparkles,
  Crown,
  FileText,
} from 'lucide-react';
import { Ad, MainCategory, PriceUnit, TransactionType } from '../../../types';
import { formatFCFA, formatPriceUnit } from '../../../utils/formatters';

interface Step5PreviewProps {
  title: string;
  mainCategory: MainCategory;
  transactionType: TransactionType;
  price: number | '';
  priceUnit: PriceUnit;
  province: string;
  city: string;
  neighborhood: string;
  description: string;
  photos: { url: string }[];
  contactName: string;
  contactPhone: string;
  durationDays: number;
  isBoostFeatured: boolean;
  isVipEligible: boolean;
  onOpenCgu: () => void;
}

export const Step5Preview: React.FC<Step5PreviewProps> = ({
  title,
  mainCategory,
  transactionType,
  price,
  priceUnit,
  province,
  city,
  neighborhood,
  description,
  photos,
  contactName,
  contactPhone,
  durationDays,
  isBoostFeatured,
  isVipEligible,
  onOpenCgu,
}) => {
  const displayPrice = Number(price) || 0;
  const isFreeCategory =
    mainCategory === 'NECROLOGIE' ||
    mainCategory === 'AVIS_DE_RECHERCHE' ||
    (mainCategory === 'EVENEMENTS' && displayPrice === 0);

  return (
    <div className="space-y-5 animate-in fade-in">
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
            Aperçu Avant Validation
          </span>
          <h3 className="text-xs sm:text-sm font-black text-slate-900 mt-1">
            Vérifiez l'affichage de votre annonce
          </h3>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Voici comment votre publication sera présentée aux acheteurs et visiteurs sur mobile.
          </p>
        </div>
      </div>

      {/* Card Preview */}
      <div className="bg-white border-2 border-slate-300 rounded-3xl overflow-hidden shadow-md max-w-sm mx-auto">
        {/* Photo Container */}
        <div className="relative aspect-16/10 bg-slate-100 overflow-hidden">
          {photos.length > 0 ? (
            <img
              src={photos[0].url}
              alt="Photo preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
              Aucune photo ajoutée
            </div>
          )}

          {/* Badges sur la photo */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="bg-white text-slate-900 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-xs">
              {transactionType === 'VENTE' ? 'Vente' : 'Location'}
            </span>
            {isBoostFeatured && (
              <span className="bg-amber-400 text-slate-950 text-[11px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>En tête</span>
              </span>
            )}
            {isVipEligible && (
              <span className="bg-amber-500 text-slate-950 text-[11px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                <Crown className="w-3 h-3" />
                <span>VIP</span>
              </span>
            )}
          </div>

          {photos.length > 1 && (
            <span className="absolute bottom-2.5 right-2.5 bg-slate-950/75 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full backdrop-blur-xs">
              1 / {photos.length}
            </span>
          )}
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-2">
          {/* Price */}
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-emerald-700">
              {isFreeCategory ? 'Gratuit / Entrée libre' : formatFCFA(displayPrice)}
            </span>
            {!isFreeCategory && priceUnit !== 'total' && (
              <span className="text-xs text-slate-500 font-semibold">
                /{formatPriceUnit(priceUnit)}
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">
            {title || `${transactionType === 'VENTE' ? 'Vente' : 'Location'} - ${mainCategory}`}
          </h4>

          {/* Location */}
          <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {[province, city, neighborhood].filter(Boolean).join(' · ')}
            </span>
          </div>

          {/* Excerpt */}
          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed pt-1 border-t border-slate-100">
            {description}
          </p>

          {/* Contact summary */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Annonceur : <strong className="text-slate-800">{contactName}</strong></span>
            <span>{durationDays} jours</span>
          </div>
        </div>
      </div>

      {/* Terms of service notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
        <p className="leading-relaxed">
          En validant cette publication, vous attestez sur l'honneur l'exactitude des informations fournies et acceptez les{' '}
          <button
            type="button"
            onClick={onOpenCgu}
            className="text-emerald-700 font-bold underline cursor-pointer"
          >
            Conditions Générales d'Utilisation (CGU)
          </button>{' '}
          de BIZBOOSTER Gabon.
        </p>
      </div>
    </div>
  );
};

