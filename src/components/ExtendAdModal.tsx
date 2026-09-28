import React, { useState } from 'react';
import { X, RefreshCw, Clock, ShieldCheck, CheckCircle2, Calendar } from 'lucide-react';
import { Ad, PaymentOperator } from '../types';
import { formatFCFA, formatRemainingTime } from '../utils/formatters';
import { MobilePaymentSimulator } from './MobilePaymentSimulator';

interface ExtendAdModalProps {
  ad: Ad | null;
  onClose: () => void;
  onExtendSuccess: (adId: string, additionalDays: number, paymentInfo: { operator: PaymentOperator; transactionRef: string }) => void;
}

export const ExtendAdModal: React.FC<ExtendAdModalProps> = ({ ad, onClose, onExtendSuccess }) => {
  if (!ad) return null;

  const [selectedExtension, setSelectedExtension] = useState<{ days: number; price: number }>({
    days: 15,
    price: 5500,
  });
  const [showPayment, setShowPayment] = useState(false);

  const extensions = [
    { days: 7, label: '+7 Jours (1 semaine)', price: 3000 },
    { days: 15, label: '+15 Jours (2 semaines)', price: 5500 },
    { days: 30, label: '+30 Jours (1 mois complet)', price: 9500 },
    { days: 60, label: '+60 Jours (2 mois)', price: 16000 },
  ];

  const { isExpired, label: remainingLabel } = formatRemainingTime(ad.expiresAt);

  const handlePaymentSuccess = (paymentInfo: { operator: PaymentOperator; contactPhone: string; transactionRef: string }) => {
    onExtendSuccess(ad.id, selectedExtension.days, {
      operator: paymentInfo.operator,
      transactionRef: paymentInfo.transactionRef,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                Prolonger la durée de votre annonce
              </h3>
              <p className="text-[11px] text-slate-400">
                Spécification Cahier des charges BIZBOOSTER
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
            {/* Ad summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3">
              <img
                src={ad.images[0]}
                alt=""
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${
                      ad.transactionType === 'VENTE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {ad.transactionType || 'Annonce'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
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

            {/* Choose extension package */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
                Sélectionnez le nombre de jours à ajouter :
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {extensions.map((ext) => {
                  const isSelected = selectedExtension.days === ext.days;
                  return (
                    <button
                      key={ext.days}
                      type="button"
                      onClick={() => setSelectedExtension(ext)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/30'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900">{ext.label}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <div className="text-sm font-black text-emerald-700 mt-1.5">
                        {formatFCFA(ext.price)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Billing breakdown */}
            <div className="bg-emerald-950 text-emerald-100 rounded-2xl p-4 border border-emerald-800">
              <div className="flex justify-between items-center text-xs text-emerald-300 mb-1">
                <span>Prolongation sélectionnée :</span>
                <span className="font-bold text-white">+{selectedExtension.days} jours</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-emerald-800/80">
                <span className="text-xs font-bold uppercase text-amber-400">Total à régler :</span>
                <span className="text-lg font-black text-amber-400">{formatFCFA(selectedExtension.price)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl transition-colors"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => setShowPayment(true)}
                className="flex-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 rounded-xl shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>Payer via Airtel ou Moov Money</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 flex justify-center">
            <MobilePaymentSimulator
              amount={selectedExtension.price}
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
