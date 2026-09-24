'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { inputClass } from '@/components/ui-parts';

export type ChartAccountOption = { id: string; code: string; name: string };

type Flow = 'payable' | 'receivable' | 'stock';

type Props = {
  name?: string;
  flow?: Flow;
  required?: boolean;
  defaultValue?: string;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

export function ChartAccountSelect({
  name = 'chartAccountId',
  flow,
  required,
  defaultValue,
  className,
  allowEmpty,
  emptyLabel = '— Selecione —',
}: Props) {
  const [accounts, setAccounts] = useState<ChartAccountOption[]>([]);

  useEffect(() => {
    const q = new URLSearchParams();
    if (flow) {
      q.set('flow', flow);
      q.set('posting', '1');
    }
    const suffix = q.toString() ? `?${q.toString()}` : '';
    void apiFetch<ChartAccountOption[]>(`/v1/cadastros/chart-accounts${suffix}`).then(setAccounts);
  }, [flow]);

  return (
    <select
      name={name}
      className={className ?? inputClass}
      required={required}
      defaultValue={defaultValue ?? (allowEmpty ? '' : undefined)}
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.code} — {a.name}
        </option>
      ))}
    </select>
  );
}
