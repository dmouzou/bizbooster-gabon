import React, { useEffect } from 'react';
import { Crown, Sparkles, CheckCircle2, Zap, ArrowRight, ShieldCheck, HeartHandshake, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { SubscriptionTier } from '../types';

interface SubscriptionUpgradeModalProps {
  isOpen: boolean;
  tier: SubscriptionTier;
  onClose: () => void;
  onGoToPublish?: () => void;
}

interface TierInfo {
  name: string;
  badge: string;
  heroGradient: string;
  accentBg: string;
  textColor: string;
  ringColor: string;
  tagline: string;
  simultaneousAds: number;
  boostersCount: number;
  extensionDiscount: string;
  features: string[];
}

const TIER_DETAILS: Record<Exclude<SubscriptionTier, 'STANDARD'>, TierInfo> = {
  PRO: {
    name: 'Pro',
    badge: 'Badge Vérifié Pro',
    heroGradient: 'from-blue-600 via-indigo-600 to-slate-900',
    accentBg: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    textColor: 'text-blue-400',
    ringColor: 'ring-blue-500/30',
    tagline: 'Votre statut Pro est activé ! Développez votre activité avec une visibilité renforcée.',
    simultaneousAds: 8,
    boostersCount: 1,
    extensionDiscount: '-25% de remise sur chaque prolongation',
    features: [
      "Jusqu'à 8 annonces simultanées sans frais de dépôt supplémentaires",
      "1 Booster 'En Tête de Liste' offert immédiatement crédité",
      "-25% de remise permanente sur toutes vos prolongations d'annonces",
      "Badge officiel 'Pro' affiché sur toutes vos annonces",
      "Priorité algorithmique devant les annonces Standard",
      "Support prioritaire dédié via WhatsApp",
    ],
  },
  ELITE: {
    name: 'Élite',
    badge: 'Badge Prestige Élite',
    heroGradient: 'from-purple-700 via-indigo-800 to-slate-950',
    accentBg: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
    textColor: 'text-purple-400',
    ringColor: 'ring-purple-500/30',
    tagline: 'Félicitations ! Vous accédez à un niveau supérieur de visibilité commerciale.',
    simultaneousAds: 14,
    boostersCount: 3,
    extensionDiscount: '-50% de remise sur chaque prolongation',
    features: [
      "Jusqu'à 14 annonces simultanées sans frais supplémentaires",
      "3 Boosters 'En Tête de Liste' offerts immédiatement crédités",
      "-50% de réduction immédiate sur toutes les prolongations",
      "Badge officiel 'Élite' doré sur toutes vos annonces",
      "Positionnement prioritaire de haut niveau dans les flux",
      "Support prioritaire dédié 7j/7",
    ],
  },
  BUSINESS: {
    name: 'Business',
    badge: 'Badge Partenaire Business',
    heroGradient: 'from-emerald-700 via-teal-800 to-slate-950',
    accentBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    textColor: 'text-emerald-400',
    ringColor: 'ring-emerald-500/30',
    tagline: 'Bienvenue au sommet ! Vous profitez du statut d\'excellence maximale BizBooster.',
    simultaneousAds: 20,
    boostersCount: 6,
    extensionDiscount: '100% GRATUIT & Illimité (Exemption totale)',
    features: [
      "Jusqu'à 20 annonces simultanées (Plafond absolu de la plateforme)",
      "6 Boosters 'En Tête de Liste' offerts immédiatement crédités",
      "Prolongations 100% GRATUITES et illimitées sur toutes vos annonces",
      "Badge officiel 'Entreprise Partenaire Business'",
      "Priorité algorithmique maximale parmi tous les abonnés",
      "Accompagnement VIP dédié & publication assistée via WhatsApp",
    ],
  },
};

export const SubscriptionUpgradeModal: React.FC<SubscriptionUpgradeModalProps> = ({
  isOpen,
  tier,
  onClose,
  onGoToPublish,
}) => {
  useEffect(() => {
    if (isOpen) {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'],
        });
      } catch {
        // Safe fallback
      }
    }
  }, [isOpen]);

  if (!isOpen || tier === 'STANDARD') return null;

  const info = TIER_DETAILS[tier];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl text-white my-8">
        {/* Top Hero Header with Tier Gradient */}
        <div className={`p-6 sm:p-8 bg-gradient-to-br ${info.heroGradient} relative overflow-hidden`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-black/30 hover:bg-black/50 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border backdrop-blur-xs flex items-center gap-1.5 ${info.accentBg}`}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Abonnement Confirmé</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center shadow-lg">
              <Crown className="w-7 h-7 text-amber-300 fill-amber-300" />
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Forfait {info.name}
              </h3>
              <p className="text-xs text-white/80 font-medium mt-0.5">
                {info.tagline}
              </p>
            </div>
          </div>
        </div>

        {/* Core Perks Highlights */}
        <div className="p-6 sm:p-7 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[11px] font-black uppercase">Quota En Ligne</span>
              </div>
              <div className="text-xl font-black text-white">
                {info.simultaneousAds} Annonces
              </div>
              <span className="text-[10px] text-slate-400">simultanées actives</span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <Zap className="w-4 h-4 fill-amber-400" />
                <span className="text-[11px] font-black uppercase">Boosters Crédités</span>
              </div>
              <div className="text-xl font-black text-white">
                +{info.boostersCount} Booster{info.boostersCount > 1 ? 's' : ''}
              </div>
              <span className="text-[10px] text-slate-400">En Tête de Liste (7 jours)</span>
            </div>
          </div>

          {/* Full Features Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Vos privilèges exclusifs inclus :
            </h4>
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2.5">
              {info.features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-200 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <HeartHandshake className="w-4 h-4" />
              <span>Accéder à mon Espace Annonceur</span>
            </button>
            {onGoToPublish && (
              <button
                onClick={() => {
                  onClose();
                  onGoToPublish();
                }}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Déposer une annonce</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
