import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  decryptSnapshotPayload,
  encryptSnapshotPayload,
  hasSessionDek,
  type EncryptedBackupBlob,
  unlockBackupKeys,
  unlockFromRemoteBlob,
} from '@/features/backup/crypto';
import {
  downloadBackupBlob,
  uploadBackupBlob,
} from '@/features/backup/driveClient';
import {
  getLastSyncAt,
  getLocalDataUpdatedAt,
  isAutoSyncEnabled,
  isDriveConnected,
  setAutoSyncEnabled,
  setLastSyncAt,
  setLocalDataUpdatedAt,
} from '@/features/backup/googleAuth';
import {
  exportSnapshot,
  importSnapshot,
  parseSnapshot,
} from '@/features/backup/snapshot';
import { nowIso } from '@/lib/id';

export type SyncStatus = {
  phase: 'idle' | 'syncing' | 'error';
  message: string | null;
  lastSyncedAt: string | null;
  dirty: boolean;
};

type Listener = (status: SyncStatus) => void;

let dirty = false;
let syncing = false;
let lastError: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
const listeners = new Set<Listener>();

const DEBOUNCE_MS = 5000;

function emit(): void {
  const status: SyncStatus = {
    phase: syncing ? 'syncing' : lastError ? 'error' : 'idle',
    message: lastError,
    lastSyncedAt: null,
    dirty,
  };
  void getLastSyncAt().then((at) => {
    status.lastSyncedAt = at;
    listeners.forEach((l) => l({ ...status }));
  });
}

export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener);
  void getSyncStatus().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return {
    phase: syncing ? 'syncing' : lastError ? 'error' : 'idle',
    message: lastError,
    lastSyncedAt: await getLastSyncAt(),
    dirty,
  };
}

export function markDirty(): void {
  dirty = true;
  const iso = nowIso();
  void setLocalDataUpdatedAt(iso);
  emit();
  scheduleAutoSync();
}

function scheduleAutoSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void runSyncIfNeeded({ reason: 'debounce' });
  }, DEBOUNCE_MS);
}

export async function runSyncIfNeeded(opts?: {
  reason?: 'debounce' | 'foreground' | 'manual';
  force?: boolean;
}): Promise<void> {
  if (syncing) return;

  const auto = await isAutoSyncEnabled();
  if (!opts?.force && !auto) return;
  if (!opts?.force && !dirty && opts?.reason !== 'manual') return;

  const connected = await isDriveConnected();
  if (!connected) {
    if (opts?.force || opts?.reason === 'manual') {
      lastError = 'Google Drive não conectado.';
      emit();
    }
    return;
  }

  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    if (opts?.force || opts?.reason === 'manual') {
      lastError = 'Sem conexão com a internet.';
      emit();
    }
    return;
  }

  if (!hasSessionDek()) {
    if (opts?.force || opts?.reason === 'manual') {
      lastError =
        'Desbloqueie com a senha Capim (não biometria só) para sincronizar.';
      emit();
    }
    return;
  }

  syncing = true;
  lastError = null;
  emit();

  try {
    const localUpdated = (await getLocalDataUpdatedAt()) ?? nowIso();
    const remote = await downloadBackupBlob();

    if (
      remote?.updatedAt &&
      !opts?.force &&
      remote.updatedAt > localUpdated &&
      opts?.reason !== 'manual'
    ) {
      // Remoto mais novo: não sobrescrever automaticamente (evita perda).
      dirty = false;
      lastError = null;
      syncing = false;
      emit();
      return;
    }

    const snapshot = await exportSnapshot();
    const updatedAt = nowIso();
    const blob = await encryptSnapshotPayload(
      JSON.stringify(snapshot),
      updatedAt,
    );
    await uploadBackupBlob(blob);
    await setLastSyncAt(updatedAt);
    await setLocalDataUpdatedAt(updatedAt);
    dirty = false;
    lastError = null;
  } catch (e) {
    lastError =
      e instanceof Error ? e.message : 'Falha na sincronização com o Drive.';
  } finally {
    syncing = false;
    emit();
  }
}

/** Primeiro upload após conectar Drive + confirmar senha. */
export async function enableBackupAndSync(password: string): Promise<void> {
  await unlockBackupKeys(password);
  await setAutoSyncEnabled(true);
  dirty = true;
  await runSyncIfNeeded({ force: true, reason: 'manual' });
}

export async function restoreFromDrive(password: string): Promise<void> {
  const remote = await downloadBackupBlob();
  if (!remote) {
    throw new Error('Nenhum backup encontrado no Google Drive.');
  }
  await unlockFromRemoteBlob(password, remote);
  const plain = decryptSnapshotPayload(remote);
  const snapshot = parseSnapshot(JSON.parse(plain) as unknown);
  await importSnapshot(snapshot);
  await setLastSyncAt(remote.updatedAt);
  await setLocalDataUpdatedAt(remote.updatedAt);
  dirty = false;
  lastError = null;
  emit();
}

export async function peekRemoteBlob(): Promise<EncryptedBackupBlob | null> {
  if (!(await isDriveConnected())) return null;
  const net = await NetInfo.fetch();
  if (!net.isConnected) return null;
  return downloadBackupBlob();
}

function onAppState(next: AppStateStatus): void {
  if (next === 'active') {
    void runSyncIfNeeded({ reason: 'foreground' });
  }
}

/** Liga listeners de AppState / rede (chamar uma vez no root). */
export function startSyncAutomation(): () => void {
  if (started) {
    return () => undefined;
  }
  started = true;
  const appSub = AppState.addEventListener('change', onAppState);
  const netUnsub = NetInfo.addEventListener((state) => {
    if (state.isConnected && dirty) {
      scheduleAutoSync();
    }
  });
  void runSyncIfNeeded({ reason: 'foreground' });

  return () => {
    started = false;
    appSub.remove();
    netUnsub();
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}
