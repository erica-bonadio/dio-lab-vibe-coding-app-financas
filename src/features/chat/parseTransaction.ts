import type {
  InvestmentKind,
  TransactionCategory,
  TransactionType,
} from '@shared/types';
import { INVESTMENT_KIND_LABELS } from '@shared/types';
import { parseBRLToCents } from '@/lib/money';
import { todayIsoDate } from '@/lib/id';

export type ParsedIntent =
  | {
      kind: 'transaction';
      type: TransactionType;
      amountCents: number;
      category: TransactionCategory;
      description: string;
      occurredAt: string;
    }
  | {
      kind: 'investment';
      action: 'contribute' | 'redeem';
      amountCents: number;
      name: string;
      investmentKind: InvestmentKind;
    }
  | { kind: 'help' }
  | { kind: 'summary' }
  | { kind: 'unknown'; raw: string };

const EXPENSE_HINTS: { re: RegExp; category: TransactionCategory }[] = [
  { re: /aluguel|condom[ií]nio|iptu/i, category: 'moradia' },
  { re: /mercado|feira|ifood|restaurante|lanche|comida|caf[eé]/i, category: 'alimentacao' },
  { re: /uber|99|gasolina|combust[ií]vel|ônibus|onibus|metro|passagem/i, category: 'transporte' },
  { re: /farm[aá]cia|m[eé]dico|plano de sa[uú]de|dentista/i, category: 'saude' },
  { re: /cinema|netflix|spotify|viagem|bar|show/i, category: 'lazer' },
  { re: /curso|livro|mensalidade|faculdade/i, category: 'educacao' },
  { re: /luz|energia|água|agua|internet|telefone|conta/i, category: 'contas' },
  { re: /roupa|loja|amazon|shopee|compra/i, category: 'compras' },
];

const INCOME_HINTS: { re: RegExp; category: TransactionCategory }[] = [
  { re: /sal[aá]rio|folha/i, category: 'salario' },
  { re: /freelance|freela|cliente|pix recebido/i, category: 'freelance' },
  { re: /dividendo|rendimento/i, category: 'investimento' },
];

const KIND_HINTS: { re: RegExp; kind: InvestmentKind }[] = [
  { re: /\bcdb\b|rdb/i, kind: 'cdb' },
  { re: /tesouro|selic|ipca/i, kind: 'tesouro' },
  { re: /\ba[cç][oõ]es?\b|a[cç][aã]o|bolsa|petr4|vale3/i, kind: 'acoes' },
  { re: /\bfii\b|fundo imobili/i, kind: 'fii' },
  { re: /bitcoin|btc|eth|cripto|crypto/i, kind: 'cripto' },
  { re: /fundo|etf/i, kind: 'fundos' },
  { re: /poupan[cç]a/i, kind: 'poupanca' },
];

function detectType(text: string): TransactionType {
  if (/\b(ganhei|recebi|sal[aá]rio|entrou|renda|freelance|dividendo)\b/i.test(text)) {
    return 'income';
  }
  if (/\b(gastei|paguei|comprei|sa[ií]u|despesa|conta)\b/i.test(text)) {
    return 'expense';
  }
  return 'expense';
}

function detectCategory(text: string, type: TransactionType): TransactionCategory {
  const hints = type === 'income' ? INCOME_HINTS : EXPENSE_HINTS;
  for (const h of hints) {
    if (h.re.test(text)) return h.category;
  }
  return 'outros';
}

function detectInvestmentKind(text: string): InvestmentKind {
  for (const h of KIND_HINTS) {
    if (h.re.test(text)) return h.kind;
  }
  return 'outros';
}

function extractAmountCents(text: string): number | null {
  const moneyMatch =
    text.match(/R\$\s*([\d.]+,\d{2}|\d+)/i) ||
    text.match(/([\d.]+,\d{2})\s*(reais)?/i) ||
    text.match(/\b(\d+)\s*reais?\b/i) ||
    text.match(/\b(\d+[.,]\d{2})\b/);
  if (moneyMatch) {
    return parseBRLToCents(moneyMatch[1] ?? moneyMatch[0]);
  }
  const plain = text.match(/\b(\d{1,6})\b/);
  if (plain) return parseBRLToCents(plain[1]);
  return null;
}

function extractDescription(text: string): string {
  return text
    .replace(/R\$\s*[\d.,]+/gi, '')
    .replace(/\b\d+[.,]?\d*\s*reais?\b/gi, '')
    .replace(/\b(gastei|paguei|comprei|ganhei|recebi|com|no|na|em|de|do|da)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function extractInvestmentName(text: string, kind: InvestmentKind): string {
  const after = text.match(
    /(?:investi|aportei|apliquei|resgatei|comprei)\s+(?:R\$\s*)?[\d.,]+\s*(?:reais?\s+)?(?:no|na|em|de|do|da)?\s*(.+)$/i,
  );
  let name = (after?.[1] ?? '').trim();
  name = name
    .replace(/\b(reais?|hoje|agora)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (!name) {
    return INVESTMENT_KIND_LABELS[kind];
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function parseInvestmentIntent(text: string): ParsedIntent | null {
  const isRedeem = /\b(resgatei|resgate|saquei|vendi)\b/i.test(text);
  const isContribute =
    /\b(investi|aportei|apliquei|comprei\s+(a[cç][oõ]es|fii|cdb|tesouro|bitcoin))\b/i.test(
      text,
    ) || /\binvesti\b/i.test(text);

  if (!isRedeem && !isContribute) return null;

  const amountCents = extractAmountCents(text);
  if (amountCents == null || amountCents <= 0) return null;

  const investmentKind = detectInvestmentKind(text);
  const name = extractInvestmentName(text, investmentKind);

  return {
    kind: 'investment',
    action: isRedeem ? 'redeem' : 'contribute',
    amountCents,
    name,
    investmentKind,
  };
}

/** Parser local (MVP): sem chamar API — regras + heurísticas em pt-BR. */
export function parseChatIntent(raw: string): ParsedIntent {
  const text = raw.trim();
  if (!text) return { kind: 'unknown', raw };

  if (/^(ajuda|help|o que (eu )?posso|como usar)/i.test(text)) {
    return { kind: 'help' };
  }
  if (/^(resumo|saldo|como estou|m[eê]s|balan[cç]o|carteira)/i.test(text)) {
    return { kind: 'summary' };
  }

  const investment = parseInvestmentIntent(text);
  if (investment) return investment;

  const amountCents = extractAmountCents(text);
  if (amountCents == null || amountCents <= 0) {
    return { kind: 'unknown', raw: text };
  }

  const type = detectType(text);
  const category = detectCategory(text, type);
  const description =
    extractDescription(text) || (type === 'income' ? 'Receita' : 'Despesa');

  return {
    kind: 'transaction',
    type,
    amountCents,
    category,
    description,
    occurredAt: todayIsoDate(),
  };
}
