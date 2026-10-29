'use client';

import { useEffect, useState } from 'react';

/** Converte texto com vírgula ou ponto em número. */
export function parseSaleQuantityInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!t || t === '.' || t === ',') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
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

/** Setas do mouse: +1 / −1 inteiro; frações só digitando. O campo pode ficar vazio para apagar o número atual. */
export function SaleQtyInput({ value, onChange, className, id }: SaleQtyInputProps) {
  const [text, setText] = useState(() => (Number.isFinite(value) ? String(value) : ''));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(Number.isFinite(value) ? String(value) : '');
  }, [value, focused]);

  return (
    <input
      id={id}
      className={`${saleQtyInputClass} ${className ?? ''}`}
      type="number"
      min={0}
      step={1}
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onBlur={() => {
        setFocused(false);
        const n = parseSaleQuantityInput(text);
        if (n == null || n < 0) {
          setText(Number.isFinite(value) ? String(value) : '');
          return;
        }
        const next = normalizeQtyAfterStep(value, n);
        onChange(next);
        setText(String(next));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw === '') return;
        const n = parseSaleQuantityInput(raw);
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
  placeholder?: string;
};

/** Rascunho de quantidade: setas +1/−1 inteiro; o texto pode ser apagado antes de digitar. */
export function SaleQtyDraftInput({ value, onChange, className, placeholder }: SaleQtyDraftInputProps) {
  const parsed = parseSaleQuantityInput(value);
  const prev = parsed ?? 0;

  return (
    <input
      className={`${saleQtyInputClass} ${className ?? ''}`}
      type="number"
      min={0}
      step={1}
      inputMode="decimal"
      placeholder={placeholder}
      value={value}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange('');
          return;
        }
        const n = parseSaleQuantityInput(raw);
        if (n == null || n < 0) {
          onChange(raw);
          return;
        }
        if (isSpinnerStep(prev, n)) {
          onChange(String(normalizeQtyAfterStep(prev, n)));
          return;
        }
        onChange(raw);
      }}
    />
  );
}
