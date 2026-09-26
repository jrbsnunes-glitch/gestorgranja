'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { ChartAccountSelect } from '@/components/chart-account-select';
import { PageIntro } from '@/components/crud';
import { ErrorBox, Field, PageCard, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { OCCURRENCE_PRIORITIES, labelEnum } from '@/lib/labels';
import { readSession, sessionHasPermission } from '@/lib/session';

type Settings = {
  consumptionSyncMode: 'ON_REVIEW' | 'ON_RECORD' | 'OFF';
  eggSyncOnlyReviewed: boolean;
  stockChartAccountId: string | null;
  enableProductionBelowStandard: boolean;
  productionBelowStandardPct: string;
  enableFeedVariation: boolean;
  feedVariationPct: string;
  enablePendingRecords: boolean;
  pendingRecordsAfterHour: number;
  enableOpenOccurrence: boolean;
  openOccurrenceMinPriority: string;
  openOccurrenceMaxHours: number;
  enableLossAboveLimit: boolean;
  lossAboveLimitPct: string;
  enableMortalityAboveLimit: boolean;
  mortalityDailyLimitPct: string;
};

const SYNC_MODES: { id: Settings['consumptionSyncMode']; label: string; hint: string }[] = [
  { id: 'ON_REVIEW', label: 'Após conferência', hint: 'A baixa no estoque só acontece quando o registro é conferido (recomendado).' },
  { id: 'ON_RECORD', label: 'No registro', hint: 'Baixa imediata ao lançar; ajustes posteriores geram movimentos de correção.' },
  { id: 'OFF', label: 'Desligado', hint: 'Nenhuma baixa automática; estoque só por movimentações manuais.' },
];

function Toggle({ name, checked, label }: { name: string; checked: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}

export default function OperacaoConfiguracoesPage() {
  const [cfg, setCfg] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = sessionHasPermission(readSession(), 'operation.settings');

  useEffect(() => {
    void apiFetch<Settings>('/v1/operation/settings')
      .then(setCfg)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'));
  }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const bool = (k: string) => fd.get(k) === 'on';
    const num = (k: string) => Number(fd.get(k));
    try {
      const updated = await apiFetch<Settings>('/v1/operation/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          consumptionSyncMode: fd.get('consumptionSyncMode'),
          eggSyncOnlyReviewed: bool('eggSyncOnlyReviewed'),
          stockChartAccountId: (fd.get('stockChartAccountId') as string) || null,
          enableProductionBelowStandard: bool('enableProductionBelowStandard'),
          productionBelowStandardPct: num('productionBelowStandardPct'),
          enableFeedVariation: bool('enableFeedVariation'),
          feedVariationPct: num('feedVariationPct'),
          enablePendingRecords: bool('enablePendingRecords'),
          pendingRecordsAfterHour: num('pendingRecordsAfterHour'),
          enableOpenOccurrence: bool('enableOpenOccurrence'),
          openOccurrenceMinPriority: fd.get('openOccurrenceMinPriority'),
          openOccurrenceMaxHours: num('openOccurrenceMaxHours'),
          enableLossAboveLimit: bool('enableLossAboveLimit'),
          lossAboveLimitPct: num('lossAboveLimitPct'),
          enableMortalityAboveLimit: bool('enableMortalityAboveLimit'),
          mortalityDailyLimitPct: num('mortalityDailyLimitPct'),
        }),
      });
      setCfg(updated);
      setMsg('Configurações salvas.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function resync() {
    if (!window.confirm('Reprocessar as baixas de ração e insumos no estoque conforme o modo atual?')) return;
    setError(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ feeds: number; supplies: number }>('/v1/operation/settings/resync-consumption', { method: 'POST' });
      setMsg(`Reprocessados ${r.feeds} registro(s) de ração e ${r.supplies} de insumos.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <AdminShell title="Operação — configurações">
      <PageIntro
        title="Configurações da Operação"
        description="Integração com o estoque (ração, insumos, ovos) e limites dos alertas operacionais."
      />
      <ErrorBox message={error} />
      {msg ? <p className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p> : null}

      {cfg ? (
        <form onSubmit={save} className="space-y-4">
          <PageCard title="Integração com o estoque">
            <fieldset disabled={!canEdit} className="space-y-3">
              <div>
                <p className="mb-1 text-sm font-medium text-slate-800">Quando baixar ração e insumos do estoque</p>
                <div className="space-y-1.5">
                  {SYNC_MODES.map((m) => (
                    <label key={m.id} className="flex items-start gap-2 text-sm">
                      <input type="radio" name="consumptionSyncMode" value={m.id} defaultChecked={cfg.consumptionSyncMode === m.id} className="mt-1" />
                      <span>
                        <span className="font-medium">{m.label}</span>
                        <span className="block text-xs text-slate-500">{m.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <Toggle name="eggSyncOnlyReviewed" checked={cfg.eggSyncOnlyReviewed} label="Postura alimenta o estoque de ovos só após conferência" />
              <Field label="Conta do plano de contas para as baixas de consumo (vazio = conta de estoque padrão)">
                <ChartAccountSelect name="stockChartAccountId" flow="stock" allowEmpty emptyLabel="— padrão —" defaultValue={cfg.stockChartAccountId ?? ''} />
              </Field>
              {canEdit ? (
                <Button type="button" variant="secondary" onClick={resync}>
                  Reprocessar baixas de consumo
                </Button>
              ) : null}
            </fieldset>
          </PageCard>

          <PageCard title="Alertas operacionais">
            <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded border border-slate-200 p-3">
                <Toggle name="enableProductionBelowStandard" checked={cfg.enableProductionBelowStandard} label="Postura abaixo do padrão da linhagem" />
                <Field label="Diferença mínima (pontos percentuais)">
                  <input name="productionBelowStandardPct" type="number" step="0.1" min={0} max={100} className={inputClass} defaultValue={cfg.productionBelowStandardPct} />
                </Field>
              </div>
              <div className="space-y-2 rounded border border-slate-200 p-3">
                <Toggle name="enableFeedVariation" checked={cfg.enableFeedVariation} label="Variação anormal no consumo de ração" />
                <Field label="Variação vs. média dos 7 dias anteriores (%)">
                  <input name="feedVariationPct" type="number" step="0.1" min={0} max={100} className={inputClass} defaultValue={cfg.feedVariationPct} />
                </Field>
              </div>
              <div className="space-y-2 rounded border border-slate-200 p-3">
                <Toggle name="enablePendingRecords" checked={cfg.enablePendingRecords} label="Lançamentos do dia anterior faltando" />
                <Field label="Alertar a partir das (hora, 0-23)">
                  <input name="pendingRecordsAfterHour" type="number" min={0} max={23} className={inputClass} defaultValue={cfg.pendingRecordsAfterHour} />
                </Field>
              </div>
              <div className="space-y-2 rounded border border-slate-200 p-3">
                <Toggle name="enableOpenOccurrence" checked={cfg.enableOpenOccurrence} label="Ocorrência aberta sem tratamento" />
                <Field label="Prioridade mínima">
                  <select name="openOccurrenceMinPriority" className={inputClass} defaultValue={cfg.openOccurrenceMinPriority}>
                    {OCCURRENCE_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {labelEnum(p)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Aberta há mais de (horas)">
                  <input name="openOccurrenceMaxHours" type="number" min={0} className={inputClass} defaultValue={cfg.openOccurrenceMaxHours} />
                </Field>
              </div>
              <div className="space-y-2 rounded border border-slate-200 p-3">
                <Toggle name="enableLossAboveLimit" checked={cfg.enableLossAboveLimit} label="Perdas de ovos acima do limite" />
                <Field label="(trincados + sujos + deformados + descarte) / produzidos (%)">
                  <input name="lossAboveLimitPct" type="number" step="0.1" min={0} max={100} className={inputClass} defaultValue={cfg.lossAboveLimitPct} />
                </Field>
              </div>
              <div className="space-y-2 rounded border border-slate-200 p-3">
                <Toggle name="enableMortalityAboveLimit" checked={cfg.enableMortalityAboveLimit} label="Mortalidade diária acima do limite" />
                <Field label="Mortalidade do dia / aves vivas (%)">
                  <input name="mortalityDailyLimitPct" type="number" step="0.01" min={0} max={100} className={inputClass} defaultValue={cfg.mortalityDailyLimitPct} />
                </Field>
              </div>
            </fieldset>
          </PageCard>

          {canEdit ? (
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar configurações'}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Somente leitura — requer permissão "Configurações da operação".</p>
          )}
        </form>
      ) : (
        <p className="text-sm text-slate-500">Carregando…</p>
      )}
    </AdminShell>
  );
}
