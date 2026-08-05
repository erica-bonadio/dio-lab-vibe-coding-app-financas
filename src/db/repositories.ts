import type {
  Budget,
  BudgetStatus,
  ChatMessage,
  Goal,
  Investment,
  InvestmentKind,
  MonthSummary,
  Transaction,
  TransactionCategory,
  TransactionType,
} from '@shared/types';
import { getDb } from '@/db/client';
import { markDirty } from '@/features/backup/syncEngine';
import { createId } from '@/lib/createId';
import { nowIso } from '@/lib/id';

type TxRow = {
  id: string;
  type: TransactionType;
  amount_cents: number;
  category: string;
  description: string;
  occurred_at: string;
  created_at: string;
  source: 'chat' | 'manual';
};

type GoalRow = {
  id: string;
  title: string;
  target_cents: number;
  current_cents: number;
  deadline: string | null;
  created_at: string;
  updated_at: string;
};

type ChatRow = {
  id: string;
  role: ChatMessage['role'];
  content: string;
  created_at: string;
  linked_transaction_id: string | null;
};

function mapTx(row: TxRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amountCents: row.amount_cents,
    category: row.category as TransactionCategory,
    description: row.description,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    source: row.source,
  };
}

function mapGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    title: row.title,
    targetCents: row.target_cents,
    currentCents: row.current_cents,
    deadline: row.deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChat(row: ChatRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    linkedTransactionId: row.linked_transaction_id,
  };
}

export async function insertTransaction(
  input: Omit<Transaction, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): Promise<Transaction> {
  const db = await getDb();
  const tx: Transaction = {
    id: input.id ?? createId('tx'),
    type: input.type,
    amountCents: input.amountCents,
    category: input.category,
    description: input.description,
    occurredAt: input.occurredAt,
    createdAt: input.createdAt ?? nowIso(),
    source: input.source,
  };
  await db.runAsync(
    `INSERT INTO transactions
      (id, type, amount_cents, category, description, occurred_at, created_at, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tx.id,
      tx.type,
      tx.amountCents,
      tx.category,
      tx.description,
      tx.occurredAt,
      tx.createdAt,
      tx.source,
    ],
  );
  markDirty();
  return tx;
}

export async function listTransactions(limit = 50): Promise<Transaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TxRow>(
    `SELECT * FROM transactions
     ORDER BY occurred_at DESC, created_at DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map(mapTx);
}

export async function listTransactionsByMonth(
  yearMonth: string,
): Promise<Transaction[]> {
  const db = await getDb();
  const start = `${yearMonth}-01`;
  const end = `${yearMonth}-31`;
  const rows = await db.getAllAsync<TxRow>(
    `SELECT * FROM transactions
     WHERE occurred_at >= ? AND occurred_at <= ?
     ORDER BY occurred_at DESC, created_at DESC`,
    [start, end],
  );
  return rows.map(mapTx);
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM transactions WHERE id = ?`, [id]);
  // Desvincula mensagens do chat sem apagar o histórico da conversa
  await db.runAsync(
    `UPDATE chat_messages SET linked_transaction_id = NULL WHERE linked_transaction_id = ?`,
    [id],
  );
  markDirty();
}

export async function updateTransactionCategory(
  id: string,
  category: TransactionCategory,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE transactions SET category = ? WHERE id = ?`, [
    category,
    id,
  ]);
  markDirty();
}

