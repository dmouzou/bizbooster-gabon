import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface SendTwilioOtpParams {
  phoneNumber: string;
  channel?: 'sms' | 'whatsapp';
  country?: string;
}

export interface SendTwilioOtpResponse {
  success: boolean;
  channel: 'sms' | 'whatsapp';
  status: string;
  operator?: 'AIRTEL' | 'MOOV' | 'UNKNOWN';
}

export interface VerifyTwilioOtpParams {
  phoneNumber: string;
  code: string;
  mode: 'REGISTER' | 'FORGOT_PASSWORD';
  country?: string;
}

export interface VerifyTwilioOtpResponse {
  success: boolean;
  customToken: string;
  isNewUser: boolean;
  e164: string;
  country?: string;
}

export interface TwilioAdminConfig {
  accountSid: string;
  hasAuthToken: boolean;
  verifyServiceSid: string;
  isLive: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  version: number;
}

export interface SaveTwilioAdminConfigParams {
  accountSid?: string;
  authToken?: string;
  verifyServiceSid?: string;
  isLive?: boolean;
}

export interface TestTwilioOtpParams {
  testPhone: string;
  channel: 'sms' | 'whatsapp';
  country?: string;
}

export interface TestTwilioOtpResponse {
  success: boolean;
  to: string;
  operator: string;
  channel: string;
  status: string;
  sid: string;
  message: string;
}

/**
 * Envoie un code OTP Twilio Verify vers un numéro gabonais (SMS ou WhatsApp).
 */
export async function sendTwilioOtp(params: SendTwilioOtpParams): Promise<SendTwilioOtpResponse> {
  const fn = httpsCallable<SendTwilioOtpParams, SendTwilioOtpResponse>(functions, 'sendTwilioOtp');
  const res = await fn(params);
  return res.data;
}

/**
 * Valide le code OTP Twilio Verify et récupère le Firebase Custom Token.
 */
export async function verifyTwilioOtp(params: VerifyTwilioOtpParams): Promise<VerifyTwilioOtpResponse> {
  const fn = httpsCallable<VerifyTwilioOtpParams, VerifyTwilioOtpResponse>(functions, 'verifyTwilioOtp');
  const res = await fn(params);
  return res.data;
}

/**
 * Récupère la configuration Twilio Verify masquée (Super Admin uniquement).
 */
export async function getTwilioAdminConfig(): Promise<TwilioAdminConfig> {
  const fn = httpsCallable<void, TwilioAdminConfig>(functions, 'getTwilioAdminConfig');
  const res = await fn();
  return res.data;
}

/**
 * Enregistre ou met à jour les clés Twilio Verify dans Firestore private_config (Super Admin uniquement).
 */
export async function saveTwilioAdminConfig(params: SaveTwilioAdminConfigParams): Promise<{ success: boolean; message: string }> {
  const fn = httpsCallable<SaveTwilioAdminConfigParams, { success: boolean; message: string }>(functions, 'saveTwilioAdminConfig');
  const res = await fn(params);
  return res.data;
}

/**
 * Déclenche un envoi d'OTP de test vers un numéro gabonais pour vérifier la connectivité Twilio.
 */
export async function testTwilioOtpSend(params: TestTwilioOtpParams): Promise<TestTwilioOtpResponse> {
  const fn = httpsCallable<TestTwilioOtpParams, TestTwilioOtpResponse>(functions, 'testTwilioOtpSend');
  const res = await fn(params);
  return res.data;
}

