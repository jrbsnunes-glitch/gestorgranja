'use client';

import { useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { PERSONAL_BILL_KINDS, PersonalBillKindIcon } from '@/components/agenda/personal-bill-kind';
import { Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';

export type ExpenseTypeOption = {
  id: string;
  name: string;
  iconKey: string;
};

export function ExpenseTypeField({
  name = 'expenseTypeId',
  defaultValue = '',
}: {
  name?: string;
  defaultValue?: string;
}) {
  const [types, setTypes] = useState<ExpenseTypeOption[]>([]);
  const [selected, setSelected] = useState(defaultValue);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('OUTROS');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch<ExpenseTypeOption[]>('/v1/finance/expense-types')
      .then((rows) => {
        setTypes(rows);
        setSelected((cur) => cur || rows.find((r) => r.iconKey === 'OUTROS')?.id || rows[0]?.id || '');
      })
      .catch(() => setTypes([]));
  }, []);

  async function createType() {
    const nameTrim = newName.trim();
    if (!nameTrim) {
      setError('Informe o nome do tipo.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await apiFetch<ExpenseTypeOption>('/v1/finance/expense-types', {
        method: 'POST',
        body: JSON.stringify({ name: nameTrim, iconKey: newIcon }),
      });
      setTypes((prev) => [...prev.filter((t) => t.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setSelected(created.id);
      setNewName('');
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar tipo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3">
      <input type="hidden" name={name} value={selected} />
      <p className="mb-2 text-sm font-medium text-slate-800">Tipo da conta</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {types.map((t) => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm ${
                active ? 'border-emerald-600 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-white text-slate-800'
              }`}
            >
              <PersonalBillKindIcon kind={t.iconKey} />
              <span className="truncate">{t.name}</span>
            </button>
          );
        })}
      </div>
      {creating ? (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Field label="Nome do novo tipo">
            <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: Ração, aluguel, imposto…" />
          </Field>
          <Field label="Ícone">
            <select className={inputClass} value={newIcon} onChange={(e) => setNewIcon(e.target.value)}>
              {PERSONAL_BILL_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" disabled={busy} onClick={() => void createType()}>
              Salvar tipo
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" className="mt-2 text-sm font-medium text-emerald-800 hover:underline" onClick={() => setCreating(true)}>
          + Cadastrar outro tipo
        </button>
      )}
    </div>
  );
}
