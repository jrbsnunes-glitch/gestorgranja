'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@gestor-granja/ui';
import { CompanyLogoImg } from '@/components/company-logo-img';
import { apiFetch } from '@/lib/api';
import { formatBrl } from '@/lib/money';
import { closeReportPrintView } from '@/lib/report-print-nav';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';
import './sale-receipt-print.css';

type ReceiptPayload = {
  sale: {
    id: string;
    controlNumber: number;
    status: string;
    orderDate: string;
    totalAmount: number;
    subtotal: number;
    discount: number;
    paymentLabel: string;
    partnerName: string;
    items: {
      sku: string;
      name: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      lineTotal: number;
    }[];
  };
  company: {
    legalName: string;
    tradeName: string | null;
    cnpj: string;
    stateReg: string | null;
    address: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    logoUrl: string | null;
  } | null;
};

function fmtCnpj(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 14);
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function PrintBody() {
  const sp = useSearchParams();
  const id = sp.get('id') ?? '';
  const autoprint = sp.get('autoprint') === '1';
  const rootRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ReceiptPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Informe ?id= da venda.');
      return;
    }
    void apiFetch<ReceiptPayload>(`/v1/commercial/orders/${encodeURIComponent(id)}/receipt`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'));
  }, [id]);

  useReportAutoPrint(autoprint && !!data && !error, rootRef);

  useEffect(() => {
    if (!autoprint) return;
    const onAfterPrint = () => closeReportPrintView();
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [autoprint]);

  const c = data?.company;
  const s = data?.sale;

  return (
    <div ref={rootRef} className="sale-receipt-page">
      <div className="sale-receipt-toolbar no-print">
        <div className="sale-receipt-toolbar-actions">
          <Button type="button" onClick={() => window.print()}>
            Imprimir (Ctrl+P)
          </Button>
          <Button type="button" variant="secondary" onClick={closeReportPrintView}>
            Voltar às vendas
          </Button>
        </div>
        <span className="text-sm text-slate-600">Cupom não fiscal — bobina 80 mm</span>
      </div>

      {error ? (
        <div className="sale-receipt-doc">
          <p>{error}</p>
        </div>
      ) : null}
      {!error && !s ? (
        <div className="sale-receipt-doc">
          <p>Carregando…</p>
        </div>
      ) : null}

      {s && c ? (
        <article className="sale-receipt-doc">
          <header className="sale-receipt-center">
            <CompanyLogoImg logoRegistered={c.logoUrl} variant="shell" className="mx-auto mb-2 max-h-16" />
            <p className="sale-receipt-title">{c.tradeName || c.legalName}</p>
            {c.cnpj ? <p className="sale-receipt-sub">CNPJ {fmtCnpj(c.cnpj)}</p> : null}
            {c.address ? <p className="sale-receipt-sub">{c.address}</p> : null}
            {c.city || c.state ? (
              <p className="sale-receipt-sub">
                {[c.city, c.state].filter(Boolean).join(' / ')}
                {c.zipCode ? ` · CEP ${c.zipCode}` : ''}
              </p>
            ) : null}
          </header>
          <div className="sale-receipt-divider" />
          <p className="sale-receipt-center sale-receipt-sub">COMPROVANTE DE VENDA (NÃO FISCAL)</p>
          <p className="sale-receipt-sub">Venda nº {s.controlNumber}</p>
          <p className="sale-receipt-sub">
            {new Date(s.orderDate).toLocaleString('pt-BR')} · Cliente: {s.partnerName}
          </p>
          <div className="sale-receipt-divider" />
          {s.items.map((it, i) => (
            <div key={i} className="sale-receipt-item">
              <p>{it.name}</p>
              <p className="sale-receipt-sub">
                {it.sku} · {it.quantity} {it.unit} × {formatBrl(it.unitPrice)}
              </p>
              <div className="sale-receipt-row">
                <span>Total linha</span>
                <span>{formatBrl(it.lineTotal)}</span>
              </div>
            </div>
          ))}
          <div className="sale-receipt-divider" />
          {s.discount > 0.005 ? (
            <div className="sale-receipt-row">
              <span>Descontos</span>
              <span>− {formatBrl(s.discount)}</span>
            </div>
          ) : null}
          <div className="sale-receipt-row">
            <span>TOTAL</span>
            <span>{formatBrl(s.totalAmount)}</span>
          </div>
          <div className="sale-receipt-row sale-receipt-payment">
            <span>Pagamento</span>
            <span className="text-right">{s.paymentLabel}</span>
          </div>
          <div className="sale-receipt-divider" />
          <p className="sale-receipt-center sale-receipt-sub">Obrigado pela preferência!</p>
        </article>
      ) : null}
    </div>
  );
}

export default function VendaImpressaoPage() {
  return (
    <Suspense
      fallback={
        <div className="sale-receipt-page">
          <p>Carregando…</p>
        </div>
      }
    >
      <PrintBody />
    </Suspense>
  );
}
