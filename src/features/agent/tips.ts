import type { BudgetStatus, Goal, MonthSummary } from '@shared/types';
import { CATEGORY_LABELS } from '@shared/types';
import { formatBRL } from '@/lib/money';

/** Agente local: dicas a partir do resumo do mês (sem API no MVP). */
export function buildAgentTips(
  summary: MonthSummary,
  goals: Goal[],
  portfolioCents = 0,
  budgets: BudgetStatus[] = [],
): string[] {
  const tips: string[] = [];
  const { incomeCents, expenseCents, balanceCents, byCategory } = summary;

  if (incomeCents === 0 && expenseCents === 0 && portfolioCents === 0) {
    tips.push(
      'Comece registrando um gasto, receita ou aporte — ex.: "gastei 45 no mercado" ou "investi 500 no tesouro".',
    );
    return tips;
  }

  const over = budgets.filter((b) => b.over);
  if (over.length > 0) {
    const b = over[0];
    tips.push(
      `Orçamento de ${CATEGORY_LABELS[b.category]} estourou: ${formatBRL(b.spentCents)} de ${formatBRL(b.limitCents)}.`,
    );
  }

  if (balanceCents < 0) {
    tips.push(
      `Este mês as despesas passaram das receitas em ${formatBRL(Math.abs(balanceCents))}. Vale revisar os maiores gastos.`,
    );
  } else if (incomeCents > 0) {
    const savedPct = Math.round((balanceCents / incomeCents) * 100);
    if (savedPct >= 20) {
      tips.push(`Bom ritmo: sobrou cerca de ${savedPct}% da renda este mês.`);
    } else if (savedPct < 10) {
      tips.push(
        'A margem está apertada (menos de 10% da renda). Um corte pequeno em lazer ou delivery já ajuda.',
      );
    }
  }

  const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  if (top && tips.length < 3) {
    const [cat, cents] = top;
    const label =
      CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat;
    tips.push(`Maior fatia de gastos: ${label} (${formatBRL(cents)}).`);
  }

  if (portfolioCents > 0 && balanceCents > 0 && tips.length < 3) {
    tips.push(
      `Carteira em ${formatBRL(portfolioCents)}. Se sobrar este mês, um aporte reforça o hábito.`,
    );
  } else if (portfolioCents === 0 && balanceCents > 0 && tips.length < 3) {
    tips.push(
      'Ainda sem investimentos cadastrados. Experimente: "investi 200 no CDB".',
    );
  }

  const openGoal = goals.find((g) => g.currentCents < g.targetCents);
  if (openGoal && tips.length < 3) {
    const missing = openGoal.targetCents - openGoal.currentCents;
    tips.push(
      `Meta "${openGoal.title}": faltam ${formatBRL(missing)}. Se sobrar este mês, dá para aportar.`,
    );
  }

  return tips.slice(0, 3);
}

export function helpText(): string {
  return [
    'Pode falar comigo assim:',
    '• "gastei 45 no mercado"',
    '• "paguei 120 de uber"',
    '• "recebi 3500 de salário"',
    '• "investi 500 no tesouro"',
    '• "resgatei 200 do CDB"',
    '• "resumo" — saldo do mês + carteira',
  ].join('\n');
}
