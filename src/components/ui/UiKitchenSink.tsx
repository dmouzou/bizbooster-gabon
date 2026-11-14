import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Chip,
  Pill,
  Skeleton,
  EmptyState,
  Price,
  Sheet,
  ResponsiveImage,
  showToast,
} from './index';
import {
  Bell,
  Search,
  Heart,
  Plus,
  ArrowRight,
  ShieldCheck,
  Crown,
  Sparkles,
  Inbox,
  AlertTriangle,
  FileText,
  Share2,
} from 'lucide-react';

export const UiKitchenSink: React.FC = () => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<'auto' | 'half' | 'full'>('auto');
  const [activeChip, setActiveChip] = useState('immob');
  const [btnLoading, setBtnLoading] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-8 border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Design System & Primitives UI
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Page de vérification visuelle et d'accessibilité (Dev only : <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">/__ui</code>).
          </p>
        </div>
        <a
          href="/"
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline p-2"
        >
          Retour à l'accueil
        </a>
      </div>

      {/* 1. Typography */}
      <section className="mb-10 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
          1. Typographie & Échelle de Texte
        </h2>
        <div className="space-y-4">
          <div>
            <span className="text-xs text-slate-400 font-mono">Display (24px / 700) :</span>
            <p className="text-2xl font-bold text-slate-900 leading-tight">
              Trouvez, vendez et boostez vos affaires au Gabon
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-mono">Title (18px / 700) :</span>
            <p className="text-lg font-bold text-slate-900 leading-snug">
              Appartement 3 pièces à louer - Libreville Centre
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-mono">Body (14px / 400 & 500) :</span>
            <p className="text-sm font-normal text-slate-700 leading-relaxed">
              Superbe opportunité au cœur de Libreville. Proche de toutes commodités, sécurisé 24h/24 avec groupe électrogène et suppresseur.
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-mono">Small (12px / 500) :</span>
            <p className="text-xs font-medium text-slate-500">
              Publié il y a 2 heures - Quartier Louis, Libreville
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-mono">Micro (11px / 600 uppercase) :</span>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              RÈGLE STRICTE : AUCUN TEXTE INTERACTIF OU CORPS EN DESSOUS DE 12 PX
            </p>
          </div>
        </div>
      </section>

      {/* 2. Buttons & IconButtons */}
      <section className="mb-10 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
          2. Boutons & Cibles Tactiles (&gt;= 44x44 px)
        </h2>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="md">
              Primary (Action clé)
            </Button>
            <Button variant="secondary" size="md">
              Secondary
            </Button>
            <Button variant="outline" size="md">
              Outline
            </Button>
            <Button variant="ghost" size="md">
              Ghost
            </Button>
            <Button variant="danger" size="md">
              Danger
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Small (min-h 44px)
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Sparkles className="w-4 h-4" />}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Medium avec Icônes
            </Button>
            <Button
              variant="primary"
              size="lg"
              isLoading={btnLoading}
              onClick={() => {
                setBtnLoading(true);
                setTimeout(() => setBtnLoading(false), 2000);
              }}
            >
              Large (Tester Spinner)
            </Button>
          </div>

          <div className="pt-2">
            <span className="text-xs text-slate-400 font-mono block mb-2">
              IconButtons (Strictement &gt;= 44x44 px avec aria-label) :
            </span>
            <div className="flex items-center gap-3">
              <IconButton
                aria-label="Rechercher des annonces"
                variant="secondary"
                icon={<Search className="w-5 h-5 text-slate-700" />}
              />
              <IconButton
                aria-label="Voir les notifications"
                variant="outline"
                icon={<Bell className="w-5 h-5 text-slate-700" />}
              />
              <IconButton
                aria-label="Ajouter aux favoris"
                variant="ghost"
                icon={<Heart className="w-5 h-5 text-rose-500" />}
              />
              <IconButton
                aria-label="Partager l'annonce"
                variant="primary"
                icon={<Share2 className="w-5 h-5 text-white" />}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Chips & Pills */}
      <section className="mb-10 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
          3. Chips Catégories & Badges Pills
        </h2>
        <div className="space-y-4">
          <div>
            <span className="text-xs text-slate-400 font-mono block mb-2">
              Chips interactifs (min-h 44px, défilement horizontal fluide) :
            </span>
            <div className="flex flex-wrap gap-2.5">
              <Chip
                label="Tout"
                count={142}
                active={activeChip === 'all'}
                onClick={() => setActiveChip('all')}
              />
              <Chip
                label="Immobilier"
                count={58}
                active={activeChip === 'immob'}
                onClick={() => setActiveChip('immob')}
              />
              <Chip
                label="Véhicules"
                count={34}
                active={activeChip === 'auto'}
                onClick={() => setActiveChip('auto')}
              />
              <Chip
                label="Emploi & Services"
                count={22}
                active={activeChip === 'jobs'}
                onClick={() => setActiveChip('jobs')}
              />
              <Chip
                label="Nécrologie"
                count={5}
                active={activeChip === 'necro'}
                onClick={() => setActiveChip('necro')}
              />
            </div>
          </div>

          <div className="pt-2">
            <span className="text-xs text-slate-400 font-mono block mb-2">
              Pills de statut & badges non-interactifs :
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Pill variant="vip" icon={<Crown className="w-3.5 h-3.5 text-amber-950" />}>
                VIP Corner
              </Pill>
              <Pill variant="verified" icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />}>
                Vérifié
              </Pill>
              <Pill variant="success">Actif</Pill>
              <Pill variant="warning">En attente</Pill>
              <Pill variant="error">Expiré</Pill>
              <Pill variant="urgent">Urgent</Pill>
              <Pill variant="neutral">Particulier</Pill>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Price & Formatters */}
      <section className="mb-10 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
          4. Affichage Prix & Monnaie (FCFA Marché Gabon)
        </h2>
        <div className="flex flex-wrap items-baseline gap-6">
          <div>
            <span className="text-xs text-slate-400 block mb-1">Standard (md) :</span>
            <Price amount={250000} period="mois" size="md" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block mb-1">Mise en avant (lg) :</span>
            <Price amount={4500000} size="lg" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block mb-1">Grand titre (xl) :</span>
            <Price amount={85000000} size="xl" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block mb-1">Gratuit :</span>
            <Price isFree size="md" />
          </div>
        </div>
      </section>

      {/* 5. Skeletons */}
      <section className="mb-10 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
          5. Squelettes de Chargement (CLS = 0)
        </h2>
        <div className="max-w-xs space-y-3 p-4 border border-slate-100 rounded-2xl">
          <Skeleton aspectRatio="16/10" variant="rounded" className="w-full" />
          <div className="space-y-2">
            <Skeleton height={18} width="80%" />
            <Skeleton height={14} width="55%" />
          </div>
          <div className="flex justify-between items-center pt-2">
            <Skeleton height={20} width="40%" />
            <Skeleton height={32} width={70} variant="rounded" />
          </div>
        </div>
      </section>

      {/* 6. Empty State */}
      <section className="mb-10 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
          6. État Vide (EmptyState)
        </h2>
        <EmptyState
          icon={<Inbox className="w-7 h-7" />}
          title="Aucune annonce trouvée"
          description="Essayez d'ajuster vos critères de recherche ou de réinitialiser vos filtres."
          actionLabel="Réinitialiser les filtres"
          onAction={() => showToast('Filtres réinitialisés avec succès', 'info')}
        />
      </section>

      {/* 7. Bottom Sheet & Toasts */}
      <section className="mb-10 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
          7. Modale Mobile & Volet Inférieur (Sheet) + Toasts
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            onClick={() => {
              setSheetSnap('auto');
              setIsSheetOpen(true);
            }}
          >
            Ouvrir Bottom Sheet (Auto)
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSheetSnap('half');
              setIsSheetOpen(true);
            }}
          >
            Ouvrir Sheet (50% Hauteur)
          </Button>
          <Button
            variant="outline"
            onClick={() => showToast('Opération validée avec succès !', 'success')}
          >
            Tester Toast Succès
          </Button>
          <Button
            variant="outline"
            onClick={() => showToast('Erreur de connexion au serveur.', 'error')}
          >
            Tester Toast Erreur
          </Button>
        </div>
      </section>

      {/* Interactive Sheet component */}
      <Sheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="Filtres Avancés"
        description="Affinez votre recherche d'annonces au Gabon"
        snapPoint={sheetSnap}
        footer={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setIsSheetOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setIsSheetOpen(false);
                showToast('Filtres appliqués', 'success');
              }}
            >
              Appliquer les filtres
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Ce composant s'affiche comme un tiroir glissant depuis le bas de l'écran sur mobile (<code className="bg-slate-100 px-1 py-0.5 rounded text-xs">&lt; 640px</code>) avec gestion du swipe vers le bas, verrouillage du défilement et respect des encoches/barres de navigation (<code className="bg-slate-100 px-1 py-0.5 rounded text-xs">safe-area-inset-bottom</code>).
          </p>
          <p className="text-sm text-slate-700">
            Sur écran plus large (&gt;= 640px), il s'adapte automatiquement en boîte de dialogue centrée accessible avec gestion de la touche <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">Échap</kbd>.
          </p>
        </div>
      </Sheet>
    </div>
  );
};

