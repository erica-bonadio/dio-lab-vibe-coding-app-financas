import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  disconnectDrive,
  isAutoSyncEnabled,
  isDriveConnected,
  isGoogleConfigured,
  saveGoogleAuthResponse,
  setAutoSyncEnabled,
  useGoogleDriveAuth,
} from '@/features/backup/googleAuth';
import {
  enableBackupAndSync,
  getSyncStatus,
  restoreFromDrive,
  runSyncIfNeeded,
  subscribeSyncStatus,
  type SyncStatus,
} from '@/features/backup/syncEngine';
import { hasSessionDek } from '@/features/backup/crypto';
import { colors, spacing } from '@/theme/colors';
import { fontStyle } from '@/theme/typography';

export default function BackupScreen() {
  const insets = useSafeAreaInsets();
  const configured = isGoogleConfigured();
  const { request, response, promptAsync } = useGoogleDriveAuth();

  const [connected, setConnected] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setConnected(await isDriveConnected());
    setAutoSync(await isAutoSyncEnabled());
    setStatus(await getSyncStatus());
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeSyncStatus(setStatus);
  }, [refresh]);

  useEffect(() => {
    if (response?.type !== 'success') return;
    void (async () => {
      try {
        await saveGoogleAuthResponse(response.authentication);
        setConnected(true);
        setInfo('Google Drive conectado. Confirme a senha Capim para ativar o sync.');
        await refresh();
      } catch (e) {
        setInfo(e instanceof Error ? e.message : 'Falha ao salvar tokens.');
      }
    })();
  }, [response, refresh]);

  async function onConnect() {
    setInfo(null);
    if (!configured) {
      setInfo(
        'Configure EXPO_PUBLIC_GOOGLE_*_CLIENT_ID no .env (veja .env.example).',
      );
      return;
    }
    await promptAsync();
  }

  async function onEnableSync() {
    setInfo(null);
    if (!password.trim()) {
      setInfo('Informe a senha Capim para criptografar o backup.');
      return;
    }
    setBusy(true);
    try {
      await enableBackupAndSync(password);
      setPassword('');
      setInfo(
        'Sync automático ativo. O Drive só recebe dados criptografados (E2EE).',
      );
      await refresh();
    } catch (e) {
      setInfo(e instanceof Error ? e.message : 'Falha ao ativar sync.');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleAuto(value: boolean) {
    await setAutoSyncEnabled(value);
    setAutoSync(value);
    if (value) {
      void runSyncIfNeeded({ force: true, reason: 'manual' });
    }
  }

  async function onSyncNow() {
    setBusy(true);
    setInfo(null);
    try {
      if (!hasSessionDek() && password.trim()) {
        await enableBackupAndSync(password);
        setPassword('');
      } else {
        await runSyncIfNeeded({ force: true, reason: 'manual' });
      }
      await refresh();
      setInfo('Sincronização concluída.');
    } catch (e) {
      setInfo(e instanceof Error ? e.message : 'Falha ao sincronizar.');
    } finally {
      setBusy(false);
    }
  }

  function onRestore() {
    if (!password.trim()) {
      setInfo('Informe a senha Capim para restaurar.');
      return;
    }
    Alert.alert(
      'Restaurar backup?',
      'Isso substitui todos os dados locais pelos do Drive. Não dá para desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              setInfo(null);
              try {
                await restoreFromDrive(password);
                setPassword('');
                setInfo('Backup restaurado. Atualize as outras abas.');
                await refresh();
              } catch (e) {
                setInfo(
                  e instanceof Error ? e.message : 'Falha ao restaurar.',
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }

  async function onDisconnect() {
    await disconnectDrive();
    setConnected(false);
    setAutoSync(false);
    setInfo('Google Drive desconectado neste aparelho.');
    await refresh();
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.md,
        gap: spacing.md,
      }}
    >
      <Text style={styles.title}>Backup</Text>
      <Text style={styles.sub}>
        Cópia criptografada (E2EE) na pasta oculta do seu Google Drive. Sem a
        senha Capim, o arquivo é inutilizável — inclusive para o Google.
      </Text>

      <View style={styles.section}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.body}>
          Drive: {connected ? 'conectado' : 'desconectado'}
        </Text>
        <Text style={styles.body}>
          Sync:{' '}
          {status?.phase === 'syncing'
            ? 'sincronizando…'
            : status?.phase === 'error'
              ? `erro — ${status.message}`
              : status?.dirty
                ? 'pendente'
                : 'em dia'}
        </Text>
        <Text style={styles.body}>
          Último sync: {status?.lastSyncedAt ?? 'nunca'}
        </Text>
        <Text style={styles.body}>
          Chave de sessão: {hasSessionDek() ? 'pronta' : 'precisa da senha'}
        </Text>
      </View>

      {!connected ? (
        <Pressable
          style={[styles.btn, !request && styles.btnDisabled]}
          disabled={!request || busy}
          onPress={() => void onConnect()}
        >
          <Text style={styles.btnText}>Conectar Google Drive</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.btnOutline} onPress={() => void onDisconnect()}>
          <Text style={styles.btnOutlineText}>Desconectar Drive</Text>
        </Pressable>
      )}

      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Senha Capim (criptografia)"
        placeholderTextColor={colors.inkMuted}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
      />

      {connected ? (
        <>
          <Pressable
            style={[styles.btn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void onEnableSync()}
          >
            <Text style={styles.btnText}>
              {busy ? '…' : 'Ativar sync automático (E2EE)'}
            </Text>
          </Pressable>

          <View style={styles.row}>
            <Text style={styles.body}>Sync automático</Text>
            <Switch
              value={autoSync}
              onValueChange={(v) => void onToggleAuto(v)}
              trackColor={{ true: colors.accentSoft, false: colors.border }}
              thumbColor={autoSync ? colors.accent : colors.inkMuted}
            />
          </View>

          <Pressable
            style={[styles.btnOutline, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void onSyncNow()}
          >
            <Text style={styles.btnOutlineText}>Sincronizar agora</Text>
          </Pressable>

          <Pressable
            style={[styles.btnDanger, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={onRestore}
          >
            <Text style={styles.btnText}>Restaurar do Drive</Text>
          </Pressable>
        </>
      ) : null}

      {busy ? <ActivityIndicator color={colors.accent} /> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <Text style={styles.hint}>
        Aviso: se esquecer a senha Capim, o backup no Drive não pode ser
        recuperado. Multi-aparelho usa last-write-wins (snapshot completo).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: {
    ...fontStyle('display', 28, { color: colors.accentDark }),
  },
  sub: {
    ...fontStyle('body', 14, { color: colors.inkMuted, lineHeight: 22 }),
  },
  section: { gap: 4 },
  label: {
    ...fontStyle('bodyMedium', 12, { color: colors.inkMuted }),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  body: {
    ...fontStyle('body', 15, { color: colors.ink }),
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...fontStyle('body', 15, { color: colors.ink }),
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDanger: {
    backgroundColor: colors.expense,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    ...fontStyle('bodyBold', 15, { color: colors.white }),
  },
  btnOutlineText: {
    ...fontStyle('bodyBold', 15, { color: colors.accentDark }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: {
    ...fontStyle('body', 14, { color: colors.ink, lineHeight: 20 }),
  },
  hint: {
    ...fontStyle('body', 13, { color: colors.inkMuted, lineHeight: 20 }),
    marginTop: spacing.sm,
  },
});
