import type { EncryptedBackupBlob } from '@/features/backup/crypto';
import { getValidAccessToken } from '@/features/backup/googleAuth';

const BACKUP_FILENAME = 'capim-backup.v1.json';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

type DriveFile = { id: string; name: string; modifiedTime?: string };

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken();
  return { Authorization: `Bearer ${token}` };
}

export async function findBackupFile(): Promise<DriveFile | null> {
  const headers = await authHeaders();
  const q = encodeURIComponent(`name='${BACKUP_FILENAME}'`);
  const url = `${DRIVE_FILES}?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error('Não foi possível listar backups no Drive.');
  }
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files?.[0] ?? null;
}

export async function downloadBackupBlob(): Promise<EncryptedBackupBlob | null> {
  const file = await findBackupFile();
  if (!file) return null;

  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_FILES}/${file.id}?alt=media`, { headers });
  if (!res.ok) {
    throw new Error('Falha ao baixar backup do Drive.');
  }
  const json = (await res.json()) as EncryptedBackupBlob;
  if (json.version !== 1 || !json.ciphertextHex) {
    throw new Error('Arquivo de backup no Drive é inválido.');
  }
  return json;
}

export async function uploadBackupBlob(
  blob: EncryptedBackupBlob,
): Promise<void> {
  const existing = await findBackupFile();
  const body = JSON.stringify(blob);
  const headers = await authHeaders();

  if (existing) {
    const res = await fetch(
      `${DRIVE_UPLOAD}/${existing.id}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body,
      },
    );
    if (!res.ok) {
      throw new Error('Falha ao atualizar backup no Drive.');
    }
    return;
  }

  const metadata = {
    name: BACKUP_FILENAME,
    parents: ['appDataFolder'],
  };

  const boundary = `capim_${Date.now()}`;
  const multipart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${body}\r\n` +
    `--${boundary}--`;

  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipart,
  });

  if (!res.ok) {
    throw new Error('Falha ao criar backup no Drive.');
  }
}

export async function getRemoteUpdatedAt(): Promise<string | null> {
  const blob = await downloadBackupBlob();
  return blob?.updatedAt ?? null;
}
