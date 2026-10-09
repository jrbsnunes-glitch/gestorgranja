'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { ErrorBox } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';

export type EggStockReconciliation = {
  config: {
    enabled: boolean;
    eggsPerCarton: number;
    cartonsPerBox: number;
    eggSyncOnlyReviewed: boolean;
    cartonProduct: { sku: string; name: string } | null;
    boxProduct: { sku: string; name: string } | null;
  };
  production: {
    rows: number;
    totalCommercialEggs: number;
    eligibleCommercialEggs: number;
    rowsMissingLedger: number;
    unpackagedRemainderEggs: number;
  };
  fromProduction: { looseCartons: number; boxes: number; equivalentEggs: number };
  ledger: { looseCartons: number; boxes: number; equivalentEggs: number };
  currentStock: { looseCartons: number; boxes: number; equivalentEggs: number };
  posturaNet: { cartons: number; boxes: number };
  otherNet: { cartons: number; boxes: number; equivalentEggs: number };
  checks: {
    ledgerMatchesProduction: boolean;
    posturaNetMatchesLedger: boolean;
    stockMatchesLedger: boolean;
    integrationHealthy: boolean;
    stockMatchesProductionTargets: boolean;
  };
  otherMovesSample: {
    at: string;
    kind: string;
    type: string;
    qty: number;
    reference: string | null;
  }[];
};

