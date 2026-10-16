'use client';

/** Converte texto com vírgula ou ponto em número. */
export function parseSaleQuantityInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatSaleQuantityDisplay(value: number): string {
  const s = String(value);
  return s.includes('.') ? s.replace('.', ',') : s;
}

/**
 * Corrige incremento do spinner quando min era fracionário (1 → 1,001).
 * Setas passam a mover de 1 em 1 unidade inteira.
 */
function isSpinnerStep(prev: number, next: number): boolean {
  const delta = next - prev;
  return (
    Math.abs(Math.abs(delta) - 1) < 1e-6 ||
    Math.abs(delta - 0.001) < 1e-6 ||
    (delta > 0 && delta < 1) ||
    (delta < 0 && delta > -1 && Math.abs(delta) > 1e-9)
  );
}

/** Setas sempre somam ou subtraem 1 da quantidade atual (1 → 2, 2,5 → 3,5). */
function normalizeQtyAfterStep(prev: number, next: number): number {
  if (!isSpinnerStep(prev, next)) return next;
  const delta = next - prev;
  if (delta > 0) return Math.round((prev + 1) * 1000) / 1000;
  return Math.max(0, Math.round((prev - 1) * 1000) / 1000);
}

/** Classes que mantêm as setas nativas do campo numérico visíveis. */
export const saleQtyInputClass =
  '[appearance:auto] [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100';

type SaleQtyInputProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  id?: string;
};

/** Setas do mouse: +1 / −1 inteiro; frações só digitando (vírgula ou ponto). */
export function SaleQtyInput({ value, onChange, className, id }: SaleQtyInputProps) {
  return (
    <input
      id={id}
      className={`${saleQtyInputClass} ${className ?? ''}`}
      type="number"
      min={0}
      step={1}
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        const n = parseSaleQuantityInput(e.target.value);
        if (n == null || n < 0) return;
        onChange(normalizeQtyAfterStep(value, n));
      }}
    />
  );
}

type SaleQtyDraftInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

/** Rascunho de quantidade: setas +1/−1 inteiro; frações digitando com vírgula. */
export function SaleQtyDraftInput({ value, onChange, className }: SaleQtyDraftInputProps) {
  const parsed = parseSaleQuantityInput(value);
  const prev = parsed ?? 0;

  return (
    <input
      className={`${saleQtyInputClass} ${className ?? ''}`}
      type="number"
      min={0}
      step={1}
      inputMode="decimal"
      value={parsed != null ? parsed : ''}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange('');
          return;
        }
        const n = parseSaleQuantityInput(raw);
        if (n == null || n < 0) return;
        const normalized = normalizeQtyAfterStep(prev, n);
        onChange(formatSaleQuantityDisplay(normalized));
      }}
    />
  );
}
