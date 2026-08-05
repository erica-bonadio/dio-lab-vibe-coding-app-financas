import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type BudgetStatus,
  type Goal,
  type MonthSummary,
  type TransactionCategory,
} from '@shared/types';
import {
  deleteBudget,
  getBudgetStatuses,
  getMonthSummary,
  getPortfolioTotals,
  listGoals,
  upsertBudget,
} from '@/db/repositories';
import { buildAgentTips } from '@/features/agent/tips';
import { BudgetSection } from '@/features/budgets/BudgetSection';
import { ExpensePieChart } from '@/features/reports/ExpensePieChart';
import { MonthPicker } from '@/features/reports/MonthPicker';
import { currentYearMonth } from '@/lib/id';
import { formatBRL } from '@/lib/money';
import { colors, spacing } from '@/theme/colors';
import { fontStyle } from '@/theme/typography';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [portfolioCents, setPortfolioCents] = useState(0);
  const [portfolioGain, setPortfolioGain] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (ym: string) => {
    const [s, g, p, b] = await Promise.all([
      getMonthSummary(ym),
      listGoals(),
      getPortfolioTotals(),
      getBudgetStatuses(ym),
    ]);
    setSummary(s);
    setGoals(g);
    setPortfolioCents(p.currentCents);
    setPortfolioGain(p.gainCents);
    setBudgets(b);
    setTips(buildAgentTips(s, g, p.currentCents, b));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(yearMonth);
    }, [load, yearMonth]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load(yearMonth);
    } finally {
      setRefreshing(false);
    }
  }

  async function onUpsertBudget(
    category: TransactionCategory,
    limitCents: number,
  ) {
    await upsertBudget(category, limitCents);
    await load(yearMonth);
  }

  async function onDeleteBudget(id: string) {
    await deleteBudget(id);
    await load(yearMonth);
  }

  const hasExpenses = (summary?.expenseCents ?? 0) > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.md,
        gap: spacing.md,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
      }
    >
      <Text style={styles.brand}>Capim</Text>
      <Text style={styles.tagline}>Finanças que crescem no ritmo da conversa.</Text>

      <MonthPicker yearMonth={yearMonth} onChange={setYearMonth} />

      <View style={styles.balanceBlock}>
        <Text style={styles.label}>Saldo do mês</Text>
        <Text
          style={[
            styles.balance,
            {
              color:
                (summary?.balanceCents ?? 0) >= 0
                  ? colors.income
                  : colors.expense,
            },
          ]}
        >
          {formatBRL(summary?.balanceCents ?? 0)}
        </Text>
        <View style={styles.row}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Entradas</Text>
            <Text style={[styles.statValue, { color: colors.income }]}>
              {formatBRL(summary?.incomeCents ?? 0)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Saídas</Text>
            <Text style={[styles.statValue, { color: colors.expense }]}>
              {formatBRL(summary?.expenseCents ?? 0)}
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        style={styles.portfolio}
        onPress={() => router.push('/(tabs)/investments' as Href)}
      >
        <Text style={styles.label}>Carteira</Text>
        <Text style={[styles.statValue, { color: colors.accentDark }]}>
          {formatBRL(portfolioCents)}
        </Text>
        <Text
          style={{
            ...fontStyle('body', 13, {
              color: portfolioGain >= 0 ? colors.income : colors.expense,
            }),
          }}
        >
          Resultado {formatBRL(portfolioGain)} · ver investimentos
        </Text>
      </Pressable>

      <Pressable style={styles.cta} onPress={() => router.push('/(tabs)/chat')}>
        <Text style={styles.ctaText}>Registrar no chat</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Agente Capim</Text>
        {tips.map((tip) => (
          <Text key={tip} style={styles.tip}>
            {tip}
          </Text>
        ))}
      </View>

      {hasExpenses && summary ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gastos por categoria</Text>
          <ExpensePieChart byCategory={summary.byCategory} size={220} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Orçamentos</Text>
        <BudgetSection
          statuses={budgets}
          onUpsert={onUpsertBudget}
          onDelete={onDeleteBudget}
        />
      </View>

      {goals.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metas</Text>
          {goals.slice(0, 3).map((g) => {
            const pct = Math.min(
              100,
              Math.round((g.currentCents / g.targetCents) * 100),
            );
            return (
              <View key={g.id} style={styles.goalRow}>
                <Text style={styles.catName}>{g.title}</Text>
                <Text style={styles.catValue}>
                  {formatBRL(g.currentCents)} / {formatBRL(g.targetCents)} ({pct}
                  %)
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  brand: {
    ...fontStyle('display', 36, { color: colors.accentDark }),
  },
  tagline: {
    ...fontStyle('body', 15, { color: colors.inkMuted, lineHeight: 22 }),
    marginBottom: spacing.sm,
  },
  balanceBlock: {
    gap: 6,
    paddingVertical: spacing.sm,
  },
  label: {
    ...fontStyle('bodyMedium', 13, { color: colors.inkMuted }),
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  balance: {
    ...fontStyle('display', 40),
  },
  row: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  stat: { flex: 1, gap: 2 },
  statLabel: {
    ...fontStyle('body', 13, { color: colors.inkMuted }),
  },
  statValue: {
    ...fontStyle('bodyBold', 18),
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  portfolio: {
    gap: 2,
    paddingVertical: spacing.sm,
  },
  ctaText: {
    ...fontStyle('bodyBold', 16, { color: colors.white }),
  },
  section: {
    gap: 8,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    ...fontStyle('displayRegular', 20, { color: colors.ink }),
    marginBottom: 4,
  },
  tip: {
    ...fontStyle('body', 15, { color: colors.ink, lineHeight: 22 }),
  },
  catName: {
    ...fontStyle('body', 15, { color: colors.ink }),
  },
  catValue: {
    ...fontStyle('bodyMedium', 15, { color: colors.inkMuted }),
  },
  goalRow: { gap: 2, paddingVertical: 4 },
});
