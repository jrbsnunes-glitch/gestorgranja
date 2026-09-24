'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import {
  FormCadastroModal,
  ModuleReportsModal,
  PageIntro,
  RecordViewModal,
  useCrudList,
} from '@/components/crud';
import { ListToolbar, PaginatedTable, RowActions, usePagination } from '@/components/list-crud';
import { ResponsiveTableWrap } from '@/components/responsive-table-wrap';
import { ErrorBox, Field, PageCard, inputClass } from '@/components/ui-parts';
import { SalesOrdersReportLauncher } from '@/components/sales-orders-report-launcher';
import { apiFetch } from '@/lib/api';
import { formatRecordControl } from '@/lib/record-control';
import { labelEnum } from '@/lib/labels';
import { openSalesOrderEspelhoPrint } from '@/lib/sales-orders-report-query';

type Partner = { id: string; name: string };
type Product = { id: string; sku: string; name: string };
type Order = {
  id: string;
  controlNumber: number;
  status: string;
  orderDate: string;
  totalAmount: string;
  paymentMethod: string | null;
  partner: { name: string };
  items: { quantity: string; unitPrice: string; product: { name: string } | null }[];
};

type CashSessionRow = {
  id: string;
  controlNumber: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: string;
  user: { name: string; username: string };
};

type MyOpenCash = {
  id: string;
  controlNumber: number;
  openingBalance: string;
  openedAt: string;
  status: string;
};

function todayLocalKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Datas de negócio (@db.Date) vêm em UTC meia-noite; considera também o dia civil local. */
function isOpenedToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const today = todayLocalKey();
  const localDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const utcDay = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return localDay === today || utcDay === today;
}

function buildDayCashSessions(cashSessions: CashSessionRow[], myOpenCash: MyOpenCash | null): CashSessionRow[] {
  const byId = new Map<string, CashSessionRow>();
  for (const s of cashSessions) {
    if (isOpenedToday(s.openedAt)) byId.set(s.id, s);
  }
  for (const s of cashSessions) {
    if (s.status === 'OPEN') byId.set(s.id, s);
  }
  if (myOpenCash && !byId.has(myOpenCash.id)) {
    const fromList = cashSessions.find((s) => s.id === myOpenCash.id);
    byId.set(
      myOpenCash.id,
      fromList ?? {
        id: myOpenCash.id,
        controlNumber: myOpenCash.controlNumber,
        status: myOpenCash.status,
        openedAt: myOpenCash.openedAt,
        closedAt: null,
        openingBalance: myOpenCash.openingBalance,
        user: { name: 'Você', username: '—' },
      },
    );
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
  );
}

