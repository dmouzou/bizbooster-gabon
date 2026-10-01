import React, { useEffect, useState } from 'react';
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
import { getFrontendUrl } from './utils/navigation';

type AdminStatus = 'loading' | 'signedOut' | 'denied' | 'admin';

export default function AdminApp() {
  const [status, setStatus] = useState<AdminStatus>('loading');
  const [currentAdmin, setCurrentAdmin] = useState<UserProfile | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<AdReport[]>([]);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 1. Watch the Firebase session and verify the ADMIN / SUPER_ADMIN role in users/{uid}
  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setStatus('signedOut');
        setCurrentAdmin(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (snap.exists()) {
          const profile = { id: snap.id, ...snap.data() } as UserProfile;
          if (isUserAdmin(profile)) {
            setCurrentAdmin(profile);
            setStatus('admin');
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
              setCurrentAdmin(profile);
              setStatus('admin');
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
              setCurrentAdmin(profile);
              setStatus('admin');
              return;
            }
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
      alert("Échec de l'approbation. Vérifiez votre connexion et vos droits.");
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
      alert('Échec du rejet.');
    }
  };

  const handleDeleteAd = async (adId: string) => {
    if (!window.confirm('Supprimer définitivement cette annonce ?')) return;
    try {
      await deleteDoc(doc(db, 'ads', adId));
      await log(adId, 'DELETED');
    } catch (e) {
      console.error(e);
      alert('Échec de la suppression.');
    }
  };

  // 4. KYC & VIP Exemption handlers (VIP exemption STRICTLY restricted to SUPER ADMIN)
  const handleToggleExemption = async (userId: string, isExempt: boolean) => {
    if (!isUserSuperAdmin(currentAdmin)) {
      alert("Action réservée exclusivement au SUPER ADMIN : création/révocation de partenaire VIP interdite.");
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
      alert("Erreur lors de la mise à jour de l'exonération.");
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
      alert("Erreur lors de la validation de la pièce d'identité.");
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
      alert("Erreur lors du rejet de la pièce d'identité.");
    }
  };

  // 4b. Subscription & Boosters management (STRICTLY restricted to SUPER ADMIN)
  const handleUpdateUserSubscription = async (userId: string, tier: SubscriptionTier) => {
    if (!isUserSuperAdmin(currentAdmin)) {
      alert("Action réservée exclusivement au SUPER ADMIN : modification d'abonnement interdite.");
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
      alert("Erreur lors de la mise à jour de l'abonnement.");
    }
  };

  const handleUpdateUserBoosters = async (userId: string, count: number) => {
    if (!isUserSuperAdmin(currentAdmin)) {
      alert("Action réservée exclusivement au SUPER ADMIN : modification des boosters interdite.");
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
      alert("Erreur lors de la modification des boosters.");
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'USER' | 'ADMIN' | 'SUPER_ADMIN') => {
    if (!isUserSuperAdmin(currentAdmin)) {
      alert("Action réservée exclusivement au SUPER ADMIN : modification des rôles interdite.");
      return;
    }
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    // Règle 2b: Un Super Admin ne peut pas être révoqué par un autre Super Admin depuis l'interface
    if ((targetUser.role as any) === 'SUPER_ADMIN' || (targetUser.role as any) === 'SUPER ADMIN') {
      alert("Action interdite : un Super Administrateur ne peut pas être rétrogradé depuis cette interface. Toute révocation doit être effectuée manuellement dans la base de données Firestore.");
      return;
    }

    // Règle 2a: Un utilisateur standard ne peut pas devenir un admin/modérateur depuis cette interface
    if (targetUser.role !== 'ADMIN') {
      alert("Action refusée : un utilisateur standard ne peut pas être nommé modérateur/admin depuis cette interface (création réservée manuellement avec identifiants distincts).");
      return;
    }

    // Règle 2b: Un modérateur ne peut être que promu SUPER ADMIN
    if (newRole !== 'SUPER_ADMIN') {
      alert("Un modérateur ne peut être que promu au rang de Super Administrateur.");
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        role: 'SUPER_ADMIN',
      });
      await log(userId, 'ROLE_PROMOTED_SUPER_ADMIN', `Modérateur promu au rang de Super Administrateur`);
      alert(`Le modérateur "${targetUser.name || targetUser.contactPhone}" a été promu Super Administrateur avec succès.`);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la mise à jour du rôle.");
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
      alert('Erreur lors du traitement du signalement.');
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
      alert('Erreur lors du classement du signalement.');
    }
  };

  const handleDeleteReportedAd = async (adId: string, reportId: string) => {
    if (!window.confirm("Supprimer définitivement l'annonce signalée pour fraude ?")) return;
    try {
      await deleteDoc(doc(db, 'ads', adId));
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        resolutionNotes: 'Annonce frauduleuse supprimée définitivement par la modération.',
      });
      await log(adId, 'AD_DELETED_FOR_FRAUD');
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la suppression de l'annonce signalée.");
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
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 text-sm">
        Chargement…
      </div>
    );
  }

  if (status === 'signedOut') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <form onSubmit={handleLogin} className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
          <h1 className="text-lg font-black text-slate-900">BIZBOOSTER · Back-Office</h1>
          <p className="text-xs text-slate-500">Accès réservé à l'équipe de modération.</p>
          {loginError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{loginError}</div>}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            required
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-sm"
          >
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white max-w-sm rounded-2xl shadow-xl border border-slate-200 p-6 text-center space-y-3">
          <h1 className="text-lg font-black text-slate-900">Accès refusé</h1>
          <p className="text-xs text-slate-500">Ce compte n'a pas le rôle administrateur.</p>
          <button onClick={() => signOut(auth)} className="text-xs font-bold text-emerald-700 underline">
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AdminPanel
        currentUser={currentAdmin}
        ads={ads}
        users={users}
        reports={reports}
        onApproveAd={handleApproveAd}
        onRejectAd={handleRejectAd}
        onDeleteAd={handleDeleteAd}
        onSelectAdDetail={setSelectedAd}
        onSwitchToFrontend={() => {
          window.location.href = getFrontendUrl();
        }}
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
    </>
  );
}
