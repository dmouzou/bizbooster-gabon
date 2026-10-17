import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from './services/firebase';
import { Ad, AdReport, SubscriptionTier, UserProfile, isUserAdmin, isUserSuperAdmin } from './types';
import { AdminPanel } from './components/AdminPanel';
import { AdDetailModal } from './components/AdDetailModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { getFrontendUrl } from './utils/navigation';
import { AppAlertModal, AlertModalConfig } from './components/AppAlertModal';
import { BizboosterLogo } from './components/BizboosterLogo';

type AdminStatus = 'loading' | 'signedOut' | 'denied' | 'admin';

interface AdminAppProps {
  currentUser?: UserProfile | null;
  onSwitchToFrontend?: () => void;
}

export default function AdminApp({ currentUser, onSwitchToFrontend }: AdminAppProps = {}) {
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

  // 1. Contrôle d'accès : vérification stricte par profil transmis ou session Auth (S-11 : identité par uid/claims uniquement)
  useEffect(() => {
    if (currentUser !== undefined) {
      if (currentUser && isUserAdmin(currentUser)) {
        setCurrentAdmin(currentUser);
        setStatus('admin');
        try {
          localStorage.setItem('bizbooster_active_panel', 'admin');
        } catch {}
      } else if (currentUser) {
        setCurrentAdmin(null);
        setStatus('denied');
      } else {
        setCurrentAdmin(null);
        setStatus('signedOut');
      }
      return;
    }

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setStatus('signedOut');
        setCurrentAdmin(null);
        return;
      }
      try {
        const tokenResult = await fbUser.getIdTokenResult();
        const roleClaim = tokenResult.claims.role;
        if (roleClaim === 'ADMIN' || roleClaim === 'SUPER_ADMIN') {
          const profile: UserProfile = {
            id: fbUser.uid,
            role: roleClaim,
            name: fbUser.displayName || 'Admin',
            contactPhone: fbUser.phoneNumber || '',
            isVerified: true,
            termsAccepted: true,
            termsAcceptedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          setCurrentAdmin(profile);
          setStatus('admin');
          return;
        }

        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (snap.exists()) {
          const profile = { id: snap.id, ...snap.data() } as UserProfile;
          if (isUserAdmin(profile)) {
            setCurrentAdmin(profile);
            setStatus('admin');
            return;
          }
        }

        setCurrentAdmin(null);
        setStatus('denied');
      } catch (err) {
        console.error('Admin verification error:', err);
        setCurrentAdmin(null);
        setStatus('denied');
      }
    });

    return () => unsub();
  }, [currentUser]);

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

  // 3. Modération via Cloud Functions sécurisées (Phase 3 - Étape 3.1)
  const handleApproveAd = async (adId: string) => {
    try {
      const approveAdCallable = httpsCallable<{ adId: string }, { success: boolean; adId: string }>(
        functions,
        'approveAd'
      );
      await approveAdCallable({ adId });
      showAlert("Annonce approuvée avec succès !", 'success');
    } catch (e: any) {
      console.error(e);
      showAlert("Échec de l'approbation : " + (e?.message || 'Vérifiez votre connexion et vos droits.'), 'error');
    }
  };

  const handleRejectAd = async (adId: string, reason: string) => {
    try {
      const rejectAdCallable = httpsCallable<{ adId: string; reason: string }, { success: boolean }>(
        functions,
        'rejectAd'
      );
      await rejectAdCallable({ adId, reason });
      showAlert("Annonce rejetée avec succès.", 'success');
    } catch (e: any) {
      console.error(e);
      showAlert("Échec du rejet : " + (e?.message || 'Erreur réseau.'), 'error');
      throw e;
    }
  };

  const handleRejectExtension = async (adId: string, reason: string) => {
    try {
      const rejectExtCallable = httpsCallable<{ adId: string; reason: string }, { success: boolean }>(
        functions,
        'rejectExtension'
      );
      await rejectExtCallable({ adId, reason });
      showAlert("Demande de prolongation refusée.", 'success');
    } catch (e: any) {
      console.error(e);
      showAlert("Échec du refus de la prolongation : " + (e?.message || 'Erreur réseau.'), 'error');
      throw e;
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
      const deleteAdCallable = httpsCallable<{ adId: string; reason: string }, { success: boolean }>(
        functions,
        'deleteAd'
      );
      await deleteAdCallable({
        adId,
        reason: reportId ? 'Annonce frauduleuse' : 'Suppression modération',
      });
      showAlert('Annonce supprimée avec succès.', 'success');
    } catch (e: any) {
      console.error(e);
      showAlert('Échec de la suppression : ' + (e?.message || 'Erreur.'), 'error');
    }
  };

  // 4. KYC & VIP Exemption handlers (VIP exemption STRICTLY restricted to SUPER ADMIN)
  const handleToggleExemption = async (userId: string, isExempt: boolean) => {
    if (!isUserSuperAdmin(currentAdmin)) {
      showAlert("Action réservée exclusivement au SUPER ADMIN : création/révocation de partenaire VIP interdite.", 'error', 'Accès Refusé');
      return;
    }
    try {
      const setExemptionCallable = httpsCallable<{ userId: string; isExempt: boolean }, { success: boolean }>(
        functions,
        'setExemption'
      );
      await setExemptionCallable({ userId, isExempt });
      showAlert(isExempt ? 'Exonération accordée avec succès.' : 'Exonération révoquée avec succès.', 'success');
    } catch (e: any) {
      console.error(e);
      showAlert("Erreur lors de la mise à jour de l'exonération : " + (e?.message || 'Erreur.'), 'error');
    }
  };

  const handleApproveKyc = async (userId: string) => {
    try {
      const targetUser = users.find((u) => u.id === userId);
      const approveKycCallable = httpsCallable<{ uid: string; idDocumentUrl?: string }, { success: boolean }>(
        functions,
        'approveKyc'
      );
      await approveKycCallable({ uid: userId, idDocumentUrl: targetUser?.idDocumentUrl });
      showAlert("Pièce d'identité validée avec succès.", 'success');
    } catch (e: any) {
      console.error(e);
      showAlert("Erreur lors de la validation KYC : " + (e?.message || 'Erreur.'), 'error');
    }
  };

  const handleRejectKyc = async (userId: string, reason: string) => {
    try {
      const rejectKycCallable = httpsCallable<{ uid: string; reason: string }, { success: boolean }>(
        functions,
        'rejectKyc'
      );
      await rejectKycCallable({ uid: userId, reason });
      showAlert("Pièce d'identité rejetée.", 'success');
    } catch (e: any) {
      console.error(e);
      showAlert("Erreur lors du rejet KYC : " + (e?.message || 'Erreur.'), 'error');
    }
  };

  const handleLogKycView = async (targetUserId: string) => {
    try {
      const logKycCallable = httpsCallable<{ targetUserId: string }, { success: boolean }>(
        functions,
        'logKycView'
      );
      await logKycCallable({ targetUserId });
    } catch (e: any) {
      console.warn("Échec de la journalisation KYC_VIEWED :", e);
    }
  };

  // 4b. Subscription & Boosters management (STRICTLY restricted to SUPER ADMIN)
  const handleUpdateUserSubscription = async (userId: string, tier: SubscriptionTier) => {
    if (!isUserSuperAdmin(currentAdmin)) {
      showAlert("Action réservée exclusivement au SUPER ADMIN : modification d'abonnement interdite.", 'error', 'Accès Refusé');
      return;
    }
    try {
      const setSubscriptionCallable = httpsCallable<
        { userId: string; subscriptionTier: string; durationDays: number },
        { success: boolean }
      >(functions, 'setSubscription');
      await setSubscriptionCallable({ userId, subscriptionTier: tier, durationDays: 30 });
      showAlert(`Forfait ${tier} appliqué avec succès.`, 'success');
    } catch (e: any) {
      console.error(e);
      showAlert("Erreur lors de la mise à jour de l'abonnement : " + (e?.message || 'Erreur.'), 'error');
    }
  };

  const handleUpdateUserBoosters = async (userId: string, count: number) => {
    if (!isUserSuperAdmin(currentAdmin)) {
      showAlert("Action réservée exclusivement au SUPER ADMIN : modification des boosters interdite.", 'error', 'Accès Refusé');
      return;
    }
    try {
      const targetUser = users.find((u) => u.id === userId);
      const current = Number(targetUser?.freeBoostsRemaining) || 0;
      const delta = Math.round(count) - current;
      if (delta === 0) return;

      const adjustBoostersCallable = httpsCallable<{ userId: string; delta: number }, { success: boolean }>(
        functions,
        'adjustBoosters'
      );
      await adjustBoostersCallable({ userId, delta });
      showAlert('Solde de boosters ajusté.', 'success');
    } catch (e: any) {
      console.error(e);
      showAlert('Erreur lors de la modification des boosters : ' + (e?.message || 'Erreur.'), 'error');
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
      const setRoleCallable = httpsCallable<{ targetUid: string; role: string }, { success: boolean }>(
        functions,
        'setRole'
      );
      await setRoleCallable({ targetUid: userId, role: 'SUPER_ADMIN' });
      showAlert(`Le modérateur "${targetUser.name || targetUser.contactPhone}" a été promu Super Administrateur avec succès.`, 'success', 'Promotion Réussie');
    } catch (e: any) {
      console.error(e);
      showAlert("Erreur lors de la mise à jour du rôle : " + (e?.message || 'Erreur.'), 'error');
    }
  };

  // 5. Fraud Reports handlers
  const handleResolveReport = async (reportId: string, notes?: string) => {
    try {
      const resolveReportCallable = httpsCallable<{ reportId: string; note?: string }, { success: boolean }>(
        functions,
        'resolveReport'
      );
      await resolveReportCallable({ reportId, note: notes });
      showAlert('Signalement résolu avec succès.', 'success');
    } catch (e: any) {
      console.error(e);
      showAlert('Erreur lors du traitement du signalement : ' + (e?.message || 'Erreur.'), 'error');
    }
  };

  const handleDismissReport = async (reportId: string, notes?: string) => {
    try {
      const dismissReportCallable = httpsCallable<{ reportId: string; note?: string }, { success: boolean }>(
        functions,
        'dismissReport'
      );
      await dismissReportCallable({ reportId, note: notes });
      showAlert('Signalement classé sans suite.', 'success');
    } catch (e: any) {
      console.error(e);
      showAlert('Erreur lors du classement du signalement : ' + (e?.message || 'Erreur.'), 'error');
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

  // Étape 4.2 & S-18 : Modération sur les annonces réelles uniquement (pas de démo en production)
  const allAds = ads;

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
        <form onSubmit={handleLogin} className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 text-center">
          <div className="flex flex-col items-center justify-center">
            <BizboosterLogo variant="stacked" iconSize={48} className="mb-2" />
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 mt-1">Espace Administration</span>
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
        onRejectExtension={handleRejectExtension}
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
        onLogKycView={handleLogKycView}
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
