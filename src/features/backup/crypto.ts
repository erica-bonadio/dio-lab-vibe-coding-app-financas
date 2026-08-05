import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const SALT_KEY = 'capim_backup_salt';
const WRAPPED_DEK_KEY = 'capim_backup_wrapped_dek';
const PBKDF2_ITERATIONS = 120_000;

/** DEK em memória só enquanto a sessão estiver desbloqueada. */
let sessionDek: Uint8Array | null = null;

export type EncryptedBackupBlob = {
  version: 1;
  updatedAt: string;
  saltHex: string;
  wrappedDekHex: string;
  ivHex: string;
  ciphertextHex: string;
};

function randomBytes(length: number): Uint8Array {
  const hex = Crypto.getRandomBytes(length);
  return new Uint8Array(hex);
}

function deriveKek(password: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, utf8ToBytes(password), salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: 32,
  });
}

function aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array): {
  iv: Uint8Array;
  ciphertext: Uint8Array;
} {
  const iv = randomBytes(12);
  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(plaintext);
  return { iv, ciphertext };
}

function aesGcmDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  const cipher = gcm(key, iv);
  return cipher.decrypt(ciphertext);
}

/** Embrulha a DEK com KEK (AES-GCM). */
function wrapDek(kek: Uint8Array, dek: Uint8Array): string {
  const { iv, ciphertext } = aesGcmEncrypt(kek, dek);
  return `${bytesToHex(iv)}:${bytesToHex(ciphertext)}`;
}

function unwrapDek(kek: Uint8Array, wrappedHex: string): Uint8Array {
  const [ivHex, ctHex] = wrappedHex.split(':');
  if (!ivHex || !ctHex) throw new Error('DEK embrulhada inválida.');
  return aesGcmDecrypt(kek, hexToBytes(ivHex), hexToBytes(ctHex));
}

export function clearSessionDek(): void {
  sessionDek = null;
}

export function hasSessionDek(): boolean {
  return sessionDek !== null;
}

export async function hasLocalBackupKeys(): Promise<boolean> {
  const [salt, wrapped] = await Promise.all([
    SecureStore.getItemAsync(SALT_KEY),
    SecureStore.getItemAsync(WRAPPED_DEK_KEY),
  ]);
  return Boolean(salt && wrapped);
}

/**
 * Garante DEK local e a coloca na sessão.
 * Se ainda não existir, gera DEK nova (primeira ativação do backup).
 */
export async function unlockBackupKeys(password: string): Promise<void> {
  let saltHex = await SecureStore.getItemAsync(SALT_KEY);
  let wrapped = await SecureStore.getItemAsync(WRAPPED_DEK_KEY);

  if (!saltHex || !wrapped) {
    const salt = randomBytes(16);
    const dek = randomBytes(32);
    const kek = deriveKek(password, salt);
    wrapped = wrapDek(kek, dek);
    saltHex = bytesToHex(salt);
    await SecureStore.setItemAsync(SALT_KEY, saltHex);
    await SecureStore.setItemAsync(WRAPPED_DEK_KEY, wrapped);
    sessionDek = dek;
    return;
  }

  const kek = deriveKek(password, hexToBytes(saltHex));
  try {
    sessionDek = unwrapDek(kek, wrapped);
  } catch {
    throw new Error('Senha incorreta para o backup criptografado.');
  }
}

/**
 * Desembrulha DEK a partir do blob remoto (restauração em aparelho novo).
 * Também persiste salt/wrapped localmente e abre a sessão.
 */
export async function unlockFromRemoteBlob(
  password: string,
  blob: EncryptedBackupBlob,
): Promise<void> {
  const kek = deriveKek(password, hexToBytes(blob.saltHex));
  let dek: Uint8Array;
  try {
    dek = unwrapDek(kek, blob.wrappedDekHex);
  } catch {
    throw new Error('Senha incorreta para restaurar o backup.');
  }
  await SecureStore.setItemAsync(SALT_KEY, blob.saltHex);
  await SecureStore.setItemAsync(WRAPPED_DEK_KEY, blob.wrappedDekHex);
  sessionDek = dek;
}

export async function encryptSnapshotPayload(
  plaintextJson: string,
  updatedAt: string,
): Promise<EncryptedBackupBlob> {
  if (!sessionDek) {
    throw new Error('Sessão de backup bloqueada. Desbloqueie com a senha.');
  }
  const saltHex = await SecureStore.getItemAsync(SALT_KEY);
  const wrappedDekHex = await SecureStore.getItemAsync(WRAPPED_DEK_KEY);
  if (!saltHex || !wrappedDekHex) {
    throw new Error('Chaves de backup não inicializadas.');
  }
  const { iv, ciphertext } = aesGcmEncrypt(
    sessionDek,
    utf8ToBytes(plaintextJson),
  );
  return {
    version: 1,
    updatedAt,
    saltHex,
    wrappedDekHex,
    ivHex: bytesToHex(iv),
    ciphertextHex: bytesToHex(ciphertext),
  };
}

export function decryptSnapshotPayload(blob: EncryptedBackupBlob): string {
  if (!sessionDek) {
    throw new Error('Sessão de backup bloqueada. Desbloqueie com a senha.');
  }
  if (blob.version !== 1) {
    throw new Error('Versão de backup não suportada.');
  }
  const plain = aesGcmDecrypt(
    sessionDek,
    hexToBytes(blob.ivHex),
    hexToBytes(blob.ciphertextHex),
  );
  return new TextDecoder().decode(plain);
}

export async function clearLocalBackupKeys(): Promise<void> {
  sessionDek = null;
  await SecureStore.deleteItemAsync(SALT_KEY);
  await SecureStore.deleteItemAsync(WRAPPED_DEK_KEY);
}
