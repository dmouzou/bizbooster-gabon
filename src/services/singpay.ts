import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { PaymentOperator } from '../types';

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface PreviewQuoteParams {
  productId: string;
  metadata?: Record<string, unknown>;
}

export interface PreviewQuoteResult {
  productId: string;
  amount: number;
  lines: QuoteLine[];
  metadata: Record<string, unknown>;
}

export interface SingPayInitiateParams {
  productId: string;
  metadata?: Record<string, unknown>;
  phoneNumber: string;
  operator?: PaymentOperator;
  idempotencyKey?: string;
  // Options de compatibilité rétroactive
  amount?: number;
  itemDescription?: string;
}

export interface SingPayInitiateResult {
  reference: string;
  amount: number;
  expiresAt: string;
  lines: QuoteLine[];
  operator: PaymentOperator;
  status?: string;
}

export interface SingPayStatusResult {
  status: 'INITIATING' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'NEEDS_REVIEW';
  result?: string;
  singpayStatus?: string;
  failureReason?: string;
  transactionId?: string;
  reference?: string;
  message?: string;
  amount?: number;
  attributed?: boolean;
}

/**
 * Prévisualisation officielle du devis calculé par le serveur (Phase 8.1).
 */
export async function previewQuote(params: PreviewQuoteParams): Promise<PreviewQuoteResult> {
  const callable = httpsCallable<PreviewQuoteParams, PreviewQuoteResult>(
    functions,
    'previewQuote'
  );
  const response = await callable(params);
  return response.data;
}

/**
 * Déclenche un prélèvement USSD Push officiel via SingPay Gabon (Moov Money ou Airtel Money).
 */
export async function initiateSingPay(params: SingPayInitiateParams): Promise<SingPayInitiateResult> {
  const callable = httpsCallable<SingPayInitiateParams, SingPayInitiateResult>(
    functions,
    'initiateSingPayPayment'
  );
  const response = await callable(params);
  return response.data;
}

/**
 * Interroge le statut réel de la transaction auprès du serveur et SingPay (Phase 5.1).
 */
export async function pollSingPayStatus(params: {
  reference: string;
  transactionId?: string;
}): Promise<SingPayStatusResult> {
  const callable = httpsCallable<{ reference: string }, SingPayStatusResult>(
    functions,
    'checkSingPayPaymentStatus'
  );
  const response = await callable(params);
  return response.data;
}
