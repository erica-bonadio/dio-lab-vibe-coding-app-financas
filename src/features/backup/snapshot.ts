import type {
  Budget,
  ChatMessage,
  Goal,
  Investment,
  Transaction,
} from '@shared/types';
import { getDb } from '@/db/client';
import { nowIso } from '@/lib/id';

export type CapimSnapshot = {
  version: 1;
  exportedAt: string;
  transactions: Transaction[];
  goals: Goal[];
  chatMessages: ChatMessage[];
  investments?: Investment[];
  budgets?: Budget[];
};

type TxRow = {
  id: string;
  type: Transaction['type'];
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

type InvRow = {
  id: string;
  name: string;
  kind: string;
  invested_cents: number;
  current_cents: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

type BudRow = {
  id: string;
  category: string;
  limit_cents: number;
  created_at: string;
  updated_at: string;
};

export async function exportSnapshot(): Promise<CapimSnapshot> {
  const db = await getDb();
  const [txRows, goalRows, chatRows, invRows, budRows] = await Promise.all([
    db.getAllAsync<TxRow>(`SELECT * FROM transactions`),
    db.getAllAsync<GoalRow>(`SELECT * FROM goals`),
    db.getAllAsync<ChatRow>(`SELECT * FROM chat_messages`),
    db.getAllAsync<InvRow>(`SELECT * FROM investments`),
    db.getAllAsync<BudRow>(`SELECT * FROM budgets`),
  ]);

  return {
    version: 1,
    exportedAt: nowIso(),
    transactions: txRows.map((row) => ({
      id: row.id,
      type: row.type,
      amountCents: row.amount_cents,
      category: row.category as Transaction['category'],
      description: row.description,
      occurredAt: row.occurred_at,
      createdAt: row.created_at,
      source: row.source,
    })),
    goals: goalRows.map((row) => ({
      id: row.id,
      title: row.title,
      targetCents: row.target_cents,
      currentCents: row.current_cents,
      deadline: row.deadline,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    chatMessages: chatRows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
      linkedTransactionId: row.linked_transaction_id,
    })),
    investments: invRows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind as Investment['kind'],
      investedCents: row.invested_cents,
      currentCents: row.current_cents,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    budgets: budRows.map((row) => ({
      id: row.id,
      category: row.category as Budget['category'],
      limitCents: row.limit_cents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export function parseSnapshot(raw: unknown): CapimSnapshot {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Snapshot inválido.');
  }
  const data = raw as Partial<CapimSnapshot>;
  if (data.version !== 1) {
    throw new Error('Versão de snapshot não suportada.');
  }
  if (
    !Array.isArray(data.transactions) ||
    !Array.isArray(data.goals) ||
    !Array.isArray(data.chatMessages)
  ) {
    throw new Error('Snapshot incompleto.');
  }
  return {
    ...(data as CapimSnapshot),
    investments: Array.isArray(data.investments) ? data.investments : [],
    budgets: Array.isArray(data.budgets) ? data.budgets : [],
  };
}

export async function importSnapshot(snapshot: CapimSnapshot): Promise<void> {
  const parsed = parseSnapshot(snapshot);
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM chat_messages;
      DELETE FROM goals;
      DELETE FROM transactions;
      DELETE FROM investments;
      DELETE FROM budgets;
    `);

    for (const tx of parsed.transactions) {
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
    }

    for (const goal of parsed.goals) {
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
    }

    for (const msg of parsed.chatMessages) {
      await db.runAsync(
        `INSERT INTO chat_messages
          (id, role, content, created_at, linked_transaction_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          msg.id,
          msg.role,
          msg.content,
          msg.createdAt,
          msg.linkedTransactionId,
        ],
      );
    }

    for (const inv of parsed.investments ?? []) {
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
    }

    for (const bud of parsed.budgets ?? []) {
      await db.runAsync(
        `INSERT INTO budgets
          (id, category, limit_cents, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [bud.id, bud.category, bud.limitCents, bud.createdAt, bud.updatedAt],
      );
    }
  });
}
