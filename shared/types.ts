export type TransactionType = 'income' | 'expense';

export type TransactionCategory =
  | 'moradia'
  | 'alimentacao'
  | 'transporte'
  | 'saude'
  | 'lazer'
  | 'educacao'
  | 'contas'
  | 'compras'
  | 'salario'
  | 'freelance'
  | 'investimento'
  | 'outros';

export type InvestmentKind =
  | 'cdb'
  | 'tesouro'
  | 'acoes'
  | 'fii'
  | 'cripto'
  | 'fundos'
  | 'poupanca'
  | 'outros';

export type Investment = {
  id: string;
  name: string;
  kind: InvestmentKind;
  investedCents: number;
  currentCents: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amountCents: number;
  category: TransactionCategory;
  description: string;
  occurredAt: string;
  createdAt: string;
  source: 'chat' | 'manual';
};

export type Goal = {
  id: string;
  title: string;
  targetCents: number;
  currentCents: number;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  linkedTransactionId: string | null;
};

export type MonthSummary = {
  yearMonth: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  byCategory: Record<string, number>;
};

/** Limite mensal recorrente por categoria de despesa. */
export type Budget = {
  id: string;
  category: TransactionCategory;
  limitCents: number;
  createdAt: string;
  updatedAt: string;
};

export type BudgetStatus = Budget & {
  spentCents: number;
  remainingCents: number;
  over: boolean;
  pct: number;
};

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  moradia: 'Moradia',
  alimentacao: 'Alimentação',
  transporte: 'Transporte',
  saude: 'Saúde',
  lazer: 'Lazer',
  educacao: 'Educação',
  contas: 'Contas',
  compras: 'Compras',
  salario: 'Salário',
  freelance: 'Freelance',
  investimento: 'Investimento',
  outros: 'Outros',
};

/** Categorias típicas de despesa (para editar lançamento). */
export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'moradia',
  'alimentacao',
  'transporte',
  'saude',
  'lazer',
  'educacao',
  'contas',
  'compras',
  'outros',
];

/** Categorias típicas de receita. */
export const INCOME_CATEGORIES: TransactionCategory[] = [
  'salario',
  'freelance',
  'investimento',
  'outros',
];

export const INVESTMENT_KIND_LABELS: Record<InvestmentKind, string> = {
  cdb: 'CDB',
  tesouro: 'Tesouro',
  acoes: 'Ações',
  fii: 'FII',
  cripto: 'Cripto',
  fundos: 'Fundos',
  poupanca: 'Poupança',
  outros: 'Outros',
};
