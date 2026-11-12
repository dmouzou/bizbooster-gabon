import React, { useState, useEffect } from 'react';
import { X, Clock, ShieldCheck, RefreshCw, AlertTriangle, PauseCircle } from 'lucide-react';
import { Ad, PaymentOperator } from '../types';
import { formatFCFA, formatFrozenRemainingTime, getAdTransactionBadge } from '../utils/formatters';
import { MobilePaymentSimulator } from './MobilePaymentSimulator';
import { previewQuote, PreviewQuoteResult } from '../services/singpay';

interface ReactivateAdModalProps {
  ad: Ad | null;
  onClose: () => void;
  onReactivateSuccess: (
    adId: string,
    paymentInfo: { operator: PaymentOperator; transactionRef: string }
  ) => void;
}

export const ReactivateAdModal: React.FC<ReactivateAdModalProps> = (props) => {
  if (!props.ad) return null;
  return <ReactivateAdModalContent {...props} ad={props.ad} />;
};

const ReactivateAdModalContent: React.FC<Omit<ReactivateAdModalProps, 'ad'> & { ad: Ad }> = ({
  ad,
  onClose,
  onReactivateSuccess,
}) => {
  const [showPayment, setShowPayment] = useState(false);
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [serverQuote, setServerQuote] = useState<PreviewQuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const frozen = formatFrozenRemainingTime(ad.expiresAt, ad.suspendedAt || ad.updatedAt);
  const grantedMs = frozen.remainingMs > 0 ? frozen.remainingMs : 3 * 24 * 3600 * 1000;
  const projectedExpiryLabel = new Date(Date.now() + grantedMs).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  useEffect(() => {
    let cancelled = false;
    const fetchQuote = async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const q = await previewQuote({
          productId: 'AD_REACTIVATE',
          metadata: { adId: ad.id },
        });
        if (!cancelled) setServerQuote(q);
      } catch (e: any) {
        if (!cancelled) {
          setQuoteError(e?.message || 'Impossible de calculer le montant de réactivation.');
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    };
    fetchQuote();
    return () => {
      cancelled = true;
    };
  }, [ad.id]);

  const badge = getAdTransactionBadge(ad);

  return (
    <div className="app-modal-overlay">
      <div
        className="app-modal-dialog bg-white rounded-3xl w-full max-w-lg overflow-y-auto shadow-2xl border border-slate-300/80 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <PauseCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                Réactiver cette annonce à l'unité
              </h3>
              <p className="text-[11px] text-slate-400">
                Tarif calculé selon vos jours restants gelés et options médias
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isWaitingPayment}
            onClick={onClose}
            className="text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!showPayment ? (
          <div className="p-6 space-y-5">
            {/* Résumé de l'annonce */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3">
              <img
                src={ad.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=500&q=80'}
                alt=""
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="overflow-hidden flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${badge.badgeClass}`}>
                    {badge.label}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium truncate">
                    {ad.location?.city || 'Gabon'}
                  </span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 truncate">{ad.title}</h4>
                <div className="text-[11px] text-amber-700 font-bold flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>Temps gelé : {frozen.label}</span>
                </div>
              </div>
            </div>

            {/* Info durée gelée */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 space-y-1">
              <p className="font-bold">Reprise immédiate de votre durée restante</p>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Le compteur a été gelé lors de la mise en pause. Dès validation du paiement, votre annonce redeviendra visible jusqu'au{' '}
                <strong>{projectedExpiryLabel}</strong>.
              </p>
            </div>

            {/* Devis officiel serveur */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                <span>Détail du tarif (serveur)</span>
                {quoteLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />}
              </div>

              {quoteError ? (
                <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-950/50 border border-rose-500/30 p-3 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{quoteError}</span>
                </div>
              ) : quoteLoading ? (
                <div className="py-3 text-xs text-slate-300">Calcul de la somme requise...</div>
              ) : serverQuote ? (
                <div className="space-y-1.5">
                  {serverQuote.lines.map((line, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-slate-200">
                      <span>{line.label}</span>
                      <span className="font-bold text-white">{formatFCFA(line.amount)}</span>
                    </div>
                  ))}
                  <div className="pt-2 mt-2 border-t border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-200">Total à payer</span>
                    <span className="text-lg font-black text-amber-400">
                      {formatFCFA(serverQuote.amount)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl transition-colors cursor-pointer"
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={quoteLoading || Boolean(quoteError) || !serverQuote}
                onClick={() => setShowPayment(true)}
                className="flex-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs py-3 rounded-xl shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>
                  {serverQuote ? `Payer ${formatFCFA(serverQuote.amount)} via Airtel Money` : 'Payer via Airtel Money'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 flex justify-center">
            <MobilePaymentSimulator
              productId="AD_REACTIVATE"
              metadata={{ adId: ad.id }}
              amount={serverQuote?.amount ?? 0}
              itemDescription={`Réactivation annonce (${frozen.label}) - ${ad.title}`}
              onSuccess={(info) => {
                setIsWaitingPayment(false);
                onReactivateSuccess(ad.id, {
                  operator: info.operator,
                  transactionRef: info.transactionRef,
                });
                onClose();
              }}
              onCancel={() => {
                setIsWaitingPayment(false);
                setShowPayment(false);
              }}
              onPaymentPendingChange={setIsWaitingPayment}
            />
          </div>
        )}
      </div>
    </div>
  );
};

