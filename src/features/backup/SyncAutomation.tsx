import React, { useEffect } from 'react';
import { startSyncAutomation } from '@/features/backup/syncEngine';

/** Mantém sync automático ligado enquanto a sessão autenticada estiver montada. */
export function SyncAutomation() {
  useEffect(() => startSyncAutomation(), []);
  return null;
}