export default function VendasPage() {
  const [rows, setRows] = useState<Order[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSessionRow[]>([]);
  const [myOpenCash, setMyOpenCash] = useState<MyOpenCash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmAfterCreate, setConfirmAfterCreate] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reportSeedOrderId, setReportSeedOrderId] = useState<string | undefined>();
  const [selected, setSelected] = useState<Order | null>(null);

  const list = useCrudList({
    items: rows,
    searchFields: (o) => [o.partner.name, o.status, o.paymentMethod],
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const dayCashSessions = useMemo(
    () => buildDayCashSessions(cashSessions, myOpenCash),
    [cashSessions, myOpenCash],
  );

  const myOpenRowToday = myOpenCash != null && myOpenCash.status === 'OPEN';

  const load = useCallback(() => {
    void apiFetch<Order[]>('/v1/commercial/orders').then(setRows);
    void apiFetch<CashSessionRow[]>('/v1/cash/sessions').then(setCashSessions);
    void apiFetch<MyOpenCash | null>('/v1/cash/sessions/open/me').then(setMyOpenCash);
  }, []);

  useEffect(() => {
    load();
    void apiFetch<Partner[]>('/v1/cadastros/partners').then(setPartners);
    void apiFetch<Product[]>('/v1/inventory/products').then(setProducts);
  }, [load]);

  function openSaleForm(fromOpenCash: boolean) {
    setError(null);
    setConfirmAfterCreate(fromOpenCash);
    setFormOpen(true);
  }

  function onCashRowClick(session: CashSessionRow) {
    if (session.status !== 'OPEN') return;
    if (!myOpenCash || session.id !== myOpenCash.id) {
      setError('Somente o seu caixa aberto pode receber novas vendas. Abra ou retome a sessão em Financeiro → Caixa.');
      return;
    }
    openSaleForm(true);
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const created = await apiFetch<{ id: string }>('/v1/commercial/orders', {
        method: 'POST',
        body: JSON.stringify({
          partnerId: fd.get('partnerId'),
          paymentMethod: fd.get('paymentMethod') || undefined,
          items: [
            {
              productId: fd.get('productId'),
              quantity: Number(fd.get('quantity')),
              unitPrice: Number(fd.get('unitPrice')),
              discount: fd.get('discount') ? Number(fd.get('discount')) : 0,
            },
          ],
        }),
      });
      if (confirmAfterCreate) {
        await apiFetch(`/v1/commercial/orders/${created.id}/confirm`, { method: 'POST', body: '{}' });
      }
      setFormOpen(false);
      setConfirmAfterCreate(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function confirm(id: string) {
    setError(null);
    try {
      await apiFetch(`/v1/commercial/orders/${id}/confirm`, { method: 'POST', body: '{}' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao confirmar');
    }
  }

  return (
    <AdminShell title="Vendas">
      <PageIntro
        title="Vendas"
        description="Registre vendas pelo caixa aberto do dia; pedidos confirmados lançam entrada no caixa."
      />
      <ErrorBox message={error} />

      <PageCard title="Caixa do dia">
        <p className="mb-4 text-sm text-slate-600">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>

        {myOpenRowToday ? (
          <p className="mb-3 text-sm text-emerald-800">
            Seu caixa está aberto (controle {myOpenCash!.controlNumber}). Clique na linha abaixo para{' '}
            <strong>incluir uma venda</strong>.
          </p>
        ) : (
          <p className="mb-3 text-sm text-slate-600">
            Para vender, abra o caixa em{' '}
            <Link href="/financeiro/caixa" className="font-medium text-emerald-800 underline">
              Financeiro → Caixa
            </Link>
            .
          </p>
        )}

        <ResponsiveTableWrap>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2">Controle</th>
                <th className="px-3 py-2">Operador</th>
                <th className="px-3 py-2">Abertura</th>
                <th className="px-3 py-2">Saldo inicial</th>
                <th className="px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {dayCashSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Nenhuma sessão de caixa registrada hoje.
                  </td>
                </tr>
              ) : (
                dayCashSessions.map((s) => {
                  const isOpen = s.status === 'OPEN';
                  const isMyOpen = myOpenCash?.id === s.id;
                  const clickable = isOpen && isMyOpen;
                  const rowSituation = isOpen ? 'Aberto' : 'Fechado';
                  return (
                    <tr
                      key={s.id}
                      onClick={() => (clickable ? onCashRowClick(s) : undefined)}
                      className={`border-b border-slate-100 last:border-0 ${
                        clickable
                          ? 'cursor-pointer bg-emerald-50/60 hover:bg-emerald-50'
                          : isOpen
                            ? 'bg-white'
                            : 'bg-slate-50/50 text-slate-700'
                      }`}
                      title={
                        clickable
                          ? 'Clique para incluir venda neste caixa'
                          : isOpen
                            ? 'Caixa de outro operador'
                            : undefined
                      }
                    >
                      <td className="px-3 py-2.5 tabular-nums">{formatRecordControl(s.controlNumber)}</td>
                      <td className="px-3 py-2.5">
                        {s.user.name}
                        <span className="text-slate-500"> ({s.user.username})</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {new Date(s.openedAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">R$ {Number(s.openingBalance).toFixed(2)}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            isOpen
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {rowSituation}
                        </span>
                        {clickable ? (
                          <span className="ml-2 text-xs text-emerald-700">· clique para vender</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </ResponsiveTableWrap>
      </PageCard>

      <PageCard title="Pedidos comerciais">
        <ListToolbar list={list} onReports={() => {
            setReportSeedOrderId(selected?.id);
            setReportsOpen(true);
          }}
          searchPlaceholder="Cliente, status, pagamento…"
        />
        <PaginatedTable
          headers={['Data', 'Cliente', 'Total', 'Pagamento', 'Status', 'Ações']}
          recordItems={slice}
          rows={slice.map((o) => [
            new Date(o.orderDate).toLocaleDateString('pt-BR'),
            o.partner.name,
            `R$ ${Number(o.totalAmount).toFixed(2)}`,
            labelEnum(o.paymentMethod),
            labelEnum(o.status),
            <span key={o.id} className="flex flex-wrap gap-1">
              <RowActions
                onView={() => {
                  setSelected(o);
                  setViewOpen(true);
                }}
              />
              {o.status === 'DRAFT' ? (
                <Button type="button" className="px-2 py-1 text-xs" onClick={() => void confirm(o.id)}>
                  Confirmar
                </Button>
              ) : null}
            </span>,
          ])}
          page={page}
          totalPages={totalPages}
          total={total}
          onPage={setPage}
        />
      </PageCard>

      <FormCadastroModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setConfirmAfterCreate(false);
        }}
        title={
          myOpenCash && confirmAfterCreate
            ? `Nova venda — caixa ${formatRecordControl(myOpenCash.controlNumber)}`
            : 'Nova venda'
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFormOpen(false);
                setConfirmAfterCreate(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" form="order-form">
              {confirmAfterCreate ? 'Registrar e confirmar venda' : 'Criar pedido'}
            </Button>
          </>
        }
      >
        <form id="order-form" onSubmit={create}>
          <Field label="Cliente">
            <select name="partnerId" className={inputClass} required>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Forma de pagamento">
            <select name="paymentMethod" className={inputClass} defaultValue="CASH">
              <option value="CASH">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="CARD">Cartão</option>
              <option value="TRANSFER">Transferência</option>
            </select>
          </Field>
          <Field label="Produto">
            <select name="productId" className={inputClass} required>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantidade">
            <input name="quantity" type="number" min={0} step="0.001" className={inputClass} required />
          </Field>
          <Field label="Preço unitário">
            <input name="unitPrice" type="number" min={0} step="0.01" className={inputClass} required />
          </Field>
          <Field label="Desconto">
            <input name="discount" type="number" min={0} step="0.01" className={inputClass} defaultValue={0} />
          </Field>
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar pedido"
        wide
        sections={
          selected
            ? [
                {
                  title: 'Pedido',
                  fields: [
                    { label: 'Controle', value: selected.controlNumber },
                    { label: 'Cliente', value: selected.partner.name },
                    { label: 'Status', value: labelEnum(selected.status) },
                    { label: 'Pagamento', value: labelEnum(selected.paymentMethod) },
                    { label: 'Total', value: `R$ ${Number(selected.totalAmount).toFixed(2)}` },
                    { label: 'Itens', value: selected.items.length },
                  ],
                },
              ]
            : []
        }
      >
        {selected ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => openSalesOrderEspelhoPrint(selected.id, '/vendas')}
            >
              Espelho da venda
            </Button>
            {selected.status === 'DRAFT' ? (
              <Button type="button" onClick={() => void confirm(selected.id)}>
                Confirmar venda (requer caixa aberto)
              </Button>
            ) : null}
          </div>
        ) : null}
      </RecordViewModal>

      <ModuleReportsModal
        open={reportsOpen}
        title="Vendas"
        onClose={() => {
          setReportsOpen(false);
          setReportSeedOrderId(undefined);
        }}
        compactLauncher
        wide
      >
        <SalesOrdersReportLauncher returnHref="/vendas" initialSalesOrderId={reportSeedOrderId} />
      </ModuleReportsModal>
    </AdminShell>
  );
}