function fmtQty(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function CheckPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950'
      }`}
    >
      {ok ? 'OK' : 'Atenção'} — {label}
    </span>
  );
}

type Row3 = { label: string; cartons: number; boxes: number; eggs: number };

function MetricTable({ rows }: { rows: Row3[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Métrica</th>
            <th className="px-3 py-2 text-right">Cartelas avulsas</th>
            <th className="px-3 py-2 text-right">Caixas</th>
            <th className="px-3 py-2 text-right">Ovos equiv.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-2 font-medium text-slate-800">{r.label}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-900">{fmtQty(r.cartons)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-900">{fmtQty(r.boxes)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-900">{fmtQty(r.eggs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EggStockReconciliationPanel({
  compact,
  onRefreshConfig,
}: {
  compact?: boolean;
  /** Chamado após reprocessar postura (opcional). */
  onRefreshConfig?: () => void;
}) {
  const [data, setData] = useState<EggStockReconciliation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void apiFetch<EggStockReconciliation>('/v1/production/egg-stock-reconciliation')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar conciliação'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm text-slate-500">Carregando conciliação postura × estoque…</p>;
  }

  if (error && !data) {
    return <ErrorBox message={error} />;
  }

  if (!data) return null;

  if (!data.config.enabled) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
        Integração postura → estoque está <strong>desativada</strong>. Ative em{' '}
        <Link href="/estoque/movimentos?tab=postura" className="font-medium text-emerald-800 underline">
          Estoque → Integração postura
        </Link>
        .
      </div>
    );
  }

  const posturaEggsEquiv =
    data.posturaNet.cartons * data.config.eggsPerCarton +
    data.posturaNet.boxes * data.config.eggsPerCarton * data.config.cartonsPerBox;

  const rows: Row3[] = [
    {
      label: 'Saldo atual (produtos)',
      cartons: data.currentStock.looseCartons,
      boxes: data.currentStock.boxes,
      eggs: data.currentStock.equivalentEggs,
    },
    {
      label: 'Gerado pela postura (ledger)',
      cartons: data.ledger.looseCartons,
      boxes: data.ledger.boxes,
      eggs: data.ledger.equivalentEggs,
    },
    {
      label: 'Esperado pelos lançamentos de postura',
      cartons: data.fromProduction.looseCartons,
      boxes: data.fromProduction.boxes,
      eggs: data.fromProduction.equivalentEggs,
    },
    {
      label: 'Entradas líquidas postura (movimentos)',
      cartons: data.posturaNet.cartons,
      boxes: data.posturaNet.boxes,
      eggs: posturaEggsEquiv,
    },
    {
      label: 'Vendas e outros (líquido)',
      cartons: data.otherNet.cartons,
      boxes: data.otherNet.boxes,
      eggs: data.otherNet.equivalentEggs,
    },
  ];

  const summaryOk = data.checks.stockMatchesProductionTargets;
  const headline = summaryOk
    ? 'Saldo igual ao gerado pela postura (sem diferença de vendas/outros).'
    : data.checks.integrationHealthy && !data.checks.stockMatchesLedger
      ? 'Integração postura coerente; saldo difere por vendas ou outros movimentos.'
      : !data.checks.integrationHealthy
        ? 'Revise integração, ledger ou reprocessamento da postura.'
        : 'Saldo confere com movimentações.';

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white ${compact ? 'p-3' : 'p-4 sm:p-5'} space-y-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Postura × saldo × vendas</h3>
          <p className="mt-1 text-sm text-slate-600">{headline}</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => load()}>
          Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <CheckPill ok={data.checks.ledgerMatchesProduction} label="Postura × ledger" />
        <CheckPill ok={data.checks.posturaNetMatchesLedger} label="Mov. postura × ledger" />
        <CheckPill ok={data.checks.stockMatchesLedger} label="Saldo × ledger" />
        <CheckPill ok={data.checks.stockMatchesProductionTargets} label="Saldo × postura (sem vendas)" />
      </div>

      <MetricTable rows={rows} />

      <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="font-medium text-slate-800">Postura</p>
          <p>
            {data.production.rows} lançamento(s) · {fmtQty(data.production.eligibleCommercialEggs)} ovos comerciais
            elegíveis
            {data.config.eggSyncOnlyReviewed ? ' (só após conferência)' : ''}.
          </p>
          {data.production.unpackagedRemainderEggs > 0 ? (
            <p className="mt-1 text-xs">
              {fmtQty(data.production.unpackagedRemainderEggs)} ovos ficam fora de cartela/caixa (resto da divisão).
            </p>
          ) : null}
          {data.production.rowsMissingLedger > 0 ? (
            <p className="mt-1 text-amber-800">
              {data.production.rowsMissingLedger} registro(s) ainda sem ledger — use Reprocessar posturas.
            </p>
          ) : null}
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="font-medium text-slate-800">Produtos</p>
          <p>
            Cartela: {data.config.cartonProduct?.sku ?? '—'}
            <br />
            Caixa: {data.config.boxProduct?.sku ?? '—'}
          </p>
          <p className="mt-1 text-xs">
            {data.config.eggsPerCarton} ovos/cartela · {data.config.cartonsPerBox} cartelas/caixa
          </p>
        </div>
      </div>

      {data.otherMovesSample.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Movimentos fora da postura (amostra)
          </p>
          <ul className="space-y-1 text-sm">
            {data.otherMovesSample.map((m, i) => (
              <li key={`${m.at}-${i}`} className="flex flex-wrap gap-x-2 text-slate-700">
                <span className="text-slate-500">{new Date(m.at).toLocaleString('pt-BR')}</span>
                <span className="font-medium">{m.kind}</span>
                <span>{labelEnum(m.type)}</span>
                <span className="tabular-nums">{fmtQty(m.qty)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            <Link href="/estoque/movimentos" className="text-emerald-800 underline">
              Ver todas as movimentações
            </Link>
          </p>
        </div>
      ) : null}

      {!compact ? (
        <p className="text-xs text-slate-500">
          Saldo = entradas da postura + vendas, NF e ajustes manuais. O equivalente em ovos usa cartelas avulsas + caixas
          × cartelas/caixa, sem contagem dupla.
        </p>
      ) : null}

      {onRefreshConfig ? (
        <p className="text-xs text-slate-500">
          Após reprocessar posturas,{' '}
          <button type="button" className="text-emerald-800 underline" onClick={() => { load(); onRefreshConfig(); }}>
            atualize a conciliação
          </button>
          .
        </p>
      ) : null}
    </div>
  );
}
