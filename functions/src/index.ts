import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {getAuth} from "firebase-admin/auth";
import {initializeApp} from "firebase-admin/app";

initializeApp();

/**
 * Normalise un numéro de téléphone gabonais (+241).
 *
 * @param {string} input - Le numéro de téléphone saisi.
 * @return {{e164: string, rawDigits: string}} Format E.164 et chiffres bruts.
 */
function normalizeGabonPhone(input: string): {
  e164: string;
  rawDigits: string;
} {
  const digits = (input || "").replace(/\D/g, "");
  let clean = digits;
  if (clean.startsWith("241")) {
    clean = clean.slice(3);
  }
  if (clean.startsWith("0")) {
    clean = clean.slice(1);
  }
  return {
    e164: `+241${clean}`,
    rawDigits: clean,
  };
}

/**
 * 1. Authentification sécurisée par Téléphone + Mot de passe
 * Permet aux utilisateurs existants et nouveaux de se connecter directement
 * sans avoir à demander un SMS OTP à chaque fois.
 */
export const loginWithPhonePassword = onCall(
  {cors: true},
  async (request) => {
    const {phoneNumber, password} = request.data || {};

    if (!phoneNumber || !password) {
      throw new HttpsError(
        "invalid-argument",
        "Numéro de téléphone et mot de passe requis."
      );
    }

    const {e164, rawDigits} = normalizeGabonPhone(String(phoneNumber));
    if (rawDigits.length < 8) {
      throw new HttpsError(
        "invalid-argument",
        "Numéro gabonais invalide (8 chiffres requis après +241)."
      );
    }

    const db = getFirestore();
    const authAdmin = getAuth();

    // Recherche dans la collection users de Firestore
    let snap = await db
      .collection("users")
      .where("contactPhone", "==", e164)
      .limit(1)
      .get();

    if (snap.empty) {
      snap = await db
        .collection("users")
        .where("phoneNumber", "==", e164)
        .limit(1)
        .get();
    }

    if (snap.empty) {
      snap = await db
        .collection("users")
        .where("contactPhone", "==", rawDigits)
        .limit(1)
        .get();
    }

    if (!snap.empty) {
      const userDoc = snap.docs[0];
      const userData = userDoc.data();
      const expectedPassword = userData.password || "users-with-no-password";

      if (String(password).trim() !== String(expectedPassword).trim()) {
        throw new HttpsError(
          "unauthenticated",
          "Numéro ou mot de passe incorrect."
        );
      }

      const syntheticEmail = `${rawDigits}@bizbooster.ga`;

      // 1. Sync email/password into Firebase Auth for client auth
      try {
        await authAdmin.updateUser(userDoc.id, {
          email: syntheticEmail,
          password: expectedPassword,
        });
      } catch (updateErr: unknown) {
        const errCode = (updateErr as { code?: string })?.code;
        if (errCode === "auth/user-not-found") {
          try {
            await authAdmin.createUser({
              uid: userDoc.id,
              phoneNumber: e164,
              email: syntheticEmail,
              password: expectedPassword,
            });
          } catch {
            // ignore
          }
        }
      }

      // 2. Try custom token if IAM allows, otherwise client signs in directly
      let customToken: string | null = null;
      try {
        customToken = await authAdmin.createCustomToken(userDoc.id);
      } catch (tokenErr) {
        console.warn("createCustomToken skipped (no signBlob IAM):", tokenErr);
      }

      return {
        success: true,
        customToken,
        syntheticEmail,
        user: {
          id: userDoc.id,
          ...userData,
          password: expectedPassword,
        },
      };
    }

    // Si non trouvé dans Firestore, vérifier si le compte existe dans Auth
    try {
      const fbUser = await authAdmin.getUserByPhoneNumber(e164);
      if (fbUser) {
        // Pour un utilisateur existant sans profil Firestore explicite
        if (String(password).trim() === "users-with-no-password") {
          const syntheticEmail = `${rawDigits}@bizbooster.ga`;
          try {
            await authAdmin.updateUser(fbUser.uid, {
              email: syntheticEmail,
              password: "users-with-no-password",
            });
          } catch {
            // ignore
          }
          let customToken: string | null = null;
          try {
            customToken = await authAdmin.createCustomToken(fbUser.uid);
          } catch {
            // ignore
          }
          const initialUser = {
            id: fbUser.uid,
            contactPhone: e164,
            phoneNumber: e164,
            name: "Annonceur BizBooster",
            role: "USER",
            password: "users-with-no-password",
            createdAt: new Date().toISOString(),
            termsAccepted: true,
            isVerified: true,
          };
          await db
            .collection("users")
            .doc(fbUser.uid)
            .set(initialUser, {merge: true});

          return {
            success: true,
            customToken,
            syntheticEmail,
            user: initialUser,
          };
        }
      }
    } catch {
      // ignore
    }

    throw new HttpsError(
      "not-found",
      "Aucun compte associé à ce numéro de téléphone. " +
        "Veuillez vous inscrire ou vérifier via code SMS OTP."
    );
  }
);

