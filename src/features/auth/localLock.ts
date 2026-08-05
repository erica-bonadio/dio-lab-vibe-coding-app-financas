import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';

const PASS_KEY = 'capim_local_pass_hash';
const BIO_KEY = 'capim_bio_enabled';

async function hashPassword(password: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `capim:${password}`,
  );
}

export async function hasLocalPassword(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(PASS_KEY);
  return Boolean(v);
}

export async function setupLocalPassword(password: string): Promise<void> {
  if (password.length < 4) {
    throw new Error('Use pelo menos 4 caracteres.');
  }
  const hash = await hashPassword(password);
  await SecureStore.setItemAsync(PASS_KEY, hash);
}

export async function verifyLocalPassword(password: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PASS_KEY);
  if (!stored) return false;
  const hash = await hashPassword(password);
  return stored === hash;
}

export async function clearLocalLock(): Promise<void> {
  await SecureStore.deleteItemAsync(PASS_KEY);
  await SecureStore.deleteItemAsync(BIO_KEY);
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIO_KEY)) === '1';
}

export async function setBiometricEnabled(on: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIO_KEY, on ? '1' : '0');
}

export async function canUseBiometrics(): Promise<{
  available: boolean;
  label: string;
}> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const face = types.includes(
    LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
  );
  return {
    available: hasHardware && enrolled,
    label: face ? 'Face ID' : 'Digital',
  };
}

export async function unlockWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Desbloquear Capim',
    cancelLabel: 'Usar senha',
    disableDeviceFallback: true,
  });
  return result.success;
}
