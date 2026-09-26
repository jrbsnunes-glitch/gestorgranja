'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { RecordViewModal } from '@/components/crud';
import { ErrorBox, Field, SimpleTable, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { FLOCK_MOVEMENT_TYPES, labelEnum } from '@/lib/labels';
import { readSession, sessionHasPermission } from '@/lib/session';

export type FlockBalance = {
  housedQty: number;
  movementsIn: number;
  movementsOut: number;
  adjustments: number;
  mortalityTotal: number;
  liveBirds: number;
};

type MovementRow = {
  id: string;
  controlNumber: number;
  date: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdByName: string | null;
  counterpartLotCode: string | null;
  createdAt: string;
};

type LotOption = { id: string; code: string };

/** Movimentações de aves de um lote: histórico, composição do saldo e inclusão. */
export function FlockMovementsModal({
  open,
  onClose,
  lot,
  lots,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  lot: { id: string; code: string; status: string } | null;
  lots: LotOption[];
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [balance, setBalance] = useState<FlockBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<string>('ENTRY');
  const session = readSession();
  const canAdjust = sessionHasPermission(session, 'production.adjust');
  const canWrite = sessionHasPermission(session, 'production.write');

  const load = useCallback(() => {
    if (!lot) return;
    void apiFetch<MovementRow[]>(`/v1/production/lots/${lot.id}/movements`).then(setRows).catch(() => setRows([]));
    void apiFetch<FlockBalance>(`/v1/production/lots/${lot.id}/balance`).then(setBalance).catch(() => setBalance(null));
  }, [lot]);

  useEffect(() => {
    if (open) {
      setError(null);
      load();
    }
  }, [open, load]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lot) return;
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    try {
      await apiFetch(`/v1/production/lots/${lot.id}/movements`, {
        method: 'POST',
        body: JSON.stringify({
          date: fd.get('date'),
          type,
          quantity: Number(fd.get('quantity') || 0),
          counterpartLotId: fd.get('counterpartLotId') || undefined,
          reason: fd.get('reason') || undefined,
        }),
      });
      form.reset();
      load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (!lot) return null;
  const today = new Date().toISOString().slice(0, 10);
  const isTransfer = type === 'TRANSFER_IN' || type === 'TRANSFER_OUT';
  const needsReason = type === 'ADJUST' || type === 'CLOSE';
  const typeOptions = FLOCK_MOVEMENT_TYPES.filter((t) => canAdjust || (t !== 'ADJUST' && t !== 'CLOSE'));

  return (
    <RecordViewModal open={open} onClose={onClose} title={`Movimentações de aves — lote ${lot.code}`} wide>
      {balance ? (
        <div className="mb-4 grid gap-2 text-sm sm:grid-cols-3 md:grid-cols-6">
          <BalanceCell label="Alojadas" value={balance.housedQty} />
          <BalanceCell label="Entradas" value={balance.movementsIn} sign="+" />
          <BalanceCell label="Saídas" value={balance.movementsOut} sign="−" />
          <BalanceCell label="Ajustes" value={balance.adjustments} sign="±" />
          <BalanceCell label="Mortalidade" value={balance.mortalityTotal} sign="−" />
          <BalanceCell label="Aves vivas" value={balance.liveBirds} strong />
        </div>
      ) : null}
      <p className="mb-4 text-xs text-slate-500">
        Aves vivas = alojadas + entradas − saídas ± ajustes − mortalidade. Cada parcela vem de registros
        conferíveis; nenhum número é digitado diretamente no painel.
      </p>

      <ErrorBox message={error} />

      {canWrite && lot.status !== 'FINISHED' ? (
        <form onSubmit={submit} className="mb-5 rounded-md border border-slate-200 p-3">
          <p className="mb-2 text-sm font-medium text-slate-800">Incluir movimentação</p>
          <div className="grid gap-x-4 md:grid-cols-3">
            <Field label="Tipo">
              <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {labelEnum(t)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data">
              <input name="date" type="date" className={inputClass} defaultValue={today} required />
            </Field>
            {type !== 'CLOSE' ? (
              <Field label={type === 'ADJUST' ? 'Quantidade (± aves)' : 'Quantidade (aves)'}>
                <input
                  name="quantity"
                  type="number"
                  className={inputClass}
                  required
                  min={type === 'ADJUST' ? undefined : 1}
                />
              </Field>
            ) : null}
            {isTransfer ? (
              <Field label={type === 'TRANSFER_OUT' ? 'Lote destino' : 'Lote origem'}>
                <select name="counterpartLotId" className={inputClass} required>
                  <option value="">Selecione</option>
                  {lots
                    .filter((l) => l.id !== lot.id)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code}
                      </option>
                    ))}
                </select>
              </Field>
            ) : null}
            <div className={isTransfer ? 'md:col-span-2' : 'md:col-span-3'}>
              <Field label={needsReason ? 'Justificativa (obrigatória)' : 'Motivo / observação'}>
                <input name="reason" className={inputClass} required={needsReason} />
              </Field>
            </div>
          </div>
          {type === 'CLOSE' ? (
            <p className="mb-2 text-xs text-amber-700">
              Encerrar o lote muda o status para Encerrado; depois disso só ajustes autorizados são aceitos.
            </p>
          ) : null}
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Registrar'}
          </Button>
        </form>
      ) : null}

      <SimpleTable
        headers={['Data', 'Tipo', 'Qtd', 'Contrapartida', 'Motivo', 'Responsável']}
        rows={rows.map((r) => [
          formatCalendarDatePtBR(r.date),
          labelEnum(r.type),
          r.type === 'CLOSE' ? '—' : String(r.quantity),
          r.counterpartLotCode ?? '—',
          r.reason ?? '—',
          r.createdByName ?? '—',
        ])}
      />
    </RecordViewModal>
  );
}

function BalanceCell({
  label,
  value,
  sign,
  strong,
}: {
  label: string;
  value: number;
  sign?: string;
  strong?: boolean;
}) {
  return (
    <div className={`rounded border p-2 ${strong ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100'}`}>
      <p className="text-xs text-slate-500">
        {sign ? `${sign} ` : ''}
        {label}
      </p>
      <p className={`font-semibold ${strong ? 'text-emerald-900' : 'text-slate-900'}`}>
        {value.toLocaleString('pt-BR')}
      </p>
    </div>
  );
}