/**
 * Vérifie l'éligibilité au renouvellement de mot de passe (règle des 24h).
 * Empêche le spam de SMS OTP si le mot de passe a été modifié récemment.
 */
export const checkPasswordResetEligibility = onCall(
  {cors: true},
  async (request) => {
    const {phoneNumber} = request.data || {};
    if (!phoneNumber) {
      throw new HttpsError("invalid-argument", "Numéro de téléphone requis.");
    }

    const {e164, rawDigits} = normalizeGabonPhone(String(phoneNumber));
    const db = getFirestore();

    let snap = await db
      .collection("users")
      .where("contactPhone", "==", e164)
      .limit(1)
      .get();

    if (snap.empty) {
      snap = await db
        .collection("users")
        .where("phoneNumber", "==", e164)
        .limit(1)
        .get();
    }

    if (snap.empty) {
      snap = await db
        .collection("users")
        .where("contactPhone", "==", rawDigits)
        .limit(1)
        .get();
    }

    if (!snap.empty) {
      const userData = snap.docs[0].data();
      const lastChange = userData.lastPasswordChangeDate;
      if (lastChange) {
        const lastTime = new Date(lastChange).getTime();
        const now = Date.now();
        const diffHours = (now - lastTime) / (1000 * 60 * 60);
        if (diffHours < 24) {
          const remainingHours = Math.ceil(24 - diffHours);
          return {
            allowed: false,
            remainingHours,
            lastPasswordChangeDate: lastChange,
          };
        }
      }
    }

    return {
      allowed: true,
      remainingHours: 0,
    };
  }
);

/**
 * 2. Expiration automatique des annonces et gestion des dépassements de quota :
 * - Expire les annonces actives dont la date de validité est passée.
 * - Rétrograde les abonnements expirés (PRO/ELITE/BUSINESS vers STANDARD).
 * - Suspend automatiquement les annonces excédentaires (les plus récentes)
 *   au-delà du quota de 3 annonces du forfait Standard.
 */
export const expireAds = onSchedule("every 60 minutes", async () => {
  const db = getFirestore();
  const now = new Date().toISOString();

  // A. Expirer les annonces dont expiresAt <= now
  const expiredAdsSnap = await db
    .collection("ads")
    .where("status", "==", "ACTIVE")
    .where("expiresAt", "<=", now)
    .get();

  const batch = db.batch();
  expiredAdsSnap.forEach((doc) => batch.update(doc.ref, {status: "EXPIRED"}));
  await batch.commit();

  // B. Détecter les utilisateurs dont l'abonnement mensuel a expiré
  const expiredUsersSnap = await db
    .collection("users")
    .where("subscriptionTier", "in", ["PRO", "ELITE", "BUSINESS"])
    .where("subscriptionExpiresAt", "<=", now)
    .get();

  for (const userDoc of expiredUsersSnap.docs) {
    const userId = userDoc.id;

    // Rétrograde en STANDARD
    await userDoc.ref.update({
      subscriptionTier: "STANDARD",
      subscriptionExpiredAt: now,
    });

    // Quota Standard = 3 annonces actives max
    const activeAdsSnap = await db
      .collection("ads")
      .where("userId", "==", userId)
      .where("status", "==", "ACTIVE")
      .get();

    if (activeAdsSnap.size > 3) {
      // Trier par date croissante (les plus anciennes restent actives)
      const sortedDocs = [...activeAdsSnap.docs].sort((a, b) => {
        const tA = new Date(
          a.data().createdAt || a.data().publishedAt || 0
        ).getTime();
        const tB = new Date(
          b.data().createdAt || b.data().publishedAt || 0
        ).getTime();
        return tA - tB;
      });

      // Les 3 premières restent actives, les excédentaires sont suspendues
      const excessDocs = sortedDocs.slice(3);
      const quotaBatch = db.batch();
      excessDocs.forEach((doc) => {
        quotaBatch.update(doc.ref, {
          status: "SUSPENDED",
          suspensionReason: "FORFAIT_EXPIRE_QUOTA",
          suspendedAt: now,
        });
      });
      await quotaBatch.commit();
    }
  }
});

