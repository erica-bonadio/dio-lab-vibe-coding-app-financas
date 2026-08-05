export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
