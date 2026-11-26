'use client';

import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react';
import { formatBrlPlain, parseBrlMoney } from '@/lib/money';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'type' | 'onChange'> & {
  value?: number | null;
  defaultValue?: number | string | null;
  onValueChange?: (value: number | null) => void;
};

function groupInt(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Digitação livre; a vírgula completa os centavos (10, vira 10,00). */
export function applyBrlMoneyEdit(raw: string): { text: string; selectFrom?: number; selectTo?: number } {
  let s = raw.replace(/[^\d,]/g, '');
  const commaAt = s.indexOf(',');
  if (commaAt >= 0) s = s.slice(0, commaAt + 1) + s.slice(commaAt + 1).replace(/,/g, '');
  const comma = s.indexOf(',');
  if (comma < 0) {
    const digits = s.replace(/^0+(?=\d)/, '');
    return { text: digits ? groupInt(digits) : '' };
  }
  let intDigits = s.slice(0, comma).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!intDigits) intDigits = '0';
  const centsRaw = s.slice(comma + 1).replace(/\D/g, '').slice(0, 2);
  const cents = centsRaw.padEnd(2, '0');
  const text = `${groupInt(intDigits)},${cents}`;
  if (centsRaw.length < 2) {
    return { text, selectFrom: text.length - (2 - centsRaw.length), selectTo: text.length };
  }
  return { text };
}

function initialText(value: number | string | null | undefined) {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : parseBrlMoney(String(value));
  return Number.isFinite(n) ? formatBrlPlain(n) : '';
}

export function BrlMoneyInput({
  value,
  defaultValue,
  onValueChange,
  name,
  className,
  required,
  disabled,
  autoFocus,
  id,
  placeholder = '0,00',
  min,
}: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const controlled = value !== undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSel = useRef<{ start: number; end: number } | null>(null);
  const [text, setText] = useState(() => initialText(controlled ? value : defaultValue));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!controlled || focused) return;
    setText(initialText(value));
  }, [controlled, focused, value]);

  useEffect(() => {
    const sel = pendingSel.current;
    const el = inputRef.current;
    if (!sel || !el) return;
    pendingSel.current = null;
    el.setSelectionRange(sel.start, sel.end);
  }, [text]);

  function publish(next: string) {
    setText(next);
    if (!onValueChange) return;
    if (!next.trim()) {
      onValueChange(null);
      return;
    }
    const n = parseBrlMoney(next);
    onValueChange(Number.isFinite(n) ? n : null);
  }

  const numeric = parseBrlMoney(text);
  const hidden = name ? (Number.isFinite(numeric) ? String(numeric) : '') : '';
  const minValue = min == null || min === '' ? null : Number(min);

  return (
    <>
      {name ? <input type="hidden" name={name} value={hidden} /> : null}
      <input
        ref={inputRef}
        id={inputId}
        className={className}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        value={text}
        aria-invalid={minValue != null && Number.isFinite(numeric) && numeric < minValue ? true : undefined}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          if (!text.trim()) {
            publish('');
            return;
          }
          const n = parseBrlMoney(text);
          publish(Number.isFinite(n) ? formatBrlPlain(n) : '');
        }}
        onChange={(e) => {
          const next = applyBrlMoneyEdit(e.target.value);
          if (next.selectFrom != null && next.selectTo != null) {
            pendingSel.current = { start: next.selectFrom, end: next.selectTo };
          }
          publish(next.text);
        }}
      />
    </>
  );
}
