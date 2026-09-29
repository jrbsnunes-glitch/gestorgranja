'use client';

import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Card } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { CompanyLogoImg } from '@/components/company-logo-img';
import { ClickableKpi } from '@/components/dashboard/kpi-card';
import { apiFetch } from '@/lib/api';
import { DASHBOARD_REFRESH_EVENT } from '@/lib/dashboard-refresh';
import { formatBrl, formatPct } from '@/lib/money';
import { readSession, sessionDisplayName } from '@/lib/session';

const POLL_MS = 60_000;

type HomeDashboard = {
  zootec?: {
    lots: number;
    liveBirds: number;
    layRatePct: number | null;
    awaitingReview: number;
    openOccurrences: number;
    criticalOccurrences: number;
  };
  finance?: {
    payables: { dueNext3: number; overdue: number };
    receivables: { dueToday: number; dueNext3: number; overdue: number };
    cashBase: number;
    openAlertsCount: number;
  };
  cash?: {
    open: number;
    pendingReconciliation: number;
    salesDay: { count: number; totalAmount: number };
    salesMonth: { count: number; totalAmount: number };
  };
  products?: {
    criticalCount: number;
    topOut30d: { productId: string; quantity: number; product: { sku: string; name: string } }[];
    eggInventory: { totalEggs: number; boxes: number; cartons: number } | null;
  };
};

function eggStockSub(inv: { boxes: number; cartons?: number }) {
  const boxes = inv.boxes.toLocaleString('pt-BR');
  const cartons = (inv.cartons ?? 0).toLocaleString('pt-BR');
  return `${boxes} caixa(s) · ${cartons} cartela(s)`;
}

function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">{children}</div>;
}

