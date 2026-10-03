import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Clock, ShieldCheck, CheckCircle2, Crown, AlertTriangle } from 'lucide-react';
import { Ad, PaymentOperator, UserProfile } from '../types';
import { formatFCFA, formatRemainingTime } from '../utils/formatters';
import { MobilePaymentSimulator } from './MobilePaymentSimulator';

interface ExtendAdModalProps {
  ad: Ad | null;
  currentUser?: UserProfile | null;
  onClose: () => void;
  onExtendSuccess: (
    adId: string,
    additionalDays: number,
    paymentInfo: { operator: PaymentOperator; transactionRef: string; isFreeVip?: boolean }
  ) => void;
}

export const ExtendAdModal: React.FC<ExtendAdModalProps> = ({
  ad,
  currentUser,
  onClose,
  onExtendSuccess,
}) => {
  if (!ad) return null;

  const isVip = Boolean(
    currentUser?.exemptFromPaymentAndKyc ||
    currentUser?.isExempt
  );
  const isOwnerVerified = currentUser?.idVerificationStatus === 'VERIFIED';
  // ID card is optional trust badge, no longer required for transactions or extensions
  const isAllowedToPay = true;

  const isBusinessSubscriber = currentUser?.subscriptionTier === 'BUSINESS';
  const isEliteSubscriber = currentUser?.subscriptionTier === 'ELITE';
  const isProSubscriber = currentUser?.subscriptionTier === 'PRO';

  const isFreeExtension = isVip || isBusinessSubscriber;
  const discountPercent = isFreeExtension ? 100 : isEliteSubscriber ? 50 : isProSubscriber ? 25 : 0;
  const getExtensionPrice = (rawPrice: number) => {
    if (discountPercent === 100) return 0;
    return Math.round(rawPrice * (1 - discountPercent / 100));
  };

  const now = Date.now();
  const expiresAtMs = new Date(ad.expiresAt).getTime();
  // Current remaining validity in days from today
  const currentRemainingDays = Math.max(0, Math.ceil((expiresAtMs - now) / (1000 * 60 * 60 * 24)));
  // Maximum days that can be added without exceeding the 365 days limit from now
  const maxExtendableDays = Math.max(0, 365 - currentRemainingDays);
  const isAtMaxLimit = maxExtendableDays <= 0;

  const extensions = [
    { days: 7, label: '+7 Jours (1 semaine)', price: 3000 },
    { days: 15, label: '+15 Jours (2 semaines)', price: 5500 },
    { days: 30, label: '+30 Jours (1 mois complet)', price: 9500 },
    { days: 60, label: '+60 Jours (2 mois)', price: 16000 },
    { days: 90, label: '+90 Jours (3 mois)', price: 22000 },
    { days: 180, label: '+180 Jours (6 mois)', price: 40000 },
    { days: 365, label: '+365 Jours (1 an)', price: 75000 },
  ];

  // Pick initial selection that fits within the max allowed days
  const defaultPackage = extensions.find((ext) => ext.days <= maxExtendableDays) || extensions[0];
  const [selectedExtension, setSelectedExtension] = useState<{ days: number; price: number }>(defaultPackage);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    const valid = extensions.find((ext) => ext.days <= maxExtendableDays);
    if (valid) {
      setSelectedExtension(valid);
    }
  }, [ad.id, maxExtendableDays]);

  const { isExpired, label: remainingLabel } = formatRemainingTime(ad.expiresAt);

  const handlePaymentSuccess = (paymentInfo: { operator: PaymentOperator; contactPhone: string; transactionRef: string }) => {
    onExtendSuccess(ad.id, selectedExtension.days, {
      operator: paymentInfo.operator,
      transactionRef: paymentInfo.transactionRef,
      isFreeVip: false,
    });
    onClose();
  };

  const handleVipFreeExtend = () => {
    if (isAtMaxLimit) return;
    onExtendSuccess(ad.id, selectedExtension.days, {
      operator: 'AIRTEL',
      transactionRef: `VIP-EXT-${Date.now().toString(36).toUpperCase()}`,
      isFreeVip: true,
    });
    onClose();
  };

  return (
    <div className="app-modal-overlay">
      <div
        className="app-modal-dialog bg-white rounded-3xl w-full max-w-lg overflow-y-auto shadow-2xl border border-slate-300/80 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isVip ? 'bg-amber-400 text-slate-950' : 'bg-amber-500/20 text-amber-400'}`}>
              {isVip ? <Crown className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">
                  Prolonger la durée de votre annonce
                </h3>
                {isVip && (
                  <span className="bg-amber-400 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                    VIP Gratuit
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Plafond réglementaire maximum : 365 jours de validité
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!showPayment ? (
          <div className="p-6 space-y-5">
            {/* VIP Status Banner */}
            {isVip && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-start gap-3 text-amber-900">
                <Crown className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="block font-black text-amber-950">Avantage Partenaire VIP Activé</strong>
                  La prolongation de votre annonce est <span className="font-bold underline">100% gratuite</span> sans passage par paiement mobile (dans la limite légale de 365 jours cumulés).
                </div>
              </div>
            )}

            {/* Ad summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3">
              <img
                src={ad.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=500&q=80'}
                alt=""
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="overflow-hidden flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${
                      ad.mainCategory === 'EMPLOI' || ad.transactionType === 'EMPLOYER'
                        ? 'bg-purple-100 text-purple-800'
                        : ad.transactionType === 'VENTE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {ad.mainCategory === 'EMPLOI' || ad.transactionType === 'EMPLOYER' ? 'À Employer' : (ad.transactionType === 'VENTE' ? 'À Vendre' : 'À Louer')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium truncate">
                    {ad.location?.city || 'Gabon'}
                  </span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 truncate">{ad.title}</h4>
                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>Statut actuel : {remainingLabel}</span>
                </div>
              </div>
            </div>

            {/* Validity Gauge & Limit Info */}
            <div className="bg-slate-100 rounded-2xl p-3 text-xs border border-slate-200/80">
              <div className="flex justify-between items-center text-slate-700 font-bold mb-1.5">
                <span>Validité restante : {currentRemainingDays}j / 365j</span>
                <span className="text-[11px] text-slate-500">
                  {isAtMaxLimit ? 'Plafond atteint' : `Reste max +${maxExtendableDays}j prolongeables`}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all rounded-full ${
                    isAtMaxLimit ? 'bg-red-500' : currentRemainingDays > 300 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((currentRemainingDays / 365) * 100))}%` }}
                />
              </div>
            </div>

            {/* Max limit reached alert */}
            {isAtMaxLimit ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-800 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-black text-red-900 mb-1">
                    Plafond maximal atteint (365 jours)
                  </strong>
                  Cette annonce a déjà atteint la durée maximale autorisée de validité continue (365 jours). Conformément aux règles BIZBOOSTER Gabon, aucune prolongation supplémentaire n'est possible tant que la date d'expiration ne s'est pas rapprochée.
                </div>
              </div>
            ) : (
              /* Choose extension package */
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
                  Sélectionnez le nombre de jours à ajouter :
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {extensions.map((ext) => {
                    const isExceeding = ext.days > maxExtendableDays;
                    const isSelected = selectedExtension.days === ext.days;

                    return (
                      <button
                        key={ext.days}
                        type="button"
                        disabled={isExceeding}
                        onClick={() => !isExceeding && setSelectedExtension(ext)}
                        className={`p-3 rounded-2xl border text-left transition-all relative ${
                          isExceeding
                            ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed'
                            : isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/30'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-slate-900">{ext.label}</span>
                          {isSelected && !isExceeding && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        </div>
                        <div className="text-xs font-black mt-1.5 flex items-center justify-between">
                          {isFreeExtension ? (
                            <span className="text-amber-700 font-extrabold">
                              0 FCFA {isVip ? '(VIP)' : '(Inclus Business)'}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-emerald-700 font-extrabold">
                                {formatFCFA(getExtensionPrice(ext.price))}
                              </span>
                              {discountPercent > 0 && (
                                <span className="line-through text-slate-400 text-[10px]">
                                  {formatFCFA(ext.price)}
                                </span>
                              )}
                            </div>
                          )}
                          {isExceeding && (
                            <span className="text-[10px] text-red-600 font-bold">&gt; 365j</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Billing breakdown */}
            {!isAtMaxLimit && (
              <div className={`${isFreeExtension ? 'bg-slate-900' : 'bg-emerald-950'} text-white rounded-2xl p-4 border ${isFreeExtension ? 'border-amber-400/40' : 'border-emerald-800'}`}>
                <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                  <span>Prolongation sélectionnée :</span>
                  <span className="font-bold text-white">+{selectedExtension.days} jours</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                  <span>Nouvelle validité totale :</span>
                  <span className="font-bold text-white">{Math.min(365, currentRemainingDays + selectedExtension.days)} jours</span>
                </div>
                {discountPercent > 0 && !isFreeExtension && (
                  <div className="flex justify-between items-center text-xs text-emerald-400 mb-1">
                    <span>Avantage Abonnement ({currentUser?.subscriptionTier}) :</span>
                    <span className="font-bold">-{discountPercent}% de réduction</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-700/80">
                  <span className="text-xs font-bold uppercase text-amber-400">Total à régler :</span>
                  <span className="text-lg font-black text-amber-400">
                    {isFreeExtension
                      ? `0 FCFA (Exonéré ${isVip ? 'VIP' : 'Business'})`
                      : formatFCFA(getExtensionPrice(selectedExtension.price))}
                  </span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl transition-colors cursor-pointer"
              >
                Fermer
              </button>

              {!isAtMaxLimit && (
                isFreeExtension ? (
                  <button
                    type="button"
                    onClick={handleVipFreeExtend}
                    className="flex-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-3 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Crown className="w-4 h-4 text-slate-950" />
                    <span>Valider la prolongation gratuite ({isVip ? 'VIP' : 'Business'})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPayment(true)}
                    className="flex-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 rounded-xl shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-300" />
                    <span>Payer via Airtel ou Moov Money</span>
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 flex justify-center">
            <MobilePaymentSimulator
              amount={getExtensionPrice(selectedExtension.price)}
              itemDescription={`Prolongation +${selectedExtension.days} jours - ${ad.title}`}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setShowPayment(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
