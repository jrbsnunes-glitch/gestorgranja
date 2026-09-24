'use client';

import '@/styles/cash-report-corporate.css';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@gestor-granja/ui';
import {
  CorporateCashReportHeader,
  type ReportCompanyBranding,
} from '@/components/corporate-cash-report-header';
import { apiFetch } from '@/lib/api';
import { ReportPrintActions } from '@/components/report-print-actions';
import { splitMovementsBySection, type CashReportMovement } from '@/lib/cash-report-sections';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';
import { labelEnum } from '@/lib/labels';
import {
  buildCashReportApiPath,
  type CashReportFilters,
} from '@/lib/cash-report-query';

type SessionBlock = {
  controlNumber: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
  operatorName: string;
  operatorUsername: string;
  openingBalance: number;
  closingBalance: number | null;
  closingNotes: string | null;
  inflow: number;
  outflow: number;
  expenses: number;
  computedBalance: number;
  movements: CashReportMovement[];
};

type ControlePayload = {
  variant: 'controle';
  controlRange: { min: number; max: number };
  sessions: SessionBlock[];
  company: ReportCompanyBranding;
};

type PeriodPayload = {
  variant: 'periodo' | 'dia';
  period: { from: string; to: string };
  totals: {
    inflow: number;
    outflow: number;
    net: number;
    movementCount: number;
    sessionCount: number;
  };
  sessions: SessionBlock[];
  movements: CashReportMovement[];
  company: ReportCompanyBranding;
};

type Payload = ControlePayload | PeriodPayload;

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function parseFilters(sp: URLSearchParams): CashReportFilters | null {
  const variant = sp.get('variant');
  if (variant !== 'controle' && variant !== 'periodo' && variant !== 'dia') return null;
  return {
    variant,
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    date: sp.get('date') ?? '',
    controlMin: sp.get('controlMin') ?? '',
    controlMax: sp.get('controlMax') ?? '',
  };
}

