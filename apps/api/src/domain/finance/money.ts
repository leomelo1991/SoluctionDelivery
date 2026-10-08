export const MAX_FINANCE_CENTS = 999999999999n;
export function cents(value: string, allowZero = false): bigint {
  if (!/^(0|[1-9][0-9]{0,11})$/.test(value))
    throw new Error('Informe centavos inteiros como texto.');
  const amount = BigInt(value);
  if (amount > MAX_FINANCE_CENTS || amount < (allowZero ? 0n : 1n))
    throw new Error('Valor fora do limite permitido.');
  return amount;
}
export function financeWeek(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('Informe a segunda-feira no formato AAAA-MM-DD.');
  const start = new Date(`${value}T00:00:00-03:00`);
  if (
    !Number.isFinite(start.getTime()) ||
    start.toISOString().slice(0, 10) !== value ||
    start.getUTCDay() !== 1 ||
    start.getUTCFullYear() < 2020
  )
    throw new Error('A semana deve começar na segunda-feira, em São Paulo.');
  return { start, end: new Date(start.getTime() + 7 * 86400000) };
}