export async function getMonthSummary(yearMonth: string): Promise<MonthSummary> {
  const db = await getDb();
  const start = `${yearMonth}-01`;
  const end = `${yearMonth}-31`;
  const rows = await db.getAllAsync<TxRow>(
    `SELECT * FROM transactions
     WHERE occurred_at >= ? AND occurred_at <= ?`,
    [start, end],
  );

  let incomeCents = 0;
  let expenseCents = 0;
  const byCategory: Record<string, number> = {};

  for (const row of rows) {
    if (row.type === 'income') incomeCents += row.amount_cents;
    else {
      expenseCents += row.amount_cents;
      byCategory[row.category] = (byCategory[row.category] ?? 0) + row.amount_cents;
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

export async function insertGoal(
  input: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'currentCents'> & {
    currentCents?: number;
  },
): Promise<Goal> {
  const db = await getDb();
  const now = nowIso();
  const goal: Goal = {
    id: createId('goal'),
    title: input.title,
    targetCents: input.targetCents,
    currentCents: input.currentCents ?? 0,
    deadline: input.deadline,
    createdAt: now,
    updatedAt: now,
  };
  await db.runAsync(
    `INSERT INTO goals
      (id, title, target_cents, current_cents, deadline, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      goal.id,
      goal.title,
      goal.targetCents,
      goal.currentCents,
      goal.deadline,
      goal.createdAt,
      goal.updatedAt,
    ],
  );
  markDirty();
  return goal;
}

export async function listGoals(): Promise<Goal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GoalRow>(
    `SELECT * FROM goals ORDER BY created_at DESC`,
  );
  return rows.map(mapGoal);
}

export async function updateGoalProgress(
  id: string,
  currentCents: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE goals SET current_cents = ?, updated_at = ? WHERE id = ?`,
    [currentCents, nowIso(), id],
  );
  markDirty();
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM goals WHERE id = ?`, [id]);
  markDirty();
}

export async function insertChatMessage(
  input: Omit<ChatMessage, 'id' | 'createdAt'> & { id?: string },
): Promise<ChatMessage> {
  const db = await getDb();
  const msg: ChatMessage = {
    id: input.id ?? createId('msg'),
    role: input.role,
    content: input.content,
    createdAt: nowIso(),
    linkedTransactionId: input.linkedTransactionId,
  };
  await db.runAsync(
    `INSERT INTO chat_messages
      (id, role, content, created_at, linked_transaction_id)
     VALUES (?, ?, ?, ?, ?)`,
    [msg.id, msg.role, msg.content, msg.createdAt, msg.linkedTransactionId],
  );
  markDirty();
  return msg;
}

export async function listChatMessages(limit = 100): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ChatRow>(
    `SELECT * FROM chat_messages
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit],
  );
  return rows.map(mapChat);
}

type InvestmentRow = {
  id: string;
  name: string;
  kind: string;
  invested_cents: number;
  current_cents: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

function mapInvestment(row: InvestmentRow): Investment {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as InvestmentKind,
    investedCents: row.invested_cents,
    currentCents: row.current_cents,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listInvestments(): Promise<Investment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<InvestmentRow>(
    `SELECT * FROM investments ORDER BY updated_at DESC`,
  );
  return rows.map(mapInvestment);
}

export async function getPortfolioTotals(): Promise<{
  investedCents: number;
  currentCents: number;
  gainCents: number;
}> {
  const list = await listInvestments();
  const investedCents = list.reduce((s, i) => s + i.investedCents, 0);
  const currentCents = list.reduce((s, i) => s + i.currentCents, 0);
  return {
    investedCents,
    currentCents,
    gainCents: currentCents - investedCents,
  };
}

export async function insertInvestment(
  input: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  },
): Promise<Investment> {
  const db = await getDb();
  const now = nowIso();
  const inv: Investment = {
    id: input.id ?? createId('inv'),
    name: input.name,
    kind: input.kind,
    investedCents: input.investedCents,
    currentCents: input.currentCents,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  await db.runAsync(
    `INSERT INTO investments
      (id, name, kind, invested_cents, current_cents, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inv.id,
      inv.name,
      inv.kind,
      inv.investedCents,
      inv.currentCents,
      inv.notes,
      inv.createdAt,
      inv.updatedAt,
    ],
  );
  markDirty();
  return inv;
}

/** Aporta valor: soma investido e valor atual. Cria ativo se nome não existir. */
export async function contributeInvestment(input: {
  name: string;
  kind: InvestmentKind;
  amountCents: number;
}): Promise<Investment> {
  const db = await getDb();
  const existing = await db.getFirstAsync<InvestmentRow>(
    `SELECT * FROM investments WHERE lower(name) = lower(?) LIMIT 1`,
    [input.name.trim()],
  );
  if (!existing) {
    return insertInvestment({
      name: input.name.trim(),
      kind: input.kind,
      investedCents: input.amountCents,
      currentCents: input.amountCents,
      notes: '',
    });
  }
  const invested = existing.invested_cents + input.amountCents;
  const current = existing.current_cents + input.amountCents;
  await db.runAsync(
    `UPDATE investments
     SET invested_cents = ?, current_cents = ?, kind = ?, updated_at = ?
     WHERE id = ?`,
    [invested, current, input.kind, nowIso(), existing.id],
  );
  markDirty();
  return mapInvestment({
    ...existing,
    kind: input.kind,
    invested_cents: invested,
    current_cents: current,
    updated_at: nowIso(),
  });
}

/** Resgate: reduz valor atual (e investido proporcionalmente no mínimo 0). */
export async function redeemInvestment(input: {
  name: string;
  amountCents: number;
}): Promise<Investment | null> {
  const db = await getDb();
  const existing = await db.getFirstAsync<InvestmentRow>(
    `SELECT * FROM investments WHERE lower(name) = lower(?) LIMIT 1`,
    [input.name.trim()],
  );
  if (!existing) return null;
  const current = Math.max(0, existing.current_cents - input.amountCents);
  const invested = Math.max(0, existing.invested_cents - input.amountCents);
  await db.runAsync(
    `UPDATE investments
     SET invested_cents = ?, current_cents = ?, updated_at = ?
     WHERE id = ?`,
    [invested, current, nowIso(), existing.id],
  );
  markDirty();
  return mapInvestment({
    ...existing,
    invested_cents: invested,
    current_cents: current,
    updated_at: nowIso(),
  });
}

export async function updateInvestmentCurrent(
  id: string,
  currentCents: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE investments SET current_cents = ?, updated_at = ? WHERE id = ?`,
    [Math.max(0, currentCents), nowIso(), id],
  );
  markDirty();
}

export async function deleteInvestment(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM investments WHERE id = ?`, [id]);
  markDirty();
}

type BudgetRow = {
  id: string;
  category: string;
  limit_cents: number;
  created_at: string;
  updated_at: string;
};

function mapBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    category: row.category as TransactionCategory,
    limitCents: row.limit_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBudgets(): Promise<Budget[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BudgetRow>(
    `SELECT * FROM budgets ORDER BY category ASC`,
  );
  return rows.map(mapBudget);
}

export async function upsertBudget(
  category: TransactionCategory,
  limitCents: number,
): Promise<Budget> {
  const db = await getDb();
  const now = nowIso();
  const existing = await db.getFirstAsync<BudgetRow>(
    `SELECT * FROM budgets WHERE category = ?`,
    [category],
  );
  if (existing) {
    await db.runAsync(
      `UPDATE budgets SET limit_cents = ?, updated_at = ? WHERE id = ?`,
      [limitCents, now, existing.id],
    );
    markDirty();
    return mapBudget({
      ...existing,
      limit_cents: limitCents,
      updated_at: now,
    });
  }
  const budget: Budget = {
    id: createId('bud'),
    category,
    limitCents,
    createdAt: now,
    updatedAt: now,
  };
  await db.runAsync(
    `INSERT INTO budgets (id, category, limit_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [budget.id, budget.category, budget.limitCents, budget.createdAt, budget.updatedAt],
  );
  markDirty();
  return budget;
}

export async function deleteBudget(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM budgets WHERE id = ?`, [id]);
  markDirty();
}

export async function getBudgetStatuses(
  yearMonth: string,
): Promise<BudgetStatus[]> {
  const [budgets, summary] = await Promise.all([
    listBudgets(),
    getMonthSummary(yearMonth),
  ]);
  return budgets.map((b) => {
    const spentCents = summary.byCategory[b.category] ?? 0;
    const remainingCents = b.limitCents - spentCents;
    const pct = Math.min(
      100,
      Math.round((spentCents / b.limitCents) * 100),
    );
    return {
      ...b,
      spentCents,
      remainingCents,
      over: spentCents > b.limitCents,
      pct,
    };
  });
}

