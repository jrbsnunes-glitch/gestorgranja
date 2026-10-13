export function cashSessionStatusUi(status: string): { label: string; className: string } {
  switch (status) {
    case 'OPEN':
      return {
        label: 'Aberto',
        className: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300/80',
      };
    case 'PENDING_RECONCILIATION':
      return {
        label: 'Pendente de conferência',
        className: 'bg-amber-100 text-amber-950 ring-1 ring-amber-300/80',
      };
    case 'RECONCILED':
      return {
        label: 'Conferido',
        className: 'bg-sky-100 text-sky-950 ring-1 ring-sky-300/80',
      };
    default:
      return {
        label: status,
        className: 'bg-slate-100 text-slate-800 ring-1 ring-slate-200',
      };
  }
}

/** Caixa já fechado pelo operador (não aberto). */
export function isCashSessionClosed(status: string) {
  return status === 'PENDING_RECONCILIATION' || status === 'RECONCILED';
}

export function varianceDisplayClass(v: number | null) {
  if (v == null) return 'text-slate-500';
  if (Math.abs(v) < 0.01) return 'text-emerald-700 font-semibold';
  return v > 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold';
}
