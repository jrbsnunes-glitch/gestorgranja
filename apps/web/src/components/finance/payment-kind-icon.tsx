'use client';

import { labelEnum } from '@/lib/labels';

export function PaymentKindIcon({ kind, className = 'h-5 w-5' }: { kind: string; className?: string }) {
  const k = kind.toUpperCase();
  if (k === 'PIX') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden>
        <path
          fill="currentColor"
          d="M11.917 11.71a2.046 2.046 0 0 1-1.454-.602l-2.1-2.1a.4.4 0 0 0-.551 0l-2.108 2.108a2.044 2.044 0 0 1-1.454.602h-.414l2.66 2.66c.83.83 2.177.83 3.007 0l2.667-2.668h-.253zM4.25 4.282c.55 0 1.066.214 1.454.602l2.108 2.108a.39.39 0 0 0 .552 0l2.1-2.1a2.044 2.044 0 0 1 1.453-.602h.253L9.503 1.623a2.127 2.127 0 0 0-3.007 0l-2.66 2.66h.414z"
        />
        <path
          fill="currentColor"
          d="m14.377 6.496-1.612-1.612a.307.307 0 0 1-.114.023h-.733c-.379 0-.75.154-1.017.422l-2.1 2.1a1.164 1.164 0 0 1-1.645 0L5.048 5.321a1.392 1.392 0 0 0-1.017-.422H3.35a.3.3 0 0 1-.105-.02l-1.622 1.623a2.127 2.127 0 0 0 0 3.006l1.622 1.623a.3.3 0 0 1 .105-.021h.639c.379 0 .75-.154 1.017-.422l2.108-2.108a1.172 1.172 0 0 1 1.645 0l2.1 2.1c.267.268.638.422 1.017.422h.733a.3.3 0 0 1 .114.023l1.612-1.612a2.127 2.127 0 0 0 0-3.006z"
        />
      </svg>
    );
  }
  if (k === 'CASH') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (k === 'CARD') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <rect x="2.5" y="5" width="19" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 9.5h18" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (k === 'BOLETO') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path
          fill="currentColor"
          d="M4 5h2v14H4V5Zm3 0h1v14H7V5Zm3 0h2v14h-2V5Zm3 0h1v14h-1V5Zm3 0h2v14h-2V5Zm3 0h1v14h-1V5Z"
        />
      </svg>
    );
  }
  if (k === 'REQUISICAO') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <rect x="5" y="3.5" width="14" height="17" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (k === 'TRANSFER') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          d="M7 7h12M7 7l3-3M7 7l3 3M17 17H5M17 17l-3 3M17 17l-3-3"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function PaymentMethodCell({ kind, name }: { kind: string; name?: string }) {
  const label = name?.trim() || labelEnum(kind) || kind;
  return (
    <span className="inline-flex items-center gap-2 text-slate-800">
      <span className="text-emerald-800">
        <PaymentKindIcon kind={kind} />
      </span>
      <span className="text-sm">{label}</span>
    </span>
  );
}
