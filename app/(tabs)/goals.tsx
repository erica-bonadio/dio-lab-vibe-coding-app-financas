import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Goal } from '@shared/types';
import {
  deleteGoal,
  insertGoal,
  listGoals,
  updateGoalProgress,
} from '@/db/repositories';
import { confirmDelete } from '@/lib/confirmDelete';
import { parseBRLToCents, formatBRL } from '@/lib/money';
import { colors, spacing } from '@/theme/colors';
import { fontStyle } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setGoals(await listGoals());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function onCreate() {
    setError(null);
    const cents = parseBRLToCents(target);
    if (!title.trim()) {
      setError('Dê um nome à meta.');
      return;
    }
    if (cents == null || cents <= 0) {
      setError('Informe um valor alvo válido.');
      return;
    }
    await insertGoal({
      title: title.trim(),
      targetCents: cents,
      deadline: null,
    });
    setTitle('');
    setTarget('');
    await reload();
  }

  async function addProgress(goal: Goal, deltaReais: number) {
    const next = Math.max(0, goal.currentCents + deltaReais * 100);
    await updateGoalProgress(goal.id, Math.min(next, goal.targetCents * 2));
    await reload();
  }

  function onDelete(goal: Goal) {
    confirmDelete(
      'Excluir meta?',
      `"${goal.title}" será removida. Isso não pode ser desfeito.`,
      async () => {
        await deleteGoal(goal.id);
        await reload();
      },
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.title}>Metas</Text>
      <Text style={styles.sub}>Reserve um destino para o que sobrar.</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Ex.: Reserva de emergência"
          placeholderTextColor={colors.inkMuted}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Valor alvo (ex.: 5000)"
          placeholderTextColor={colors.inkMuted}
          keyboardType="decimal-pad"
          value={target}
          onChangeText={setTarget}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.btn} onPress={() => void onCreate()}>
          <Text style={styles.btnText}>Criar meta</Text>
        </Pressable>
      </View>

      <FlatList
        data={goals}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhuma meta ainda.</Text>
        }
        renderItem={({ item }) => {
          const pct = Math.min(
            100,
            Math.round((item.currentCents / item.targetCents) * 100),
          );
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.goalTitle}>{item.title}</Text>
                <Pressable
                  onPress={() => onDelete(item)}
                  hitSlop={8}
                  accessibilityLabel="Excluir meta"
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.expense}
                  />
                </Pressable>
              </View>
              <Text style={styles.goalMeta}>
                {formatBRL(item.currentCents)} de {formatBRL(item.targetCents)}{' '}
                · {pct}%
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
              </View>
              <View style={styles.actions}>
                <Pressable
                  style={styles.chip}
                  onPress={() => void addProgress(item, 50)}
                >
                  <Text style={styles.chipText}>+ R$ 50</Text>
                </Pressable>
                <Pressable
                  style={styles.chip}
                  onPress={() => void addProgress(item, 100)}
                >
                  <Text style={styles.chipText}>+ R$ 100</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
  },
  title: {
    ...fontStyle('display', 28, { color: colors.accentDark }),
  },
  sub: {
    ...fontStyle('body', 14, { color: colors.inkMuted }),
    marginBottom: spacing.sm,
  },
  form: { gap: 8, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...fontStyle('body', 15, { color: colors.ink }),
  },
  error: {
    ...fontStyle('body', 13, { color: colors.expense }),
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: {
    ...fontStyle('bodyBold', 15, { color: colors.white }),
  },
  list: { paddingBottom: spacing.xl, gap: 12 },
  empty: {
    ...fontStyle('body', 15, { color: colors.inkMuted }),
  },
  card: {
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  goalTitle: {
    flex: 1,
    ...fontStyle('bodyBold', 17, { color: colors.ink }),
  },
  goalMeta: {
    ...fontStyle('body', 14, { color: colors.inkMuted }),
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  actions: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  chipText: {
    ...fontStyle('bodyMedium', 13, { color: colors.accentDark }),
  },
});
