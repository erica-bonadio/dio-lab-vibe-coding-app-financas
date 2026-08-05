import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const ACCESS_KEY = 'capim_google_access_token';
const REFRESH_KEY = 'capim_google_refresh_token';
const EXPIRY_KEY = 'capim_google_token_expiry';
const AUTO_SYNC_KEY = 'capim_drive_auto_sync';
const LAST_SYNC_KEY = 'capim_drive_last_sync';
const LOCAL_UPDATED_KEY = 'capim_local_data_updated_at';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

type Extra = {
  googleExpoClientId?: string;
  googleAndroidClientId?: string;
  googleIosClientId?: string;
  googleWebClientId?: string;
};

function getExtra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

export function getGoogleClientIds(): {
  androidClientId?: string;
  iosClientId?: string;
  webClientId?: string;
} {
  const extra = getExtra();
  const web =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
    extra.googleWebClientId ??
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ??
    extra.googleExpoClientId;
  return {
    androidClientId:
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
      extra.googleAndroidClientId,
    iosClientId:
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? extra.googleIosClientId,
    webClientId: web,
  };
}

export function isGoogleConfigured(): boolean {
  const ids = getGoogleClientIds();
  return Boolean(ids.androidClientId || ids.iosClientId || ids.webClientId);
}

export async function isDriveConnected(): Promise<boolean> {
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  const access = await SecureStore.getItemAsync(ACCESS_KEY);
  return Boolean(refresh || access);
}

export async function isAutoSyncEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(AUTO_SYNC_KEY)) === '1';
}

export async function setAutoSyncEnabled(on: boolean): Promise<void> {
  await SecureStore.setItemAsync(AUTO_SYNC_KEY, on ? '1' : '0');
}

export async function getLastSyncAt(): Promise<string | null> {
  return SecureStore.getItemAsync(LAST_SYNC_KEY);
}

export async function setLastSyncAt(iso: string): Promise<void> {
  await SecureStore.setItemAsync(LAST_SYNC_KEY, iso);
}

export async function getLocalDataUpdatedAt(): Promise<string | null> {
  return SecureStore.getItemAsync(LOCAL_UPDATED_KEY);
}

export async function setLocalDataUpdatedAt(iso: string): Promise<void> {
  await SecureStore.setItemAsync(LOCAL_UPDATED_KEY, iso);
}

async function persistTokens(params: {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
}): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, params.accessToken);
  if (params.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_KEY, params.refreshToken);
  }
  const expiresIn = params.expiresIn ?? 3600;
  const expiry = String(Date.now() + expiresIn * 1000 - 60_000);
  await SecureStore.setItemAsync(EXPIRY_KEY, expiry);
}

export async function disconnectDrive(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(EXPIRY_KEY);
  await SecureStore.deleteItemAsync(AUTO_SYNC_KEY);
}

/**
 * Hook de autenticação Google (usar na tela Backup).
 * Retorna promptAsync + estado; após sucesso, tokens ficam no Secure Store.
 */
export function useGoogleDriveAuth() {
  const ids = getGoogleClientIds();
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'capim',
    path: 'oauth',
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    scopes: [DRIVE_SCOPE],
    androidClientId: ids.androidClientId,
    iosClientId: ids.iosClientId,
    webClientId: ids.webClientId,
    redirectUri,
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  });

  return { request, response, promptAsync, redirectUri };
}

/** Persiste resultado do AuthSession Google. */
export async function saveGoogleAuthResponse(
  authentication: AuthSession.TokenResponse | null | undefined,
): Promise<void> {
  if (!authentication?.accessToken) {
    throw new Error('Autenticação Google sem access token.');
  }
  await persistTokens({
    accessToken: authentication.accessToken,
    refreshToken: authentication.refreshToken,
    expiresIn: authentication.expiresIn,
  });
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const ids = getGoogleClientIds();
  const clientId =
    (Platform.OS === 'ios'
      ? ids.iosClientId
      : Platform.OS === 'android'
        ? ids.androidClientId
        : ids.webClientId) ?? ids.webClientId;

  if (!clientId) {
    throw new Error('Google Client ID não configurado.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error('Falha ao renovar token do Google Drive.');
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };

  await persistTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  });

  return data.access_token;
}

/** Access token válido (renova se necessário). Não logar o valor. */
export async function getValidAccessToken(): Promise<string> {
  const [access, refresh, expiryRaw] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
    SecureStore.getItemAsync(EXPIRY_KEY),
  ]);

  const expiry = expiryRaw ? Number(expiryRaw) : 0;
  if (access && Date.now() < expiry) {
    return access;
  }

  if (refresh) {
    return refreshAccessToken(refresh);
  }

  if (access) return access;

  throw new Error('Google Drive não conectado. Conecte na aba Backup.');
}
