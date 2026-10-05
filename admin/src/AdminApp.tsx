import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './services/firebase';
import { Ad, AdReport, SubscriptionTier, UserProfile, isUserAdmin, isUserSuperAdmin } from './types';
import { AdminPanel } from './components/AdminPanel';
import { AdDetailModal } from './components/AdDetailModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { INITIAL_ADS } from './data/initialAds';
import { getFrontendUrl } from './utils/navigation';
import { AppAlertModal, AlertModalConfig } from './components/AppAlertModal';

type AdminStatus = 'loading' | 'signedOut' | 'denied' | 'admin';

interface AdminAppProps {
  onSwitchToFrontend?: () => void;
}

export default function AdminApp({ onSwitchToFrontend }: AdminAppProps = {}) {
  const [status, setStatus] = useState<AdminStatus>('loading');
  const [currentAdmin, setCurrentAdmin] = useState<UserProfile | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<AdReport[]>([]);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    adId: string;
    reportId?: string;
    title: string;
    adTitle?: string;
    message: string;
  } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [alertModalConfig, setAlertModalConfig] = useState<AlertModalConfig | null>(null);

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info', title?: string) => {
    setAlertModalConfig({
      isOpen: true,
      message,
      type,
      title,
    });
  };

  // 1. Watch the Firebase session and verify the ADMIN / SUPER_ADMIN role in users/{uid}
  useEffect(() => {
    // Timeout fallback: if Firebase Auth takes more than 3.5s to resolve, show login screen
    const loadingTimer = setTimeout(() => {
      setStatus((prev) => (prev === 'loading' ? 'signedOut' : prev));
    }, 3500);

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        clearTimeout(loadingTimer);
        setStatus('signedOut');
        setCurrentAdmin(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (snap.exists()) {
          const profile = { id: snap.id, ...snap.data() } as UserProfile;
          if (isUserAdmin(profile)) {
            clearTimeout(loadingTimer);
            setCurrentAdmin(profile);
            setStatus('admin');
            try {
              localStorage.setItem('bizbooster_active_panel', 'admin');
            } catch (e) {}
            return;
          }
        }

        // Fallback 1: Lookup user in Firestore by email
        if (fbUser.email) {
          const qEmail = query(collection(db, 'users'), where('email', '==', fbUser.email.toLowerCase()));
          const emailSnap = await getDocs(qEmail);
          if (!emailSnap.empty) {
            const profile = { id: emailSnap.docs[0].id, ...emailSnap.docs[0].data() } as UserProfile;
            if (isUserAdmin(profile)) {
              clearTimeout(loadingTimer);
              setCurrentAdmin(profile);
              setStatus('admin');
              try {
                localStorage.setItem('bizbooster_active_panel', 'admin');
              } catch (e) {
                console.warn(e);
              }
              return;
            }
          }
        }

        // Fallback 2: Lookup user in Firestore by phone
        if (fbUser.phoneNumber) {
          const qPhone = query(collection(db, 'users'), where('contactPhone', '==', fbUser.phoneNumber));
          const phoneSnap = await getDocs(qPhone);
          if (!phoneSnap.empty) {
            const profile = { id: phoneSnap.docs[0].id, ...phoneSnap.docs[0].data() } as UserProfile;
            if (isUserAdmin(profile)) {
              clearTimeout(loadingTimer);
              setCurrentAdmin(profile);
              setStatus('admin');
              try {
                localStorage.setItem('bizbooster_active_panel', 'admin');
              } catch (e) {
                console.warn(e);
              }
              return;
            }
          }
        }

        clearTimeout(loadingTimer);
        setCurrentAdmin(null);
        setStatus('denied');
      } catch (err) {
        console.error('Admin verification error:', err);
        clearTimeout(loadingTimer);
        setCurrentAdmin(null);
        setStatus('denied');
      }
    });

    return () => {
      clearTimeout(loadingTimer);
      unsub();
    };
  }, []);

  // 2. Only once we know the user is an admin, listen to ALL ads, users and reports in real time
  useEffect(() => {
    if (status !== 'admin') {
      setAds([]);
      setUsers([]);
      setReports([]);
      return;
    }

    const unsubAds = onSnapshot(
      collection(db, 'ads'),
      (snap) => setAds(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Ad)),
      (err) => console.error('Admin ads listener error:', err)
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => setUsers(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as UserProfile)),
      (err) => console.error('Admin users listener error:', err)
    );

    const unsubReports = onSnapshot(
      collection(db, 'reports'),
      (snap) => setReports(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as AdReport)),
      (err) => console.error('Admin reports listener error:', err)
    );

    return () => {
      unsubAds();
      unsubUsers();
      unsubReports();
    };
  }, [status]);

  const log = (targetId: string, action: string, reason?: string) =>
    addDoc(collection(db, 'moderation_logs'), {
      targetId,
      action,
      moderatorId: auth.currentUser?.uid || 'admin',
      timestamp: new Date().toISOString(),
      ...(reason ? { reason } : {}),
    });

  // 3. Approve ad or paid extension
  const handleApproveAd = async (adId: string) => {
    const ad = ads.find((a) => a.id === adId);
    if (!ad) return;
    const nowIso = new Date().toISOString();

    try {
      if (ad.pendingExtension) {
        const base = Math.max(new Date(ad.expiresAt).getTime(), Date.now());
        const maxExpiry = Date.now() + 365 * 86400000;
        const requestedDays = Math.min(ad.pendingExtension.days, 365);
        const computedExpiry = base + requestedDays * 86400000;
        const newExpiry = new Date(Math.min(computedExpiry, maxExpiry)).toISOString();
        const effectiveAddedDays = Math.max(1, Math.round((new Date(newExpiry).getTime() - base) / 86400000));
        await updateDoc(doc(db, 'ads', adId), {
          status: 'ACTIVE',
          expiresAt: newExpiry,
          durationDays: Math.min(365, (ad.durationDays || 0) + effectiveAddedDays),
          paymentMethod: ad.pendingExtension.operator,
          transactionRef: ad.pendingExtension.transactionRef,
          pendingExtension: deleteField(),
          moderatedAt: nowIso,
        });
        await log(adId, 'EXTENSION_APPROVED');
      } else {
        const expiresAt = new Date(Date.now() + ad.durationDays * 86400000).toISOString();
        await updateDoc(doc(db, 'ads', adId), {
          status: 'ACTIVE',
          publishedAt: nowIso,
          expiresAt,
          moderatedAt: nowIso,
          moderationReason: deleteField(),
        });
        await log(adId, 'APPROVED');
      }
    } catch (e) {
      console.error(e);
      showAlert("Échec de l'approbation. Vérifiez votre connexion et vos droits.", 'error');
    }
  };

  const handleRejectAd = async (adId: string, reason: string) => {
    try {
      await updateDoc(doc(db, 'ads', adId), {
        status: 'REJECTED',
        moderationReason: reason,
        moderatedAt: new Date().toISOString(),
      });
      await log(adId, 'REJECTED', reason);
    } catch (e) {
      console.error(e);
      showAlert('Échec du rejet.', 'error');
    }
  };

  const handleDeleteAd = (adId: string) => {
    const targetAd = ads.find((a) => a.id === adId);
    setDeleteModalState({
      isOpen: true,
      adId,
      title: 'Supprimer définitivement cette annonce ?',
      adTitle: targetAd?.title,
      message: 'Cette action retirera définitivement cette annonce de la base de données.',
    });
  };

  const handleConfirmDeleteModal = async () => {
    if (!deleteModalState) return;
    const { adId, reportId } = deleteModalState;
    setDeleteModalState(null);
    try {
      await deleteDoc(doc(db, 'ads', adId));
      if (reportId) {
        await updateDoc(doc(db, 'reports', reportId), {
          status: 'RESOLVED',
          resolvedAt: new Date().toISOString(),
          resolutionNotes: 'Annonce frauduleuse supprimée définitivement par la modération.',
        });
        await log(adId, 'AD_DELETED_FOR_FRAUD');
      } else {
        await log(adId, 'DELETED');
      }
    } catch (e) {
      console.error(e);
      showAlert('Échec de la suppression.', 'error');
    }
  };

  // 4. KYC & VIP Exemption handlers (VIP exemption STRICTLY restricted to SUPER ADMIN)
  const handleToggleExemption = async (userId: string, isExempt: boolean) => {
    if (!isUserSuperAdmin(currentAdmin)) {
      showAlert("Action réservée exclusivement au SUPER ADMIN : création/révocation de partenaire VIP interdite.", 'error', 'Accès Refusé');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), {
        exemptFromPaymentAndKyc: isExempt,
        isExempt: isExempt,
      });
      await log(userId, isExempt ? 'EXEMPTION_GRANTED' : 'EXEMPTION_REVOKED');
    } catch (e) {
      console.error(e);
      showAlert("Erreur lors de la mise à jour de l'exonération.", 'error');
    }
  };

  const handleApproveKyc = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        idVerificationStatus: 'VERIFIED',
        idVerifiedAt: new Date().toISOString(),
      });
      await log(userId, 'KYC_APPROVED');
    } catch (e) {
      console.error(e);
      showAlert("Erreur lors de la validation de la pièce d'identité.", 'error');
    }
  };

  const handleRejectKyc = async (userId: string, reason: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        idVerificationStatus: 'REJECTED',
        idRejectionReason: reason,
      });
      await log(userId, 'KYC_REJECTED', reason);
    } catch (e) {
      console.error(e);
      showAlert("Erreur lors du rejet de la pièce d'identité.", 'error');
    }
  };

  // 4b. Subscription & Boosters management (STRICTLY restricted to SUPER ADMIN)
  const handleUpdateUserSubscription = async (userId: string, tier: SubscriptionTier) => {
    if (!isUserSuperAdmin(currentAdmin)) {
      showAlert("Action réservée exclusivement au SUPER ADMIN : modification d'abonnement interdite.", 'error', 'Accès Refusé');
      return;
    }
    try {
      const isPaid = tier === 'PRO' || tier === 'ELITE' || tier === 'BUSINESS';
      const targetUser = users.find((u) => u.id === userId);
      const currentBoosts = targetUser?.freeBoostsRemaining || 0;
      const boostsToAdd = tier === 'BUSINESS' ? 6 : tier === 'ELITE' ? 3 : tier === 'PRO' ? 1 : 0;
      const newBoosts = Math.min(20, currentBoosts + boostsToAdd);

      await updateDoc(doc(db, 'users', userId), {
        subscriptionTier: tier,
        subscriptionExpiresAt: isPaid ? new Date(Date.now() + 30 * 86400000).toISOString() : null,
        freeBoostsRemaining: newBoosts,
      });
      await log(userId, 'SUBSCRIPTION_UPDATED', `Forfait défini sur: ${tier} (+${boostsToAdd} boosters crédités)`);
    } catch (e) {
      console.error(e);
      showAlert("Erreur lors de la mise à jour de l'abonnement.", 'error');
    }
  };

  const handleUpdateUserBoosters = async (userId: string, count: number) => {
    if (!isUserSuperAdmin(currentAdmin)) {
      showAlert("Action réservée exclusivement au SUPER ADMIN : modification des boosters interdite.", 'error', 'Accès Refusé');
      return;
    }
    try {
      const safeCount = Math.max(0, Math.min(20, Math.round(count)));
      await updateDoc(doc(db, 'users', userId), {
        freeBoostsRemaining: safeCount,
      });
      await log(userId, 'BOOSTERS_UPDATED', `Solde de boosters ajusté à ${safeCount}`);
    } catch (e) {
      console.error(e);
      showAlert("Erreur lors de la modification des boosters.", 'error');
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'USER' | 'ADMIN' | 'SUPER_ADMIN') => {
    if (!isUserSuperAdmin(currentAdmin)) {
      showAlert("Action réservée exclusivement au SUPER ADMIN : modification des rôles interdite.", 'error', 'Accès Refusé');
      return;
    }
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    // Règle 2b: Un Super Admin ne peut pas être révoqué par un autre Super Admin depuis l'interface
    if ((targetUser.role as any) === 'SUPER_ADMIN' || (targetUser.role as any) === 'SUPER ADMIN') {
      showAlert("Action interdite : un Super Administrateur ne peut pas être rétrogradé depuis cette interface. Toute révocation doit être effectuée manuellement dans la base de données Firestore.", 'error', 'Action interdite');
      return;
    }

    // Règle 2a: Un utilisateur standard ne peut pas devenir un admin/modérateur depuis cette interface
    if (targetUser.role !== 'ADMIN') {
      showAlert("Action refusée : un utilisateur standard ne peut pas être nommé modérateur/admin depuis cette interface (création réservée manuellement avec identifiants distincts).", 'error', 'Action refusée');
      return;
    }

    // Règle 2b: Un modérateur ne peut être que promu SUPER ADMIN
    if (newRole !== 'SUPER_ADMIN') {
      showAlert("Un modérateur ne peut être que promu au rang de Super Administrateur.", 'error', 'Action refusée');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        role: 'SUPER_ADMIN',
      });
      await log(userId, 'ROLE_PROMOTED_SUPER_ADMIN', `Modérateur promu au rang de Super Administrateur`);
      showAlert(`Le modérateur "${targetUser.name || targetUser.contactPhone}" a été promu Super Administrateur avec succès.`, 'success', 'Promotion Réussie');
    } catch (e) {
      console.error(e);
      showAlert("Erreur lors de la mise à jour du rôle.", 'error');
    }
  };

  // 5. Fraud Reports handlers
  const handleResolveReport = async (reportId: string, notes?: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        resolutionNotes: notes || 'Signalement traité par la modération',
      });
      await log(reportId, 'REPORT_RESOLVED');
    } catch (e) {
      console.error(e);
      showAlert('Erreur lors du traitement du signalement.', 'error');
    }
  };

  const handleDismissReport = async (reportId: string, notes?: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'DISMISSED',
        resolvedAt: new Date().toISOString(),
        resolutionNotes: notes || 'Signalement classé sans suite (non fondé)',
      });
      await log(reportId, 'REPORT_DISMISSED');
    } catch (e) {
      console.error(e);
      showAlert('Erreur lors du classement du signalement.', 'error');
    }
  };

  const handleDeleteReportedAd = (adId: string, reportId: string) => {
    const targetAd = ads.find((a) => a.id === adId);
    setDeleteModalState({
      isOpen: true,
      adId,
      reportId,
      title: "Supprimer l'annonce signalée ?",
      adTitle: targetAd?.title,
      message: 'Cette annonce sera définitivement supprimée et le signalement sera marqué comme résolu.',
    });
  };

  // Merge INITIAL_ADS with live Firestore ads so test & demo ads are available for moderation examination
  const allAds = useMemo(() => {
    const map = new Map<string, Ad>();
    INITIAL_ADS.forEach((a) => map.set(a.id, a));
    ads.forEach((a) => map.set(a.id, a));
    return Array.from(map.values());
  }, [ads]);

  const handleSwitchToFrontend = () => {
    try {
      localStorage.setItem('bizbooster_active_panel', 'frontend');
    } catch (e) {
      console.warn(e);
    }
    if (onSwitchToFrontend) {
      onSwitchToFrontend();
    } else {
      window.location.replace(getFrontendUrl());
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setBusy(true);
    try {
      let targetEmail = email.trim();
      if (!targetEmail.includes('@')) {
        let clean = targetEmail.replace(/[^0-9]/g, '');
        if (clean.startsWith('241')) clean = clean.slice(3);
        if (clean.startsWith('0')) clean = clean.slice(1);
        targetEmail = `${clean}@bizbooster.ga`;
      }
      await signInWithEmailAndPassword(auth, targetEmail, password);
    } catch {
      setLoginError('Identifiants incorrects (email ou mot de passe).');
    } finally {
      setBusy(false);
    }
  };

  // ---------------- Screens ----------------
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-black text-2xl text-white shadow-xl shadow-emerald-500/20 animate-pulse">
          BZ
        </div>
        <div className="flex items-center gap-2.5 text-emerald-400 text-sm font-bold">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span>Chargement du Cockpit Administrateur…</span>
        </div>
        <p className="text-xs text-slate-400">Vérification des droits d'accès...</p>
        <button
          onClick={handleSwitchToFrontend}
          className="text-xs text-slate-400 hover:text-white underline mt-2 cursor-pointer"
        >
          Retourner au catalogue public
        </button>
      </div>
    );
  }

  if (status === 'signedOut') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900/95 p-4">
        <form onSubmit={handleLogin} className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-black text-slate-900">BIZBOOSTER · Back-Office</h1>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Admin</span>
          </div>
          <p className="text-xs text-slate-500">Accès réservé à l'équipe de modération et d'administration.</p>
          {loginError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 font-semibold">{loginError}</div>}
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email ou Téléphone (+241)"
            required
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            required
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold py-3 rounded-xl text-sm transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Connexion en cours…' : 'Se connecter au Cockpit'}
          </button>
          <button
            type="button"
            onClick={handleSwitchToFrontend}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            ← Retour au site grand public
          </button>
        </form>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900/95 p-4">
        <div className="bg-white max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-6 text-center space-y-3">
          <h1 className="text-lg font-black text-slate-900">Accès refusé</h1>
          <p className="text-xs text-slate-500">Ce compte ne dispose pas des privilèges administrateur nécessaires pour accéder au Back-Office.</p>
          <div className="pt-2 space-y-2">
            <button onClick={() => signOut(auth)} className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-red-200">
              Se déconnecter
            </button>
            <button
              onClick={handleSwitchToFrontend}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Retourner au catalogue public
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AdminPanel
        currentUser={currentAdmin}
        ads={allAds}
        users={users}
        reports={reports}
        onApproveAd={handleApproveAd}
        onRejectAd={handleRejectAd}
        onDeleteAd={handleDeleteAd}
        onSelectAdDetail={setSelectedAd}
        onSwitchToFrontend={handleSwitchToFrontend}
        onToggleExemption={handleToggleExemption}
        onApproveKyc={handleApproveKyc}
        onRejectKyc={handleRejectKyc}
        onUpdateUserSubscription={handleUpdateUserSubscription}
        onUpdateUserBoosters={handleUpdateUserBoosters}
        onUpdateUserRole={handleUpdateUserRole}
        onResolveReport={handleResolveReport}
        onDismissReport={handleDismissReport}
        onDeleteReportedAd={handleDeleteReportedAd}
      />
      <AdDetailModal
        ad={selectedAd}
        onClose={() => setSelectedAd(null)}
        onOpenExtendModal={() => {}}
        currentUser={null}
      />
      {deleteModalState && (
        <DeleteConfirmModal
          isOpen={deleteModalState.isOpen}
          onClose={() => setDeleteModalState(null)}
          onConfirm={handleConfirmDeleteModal}
          title={deleteModalState.title}
          adTitle={deleteModalState.adTitle}
          message={deleteModalState.message}
          confirmText="Supprimer définitivement"
          cancelText="Annuler"
        />
      )}
      <AppAlertModal
        config={alertModalConfig}
        onClose={() => setAlertModalConfig(null)}
      />
    </>
  );
}
