import {describe, it, expect, beforeAll, afterAll, beforeEach} from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {getFirestore} from "firebase-admin/firestore";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {doc, setDoc, updateDoc} from "firebase/firestore";
import {
  reportAd,
  resubmitAd,
  registerView,
  settlePayment,
  syncAdViewCounters,
  isExplicitTestAd,
} from "../index";

const RULES_PROJECT_ID = "bizbooster-gabon-wf-rules";
const RULES_PATH = path.resolve(__dirname, "../../../firestore.rules");

describe("Emulateur : parcours critiques (publication, édition attente, prolongation, signalement, KYC, F1/F6)", () => {
  const adminDb = getFirestore();
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = fs.readFileSync(RULES_PATH, "utf8");
    testEnv = await initializeTestEnvironment({
      projectId: RULES_PROJECT_ID,
      firestore: {
        rules,
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it("1. Publication et édition d'une annonce en attente respectent firestore.rules + F1 isExplicitTestAd", async () => {
    const ownerDb = testEnv.authenticatedContext("wf_owner_pub").firestore();
    const adRef = doc(ownerDb, "ads", "wf_ad_pub_1");

    await assertSucceeds(
      setDoc(adRef, {
        userId: "wf_owner_pub",
        title: "Villa Libreville",
        mainCategory: "IMMOBILIER",
        price: 25000000,
        description: "Villa 3 chambres",
        contactPhone: "Non renseigné",
        contactName: "Annonceur",
        durationDays: 30,
        status: "PENDING_REVIEW",
      })
    );

    await assertSucceeds(
      updateDoc(adRef, {
        title: "Villa Libreville rénovée",
        price: 24500000,
      })
    );

    expect(isExplicitTestAd("wf_ad_pub_1", "wf_owner_pub")).toBe(false);
  });

  it("2. Édition/réémission via resubmitAd et prolongation via settlePayment fonctionnent sur émulateur", async () => {
    const ownerId = "wf_owner_ext";
    const adId = "wf_ad_ext_1";
    const payRef = "WF_PAY_EXT_1";

    await adminDb.collection("users").doc(ownerId).set({
      name: "Annonceur Extension",
      role: "USER",
      subscriptionTier: "STANDARD",
      freeBoostsRemaining: 0,
      consumedFreeAdsCount: 0,
    });

    const futureIso = new Date(Date.now() + 5 * 86400000).toISOString();
    await adminDb.collection("ads").doc(adId).set({
      userId: ownerId,
      title: "Terrain Owendo",
      mainCategory: "IMMOBILIER",
      price: 5000000,
      description: "Terrain titré",
      status: "ACTIVE",
      expiresAt: futureIso,
      durationDays: 14,
      viewsCount: 0,
    });

    const resubmitResult = await resubmitAd.run({
      data: {
        adId,
        updates: {
          title: "Terrain Owendo modifié",
          price: 5200000,
        },
      },
      auth: {uid: ownerId, token: {}} as never,
      rawRequest: {headers: {}, ip: "127.0.0.1"} as never,
      acceptsStreaming: false,
    });
    expect(resubmitResult).toEqual({success: true, adId});

    await adminDb.collection("ads").doc(adId).update({status: "ACTIVE"});

    await adminDb.collection("payments").doc(payRef).set({
      reference: payRef,
      userId: ownerId,
      productId: "AD_EXTEND",
      amount: 3000,
      status: "PENDING",
      attributed: false,
      metadata: {adId, days: 7},
      createdAt: new Date().toISOString(),
    });

    const settled = await settlePayment(payRef, {
      status: "SUCCESS",
      amountReceived: 3000,
    });
    expect(settled.status).toBe("SUCCESS");
    expect(settled.attributed).toBe(true);

    const updatedAd = (await adminDb.collection("ads").doc(adId).get()).data();
    expect(new Date(updatedAd?.expiresAt).getTime()).toBeGreaterThan(
      new Date(futureIso).getTime() + 6 * 86400000
    );
  });

  it("3. Signalement via reportAd, comptage réel via registerView/syncAdViewCounters et dépôt KYC", async () => {
    const ownerId = "wf_owner_rep";
    const viewerId = "wf_viewer_rep";
    const adId = "wf_ad_rep_1";

    await adminDb.collection("ads").doc(adId).set({
      userId: ownerId,
      title: "Véhicule Akanda",
      mainCategory: "MATERIEL_ROULANT",
      price: 4500000,
      description: "Bon état",
      status: "ACTIVE",
      durationDays: 14,
      viewsCount: 0,
      reportsCount: 0,
    });

    const reportRes = await reportAd.run({
      data: {
        adId,
        reason: "Contenu suspect",
        details: "Test émulateur",
        reporterPhone: "",
      },
      auth: {uid: viewerId, token: {}} as never,
      rawRequest: {headers: {}, ip: "127.0.0.1"} as never,
      acceptsStreaming: false,
    });
    expect(reportRes).toEqual({success: true, reportId: `${adId}_${viewerId}`});

    const viewRes = await registerView.run({
      data: {adId},
      auth: {uid: viewerId, token: {}} as never,
      rawRequest: {headers: {}, ip: "127.0.0.1"} as never,
      acceptsStreaming: false,
    });
    expect(viewRes).toEqual({success: true, counted: true});

    // F6: registerView ne modifie pas ads.viewsCount à chaque vue
    const adAfterView = (await adminDb.collection("ads").doc(adId).get()).data();
    expect(adAfterView?.viewsCount).toBe(0);
    expect(adAfterView?.reportsCount).toBe(1);

    const counterDoc = (await adminDb.collection("ad_counters").doc(adId).get()).data();
    expect(counterDoc?.views).toBe(1);

    // F6: syncAdViewCounters recopie ad_counters.views dans ads.viewsCount
    await syncAdViewCounters(adminDb);
    const adAfterSync = (await adminDb.collection("ads").doc(adId).get()).data();
    expect(adAfterSync?.viewsCount).toBe(1);

    // Upload KYC sur émulateur : autorisé depuis NOT_SUBMITTED, verrouillé après VERIFIED
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "wf_kyc_user"), {
        name: "Titulaire KYC",
        role: "USER",
        idVerificationStatus: "NOT_SUBMITTED",
      });
    });
    const kycDb = testEnv.authenticatedContext("wf_kyc_user").firestore();
    const kycRef = doc(kycDb, "users", "wf_kyc_user");
    await assertSucceeds(
      updateDoc(kycRef, {
        idDocumentUrl: "https://storage.googleapis.com/emul/kyc/piece.jpg",
        idVerificationStatus: "PENDING",
      })
    );
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "users", "wf_kyc_user"), {
        idVerificationStatus: "VERIFIED",
      });
    });
    // Un utilisateur VERIFIED ne peut pas repasser en PENDING sans nouvelle pièce ni modifier son document en restant VERIFIED,
    // mais peut resoumettre un nouveau KYC (idDocumentUrl + idVerificationStatus: 'PENDING').
    await assertFails(
      updateDoc(kycRef, {
        idVerificationStatus: "PENDING",
      })
    );
    await assertSucceeds(
      updateDoc(kycRef, {
        idDocumentUrl: "https://storage.googleapis.com/emul/kyc/autre.jpg",
        idVerificationStatus: "PENDING",
      })
    );
  });
});