/**
 * 3. Mise à jour des compteurs de l'Observatoire (system_counters)
 * à chaque écriture sur la collection ads.
 */
export const updateCounters = onDocumentWritten("ads/{adId}", async () => {
  const db = getFirestore();
  const activeSnap = await db
    .collection("ads")
    .where("status", "==", "ACTIVE")
    .get();

  const totalValue = activeSnap.docs.reduce(
    (sum, d) => sum + (d.data().price || 0),
    0
  );

  await db.doc("system_counters/global").set(
    {
      totalActiveAds: activeSnap.size,
      totalCatalogValueFCFA: totalValue,
      updatedAt: new Date().toISOString(),
    },
    {merge: true}
  );
});

interface SingPayTransactionData {
  id?: string;
  _id?: string;
  reference?: string;
  status?: string;
  result?: string;
  amount?: string | number;
  client_msisdn?: string;
}

interface SingPayResponsePayload {
  transaction?: SingPayTransactionData;
  status?: {
    code?: string;
    message?: string;
    success?: boolean;
    result_code?: string;
  };
  message?: string;
}

/**
 * 4. Passerelle SingPay Gabon (Paiement Moov Money réel)
 * Déclenche un appel à l'API SingPay pour envoyer un USSD Push sur le mobile.
 */
export const initiateSingPayPayment = onCall(
  {cors: true},
  async (request) => {
    const {amount, phoneNumber, reference, itemDescription, operator} =
      request.data || {};

    if (!amount || Number(amount) <= 0) {
      throw new HttpsError("invalid-argument", "Montant de paiement invalide.");
    }
    if (!phoneNumber) {
      throw new HttpsError("invalid-argument", "Numéro de téléphone requis.");
    }
    if (!reference) {
      throw new HttpsError(
        "invalid-argument",
        "Référence de transaction requise."
      );
    }

    const requestedOperator = operator || "MOOV_MONEY";
    if (requestedOperator === "AIRTEL_MONEY") {
      throw new HttpsError(
        "failed-precondition",
        "Airtel Money est en standby. Veuillez régler via Moov Money."
      );
    }

    const {e164, rawDigits} = normalizeGabonPhone(String(phoneNumber));
    const isMoov =
      rawDigits.startsWith("60") ||
      rawDigits.startsWith("62") ||
      rawDigits.startsWith("65") ||
      rawDigits.startsWith("66");

    if (!isMoov) {
      throw new HttpsError(
        "invalid-argument",
        "Numéro Moov Money invalide (préfixes requis: 060, 062, 065, 066)."
      );
    }

    const clientMsisdn = `241${rawDigits}`;

    const db = getFirestore();
    const settingsSnap = await db.doc("settings/payment_gateway").get();
    const settingsData = settingsSnap.exists ? settingsSnap.data() || {} : {};

    const clientId =
      process.env.SINGPAY_CLIENT_ID ||
      (settingsData.singpayClientId as string) ||
      "";
    const clientSecret =
      process.env.SINGPAY_CLIENT_SECRET ||
      (settingsData.singpayClientSecret as string) ||
      "";
    const walletId =
      process.env.SINGPAY_WALLET_ID ||
      (settingsData.singpayWalletId as string) ||
      "";
    // Numéro Moov de destination (disbursement) fourni par l'administrateur
    const disbursement =
      (settingsData.moovDisbursementNumber as string) ||
      process.env.SINGPAY_MOOV_DISBURSEMENT ||
      "24162188734"; // 62 18 87 34

    if (!clientId || !clientSecret || !walletId) {
      throw new HttpsError(
        "failed-precondition",
        "Identifiants SingPay manquants (Client ID, Secret, Wallet ID)."
      );
    }

    const paymentPayload = {
      amount: Number(amount),
      reference: String(reference),
      client_msisdn: clientMsisdn,
      portefeuille: walletId,
      disbursement: disbursement,
      isTransfer: false,
    };

    try {
      const resp = await fetch("https://gateway.singpay.ga/v1/62/paiement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": clientId,
          "x-client-secret": clientSecret,
          "x-wallet": walletId,
        },
        body: JSON.stringify(paymentPayload),
      });

      const responseText = await resp.text();
      let responseJson: SingPayResponsePayload | null = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        // Plain text
      }

      if (!resp.ok || !responseJson?.status?.success) {
        const errorMsg =
          responseJson?.status?.message ||
          responseJson?.message ||
          responseText ||
          `Erreur SingPay code ${resp.status}`;
        throw new HttpsError("internal", `SingPay: ${errorMsg}`);
      }

      const singpayTx = responseJson.transaction || {};
      const singpayTxId = singpayTx.id || singpayTx._id || "";

      await db.collection("payments").doc(String(reference)).set({
        reference: String(reference),
        singpayTransactionId: singpayTxId,
        amount: Number(amount),
        operator: "MOOV_MONEY",
        clientPhone: e164,
        clientMsisdn,
        disbursementPhone: disbursement,
        itemDescription: itemDescription || "Paiement BIZBOOSTER Gabon",
        status: "PENDING",
        singpayStatus: singpayTx.status || "Start",
        singpayResult: singpayTx.result || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return {
        success: true,
        reference: String(reference),
        transactionId: singpayTxId,
        status: "PENDING",
        message: "Demande USSD Push envoyée sur le mobile Moov Money.",
      };
    } catch (err: unknown) {
      if (err instanceof HttpsError) {
        throw err;
      }
      const e = err as Error;
      throw new HttpsError("internal", `SingPay communication: ${e.message}`);
    }
  }
);

