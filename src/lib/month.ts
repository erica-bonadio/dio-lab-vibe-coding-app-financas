import { currentYearMonth } from '@/lib/id';

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "2026-08" → "agosto 2026" */
export function formatYearMonthBr(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return yearMonth;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

export function isCurrentMonth(yearMonth: string): boolean {
  return yearMonth === currentYearMonth();
}

export function monthRange(yearMonth: string): { start: string; end: string } {
  return {
    start: `${yearMonth}-01`,
    end: `${yearMonth}-31`,
  };
}
