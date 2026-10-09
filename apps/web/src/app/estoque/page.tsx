'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { ClickableKpi, DashboardColumn, Kpi } from '@/components/dashboard/kpi-card';
import { EggStockReconciliationPanel } from '@/components/inventory/egg-stock-reconciliation-panel';
import { ErrorBox } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { errorMessage } from '@/lib/labels';
import { formatBrl } from '@/lib/money';

type InventoryDashboard = {
  criticalCount: number;
  criticalValue: number;
  criticalProducts: { id: string; sku: string; name: string; stockQty: number; minStockQty: number }[];
  topOut7d: { productId: string; quantity: number; product: { sku: string; name: string } }[];
  topOut30d: { productId: string; quantity: number; product: { sku: string; name: string } }[];
  purchaseRequestsOpen: number;
  stockReceiptsLast30d: number;
  productCount: number;
};

type EggInventory = {
  boxes: number;
  cartons: number;
  totalEggs: number;
};

export default function EstoqueDashboardPage() {
  const [data, setData] = useState<InventoryDashboard | null>(null);
  const [eggs, setEggs] = useState<EggInventory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void apiFetch<InventoryDashboard>('/v1/inventory/dashboard')
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
    void apiFetch<EggInventory>('/v1/reports/egg-inventory')
      .then(setEggs)
      .catch(() => setEggs(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chartData =
    data?.topOut30d.map((r) => ({
      name: r.product.sku,
      qty: r.quantity,
    })) ?? [];

  return (
    <AdminShell title="Estoque">
      <PageIntro
        title="Visão geral do estoque"
        description="Indicadores de saldo, saídas e compras — clique nos quadros para ir ao detalhe."
      />
      <ErrorBox message={error} />

      {data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <DashboardColumn title="Situação" footerHref="/estoque/movimentos" footerLabel="Movimentações">
              <ClickableKpi
                href="/estoque/movimentos"
                label="Produtos cadastrados"
                value={String(data.productCount)}
              />
              <ClickableKpi
                href="/estoque/movimentos"
                label="Estoque crítico"
                value={String(data.criticalCount)}
                tone={data.criticalCount > 0 ? 'bad' : 'good'}
                sub={
                  data.criticalValue > 0
                    ? `Valor estimado: ${formatBrl(data.criticalValue)}`
                    : undefined
                }
              />
              {eggs ? (
                <ClickableKpi
                  href="/estoque/movimentos"
                  label="Ovos (integração postura)"
                  value={eggs.totalEggs.toLocaleString('pt-BR')}
                  sub={`${eggs.boxes.toLocaleString('pt-BR')} caixa(s) · ${eggs.cartons.toLocaleString('pt-BR')} cartela(s)`}
                />
              ) : null}
              <ClickableKpi
                href="/compras"
                label="Pedidos em cotação/rascunho"
                value={String(data.purchaseRequestsOpen)}
              />
              <ClickableKpi
                href="/estoque/entradas"
                label="Entradas NF (30 dias)"
                value={String(data.stockReceiptsLast30d)}
              />
            </DashboardColumn>

            <DashboardColumn title="Top saídas (7 dias)">
              {data.topOut7d.length === 0 ? (
                <Kpi label="—" value="Sem saídas no período" />
              ) : (
                data.topOut7d.map((r) => (
                  <ClickableKpi
                    key={r.productId}
                    href="/estoque/movimentos"
                    label={r.product.sku}
                    value={r.quantity.toLocaleString('pt-BR')}
                    sub={r.product.name}
                  />
                ))
              )}
            </DashboardColumn>
          </div>

          <div className="mt-6">
            <EggStockReconciliationPanel compact />
          </div>

          {chartData.length > 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Saídas — top 5 (30 dias)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="qty" fill="#047857" name="Quantidade" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          {data.criticalProducts.length > 0 ? (
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                    <th className="px-3 py-2 text-right">Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.criticalProducts.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{p.sku}</td>
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.stockQty}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.minStockQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </AdminShell>
  );
}
