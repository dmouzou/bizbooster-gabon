import React, { useState } from 'react';
import { X, AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { addDoc, collection, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Ad } from '../types';

interface ReportAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  ad: Ad;
  onReportSubmitted?: () => void;
}

const REPORT_REASONS = [
  'Arnaque financière / Demande de transfert d\'argent préalable',
  'Faux démarcheur / Usurpation d\'identité ou absence de mandat',
  'Bien inexistant, fictif ou déjà vendu',
  'Prix manifestement trompeur ou irréaliste',
  'Faux documents ou photos volées',
  'Contenu inapproprié ou non conforme aux règles',
  'Autre motif suspect',
];

export const ReportAdModal: React.FC<ReportAdModalProps> = ({
  isOpen,
  onClose,
  ad,
  onReportSubmitted,
}) => {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) {
      setError('Veuillez préciser la raison de votre signalement.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Add document to reports collection
      await addDoc(collection(db, 'reports'), {
        adId: ad.id,
        adTitle: ad.title,
        adCategory: ad.mainCategory,
        adPrice: ad.price,
        adOwnerName: ad.contactName,
        adOwnerPhone: ad.contactPhone,
        reason,
        details: details.trim(),
        reporterPhone: reporterPhone.trim() || 'Non renseigné',
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      });

      // 2. Increment reportsCount on the ad
      try {
        await updateDoc(doc(db, 'ads', ad.id), {
          reportsCount: increment(1),
        });
      } catch {
        // Non-blocking if permission restricted
      }

      setSubmitted(true);
      if (onReportSubmitted) onReportSubmitted();
      setTimeout(() => {
        setSubmitted(false);
        setDetails('');
        setReporterPhone('');
        onClose();
      }, 2500);
    } catch (err: any) {
      console.error('Failed to submit report:', err);
      setError('Impossible d\'enregistrer le signalement. Veuillez vérifier votre connexion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-red-950 text-white p-5 flex items-center justify-between border-b border-red-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-600/30 text-red-300 border border-red-500/40">
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white">Signaler cette annonce</h3>
              <p className="text-xs text-red-200">Protection des acheteurs & lutte anti-fraude au Gabon</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-red-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">Signalement bien reçu</h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Notre équipe de modération BIZBOOSTER a été alertée et va immédiatement examiner cette annonce. Merci pour votre vigilance citoyenne.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Ad summary */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500 font-bold block mb-0.5">Annonce concernée :</span>
                <p className="font-black text-slate-800 line-clamp-1">{ad.title}</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Annonceur : {ad.contactName} ({ad.contactPhone})
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Motif du signalement
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Details */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Précisions / Explications
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Décrivez précisément ce qui vous paraît suspect (ex: le démarcheur exige un acompte avant visite, le numéro ne répond pas, le bien n'existe pas...)"
                  rows={3}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Optional Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Votre numéro de téléphone (optionnel)
                </label>
                <input
                  type="tel"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                  placeholder="Ex: 77 45 20 18 (pour que l'équipe puisse vous recontacter)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Envoyer le signalement</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