function CorpSectionTable({
  index,
  title,
  rows,
  total,
}: {
  index: number;
  title: string;
  rows: CashReportMovement[];
  total: number;
}) {
  return (
    <section className="corp-section">
      <h3 className="corp-section-title">
        {index}. {title}
      </h3>
      <table className="corp-table">
        <thead>
          <tr>
            <th style={{ width: '18%' }}>Data / hora</th>
            <th style={{ width: '14%' }} className="num">
              Valor (R$)
            </th>
            <th style={{ width: '16%' }}>Forma pgt.</th>
            <th>Histórico / complemento</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="empty">
                Sem movimentação nesta classificação.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDt(r.createdAt)}</td>
                <td className="num">{fmt(r.amount)}</td>
                <td>{r.paymentMethod ? labelEnum(r.paymentMethod) : '—'}</td>
                <td>{r.reason ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ textAlign: 'right', fontWeight: 600 }}>Subtotal</td>
            <td className="num">{fmt(total)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function SessionReport({ session }: { session: SessionBlock }) {
  const split = splitMovementsBySection(session.movements);
  const diff =
    session.closingBalance != null
      ? Math.round((session.computedBalance - session.closingBalance) * 100) / 100
      : null;

  return (
    <article className="corp-session">
      <div className="corp-session-head">
        <h2>Sessão de caixa · controle {String(session.controlNumber).padStart(4, '0')}</h2>
        <span>{labelEnum(session.status)}</span>
      </div>

      <div className="corp-info-grid">
        <div className="corp-info-cell">
          <span className="corp-info-label">Operador</span>
          {session.operatorName} ({session.operatorUsername})
        </div>
        <div className="corp-info-cell">
          <span className="corp-info-label">Saldo inicial</span>
          {fmt(session.openingBalance)}
        </div>
        <div className="corp-info-cell">
          <span className="corp-info-label">Abertura</span>
          {fmtDt(session.openedAt)}
        </div>
        <div className="corp-info-cell">
          <span className="corp-info-label">Fechamento</span>
          {session.closedAt ? fmtDt(session.closedAt) : 'Sessão em aberto'}
        </div>
      </div>

      {session.closingNotes ? (
        <p className="corp-footnote" style={{ marginBottom: '0.75rem' }}>
          Observações do fechamento: {session.closingNotes}
        </p>
      ) : null}

      <CorpSectionTable index={1} title="Vendas" rows={split.sales} total={split.totalSales} />
      <CorpSectionTable
        index={2}
        title="Contas recebidas no caixa"
        rows={split.receivablesAtCash}
        total={split.totalReceivablesAtCash}
      />
      <CorpSectionTable index={3} title="Despesas e saídas" rows={split.expenses} total={split.totalExpenses} />

      <div className="corp-reconcile">
        <p className="corp-reconcile-title">4. Conferência — total do caixa × total apresentado</p>
        <table className="corp-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th className="num">Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total calculado (saldo inicial + entradas − saídas, incluindo despesas)</td>
              <td className="num">{fmt(session.computedBalance)}</td>
            </tr>
            <tr>
              <td>Total apresentado pelo operador no fechamento</td>
              <td className="num">
                {session.closingBalance != null ? fmt(session.closingBalance) : '—'}
              </td>
            </tr>
            <tr>
              <td>Diferença (calculado − apresentado)</td>
              <td className="num">{diff != null ? fmt(diff) : '—'}</td>
            </tr>
          </tbody>
        </table>
        <p className="corp-footnote" style={{ padding: '0.35rem 0.55rem' }}>
          Movimentação: entradas {fmt(session.inflow)} · saídas {fmt(session.outflow)}
          {session.expenses > 0 ? <> · despesas {fmt(session.expenses)}</> : null} · dinheiro esperado{' '}
          {fmt(session.computedBalance)}
        </p>
      </div>

    </article>
  );
}

function PrintBody() {
  const sp = useSearchParams();
  const title = sp.get('title') ?? 'Relatório de caixa';
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [brandingFetch, setBrandingFetch] = useState<ReportCompanyBranding | null>(null);
  const [headerReady, setHeaderReady] = useState(false);
  const printRootRef = useRef<HTMLDivElement>(null);
  const markHeaderReady = useCallback(() => setHeaderReady(true), []);

  useEffect(() => {
    void apiFetch<ReportCompanyBranding>('/v1/cadastros/company/branding')
      .then(setBrandingFetch)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!filters) {
      setError('Parâmetros inválidos. Gere o relatório a partir do módulo Caixa.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setHeaderReady(false);
    setError(null);
    void apiFetch<Payload>(buildCashReportApiPath(filters))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [filters]);

  const headerBranding = useMemo((): ReportCompanyBranding | null => {
    const fromReport = data?.company;
    const fromApi = brandingFetch;
    if (!fromReport && !fromApi) return null;
    return {
      legalName: fromReport?.legalName ?? fromApi?.legalName ?? 'GestorGranja',
      tradeName: fromReport?.tradeName ?? fromApi?.tradeName ?? null,
      cnpj: fromReport?.cnpj ?? fromApi?.cnpj ?? null,
      logoUrl: fromReport?.logoUrl ?? fromApi?.logoUrl ?? null,
      logoDataUrl: fromReport?.logoDataUrl ?? fromApi?.logoDataUrl ?? null,
    };
  }, [data?.company, brandingFetch]);

  useEffect(() => {
    setHeaderReady(false);
  }, [headerBranding?.logoDataUrl]);

  useReportAutoPrint(!loading && !error && data != null && headerReady, printRootRef);

  const subtitle = useMemo(() => {
    if (!data) return null;
    if (data.variant === 'controle') {
      const { min, max } = data.controlRange;
      return (
        <p>
          Filtro por controle {min === max ? min : `${min} a ${max}`} · {data.sessions.length}{' '}
          sessão(ões)
        </p>
      );
    }
    const p =
      data.period.from === data.period.to
        ? fmtDateShort(data.period.from + 'T12:00:00')
        : `${fmtDateShort(data.period.from + 'T12:00:00')} a ${fmtDateShort(data.period.to + 'T12:00:00')}`;
    return (
      <p>
        Período de apuração: {p} · {data.totals.movementCount} lançamento(s) · {data.totals.sessionCount}{' '}
        sessão(ões)
      </p>
    );
  }, [data]);

  const reportRef = useMemo(() => {
    if (!data) return undefined;
    if (data.variant === 'controle') {
      const { min, max } = data.controlRange;
      return `CX-CTRL-${min}${max !== min ? `-${max}` : ''}`;
    }
    return `CX-${data.period.from}${data.period.to !== data.period.from ? `-${data.period.to}` : ''}`;
  }, [data]);

  const sessions = data?.sessions ?? [];

  return (
    <div ref={printRootRef} className="cash-corp report-print-surface bg-white py-6 print:py-0">
      <div className="corp-sheet px-6 print:px-0">
        <ReportPrintActions />

        {headerBranding ? (
          <CorporateCashReportHeader
            documentTitle={title}
            subtitle={subtitle}
            reportRef={reportRef}
            branding={headerBranding}
            onBrandingReady={markHeaderReady}
          />
        ) : null}

        {loading ? <p className="text-sm text-slate-600">Carregando dados…</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {data && !loading && !error ? (
          <>
            {data.variant !== 'controle' ? (
              <div className="corp-kpi-row">
                <div className="corp-kpi">
                  <div className="corp-kpi-label">Entradas</div>
                  <div className="corp-kpi-value">{fmt(data.totals.inflow)}</div>
                </div>
                <div className="corp-kpi">
                  <div className="corp-kpi-label">Saídas</div>
                  <div className="corp-kpi-value">{fmt(data.totals.outflow)}</div>
                </div>
                <div className="corp-kpi">
                  <div className="corp-kpi-label">Líquido</div>
                  <div className="corp-kpi-value">{fmt(data.totals.net)}</div>
                </div>
                <div className="corp-kpi">
                  <div className="corp-kpi-label">Sessões</div>
                  <div className="corp-kpi-value">{data.totals.sessionCount}</div>
                </div>
              </div>
            ) : null}

            {sessions.length === 0 ? (
              <p className="corp-footnote">Nenhuma sessão com movimentação no filtro informado.</p>
            ) : (
              sessions.map((s) => <SessionReport key={s.controlNumber} session={s} />)
            )}

            <footer className="corp-footer">
              Documento gerado eletronicamente · GestorGranja · Uso interno e conferência de caixa
            </footer>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function CaixaImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
