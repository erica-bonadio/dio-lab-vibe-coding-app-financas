import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  type BudgetStatus,
  type TransactionCategory,
} from '@shared/types';
import { confirmDelete } from '@/lib/confirmDelete';
import { formatBRL, parseBRLToCents } from '@/lib/money';
import { colors, spacing } from '@/theme/colors';
import { fontStyle } from '@/theme/typography';

type Props = {
  statuses: BudgetStatus[];
  onUpsert: (category: TransactionCategory, limitCents: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function BudgetSection({ statuses, onUpsert, onDelete }: Props) {
  const [category, setCategory] = useState<TransactionCategory>('alimentacao');
  const [limit, setLimit] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    const cents = parseBRLToCents(limit);
    if (cents == null || cents <= 0) {
      setError('Informe um limite válido (ex.: 800).');
      return;
    }
    await onUpsert(category, cents);
    setLimit('');
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        Limite mensal por categoria (vale para todo mês).
      </Text>
      <View style={styles.kinds}>
        {EXPENSE_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, category === c && styles.chipOn]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextOn]}>
              {CATEGORY_LABELS[c]}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Limite (ex.: 800)"
        placeholderTextColor={colors.inkMuted}
        keyboardType="decimal-pad"
        value={limit}
        onChangeText={setLimit}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.btn} onPress={() => void onSave()}>
        <Text style={styles.btnText}>Salvar orçamento</Text>
      </Pressable>

      {statuses.map((b) => (
        <View key={b.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{CATEGORY_LABELS[b.category]}</Text>
            <Pressable
              onPress={() =>
                confirmDelete(
                  'Excluir orçamento?',
                  `Remover limite de ${CATEGORY_LABELS[b.category]}?`,
                  () => onDelete(b.id),
                )
              }
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={18} color={colors.expense} />
            </Pressable>
          </View>
          <Text
            style={[
              styles.cardMeta,
              { color: b.over ? colors.expense : colors.inkMuted },
            ]}
          >
            {formatBRL(b.spentCents)} de {formatBRL(b.limitCents)} ({b.pct}%)
            {b.over
              ? ` · ultrapassou ${formatBRL(Math.abs(b.remainingCents))}`
              : ` · restam ${formatBRL(b.remainingCents)}`}
          </Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.min(100, b.pct)}%`,
                  backgroundColor: b.over ? colors.expense : colors.accent,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  hint: {
    ...fontStyle('body', 13, { color: colors.inkMuted }),
  },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  chipOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: {
    ...fontStyle('bodyMedium', 12, { color: colors.accentDark }),
  },
  chipTextOn: {
    ...fontStyle('bodyBold', 12, { color: colors.accentDark }),
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
  card: {
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    ...fontStyle('bodyBold', 15, { color: colors.ink }),
  },
  cardMeta: {
    ...fontStyle('body', 13),
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
});
