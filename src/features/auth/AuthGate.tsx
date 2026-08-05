import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  canUseBiometrics,
  hasLocalPassword,
  isBiometricEnabled,
  setBiometricEnabled,
  setupLocalPassword,
  unlockWithBiometrics,
  verifyLocalPassword,
} from '@/features/auth/localLock';
import {
  clearSessionDek,
  hasLocalBackupKeys,
  unlockBackupKeys,
} from '@/features/backup/crypto';
import { colors } from '@/theme/colors';
import { fontStyle } from '@/theme/typography';

type Props = { children: React.ReactNode };
type Phase = 'loading' | 'setup' | 'unlock' | 'open';

export function AuthGate({ children }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Digital');

  const bootstrap = useCallback(async () => {
    const [hasPass, bio] = await Promise.all([
      hasLocalPassword(),
      canUseBiometrics(),
    ]);
    setBioAvailable(bio.available);
    setBioLabel(bio.label);
    setPhase(hasPass ? 'unlock' : 'setup');
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (phase !== 'unlock') return;
    void (async () => {
      if (!(await isBiometricEnabled())) return;
      if (await unlockWithBiometrics()) setPhase('open');
    })();
  }, [phase]);

  async function onSetup() {
    setError(null);
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    try {
      await setupLocalPassword(password);
      if (bioAvailable) await setBiometricEnabled(true);
      clearSessionDek();
      setPhase('open');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function onUnlock() {
    setError(null);
    setBusy(true);
    try {
      const ok = await verifyLocalPassword(password);
      if (!ok) {
        setError('Senha incorreta.');
        return;
      }
      if (await hasLocalBackupKeys()) {
        await unlockBackupKeys(password);
      }
      setPhase('open');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao desbloquear.');
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'open') return <>{children}</>;

  if (phase === 'loading') {
    return (
      <View style={[styles.boot, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const isSetup = phase === 'setup';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.brand}>Capim</Text>
      <Text style={styles.sub}>
        {isSetup
          ? 'Crie uma senha local para proteger seus dados financeiros no aparelho.'
          : 'Desbloqueie para continuar.'}
      </Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Senha"
        placeholderTextColor={colors.inkMuted}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
      />
      {isSetup ? (
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Confirmar senha"
          placeholderTextColor={colors.inkMuted}
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="none"
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.btn, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={() => void (isSetup ? onSetup() : onUnlock())}
      >
        <Text style={styles.btnText}>
          {busy ? '…' : isSetup ? 'Começar' : 'Entrar'}
        </Text>
      </Pressable>
      {!isSetup && bioAvailable ? (
        <Pressable
          onPress={() =>
            void unlockWithBiometrics().then((ok) => ok && setPhase('open'))
          }
        >
          <Text style={styles.link}>Usar {bioLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
    gap: 12,
  },
  brand: {
    ...fontStyle('display', 40, { color: colors.accentDark }),
    marginBottom: 4,
  },
  sub: {
    ...fontStyle('body', 16, { color: colors.inkMuted, lineHeight: 24 }),
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...fontStyle('body', 16, { color: colors.ink }),
  },
  error: {
    ...fontStyle('body', 14, { color: colors.expense }),
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    ...fontStyle('bodyBold', 16, { color: colors.white }),
  },
  link: {
    ...fontStyle('bodyMedium', 15, { color: colors.accentDark }),
    textAlign: 'center',
    marginTop: 16,
  },
});
