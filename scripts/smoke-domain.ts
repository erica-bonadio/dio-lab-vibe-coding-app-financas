/**
 * Smoke de domínio (sem dispositivo): fluxos 2–5 + mês/orçamento
 * do checklist em docs/comandos-testes.md.
 *
 * UI / SecureStore / Drive: precisam do Expo Go no aparelho.
 */
import assert from 'node:assert/strict';
import { parseChatIntent } from '../src/features/chat/parseTransaction';
import { buildAgentTips } from '../src/features/agent/tips';
import { formatBRL, parseBRLToCents } from '../src/lib/money';
import {
  formatYearMonthBr,
  monthRange,
  shiftYearMonth,
} from '../src/lib/month';
import { currentYearMonth, todayIsoDate } from '../src/lib/id';
import type {
  BudgetStatus,
  Goal,
  MonthSummary,
  TransactionCategory,
} from '../shared/types';

type Tx = {
  type: 'income' | 'expense';
  amountCents: number;
  category: string;
  occurredAt: string;
};

function summarize(txs: Tx[], yearMonth: string): MonthSummary {
  const { start, end } = monthRange(yearMonth);
  let incomeCents = 0;
  let expenseCents = 0;
  const byCategory: Record<string, number> = {};
  for (const t of txs) {
    if (t.occurredAt < start || t.occurredAt > end) continue;
    if (t.type === 'income') incomeCents += t.amountCents;
    else {
      expenseCents += t.amountCents;
      byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amountCents;
    }
  }
  return {
    yearMonth,
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    byCategory,
  };
}

function budgetStatuses(
  budgets: {
    id: string;
    category: TransactionCategory;
    limitCents: number;
    createdAt: string;
    updatedAt: string;
  }[],
  summary: MonthSummary,
): BudgetStatus[] {
  return budgets.map((b) => {
    const spentCents = summary.byCategory[b.category] ?? 0;
    return {
      ...b,
      spentCents,
      remainingCents: b.limitCents - spentCents,
      over: spentCents > b.limitCents,
      pct: Math.min(100, Math.round((spentCents / b.limitCents) * 100)),
    };
  });
}

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`✗ ${name}`);
    console.log(`  ${(e as Error).message}`);
  }
}

const ym = currentYearMonth();
const txs: Tx[] = [];
const goals: Goal[] = [];

console.log('\n=== Smoke domínio Capim ===\n');
console.log(`Mês atual: ${ym} (${formatYearMonthBr(ym)})\n`);

check('2. parser: gastei 45 no mercado', () => {
  const intent = parseChatIntent('gastei 45 no mercado');
  assert.equal(intent.kind, 'transaction');
  if (intent.kind !== 'transaction') return;
  assert.equal(intent.type, 'expense');
  assert.equal(intent.amountCents, 4500);
  assert.equal(intent.category, 'alimentacao');
  txs.push(intent);
});

check('3. parser: recebi 3000 de salário', () => {
  const intent = parseChatIntent('recebi 3000 de salário');
  assert.equal(intent.kind, 'transaction');
  if (intent.kind !== 'transaction') return;
  assert.equal(intent.type, 'income');
  assert.equal(intent.amountCents, 300000);
  assert.equal(intent.category, 'salario');
  txs.push(intent);
});

check('4. resumo: totais e dicas', () => {
  const summary = summarize(txs, ym);
  assert.equal(summary.incomeCents, 300000);
  assert.equal(summary.expenseCents, 4500);
  assert.equal(summary.balanceCents, 295500);
  assert.equal(summary.byCategory.alimentacao, 4500);
  const tipList = buildAgentTips(summary, goals, 0, []);
  assert.ok(tipList.length >= 1, 'deve ter ao menos 1 dica');
  assert.equal(parseChatIntent('resumo').kind, 'summary');
});

check('5. meta: criar e aportar 50', () => {
  const now = new Date().toISOString();
  const goal: Goal = {
    id: 'goal_1',
    title: 'Reserva',
    targetCents: 50000,
    currentCents: 0,
    deadline: null,
    createdAt: now,
    updatedAt: now,
  };
  goal.currentCents += 5000; // aporte R$50
  goals.push(goal);
  assert.equal(goal.currentCents, 5000);
  assert.equal(goal.targetCents - goal.currentCents, 45000);
  // resumo enxuto para sobrar slot de dica da meta
  const tipList = buildAgentTips(
    {
      yearMonth: ym,
      incomeCents: 0,
      expenseCents: 100,
      balanceCents: -100,
      byCategory: {},
    },
    goals,
    0,
    [],
  );
  assert.ok(
    tipList.some((t) => t.includes('Reserva')),
    `dicas devem mencionar meta: ${tipList.join(' | ')}`,
  );
});

check('extra. filtro de mês (shift + range)', () => {
  const prev = shiftYearMonth(ym, -1);
  const next = shiftYearMonth(ym, 1);
  assert.notEqual(prev, ym);
  assert.notEqual(next, ym);
  const range = monthRange(ym);
  assert.equal(range.start, `${ym}-01`);
  assert.ok(todayIsoDate() >= range.start && todayIsoDate() <= range.end);
});

check('extra. orçamento: estouro alimentacao', () => {
  const budgets = [
    {
      id: 'b1',
      category: 'alimentacao' as const,
      limitCents: 3000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const summary = summarize(txs, ym);
  const statuses = budgetStatuses(budgets, summary);
  assert.equal(statuses[0].spentCents, 4500);
  assert.equal(statuses[0].over, true);
  const tipList = buildAgentTips(summary, goals, 0, statuses);
  assert.ok(
    tipList.some((t) => /orçamento|estourou/i.test(t)),
    `dica de estouro: ${tipList.join(' | ')}`,
  );
});

check('money: format/parse BRL', () => {
  assert.equal(parseBRLToCents('45'), 4500);
  assert.equal(parseBRLToCents('3.000,50'), 300050);
  assert.match(formatBRL(4500), /45/);
});

console.log('\n--- UI / dispositivo (não executáveis aqui) ---');
const skipped = [
  '1. Criar senha local e desbloquear (SecureStore + Expo Go)',
  '6. Matar app e reabrir → persistência + lock',
  '7–10. Google Drive backup / sync / restore',
];
for (const s of skipped) console.log(`○ SKIP ${s}`);

console.log(
  `\nResumo: ${passed} pass · ${failed} fail · ${skipped.length} skip UI\n`,
);
process.exit(failed > 0 ? 1 : 0);
