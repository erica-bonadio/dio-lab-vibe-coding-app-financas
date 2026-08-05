import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type Transaction,
  type TransactionCategory,
} from '@shared/types';
import {
  deleteTransaction,
  listTransactionsByMonth,
  updateTransactionCategory,
} from '@/db/repositories';
import { MonthPicker } from '@/features/reports/MonthPicker';
import { confirmDelete } from '@/lib/confirmDelete';
import { currentYearMonth } from '@/lib/id';
import { formatBRL } from '@/lib/money';
import { colors, spacing } from '@/theme/colors';
import { fontStyle } from '@/theme/typography';

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [items, setItems] = useState<Transaction[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const reload = useCallback(async (ym: string) => {
    setItems(await listTransactionsByMonth(ym));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload(yearMonth);
    }, [reload, yearMonth]),
  );

  function onDelete(item: Transaction) {
    confirmDelete(
      'Excluir lançamento?',
      `"${item.description}" será removido. Isso não pode ser desfeito.`,
      async () => {
        await deleteTransaction(item.id);
        await reload(yearMonth);
      },
    );
  }

  async function onPickCategory(category: TransactionCategory) {
    if (!editing) return;
    await updateTransactionCategory(editing.id, category);
    setEditing(null);
    await reload(yearMonth);
  }

  const categoryOptions =
    editing?.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.title}>Lançamentos</Text>
      <Text style={styles.sub}>
        Toque na categoria para editar · lixeira para excluir.
      </Text>
      <MonthPicker yearMonth={yearMonth} onChange={setYearMonth} />
      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Ainda não há lançamentos. Use o chat para registrar o primeiro.
          </Text>
        }
        renderItem={({ item }) => {
          const income = item.type === 'income';
          return (
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.desc}>{item.description}</Text>
                <Pressable
                  onPress={() => setEditing(item)}
                  hitSlop={6}
                  accessibilityLabel="Editar categoria"
                >
                  <Text style={styles.metaEdit}>
                    {CATEGORY_LABELS[item.category]} · {item.occurredAt}
                    {item.source === 'chat' ? ' · chat' : ''} · editar
                  </Text>
                </Pressable>
              </View>
              <Text
                style={[
                  styles.amount,
                  { color: income ? colors.income : colors.expense },
                ]}
              >
                {income ? '+' : '−'}
                {formatBRL(item.amountCents)}
              </Text>
              <Pressable
                onPress={() => onDelete(item)}
                hitSlop={8}
                accessibilityLabel="Excluir lançamento"
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={colors.expense}
                />
              </Pressable>
            </View>
          );
        }}
      />

      <Modal
        visible={editing != null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Categoria</Text>
            {editing ? (
              <Text style={styles.sheetSub} numberOfLines={2}>
                {editing.description}
              </Text>
            ) : null}
            <View style={styles.chips}>
              {categoryOptions.map((cat) => {
                const selected = editing?.category === cat;
                return (
                  <Pressable
                    key={cat}
                    style={[styles.chip, selected && styles.chipOn]}
                    onPress={() => void onPickCategory(cat)}
                  >
                    <Text
                      style={[styles.chipText, selected && styles.chipTextOn]}
                    >
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={styles.cancel}
              onPress={() => setEditing(null)}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  list: { paddingBottom: spacing.xl, gap: 4 },
  empty: {
    ...fontStyle('body', 15, { color: colors.inkMuted, lineHeight: 22 }),
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 10,
  },
  rowMain: { flex: 1, gap: 2 },
  desc: {
    ...fontStyle('bodyMedium', 16, { color: colors.ink }),
  },
  metaEdit: {
    ...fontStyle('body', 13, { color: colors.accentDark }),
    textDecorationLine: 'underline',
  },
  amount: {
    ...fontStyle('bodyBold', 15),
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 46, 28, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: 10,
  },
  sheetTitle: {
    ...fontStyle('displayRegular', 22, { color: colors.ink }),
  },
  sheetSub: {
    ...fontStyle('body', 14, { color: colors.inkMuted }),
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  chipOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: {
    ...fontStyle('bodyMedium', 14, { color: colors.ink }),
  },
  chipTextOn: {
    ...fontStyle('bodyBold', 14, { color: colors.accentDark }),
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    ...fontStyle('bodyMedium', 15, { color: colors.inkMuted }),
  },
});
