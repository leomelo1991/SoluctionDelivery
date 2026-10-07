import type { Stage } from '@solution/contracts';
export const nextStep: Partial<
  Record<Stage, { action: string; label: string; confirmation: string }>
> = {
  accepted: {
    action: 'arrive',
    label: 'Cheguei à coleta',
    confirmation: 'Você já chegou ao estabelecimento?',
  },
  arrived: {
    action: 'collect',
    label: 'Confirmar retirada',
    confirmation: 'Você recebeu o pedido e está pronto para sair?',
  },
  collected: {
    action: 'complete',
    label: 'Concluir entrega',
    confirmation: 'Você entregou o pedido ao destinatário?',
  },
};
export function historyPeriod(from: string, to: string): string {
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to) || from > to)
    throw new Error('Informe um período válido no formato AAAA-MM-DD.');
  return `from=${encodeURIComponent(`${from}T00:00:00-03:00`)}&to=${encodeURIComponent(`${to}T23:59:59.999-03:00`)}`;
}
