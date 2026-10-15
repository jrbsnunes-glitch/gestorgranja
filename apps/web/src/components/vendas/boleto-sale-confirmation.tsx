'use client';

import { useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { CompanyLogoImg } from '@/components/company-logo-img';
import { apiFetch, downloadAuthFile } from '@/lib/api';
import {
  type BankBoletoDto,
  boletoBarcodeDigits,
  formatBoletoLinhaDigitavel,
} from '@/lib/boleto';
import { formatCalendarDatePtBR, prismaDateDayKey } from '@/lib/calendar-date';
import { formatBrl } from '@/lib/money';
import { navigateToReportPrint } from '@/lib/report-print-nav';

function BoletoBarcode({ digits }: { digits: string }) {
  if (!digits) return null;
  return (
    <div
      className="flex h-14 w-full max-w-md items-stretch justify-center gap-px overflow-hidden rounded border border-slate-200 bg-white px-1 py-1"
      aria-hidden
    >
      {digits.split('').map((ch, i) => {
        const n = Number(ch);
        const w = Number.isFinite(n) ? (n % 3) + 1 : 2;
        return <span key={`${i}-${ch}`} className="shrink-0 bg-slate-900" style={{ width: w }} />;
      })}
    </div>
  );
}

function saleDateLabel(iso?: string) {
  if (!iso) {
    return new Date().toLocaleDateString('pt-BR');
  }
  const key = iso.includes('T') ? prismaDateDayKey(iso) : iso.slice(0, 10);
  return formatCalendarDatePtBR(key);
}

function dueDateLabel(iso: string) {
  const key = iso.includes('T') ? prismaDateDayKey(iso) : iso.slice(0, 10);
  return formatCalendarDatePtBR(key);
}

export function BoletoSaleConfirmation({
  boleto,
  saleId,
  partnerName,
  saleTotal,
  saleDateIso,
  onClose,
}: {
  boleto: BankBoletoDto;
  saleId: string;
  partnerName: string;
  saleTotal: number;
  saleDateIso?: string;
  onClose: () => void;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const linhaFmt = formatBoletoLinhaDigitavel(boleto.linhaDigitavel);
  const barcodeDigits = boletoBarcodeDigits(boleto);
  const total = boleto.valor > 0 ? boleto.valor : saleTotal;

  useEffect(() => {
    void apiFetch<{ company: { logoUrl: string | null } | null }>(
      `/v1/commercial/orders/${encodeURIComponent(saleId)}/receipt`,
    )
      .then((r) => setLogoUrl(r.company?.logoUrl ?? null))
      .catch(() => setLogoUrl(null));
  }, [saleId]);

  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 12.5 10 17l9-10"
            />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-emerald-950">Venda registrada com sucesso!</p>
          <p className="mt-0.5 text-sm text-emerald-900">
            O boleto foi emitido pela integração bancária e a conta a receber foi criada no sistema.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Dados da venda</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-slate-200/80 py-2">
              <dt className="text-slate-500">Cliente</dt>
              <dd className="text-right font-medium text-slate-900">{partnerName}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-200/80 py-2">
              <dt className="text-slate-500">Data da venda</dt>
              <dd className="tabular-nums text-slate-900">{saleDateLabel(saleDateIso)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-200/80 py-2">
              <dt className="text-slate-500">Valor total</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{formatBrl(total)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-200/80 py-2">
              <dt className="text-slate-500">Forma de pagamento</dt>
              <dd className="text-slate-900">Boleto</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-200/80 py-2">
              <dt className="text-slate-500">Vencimento</dt>
              <dd className="tabular-nums text-slate-900">{dueDateLabel(boleto.dataVencimento)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-slate-500">Situação</dt>
              <dd>
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  Em aberto
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <CompanyLogoImg logoRegistered={logoUrl} variant="shell" className="max-h-10" />
            <span className="text-lg font-bold tracking-wide text-slate-800">BOLETO</span>
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Número do boleto</p>
          <p className="mt-1 break-all font-mono text-sm leading-relaxed text-slate-900">{linhaFmt}</p>
          {boleto.nossoNumero ? (
            <p className="mt-2 text-xs text-slate-500">
              Nosso número: <span className="font-mono text-slate-700">{boleto.nossoNumero}</span>
            </p>
          ) : null}
          <div className="mt-4 flex flex-col items-center gap-2">
            <BoletoBarcode digits={barcodeDigits} />
            <p className="max-w-md break-all text-center font-mono text-[10px] leading-snug text-slate-600">
              {barcodeDigits || linhaFmt.replace(/\s/g, '')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 border-t border-slate-100 pt-4">
        <Button
          type="button"
          onClick={() =>
            void downloadAuthFile(`/v1/finance/boletos/${boleto.id}/pdf`, `boleto-${boleto.id}.pdf`)
          }
        >
          Baixar boleto (PDF)
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            onClose();
            navigateToReportPrint(
              `/vendas/impressao?id=${encodeURIComponent(saleId)}&autoprint=1`,
              '/vendas',
            );
          }}
        >
          Imprimir comprovante da venda
        </Button>
      </div>
    </div>
  );
}
