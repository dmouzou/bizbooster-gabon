import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { PaymentOperator } from '../types';

export interface SingPayInitiateParams {
  amount: number;
  phoneNumber: string;
  reference: string;
  itemDescription?: string;
  operator?: PaymentOperator;
}

export interface SingPayInitiateResult {
  success: boolean;
  reference: string;
  transactionId?: string;
  status: string;
  message: string;
}

export interface SingPayStatusResult {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  result?: string;
  singpayStatus?: string;
  failureReason?: string;
  transactionId?: string;
  reference?: string;
  message?: string;
}

export const MOOV_MERCHANT_NUMBER = '62 18 87 34';
export const MOOV_MERCHANT_E164 = '+241 62 18 87 34';
export const AIRTEL_MERCHANT_NUMBER = '74 00 00 00';
export const AIRTEL_MERCHANT_E164 = '+241 74 00 00 00';

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
 * Interroge le statut réel de la transaction Moov Money auprès de SingPay.
 */
export async function pollSingPayStatus(params: {
  transactionId?: string;
  reference: string;
}): Promise<SingPayStatusResult> {
  const callable = httpsCallable<{ transactionId?: string; reference: string }, SingPayStatusResult>(
    functions,
    'checkSingPayPaymentStatus'
  );
  const response = await callable(params);
  return response.data;
}
