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
import {
  INVESTMENT_KIND_LABELS,
  type Investment,
  type InvestmentKind,
} from '@shared/types';
import {
  contributeInvestment,
  deleteInvestment,
  getPortfolioTotals,
  listInvestments,
  updateInvestmentCurrent,
} from '@/db/repositories';
import { confirmDelete } from '@/lib/confirmDelete';
import { formatBRL, parseBRLToCents } from '@/lib/money';
import { colors, spacing } from '@/theme/colors';
import { fontStyle } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';

const KIND_OPTIONS = Object.keys(INVESTMENT_KIND_LABELS) as InvestmentKind[];

export default function InvestmentsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Investment[]>([]);
  const [totals, setTotals] = useState({
    investedCents: 0,
    currentCents: 0,
    gainCents: 0,
  });
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<InvestmentKind>('cdb');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [list, t] = await Promise.all([
      listInvestments(),
      getPortfolioTotals(),
    ]);
    setItems(list);
    setTotals(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function onContribute() {
    setError(null);
    const cents = parseBRLToCents(amount);
    if (!name.trim()) {
      setError('Informe o nome do ativo (ex.: Tesouro Selic).');
      return;
    }
    if (cents == null || cents <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    await contributeInvestment({
      name: name.trim(),
      kind,
      amountCents: cents,
    });
    setName('');
    setAmount('');
    await reload();
  }

  async function bumpCurrent(inv: Investment, deltaReais: number) {
    await updateInvestmentCurrent(
      inv.id,
      Math.max(0, inv.currentCents + deltaReais * 100),
    );
    await reload();
  }

  function onDelete(inv: Investment) {
    confirmDelete(
      'Excluir investimento?',
      `"${inv.name}" será removido da carteira. Isso não pode ser desfeito.`,
      async () => {
        await deleteInvestment(inv.id);
        await reload();
      },
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.title}>Investimentos</Text>
      <Text style={styles.sub}>
        Carteira local — aportes e resgates também pelo chat.
      </Text>

      <View style={styles.totals}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Investido</Text>
          <Text style={styles.statValue}>
            {formatBRL(totals.investedCents)}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Atual</Text>
          <Text style={[styles.statValue, { color: colors.accentDark }]}>
            {formatBRL(totals.currentCents)}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Resultado</Text>
          <Text
            style={[
              styles.statValue,
              {
                color:
                  totals.gainCents >= 0 ? colors.income : colors.expense,
              },
            ]}
          >
            {formatBRL(totals.gainCents)}
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nome (ex.: Tesouro Selic)"
          placeholderTextColor={colors.inkMuted}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Valor do aporte (ex.: 500)"
          placeholderTextColor={colors.inkMuted}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <View style={styles.kinds}>
          {KIND_OPTIONS.map((k) => (
            <Pressable
              key={k}
              style={[styles.chip, kind === k && styles.chipOn]}
              onPress={() => setKind(k)}
            >
              <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>
                {INVESTMENT_KIND_LABELS[k]}
              </Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.btn} onPress={() => void onContribute()}>
          <Text style={styles.btnText}>Registrar aporte</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nenhum ativo ainda. Ex.: “investi 500 no tesouro”.
          </Text>
        }
        renderItem={({ item }) => {
          const gain = item.currentCents - item.investedCents;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Pressable
                  onPress={() => onDelete(item)}
                  hitSlop={8}
                  accessibilityLabel="Excluir investimento"
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.expense}
                  />
                </Pressable>
              </View>
              <Text style={styles.cardMeta}>
                {INVESTMENT_KIND_LABELS[item.kind]} · investido{' '}
                {formatBRL(item.investedCents)}
              </Text>
              <Text
                style={[
                  styles.cardValue,
                  { color: gain >= 0 ? colors.income : colors.expense },
                ]}
              >
                Atual {formatBRL(item.currentCents)} ({formatBRL(gain)})
              </Text>
              <View style={styles.actions}>
                <Pressable
                  style={styles.chip}
                  onPress={() => void bumpCurrent(item, 50)}
                >
                  <Text style={styles.chipText}>Atual +R$ 50</Text>
                </Pressable>
                <Pressable
                  style={styles.chip}
                  onPress={() => void bumpCurrent(item, -50)}
                >
                  <Text style={styles.chipText}>Atual −R$ 50</Text>
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
  totals: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stat: { flex: 1, gap: 2 },
  statLabel: {
    ...fontStyle('body', 12, { color: colors.inkMuted }),
  },
  statValue: {
    ...fontStyle('bodyBold', 15, { color: colors.ink }),
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
  kinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
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
  list: { paddingBottom: spacing.xl, gap: 10 },
  empty: {
    ...fontStyle('body', 15, { color: colors.inkMuted, lineHeight: 22 }),
  },
  card: {
    gap: 4,
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
  cardTitle: {
    flex: 1,
    ...fontStyle('bodyBold', 16, { color: colors.ink }),
  },
  cardMeta: {
    ...fontStyle('body', 13, { color: colors.inkMuted }),
  },
  cardValue: {
    ...fontStyle('bodyMedium', 15),
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