export default function DashboardPage() {
  const [data, setData] = useState<HomeDashboard | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    void apiFetch<HomeDashboard>('/v1/home/dashboard')
      .then((d) => {
        setData(d);
        setRefreshedAt(new Date());
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    void apiFetch<{ logoUrl: string | null }>('/v1/cadastros/company')
      .then((c) => setCompanyLogo(c.logoUrl))
      .catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const onRefresh = () => refresh();
    window.addEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
  }, [refresh]);

  const displayName = sessionDisplayName(readSession());
  const hasAnyBlock = Boolean(data?.zootec || data?.finance || data?.cash || data?.products);

  return (
    <AdminShell title="Painel">
      <PageIntro
        title="Painel — visão geral"
        description="Indicadores zootécnicos, financeiros, caixa e estoque em um só lugar. Clique nos quadros para abrir o módulo correspondente."
      />

      <div className="mb-3 flex flex-wrap items-center gap-4">
        <CompanyLogoImg logoRegistered={companyLogo} variant="shell" className="h-12 w-auto shrink-0" />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-slate-900">
            {displayName ? `Olá, ${displayName}` : 'Bem-vindo(a)'}
          </p>
          {refreshedAt ? (
            <p className="text-xs text-slate-500">
              Atualizado às {refreshedAt.toLocaleTimeString('pt-BR')}
              {loading ? ' · atualizando…' : null}
            </p>
          ) : loading ? (
            <p className="text-xs text-slate-500">Carregando indicadores…</p>
          ) : null}
        </div>
      </div>

      {data?.zootec ? (
        <Card title="Zootécnico" className="mb-4">
          <KpiGrid>
            <ClickableKpi href="/operacao" label="Lotes no escopo" value={String(data.zootec.lots)} />
            <ClickableKpi
              href="/operacao"
              label="Aves vivas"
              value={data.zootec.liveBirds.toLocaleString('pt-BR')}
            />
            <ClickableKpi href="/operacao" label="Postura média (30d)" value={formatPct(data.zootec.layRatePct)} tone="good" />
            <ClickableKpi
              href="/operacao/pendencias"
              label="Registros a conferir"
              value={String(data.zootec.awaitingReview)}
              tone={data.zootec.awaitingReview > 0 ? 'warn' : 'good'}
            />
            <ClickableKpi
              href="/operacao/ocorrencias"
              label="Ocorrências abertas"
              value={String(data.zootec.openOccurrences)}
              sub={
                data.zootec.criticalOccurrences > 0
                  ? `${data.zootec.criticalOccurrences} crítica(s)/alta`
                  : undefined
              }
              tone={data.zootec.criticalOccurrences > 0 ? 'bad' : data.zootec.openOccurrences ? 'warn' : 'good'}
            />
          </KpiGrid>
          <Link href="/operacao" className="mt-3 inline-block text-sm font-medium text-emerald-800 hover:underline">
            Ver painel zootécnico completo →
          </Link>
        </Card>
      ) : null}

      {data?.finance || data?.cash ? (
        <Card title="Financeiro e caixa" className="mb-4">
          <KpiGrid>
            {data.finance ? (
              <>
                <ClickableKpi
                  href="/financeiro/pagar?dueDays=3"
                  label="Contas a pagar (3 dias)"
                  value={formatBrl(data.finance.payables.dueNext3)}
                  tone={data.finance.payables.dueNext3 > 0 ? 'warn' : 'default'}
                />
                <ClickableKpi
                  href="/financeiro/pagar?overdue=1"
                  label="Contas a pagar vencidas"
                  value={formatBrl(data.finance.payables.overdue)}
                  tone={data.finance.payables.overdue > 0 ? 'bad' : 'default'}
                />
                <ClickableKpi
                  href="/financeiro/receber?dueDays=0"
                  label="Contas a receber vencendo hoje"
                  value={formatBrl(data.finance.receivables.dueToday ?? 0)}
                  tone={(data.finance.receivables.dueToday ?? 0) > 0 ? 'good' : 'default'}
                />
                <ClickableKpi
                  href="/financeiro/receber?overdue=1"
                  label="Contas a receber vencidas"
                  value={formatBrl(data.finance.receivables.overdue)}
                  tone={data.finance.receivables.overdue > 0 ? 'bad' : 'default'}
                />
                <ClickableKpi href="/financeiro/bancos" label="Saldo bancos (base)" value={formatBrl(data.finance.cashBase)} />
                <ClickableKpi
                  href="/alertas"
                  label="Alertas financeiros"
                  value={String(data.finance.openAlertsCount)}
                  tone={data.finance.openAlertsCount > 0 ? 'warn' : 'default'}
                />
              </>
            ) : null}
            {data.cash ? (
              <>
                <ClickableKpi
                  href="/vendas/caixa"
                  label="Caixas abertos"
                  value={String(data.cash.open)}
                  tone={data.cash.open > 0 ? 'good' : 'default'}
                />
                <ClickableKpi
                  href="/vendas/caixa?status=PENDING_RECONCILIATION"
                  label="Pendente de conferência"
                  value={String(data.cash.pendingReconciliation)}
                  tone={data.cash.pendingReconciliation > 0 ? 'warn' : 'default'}
                />
                <ClickableKpi
                  href="/vendas"
                  label="Vendas hoje"
                  value={formatBrl(data.cash.salesDay.totalAmount)}
                  sub={`${data.cash.salesDay.count} pedido(s)`}
                  tone={data.cash.salesDay.count > 0 ? 'good' : 'default'}
                />
                <ClickableKpi
                  href="/vendas"
                  label="Vendas no mês"
                  value={formatBrl(data.cash.salesMonth.totalAmount)}
                  sub={`${data.cash.salesMonth.count} pedido(s)`}
                  tone={data.cash.salesMonth.count > 0 ? 'good' : 'default'}
                />
              </>
            ) : null}
          </KpiGrid>
          <Link href="/financeiro/visao" className="mt-3 inline-block text-sm font-medium text-emerald-800 hover:underline">
            Visão financeira →
          </Link>
        </Card>
      ) : null}

      {data?.products ? (
        <Card title="Produtos e estoque" className="mb-4">
          <KpiGrid>
            <ClickableKpi
              href="/estoque"
              label="Estoque crítico"
              value={String(data.products.criticalCount)}
              tone={data.products.criticalCount > 0 ? 'bad' : 'good'}
            />
            {data.products.eggInventory ? (
              <ClickableKpi
                href="/estoque"
                label="Ovos em estoque"
                value={data.products.eggInventory.totalEggs.toLocaleString('pt-BR')}
                sub={eggStockSub(data.products.eggInventory)}
              />
            ) : null}
            {data.products.topOut30d.map((row) => (
              <ClickableKpi
                key={row.productId}
                href="/estoque/movimentos"
                label={`Saídas 30d — ${row.product.sku}`}
                value={row.quantity.toLocaleString('pt-BR')}
                sub={row.product.name}
              />
            ))}
            <ClickableKpi href="/produtos" label="Cadastro de produtos" value="Abrir" sub="Consultar saldos e preços" />
          </KpiGrid>
          <Link href="/estoque" className="mt-3 inline-block text-sm font-medium text-emerald-800 hover:underline">
            Painel de estoque →
          </Link>
        </Card>
      ) : null}

      {!hasAnyBlock && !loading ? (
        <p className="mt-4 text-center text-sm text-slate-500">
          Nenhum bloco disponível para o seu perfil ou ainda carregando…
        </p>
      ) : null}
    </AdminShell>
  );
}