/**
 * 5. Vérification du statut d'une transaction SingPay
 */
export const checkSingPayPaymentStatus = onCall(
  {cors: true},
  async (request) => {
    const {transactionId, reference} = request.data || {};

    if (!reference && !transactionId) {
      throw new HttpsError(
        "invalid-argument",
        "Référence ou ID de transaction requis."
      );
    }

    const db = getFirestore();
    let paymentDocRef = null;
    let paymentData: Record<string, unknown> | null = null;

    if (reference) {
      paymentDocRef = db.collection("payments").doc(String(reference));
      const snap = await paymentDocRef.get();
      if (snap.exists) {
        paymentData = snap.data() || null;
      }
    }

    if (paymentData?.status === "SUCCESS") {
      return {
        status: "SUCCESS",
        result: "Success",
        reference: paymentData.reference as string,
        transactionId: paymentData.singpayTransactionId as string,
        message: "Paiement validé avec succès.",
      };
    }

    const settingsSnap = await db.doc("settings/payment_gateway").get();
    const settingsData = settingsSnap.exists ? settingsSnap.data() || {} : {};

    const clientId =
      process.env.SINGPAY_CLIENT_ID ||
      (settingsData.singpayClientId as string) ||
      "";
    const clientSecret =
      process.env.SINGPAY_CLIENT_SECRET ||
      (settingsData.singpayClientSecret as string) ||
      "";
    const walletId =
      process.env.SINGPAY_WALLET_ID ||
      (settingsData.singpayWalletId as string) ||
      "";

    if (!clientId || !clientSecret) {
      return {
        status: (paymentData?.status as string) || "PENDING",
        message: "Clés SingPay non configurées.",
      };
    }

    const targetTxId =
      transactionId || (paymentData?.singpayTransactionId as string);
    let endpoint = "";
    const headers: Record<string, string> = {
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
    };

    if (targetTxId) {
      endpoint = `https://gateway.singpay.ga/v1/transaction/api/status/${encodeURIComponent(
        targetTxId
      )}`;
    } else if (reference) {
      endpoint = `https://gateway.singpay.ga/v1/transaction/api/search/by-reference/${encodeURIComponent(
        reference
      )}`;
      headers["x-wallet"] = walletId;
    }

    try {
      const resp = await fetch(endpoint, {
        method: "GET",
        headers,
      });

      const responseText = await resp.text();
      let responseJson: SingPayResponsePayload | null = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        // Plain text
      }

      if (!resp.ok) {
        return {
          status: (paymentData?.status as string) || "PENDING",
          message: "En attente de validation auprès de l'opérateur.",
        };
      }

      const tx = responseJson?.transaction || {};
      const txStatus = tx.status || "";
      const txResult = tx.result || "";

      let finalStatus = "PENDING";
      let failureReason = "";

      if (
        txResult === "Success" ||
        (txStatus === "Terminate" && txResult === "Success")
      ) {
        finalStatus = "SUCCESS";
      } else if (txResult === "PasswordError") {
        finalStatus = "FAILED";
        failureReason = "Code PIN Moov Money erroné saisi sur le mobile.";
      } else if (txResult === "BalanceError") {
        finalStatus = "FAILED";
        failureReason = "Solde Moov Money insuffisant sur le compte client.";
      } else if (txResult === "TimeOutError") {
        finalStatus = "FAILED";
        failureReason = "Délai d'attente dépassé (timeout USSD Moov).";
      } else if (
        txResult === "Error" ||
        (txStatus === "Terminate" && txResult && txResult !== "Success")
      ) {
        finalStatus = "FAILED";
        failureReason = "Paiement refusé ou annulé par l'utilisateur.";
      }

      if (
        paymentDocRef &&
        (finalStatus !== paymentData?.status ||
          txStatus !== paymentData?.singpayStatus)
      ) {
        await paymentDocRef.set(
          {
            status: finalStatus,
            singpayStatus: txStatus,
            singpayResult: txResult,
            failureReason: failureReason || null,
            updatedAt: new Date().toISOString(),
          },
          {merge: true}
        );
      }

      return {
        status: finalStatus,
        result: txResult,
        singpayStatus: txStatus,
        failureReason,
        transactionId: tx.id || targetTxId,
        reference: tx.reference || reference,
      };
    } catch (err: unknown) {
      const e = err as Error;
      return {
        status: (paymentData?.status as string) || "PENDING",
        message: e.message,
      };
    }
  }
);

/**
 * 6. Webhook de rappel officiel SingPay
 */
export const singpayWebhook = onRequest(
  {cors: true},
  async (req, res) => {
    try {
      const data = (req.body || {}) as {
        transaction?: SingPayTransactionData;
        reference?: string;
        result?: string;
        status?: string;
      };
      const tx = data.transaction || data;
      const reference = tx.reference;
      const result = tx.result;
      const status = tx.status;

      if (reference) {
        const db = getFirestore();
        const docRef = db.collection("payments").doc(String(reference));
        const isSuccess =
          result === "Success" ||
          (status === "Terminate" && result === "Success");

        await docRef.set(
          {
            singpayStatus: status || null,
            singpayResult: result || null,
            status: isSuccess ? "SUCCESS" : result ? "FAILED" : "PENDING",
            updatedAt: new Date().toISOString(),
            rawWebhookPayload: data,
          },
          {merge: true}
        );
      }
      res.status(200).json({received: true});
    } catch (err: unknown) {
      const e = err as Error;
      res.status(500).json({error: e.message});
    }
  }
);
