export const PERSONAL_BILL_KINDS = [
  { id: 'LUZ', label: 'Conta de luz' },
  { id: 'FACULDADE', label: 'Faculdade' },
  { id: 'CARRO', label: 'Carro' },
  { id: 'CARTAO', label: 'Cartão de crédito' },
  { id: 'INTERNET', label: 'Internet' },
  { id: 'TELEFONE', label: 'Telefone' },
  { id: 'SEGURO', label: 'Seguro' },
  { id: 'OUTROS', label: 'Outros' },
] as const;

export type PersonalBillKind = (typeof PERSONAL_BILL_KINDS)[number]['id'];

export function PersonalBillKindIcon({ kind, className = 'h-4 w-4' }: { kind: string; className?: string }) {
  const k = kind.toUpperCase();
  if (k === 'LUZ') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="currentColor" d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z" />
      </svg>
    );
  }
  if (k === 'FACULDADE') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="currentColor" d="M12 3 2 8l10 5 8-4.1V16h2V8L12 3Zm-6 9.2V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.8l-6 3-6-3Z" />
      </svg>
    );
  }
  if (k === 'CARRO') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path
          fill="currentColor"
          d="M5 11 6.5 6.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6h-2v-1.5H7V17H5v-6Zm2.2-1h9.6l-.9-2.6H8.1L7.2 10ZM7.5 13.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Zm9 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z"
        />
      </svg>
    );
  }
  if (k === 'CARTAO') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="currentColor" d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11ZM5 8h14V6.5H5V8Zm0 3v6.5h14V11H5Z" />
      </svg>
    );
  }
  if (k === 'INTERNET') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path
          fill="currentColor"
          d="M12 18.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM6.2 15.2a8.2 8.2 0 0 1 11.6 0l-1.5 1.5a6.1 6.1 0 0 0-8.6 0l-1.5-1.5Zm-3.2-3.2a12.6 12.6 0 0 1 18 0l-1.5 1.5a10.5 10.5 0 0 0-15 0L3 12Z"
        />
      </svg>
    );
  }
  if (k === 'TELEFONE') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path
          fill="currentColor"
          d="M8.2 3.5h2.2l1.1 3.2-1.6 1a12 12 0 0 0 5.4 5.4l1-1.6 3.2 1.1v2.2c0 .8-.6 1.5-1.4 1.6A15 15 0 0 1 6.6 4.9c.1-.8.8-1.4 1.6-1.4Z"
        />
      </svg>
    );
  }
  if (k === 'SEGURO') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="currentColor" d="M12 2 4.5 5v6.2c0 4.6 3.1 8.8 7.5 10.3 4.4-1.5 7.5-5.7 7.5-10.3V5L12 2Zm0 2.2 5.5 2.2v4.8c0 3.5-2.2 6.8-5.5 8.1-3.3-1.3-5.5-4.6-5.5-8.1V6.4L12 4.2Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="6" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="18" cy="12" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function PersonalBillDescription({ kind, description }: { kind?: string | null; description: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-slate-900">
      <span className="text-slate-700">
        <PersonalBillKindIcon kind={kind || 'OUTROS'} />
      </span>
      <span>{description}</span>
    </span>
  );
}
