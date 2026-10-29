'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@gestor-granja/ui';
import { ModalBackdrop } from '@/components/crud/modal-backdrop';
import { PartnerLookupField } from '@/components/partner-lookup-field';
import { ProductLookupField } from '@/components/product-lookup-field';
import { Field, inputClass } from '@/components/ui-parts';
import { BoletoSaleConfirmation } from '@/components/vendas/boleto-sale-confirmation';
import { apiFetch } from '@/lib/api';
import type { BankBoletoDto } from '@/lib/boleto';
import { navigateToReportPrint } from '@/lib/report-print-nav';
import { formatBrl } from '@/lib/money';
import { parseSaleQuantityInput, SaleQtyDraftInput, SaleQtyInput } from '@/components/vendas/sale-qty-input';

type PaymentForm = {
  id: string;
  name: string;
  kind: string;
  colorHex: string;
};

type CartLine = {
  key: string;
  productId: string;
  label: string;
  quantity: number;
  unitPrice: number;
};

type SaleStep = 'sale' | 'success' | 'boleto';
type PayPanel = 'methods' | 'requisition' | 'cash' | 'boleto';

type BoletoSaleTerms = {
  dueDate: string;
  tipoMulta: number;
  valorMulta: number | null;
  tipoJurosMora: number;
  valorJurosMora: number | null;
  diasInicioMultaAposVencimento: number;
  diasInicioJurosAposVencimento: number;
  diasLimitePagamentoAposVencimento: number | null;
};

type RequisitionSuccess = {
  partnerName: string;
  total: number;
  dueDate: string;
  days: number;
};

const KIND_RANK: Record<string, number> = {
  PIX: 0,
  CASH: 1,
  CARD: 2,
  BOLETO: 3,
  REQUISICAO: 4,
  TRANSFER: 5,
  OTHER: 6,
};

const KIND_LABEL: Record<string, string> = {
  PIX: 'Pix',
  CASH: 'Dinheiro',
  CARD: 'Cartão',
  BOLETO: 'Boleto',
  REQUISICAO: 'Requisição',
  TRANSFER: 'Transferência',
  OTHER: 'Outro',
};

function lineGross(l: CartLine) {
  return l.quantity * l.unitPrice;
}

function addCalendarDays(days: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatIsoPt(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function daysFromToday(iso: string) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const due = new Date(`${iso}T12:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function parseMoneyInput(raw: string) {
  const n = Number(String(raw).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function cashChange(tendered: number, due: number) {
  return Math.round(Math.max(0, tendered - due) * 100) / 100;
}

function distributeDiscount(lines: CartLine[], discount: number) {
  const gross = lines.reduce((s, l) => s + lineGross(l), 0);
  if (discount <= 0 || gross <= 0) {
    return lines.map((l) => ({ ...l, discount: 0 }));
  }
  let remaining = Math.round(discount * 100) / 100;
  return lines.map((l, i) => {
    const share =
      i === lines.length - 1
        ? remaining
        : Math.round(((discount * lineGross(l)) / gross) * 100) / 100;
    remaining = Math.round((remaining - share) * 100) / 100;
    return { ...l, discount: Math.min(Math.max(0, share), lineGross(l)) };
  });
}

function CashTenderFields({
  due,
  tendered,
  onTenderedChange,
  label = 'Valor que o cliente está pagando',
}: {
  due: number;
  tendered: string;
  onTenderedChange: (value: string) => void;
  label?: string;
}) {
  const tenderedNum = parseMoneyInput(tendered);
  const showTroco = Number.isFinite(tenderedNum) && tenderedNum + 0.004 >= due;
  const troco = showTroco ? cashChange(tenderedNum, due) : 0;
  const insufficient = Number.isFinite(tenderedNum) && tenderedNum + 0.004 < due;

  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/90 p-3">
      <p className="text-sm font-medium text-amber-950">Pagamento em dinheiro</p>
      <p className="text-xs text-amber-900">
        Total em dinheiro: <strong className="tabular-nums">{formatBrl(due)}</strong>
      </p>
      <Field label={label}>
        <input
          className={inputClass}
          type="number"
          min={0}
          step="0.01"
          value={tendered}
          onChange={(e) => onTenderedChange(e.target.value)}
          placeholder="0,00"
          autoFocus
        />
      </Field>
      {insufficient ? (
        <p className="text-sm text-red-700">Valor recebido menor que o total em dinheiro.</p>
      ) : null}
      {showTroco ? (
        <p className="rounded-lg bg-white px-3 py-2 text-lg font-semibold text-emerald-900">
          Troco: <span className="tabular-nums">{formatBrl(troco)}</span>
        </p>
      ) : null}
    </div>
  );
}

function BoletoTermsFields({
  days,
  due,
  tipoMulta,
  valorMulta,
  tipoJuros,
  valorJuros,
  diasMulta,
  diasJuros,
  diasLimite,
  onDays,
  onDue,
  onTipoMulta,
  onValorMulta,
  onTipoJuros,
  onValorJuros,
  onDiasMulta,
  onDiasJuros,
  onDiasLimite,
}: {
  days: string;
  due: string;
  tipoMulta: string;
  valorMulta: string;
  tipoJuros: string;
  valorJuros: string;
  diasMulta: string;
  diasJuros: string;
  diasLimite: string;
  onDays: (v: string) => void;
  onDue: (v: string) => void;
  onTipoMulta: (v: string) => void;
  onValorMulta: (v: string) => void;
  onTipoJuros: (v: string) => void;
  onValorJuros: (v: string) => void;
  onDiasMulta: (v: string) => void;
  onDiasJuros: (v: string) => void;
  onDiasLimite: (v: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
      <p className="text-sm font-semibold text-emerald-950">Boleto</p>
      <p className="text-xs text-emerald-900">
        Estes valores valem só para este boleto. O cadastro da empresa continua como padrão da próxima venda.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Prazo em dias">
          <input
            className={inputClass}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={days}
            onChange={(e) => {
              const next = e.target.value;
              onDays(next);
              const n = Number(next);
              if (next !== '' && Number.isFinite(n) && n >= 0) onDue(addCalendarDays(n));
            }}
          />
        </Field>
        <Field label="Vencimento">
          <input
            className={inputClass}
            type="date"
            value={due}
            onChange={(e) => {
              const iso = e.target.value;
              onDue(iso);
              if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) onDays(String(Math.max(0, daysFromToday(iso))));
            }}
            required
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Multa">
          <select className={inputClass} value={tipoMulta} onChange={(e) => onTipoMulta(e.target.value)}>
            <option value="0">Isenta</option>
            <option value="1">Valor fixo (R$)</option>
            <option value="2">Percentual (%)</option>
          </select>
        </Field>
        <Field label="Valor da multa">
          <input
            className={inputClass}
            inputMode="decimal"
            value={valorMulta}
            disabled={tipoMulta === '0'}
            placeholder={tipoMulta === '2' ? 'Ex.: 2' : 'Ex.: 10,00'}
            onChange={(e) => onValorMulta(e.target.value)}
          />
        </Field>
        <Field label="Juros de mora">
          <select className={inputClass} value={tipoJuros} onChange={(e) => onTipoJuros(e.target.value)}>
            <option value="3">Isento</option>
            <option value="1">Valor por dia (R$)</option>
            <option value="2">Taxa mensal (%)</option>
          </select>
        </Field>
        <Field label="Valor dos juros">
          <input
            className={inputClass}
            inputMode="decimal"
            value={valorJuros}
            disabled={tipoJuros === '3'}
            placeholder={tipoJuros === '2' ? 'Ex.: 1' : 'Ex.: 0,33'}
            onChange={(e) => onValorJuros(e.target.value)}
          />
        </Field>
        <Field label="Multa a partir de (dias após venc.)">
          <input
            className={inputClass}
            type="number"
            min={1}
            value={diasMulta}
            onChange={(e) => onDiasMulta(e.target.value)}
          />
        </Field>
        <Field label="Juros a partir de (dias após venc.)">
          <input
            className={inputClass}
            type="number"
            min={1}
            value={diasJuros}
            onChange={(e) => onDiasJuros(e.target.value)}
          />
        </Field>
        <Field label="Limite para pagamento (dias após venc.)">
          <input
            className={inputClass}
            type="number"
            min={0}
            value={diasLimite}
            placeholder="Em branco = automático"
            onChange={(e) => onDiasLimite(e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function PaymentKindIcon({ kind }: { kind: string }) {
  const common = 'h-5 w-5';
  if (kind === 'PIX') {
    return (
      <svg viewBox="0 0 16 16" className={common} aria-hidden>
        <path
          fill="currentColor"
          d="M11.917 11.71a2.046 2.046 0 0 1-1.454-.602l-2.1-2.1a.4.4 0 0 0-.551 0l-2.108 2.108a2.044 2.044 0 0 1-1.454.602h-.414l2.66 2.66c.83.83 2.177.83 3.007 0l2.667-2.668h-.253zM4.25 4.282c.55 0 1.066.214 1.454.602l2.108 2.108a.39.39 0 0 0 .552 0l2.1-2.1a2.044 2.044 0 0 1 1.453-.602h.253L9.503 1.623a2.127 2.127 0 0 0-3.007 0l-2.66 2.66h.414z"
        />
        <path
          fill="currentColor"
          d="m14.377 6.496-1.612-1.612a.307.307 0 0 1-.114.023h-.733c-.379 0-.75.154-1.017.422l-2.1 2.1a1.164 1.164 0 0 1-1.645 0L5.048 5.321a1.392 1.392 0 0 0-1.017-.422H3.35a.3.3 0 0 1-.105-.02l-1.622 1.623a2.127 2.127 0 0 0 0 3.006l1.622 1.623a.3.3 0 0 1 .105-.021h.639c.379 0 .75-.154 1.017-.422l2.108-2.108a1.172 1.172 0 0 1 1.645 0l2.1 2.1c.267.268.638.422 1.017.422h.733a.3.3 0 0 1 .114.023l1.612-1.612a2.127 2.127 0 0 0 0-3.006z"
        />
      </svg>
    );
  }
  if (kind === 'CASH') {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden>
        <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === 'CARD') {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden>
        <rect x="2.5" y="5" width="19" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 9.5h18" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === 'BOLETO') {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden>
        <path
          fill="currentColor"
          d="M4 5h2v14H4V5Zm3 0h1v14H7V5Zm3 0h2v14h-2V5Zm3 0h1v14h-1V5Zm3 0h2v14h-2V5Zm3 0h1v14h-1V5Z"
        />
      </svg>
    );
  }
  if (kind === 'REQUISICAO') {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden>
        <rect x="5" y="3.5" width="14" height="17" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={common} aria-hidden>
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function MiniPdvModal({
  open,
  onClose,
  title,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onCompleted?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<SaleStep>('sale');
  const [showPayment, setShowPayment] = useState(false);
  const [payPanel, setPayPanel] = useState<PayPanel>('methods');
  const [boletoResult, setBoletoResult] = useState<BankBoletoDto | null>(null);
  const [boletoSaleTotal, setBoletoSaleTotal] = useState(0);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [success, setSuccess] = useState<RequisitionSuccess | null>(null);
  const [partnerId, setPartnerId] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [draftProductId, setDraftProductId] = useState('');
  const [draftLabel, setDraftLabel] = useState('');
  const [draftQty, setDraftQty] = useState('');
  const [draftPrice, setDraftPrice] = useState('');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [saleDiscount, setSaleDiscount] = useState('0');
  const [paymentForms, setPaymentForms] = useState<PaymentForm[]>([]);
  const [splitPay, setSplitPay] = useState(false);
  const [splitPrimaryFormId, setSplitPrimaryFormId] = useState<string | null>(null);
  const [splitSecondaryFormId, setSplitSecondaryFormId] = useState<string | null>(null);
  const [splitPrimaryAmount, setSplitPrimaryAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [emitNfce, setEmitNfce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequisicaoFormId, setPendingRequisicaoFormId] = useState<string | null>(null);
  const [requisitionDays, setRequisitionDays] = useState('7');
  const [requisitionDue, setRequisitionDue] = useState('');
  const [requisitionNotes, setRequisitionNotes] = useState('');
  const [requisitionCredit, setRequisitionCredit] = useState<{
    limit: number | null;
    used: number;
    available: number | null;
  } | null>(null);
  const [pendingCashFormId, setPendingCashFormId] = useState<string | null>(null);
  const [cashTendered, setCashTendered] = useState('');
  const [splitCashTenderedPrimary, setSplitCashTenderedPrimary] = useState('');
  const [splitCashTenderedSecondary, setSplitCashTenderedSecondary] = useState('');
  const [pendingBoletoFormId, setPendingBoletoFormId] = useState<string | null>(null);
  const [boletoDays, setBoletoDays] = useState('7');
  const [boletoDue, setBoletoDue] = useState('');
  const [boletoTipoMulta, setBoletoTipoMulta] = useState('0');
  const [boletoValorMulta, setBoletoValorMulta] = useState('');
  const [boletoTipoJuros, setBoletoTipoJuros] = useState('3');
  const [boletoValorJuros, setBoletoValorJuros] = useState('');
  const [boletoDiasMulta, setBoletoDiasMulta] = useState('1');
  const [boletoDiasJuros, setBoletoDiasJuros] = useState('1');
  const [boletoDiasLimite, setBoletoDiasLimite] = useState('');

  function isRequisicaoForm(f: PaymentForm) {
    return f.kind === 'REQUISICAO';
  }

  function isCashForm(f: PaymentForm) {
    return f.kind === 'CASH';
  }

  function isCashFormId(formId: string | null) {
    if (!formId) return false;
    const f = paymentForms.find((p) => p.id === formId);
    return f?.kind === 'CASH';
  }

  function isBoletoForm(f: PaymentForm) {
    return f.kind === 'BOLETO';
  }

  function isBoletoFormId(formId: string | null) {
    if (!formId) return false;
    return paymentForms.find((p) => p.id === formId)?.kind === 'BOLETO';
  }

  function applyBoletoDefaults(d: {
    dueDaysDefault: number;
    tipoMulta: number;
    valorMulta: number | null;
    tipoJurosMora: number;
    valorJurosMora: number | null;
    diasInicioMultaAposVencimento: number;
    diasInicioJurosAposVencimento: number;
    diasLimitePagamentoAposVencimento: number | null;
  }) {
    const days = String(d.dueDaysDefault ?? 7);
    setBoletoDays(days);
    setBoletoDue(addCalendarDays(Number(days) || 0));
    setBoletoTipoMulta(String(d.tipoMulta ?? 0));
    setBoletoValorMulta(d.valorMulta != null ? String(d.valorMulta) : '');
    setBoletoTipoJuros(String(d.tipoJurosMora ?? 3));
    setBoletoValorJuros(d.valorJurosMora != null ? String(d.valorJurosMora) : '');
    setBoletoDiasMulta(String(d.diasInicioMultaAposVencimento ?? 1));
    setBoletoDiasJuros(String(d.diasInicioJurosAposVencimento ?? 1));
    setBoletoDiasLimite(
      d.diasLimitePagamentoAposVencimento != null ? String(d.diasLimitePagamentoAposVencimento) : '',
    );
  }

  function loadBoletoDefaults() {
    void apiFetch<{
      dueDaysDefault: number;
      tipoMulta: number;
      valorMulta: number | null;
      tipoJurosMora: number;
      valorJurosMora: number | null;
      diasInicioMultaAposVencimento: number;
      diasInicioJurosAposVencimento: number;
      diasLimitePagamentoAposVencimento: number | null;
    }>('/v1/finance/sicoob/sale-defaults')
      .then(applyBoletoDefaults)
      .catch(() => {
        setBoletoDays('7');
        setBoletoDue(addCalendarDays(7));
      });
  }

  function openBoletoPanel() {
    setPayPanel('boleto');
    setError(null);
    loadBoletoDefaults();
  }

  function buildBoletoTerms(): BoletoSaleTerms | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(boletoDue)) {
      setError('Informe a data de vencimento do boleto.');
      return null;
    }
    if (boletoDue < addCalendarDays(0)) {
      setError('A data de vencimento do boleto não pode ser anterior a hoje.');
      return null;
    }
    const tipoMulta = Number(boletoTipoMulta);
    const tipoJurosMora = Number(boletoTipoJuros);
    const valorMulta = boletoValorMulta.trim() === '' ? null : Number(boletoValorMulta.replace(',', '.'));
    const valorJurosMora = boletoValorJuros.trim() === '' ? null : Number(boletoValorJuros.replace(',', '.'));
    if (tipoMulta > 0 && (valorMulta == null || !Number.isFinite(valorMulta) || valorMulta <= 0)) {
      setError('Informe o valor da multa.');
      return null;
    }
    if (tipoJurosMora !== 3 && (valorJurosMora == null || !Number.isFinite(valorJurosMora) || valorJurosMora <= 0)) {
      setError('Informe o valor dos juros.');
      return null;
    }
    const limite = boletoDiasLimite.trim() === '' ? null : Number(boletoDiasLimite);
    return {
      dueDate: boletoDue,
      tipoMulta,
      valorMulta: tipoMulta === 0 ? null : valorMulta,
      tipoJurosMora,
      valorJurosMora: tipoJurosMora === 3 ? null : valorJurosMora,
      diasInicioMultaAposVencimento: Math.max(1, Number(boletoDiasMulta) || 1),
      diasInicioJurosAposVencimento: Math.max(1, Number(boletoDiasJuros) || 1),
      diasLimitePagamentoAposVencimento: limite != null && Number.isFinite(limite) ? limite : null,
    };
  }

  const reset = useCallback(() => {
    setStep('sale');
    setShowPayment(false);
    setPayPanel('methods');
    setPartnerId('');
    setPartnerName('');
    setDraftProductId('');
    setDraftLabel('');
    setDraftQty('');
    setDraftPrice('');
    setLines([]);
    setSaleDiscount('0');
    setSplitPay(false);
    setSplitPrimaryFormId(null);
    setSplitSecondaryFormId(null);
    setSplitPrimaryAmount('');
    setBoletoResult(null);
    setBoletoSaleTotal(0);
    setLastSaleId(null);
    setSuccess(null);
    setPendingRequisicaoFormId(null);
    setRequisitionDays('7');
    setRequisitionDue('');
    setRequisitionNotes('');
    setRequisitionCredit(null);
    setPendingCashFormId(null);
    setPendingBoletoFormId(null);
    setBoletoDays('7');
    setBoletoDue('');
    setBoletoTipoMulta('0');
    setBoletoValorMulta('');
    setBoletoTipoJuros('3');
    setBoletoValorJuros('');
    setBoletoDiasMulta('1');
    setBoletoDiasJuros('1');
    setBoletoDiasLimite('');
    setCashTendered('');
    setSplitCashTenderedPrimary('');
    setSplitCashTenderedSecondary('');
    setEmitNfce(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    void apiFetch<PaymentForm[]>('/v1/cadastros/payment-forms?activeOnly=1').then(setPaymentForms);
  }, [open, reset]);

  const orderedForms = useMemo(
    () =>
      [...paymentForms].sort(
        (a, b) => (KIND_RANK[a.kind] ?? 99) - (KIND_RANK[b.kind] ?? 99) || a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [paymentForms],
  );

  const gross = useMemo(() => lines.reduce((s, l) => s + lineGross(l), 0), [lines]);
  const discountNum = Math.max(0, Number(saleDiscount.replace(',', '.')) || 0);
  const subtotal = Math.round((gross - Math.min(discountNum, gross)) * 100) / 100;

  function addLine() {
    setError(null);
    const quantity = parseSaleQuantityInput(draftQty);
    const unitPrice = Number(draftPrice);
    if (!draftProductId || !partnerId) {
      setError('Informe cliente e produto.');
      return;
    }
    if (quantity == null || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Quantidade e preço inválidos.');
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: `${draftProductId}-${Date.now()}`,
        productId: draftProductId,
        label: draftLabel || 'Produto',
        quantity,
        unitPrice,
      },
    ]);
    setDraftProductId('');
    setDraftLabel('');
    setDraftQty('');
    setDraftPrice('');
  }

  function updateLine(key: string, patch: Partial<Pick<CartLine, 'quantity' | 'unitPrice'>>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const splitPrimaryNum = splitPrimaryAmount === '' ? NaN : Number(splitPrimaryAmount);
  const splitRemainder =
    splitPay && Number.isFinite(splitPrimaryNum)
      ? Math.round((subtotal - splitPrimaryNum) * 100) / 100
      : null;

  async function loadRequisitionCredit() {
    if (!partnerId) return;
    try {
      const c = await apiFetch<{ limit: number | null; used: number; available: number | null }>(
        `/v1/commercial/partners/${partnerId}/requisition-credit`,
      );
      setRequisitionCredit(c);
    } catch {
      setRequisitionCredit(null);
    }
  }

  function saleItems() {
    const applied = Math.min(discountNum, gross);
    return distributeDiscount(lines, applied).map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
    }));
  }

  async function finishSale(payload: {
    paymentFormId: string;
    primaryPaymentAmount?: number;
    secondaryPaymentFormId?: string;
    cashTendered?: number;
    boletoTerms?: BoletoSaleTerms;
    requisitionTerms?: {
      installmentCount: number;
      firstDueDate: string;
      intervalDays: number[];
      notes?: string;
    };
    requisitionSuccess?: RequisitionSuccess;
  }) {
    if (!partnerId || lines.length === 0) return;
    if (discountNum > gross + 0.004) {
      setError('O desconto não pode ser maior que o subtotal.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string }>('/v1/commercial/orders', {
        method: 'POST',
        body: JSON.stringify({
          partnerId,
          paymentFormId: payload.paymentFormId,
          primaryPaymentAmount: payload.primaryPaymentAmount,
          secondaryPaymentFormId: payload.secondaryPaymentFormId,
          requisitionTerms: payload.requisitionTerms,
          cashTendered: payload.cashTendered,
          items: saleItems(),
        }),
      });
      const confirmed = await apiFetch<{ boleto?: BankBoletoDto }>(
        `/v1/commercial/orders/${created.id}/confirm`,
        {
          method: 'POST',
          body: JSON.stringify(payload.boletoTerms ? { boletoTerms: payload.boletoTerms } : {}),
        },
      );
      if (emitNfce) {
        try {
          await apiFetch(`/v1/fiscal/emit/${created.id}?type=NFCE`, { method: 'POST', body: '{}' });
        } catch (nfceErr) {
          setError(
            nfceErr instanceof Error
              ? `Venda confirmada, mas NFC-e falhou: ${nfceErr.message}`
              : 'Venda confirmada, mas NFC-e falhou',
          );
          onCompleted?.();
          return;
        }
      }
      if (confirmed.boleto && !confirmed.boleto.error && confirmed.boleto.id) {
        setLastSaleId(created.id);
        setBoletoSaleTotal(subtotal);
        setBoletoResult(confirmed.boleto);
        setStep('boleto');
        onCompleted?.();
        return;
      }
      if (confirmed.boleto?.error) {
        setError(`Venda confirmada, mas o boleto falhou: ${confirmed.boleto.error}`);
        onCompleted?.();
        return;
      }
      if (payload.requisitionSuccess) {
        setLastSaleId(created.id);
        setSuccess(payload.requisitionSuccess);
        setStep('success');
        onCompleted?.();
        return;
      }
      onClose();
      onCompleted?.();
      navigateToReportPrint(
        `/vendas/impressao?id=${encodeURIComponent(created.id)}`,
        '/vendas',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar venda');
    } finally {
      setBusy(false);
    }
  }

  function openPayment() {
    setError(null);
    if (!partnerId || lines.length === 0) {
      setError('Informe o cliente e ao menos um produto.');
      return;
    }
    if (discountNum > gross + 0.004) {
      setError('O desconto não pode ser maior que o subtotal.');
      return;
    }
    setShowPayment(true);
    setPayPanel('methods');
  }

  function finishWithPayment(form: PaymentForm) {
    if (splitPay) return;
    if (isRequisicaoForm(form)) {
      setPendingRequisicaoFormId(form.id);
      setPendingCashFormId(null);
      setRequisitionDays('7');
      setRequisitionDue(addCalendarDays(7));
      setRequisitionNotes('');
      setPayPanel('requisition');
      void loadRequisitionCredit();
      setError(null);
      return;
    }
    if (isCashForm(form)) {
      setPendingCashFormId(form.id);
      setPendingRequisicaoFormId(null);
      setPendingBoletoFormId(null);
      setCashTendered('');
      setPayPanel('cash');
      setError(null);
      return;
    }
    if (isBoletoForm(form)) {
      setPendingBoletoFormId(form.id);
      setPendingCashFormId(null);
      setPendingRequisicaoFormId(null);
      openBoletoPanel();
      return;
    }
    void finishSale({ paymentFormId: form.id });
  }

  function confirmCashPayment() {
    if (!pendingCashFormId) return;
    const tendered = parseMoneyInput(cashTendered);
    if (!Number.isFinite(tendered) || tendered + 0.004 < subtotal) {
      setError('Informe o valor que o cliente está pagando (maior ou igual ao total).');
      return;
    }
    void finishSale({ paymentFormId: pendingCashFormId, cashTendered: tendered });
  }

  function confirmBoletoPayment() {
    const terms = buildBoletoTerms();
    if (!terms) return;
    if (splitPay) {
      confirmSplitPayment(terms);
      return;
    }
    if (!pendingBoletoFormId) return;
    void finishSale({ paymentFormId: pendingBoletoFormId, boletoTerms: terms });
  }

  function confirmRequisitionPayment() {
    if (!pendingRequisicaoFormId) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requisitionDue)) {
      setError('Informe a data de vencimento.');
      return;
    }
    const days = daysFromToday(requisitionDue);
    void finishSale({
      paymentFormId: pendingRequisicaoFormId,
      requisitionTerms: {
        installmentCount: 1,
        firstDueDate: requisitionDue,
        intervalDays: [],
        notes: requisitionNotes.trim() || undefined,
      },
      requisitionSuccess: {
        partnerName: partnerName || 'Cliente',
        total: subtotal,
        dueDate: requisitionDue,
        days,
      },
    });
  }

  function startNewSale() {
    setLines([]);
    setSaleDiscount('0');
    setDraftProductId('');
    setDraftLabel('');
    setDraftQty('');
    setDraftPrice('');
    setBoletoDays('7');
    setBoletoDue('');
    setBoletoTipoMulta('0');
    setBoletoValorMulta('');
    setBoletoTipoJuros('3');
    setBoletoValorJuros('');
    setBoletoDiasMulta('1');
    setBoletoDiasJuros('1');
    setBoletoDiasLimite('');
    setShowPayment(false);
    setPayPanel('methods');
    setSuccess(null);
    setStep('sale');
    setPendingRequisicaoFormId(null);
    setPendingCashFormId(null);
    setPendingBoletoFormId(null);
    setCashTendered('');
    setSplitCashTenderedPrimary('');
    setSplitCashTenderedSecondary('');
    setRequisitionNotes('');
    setSplitPay(false);
    setError(null);
  }

  function confirmSplitPayment(boletoTerms?: BoletoSaleTerms) {
    if (!splitPrimaryFormId || !splitSecondaryFormId) {
      setError('Selecione as duas formas de pagamento.');
      return;
    }
    if (!Number.isFinite(splitPrimaryNum) || splitPrimaryNum <= 0 || splitPrimaryNum >= subtotal - 0.004) {
      setError('Informe um valor válido na 1ª forma (menor que o total).');
      return;
    }
    if (splitRemainder == null || splitRemainder < 0.01) {
      setError('O restante na 2ª forma deve ser maior que zero.');
      return;
    }
    if (isCashFormId(splitPrimaryFormId)) {
      const tendered = parseMoneyInput(splitCashTenderedPrimary);
      if (!Number.isFinite(tendered) || tendered + 0.004 < splitPrimaryNum) {
        setError('Valor recebido em dinheiro insuficiente na 1ª forma.');
        return;
      }
    }
    if (isCashFormId(splitSecondaryFormId)) {
      const tendered = parseMoneyInput(splitCashTenderedSecondary);
      if (!Number.isFinite(tendered) || tendered + 0.004 < splitRemainder) {
        setError('Valor recebido em dinheiro insuficiente na 2ª forma.');
        return;
      }
    }
    let cashTendered: number | undefined;
    if (isCashFormId(splitPrimaryFormId)) {
      cashTendered = (cashTendered ?? 0) + parseMoneyInput(splitCashTenderedPrimary);
    }
    if (isCashFormId(splitSecondaryFormId)) {
      cashTendered = (cashTendered ?? 0) + parseMoneyInput(splitCashTenderedSecondary);
    }
    const usesBoleto = isBoletoFormId(splitPrimaryFormId) || isBoletoFormId(splitSecondaryFormId);
    let terms = boletoTerms;
    if (usesBoleto && !terms) {
      const built = buildBoletoTerms();
      if (!built) return;
      terms = built;
    }
    void finishSale({
      paymentFormId: splitPrimaryFormId,
      primaryPaymentAmount: splitPrimaryNum,
      secondaryPaymentFormId: splitSecondaryFormId,
      cashTendered,
      boletoTerms: terms,
    });
  }

  function paymentButton(form: PaymentForm, selected: boolean, onPick: () => void) {
    return (
      <button
        key={form.id}
        type="button"
        disabled={busy}
        className={`flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium disabled:opacity-60 ${
          selected ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-600' : 'border-slate-200 bg-white hover:bg-slate-50'
        }`}
        style={{ color: form.colorHex || '#0f766e' }}
        onClick={onPick}
      >
        <PaymentKindIcon kind={form.kind} />
        <span className="text-slate-800">{KIND_LABEL[form.kind] ?? form.name}</span>
      </button>
    );
  }

  if (!open) return null;

  const cartBlock = (
    <div className="min-w-0 flex-1">
      <div className="mb-3">
        <PartnerLookupField
          role="customer"
          value={partnerId}
          onValueChange={(id, partner) => {
            setPartnerId(id);
            setPartnerName(partner?.name ?? '');
          }}
          required
          label="Cliente"
        />
      </div>
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-end gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm text-slate-600">Produto</span>
            {draftProductId ? (
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-800"
                onClick={() => {
                  setDraftProductId('');
                  setDraftLabel('');
                  setDraftPrice('');
                }}
              >
                Limpar
              </button>
            ) : null}
          </div>
          <ProductLookupField
            bare
            hideClear
            value={draftProductId}
            onValueChange={(id, product) => {
              setDraftProductId(id);
              if (product) {
                setDraftLabel(product.name);
                if (product.salePrice != null) setDraftPrice(String(product.salePrice));
              } else {
                setDraftLabel('');
                setDraftPrice('');
              }
            }}
            className="h-11"
            placeholder="Digite o produto…"
          />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Qtd</span>
          <SaleQtyDraftInput
            className={`${inputClass} h-11`}
            value={draftQty}
            onChange={setDraftQty}
            placeholder="Qtd"
          />
        </label>
        <Button type="button" className="h-11 px-4" onClick={addLine}>
          Adicionar
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Produto</th>
              <th className="px-3 py-2 font-medium">Qtd.</th>
              <th className="px-3 py-2 font-medium">Valor unit.</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Nenhum item adicionado.
                </td>
              </tr>
            ) : (
              lines.map((l) => (
                <tr key={l.key} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{l.label}</td>
                  <td className="px-3 py-2">
                    <SaleQtyInput
                      className="w-[4.5rem] rounded border border-slate-200 px-1 py-1 text-sm"
                      value={l.quantity}
                      onChange={(quantity) => updateLine(l.key, { quantity })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-sm"
                      type="number"
                      min={0}
                      step="0.01"
                      value={l.unitPrice}
                      onChange={(e) => updateLine(l.key, { unitPrice: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatBrl(lineGross(l))}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-800"
                      aria-label="Remover item"
                      onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                        <path
                          fill="currentColor"
                          d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="flex justify-end border-t border-slate-200 px-3 py-3">
          <div className="w-full max-w-[16rem] space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-6 text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatBrl(gross)}</span>
            </div>
            <div className="flex items-center justify-between gap-6 text-slate-600">
              <label htmlFor="sale-discount">Desconto</label>
              <input
                id="sale-discount"
                className="w-28 rounded border border-slate-200 px-2 py-1 text-right text-sm"
                type="number"
                min={0}
                step="0.01"
                value={saleDiscount}
                onChange={(e) => setSaleDiscount(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-6 border-t border-slate-200 pt-1.5 text-base font-semibold text-slate-900">
              <span>Total da venda</span>
              <span className="tabular-nums text-emerald-800">{formatBrl(subtotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const paymentBlock = (
    <div className="w-full lg:w-[22rem] lg:shrink-0">
      <p className="mb-2 text-sm font-semibold text-slate-800">Forma de pagamento</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {orderedForms.map((f) =>
          paymentButton(
            f,
            (payPanel === 'requisition' && isRequisicaoForm(f) && !splitPay) ||
              (payPanel === 'cash' && pendingCashFormId === f.id && !splitPay) ||
              (payPanel === 'boleto' && pendingBoletoFormId === f.id && !splitPay),
            () => {
            if (splitPay) {
              setError('No pagamento dividido, use as duas formas abaixo.');
              return;
            }
            finishWithPayment(f);
          }),
        )}
      </div>
      {paymentForms.length === 0 ? (
        <p className="mb-3 text-sm text-amber-800">Cadastre formas em Cadastros → Formas de pagamento.</p>
      ) : null}

      <div className="mb-3 space-y-1 text-xs text-slate-600">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={emitNfce} onChange={(e) => setEmitNfce(e.target.checked)} />
          Emitir NFC-e após confirmar
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={splitPay}
            onChange={(e) => {
              setSplitPay(e.target.checked);
              setSplitPrimaryFormId(null);
              setSplitSecondaryFormId(null);
              setSplitPrimaryAmount('');
              setSplitCashTenderedPrimary('');
              setSplitCashTenderedSecondary('');
              setPayPanel('methods');
              setPendingCashFormId(null);
              setError(null);
            }}
          />
          Cliente paga em duas formas
        </label>
      </div>

      {payPanel === 'requisition' && !splitPay ? (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
          <p className="text-sm font-semibold text-emerald-950">Requisição</p>
          <p className="text-xs text-emerald-900">
            A venda será registrada como um valor a receber, com uma única data de vencimento.
          </p>
          {requisitionCredit ? (
            <p className="text-xs text-emerald-950">
              Requisição liberada. Em aberto: {formatBrl(requisitionCredit.used)}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Valor total da venda">
              <input className={`${inputClass} bg-white`} readOnly value={formatBrl(subtotal)} />
            </Field>
            <Field label="Prazo em dias">
              <input
                className={inputClass}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={requisitionDays}
                onChange={(e) => {
                  const days = e.target.value;
                  setRequisitionDays(days);
                  const n = Number(days);
                  if (days !== '' && Number.isFinite(n) && n >= 0) {
                    setRequisitionDue(addCalendarDays(n));
                  }
                }}
                placeholder="Ex.: 7"
              />
            </Field>
          </div>
          <Field label="Data de vencimento">
            <input
              className={inputClass}
              type="date"
              value={requisitionDue}
              onChange={(e) => {
                const iso = e.target.value;
                setRequisitionDue(iso);
                if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
                  setRequisitionDays(String(Math.max(0, daysFromToday(iso))));
                }
              }}
              required
            />
          </Field>
          <p className="flex gap-2 text-xs text-emerald-900">
            <span aria-hidden>ℹ</span>
            Ao finalizar a venda, será criada uma conta a receber para este cliente com o valor total e a data de
            vencimento informada.
          </p>
          <Field label="Observações (opcional)">
            <textarea
              className={`${inputClass} min-h-16`}
              value={requisitionNotes}
              onChange={(e) => setRequisitionNotes(e.target.value)}
              placeholder="Ex.: Observações sobre a requisição…"
            />
          </Field>
        </div>
      ) : null}

      {payPanel === 'cash' && !splitPay ? (
        <CashTenderFields
          due={subtotal}
          tendered={cashTendered}
          onTenderedChange={setCashTendered}
        />
      ) : null}

      {payPanel === 'boleto' && !splitPay ? (
        <BoletoTermsFields
          days={boletoDays}
          due={boletoDue}
          tipoMulta={boletoTipoMulta}
          valorMulta={boletoValorMulta}
          tipoJuros={boletoTipoJuros}
          valorJuros={boletoValorJuros}
          diasMulta={boletoDiasMulta}
          diasJuros={boletoDiasJuros}
          diasLimite={boletoDiasLimite}
          onDays={setBoletoDays}
          onDue={setBoletoDue}
          onTipoMulta={setBoletoTipoMulta}
          onValorMulta={setBoletoValorMulta}
          onTipoJuros={setBoletoTipoJuros}
          onValorJuros={setBoletoValorJuros}
          onDiasMulta={setBoletoDiasMulta}
          onDiasJuros={setBoletoDiasJuros}
          onDiasLimite={setBoletoDiasLimite}
        />
      ) : null}

      {splitPay ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Field label="Valor pago na 1ª forma (R$)">
            <input
              className={inputClass}
              type="number"
              min={0.01}
              step="0.01"
              value={splitPrimaryAmount}
              onChange={(e) => setSplitPrimaryAmount(e.target.value)}
              placeholder={subtotal.toFixed(2)}
            />
          </Field>
          {splitRemainder != null && splitRemainder >= 0.01 ? (
            <p className="text-sm text-slate-700">
              Restante na 2ª forma: <strong className="tabular-nums">{formatBrl(splitRemainder)}</strong>
            </p>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">1ª forma</p>
          <div className="flex flex-wrap gap-1.5">
            {orderedForms
              .filter((f) => !isRequisicaoForm(f))
              .map((f) =>
                paymentButton(f, splitPrimaryFormId === f.id, () => {
                  setSplitPrimaryFormId(f.id);
                  if (splitSecondaryFormId === f.id) setSplitSecondaryFormId(null);
                  setSplitCashTenderedPrimary('');
                  if (isBoletoForm(f) && !boletoDue) loadBoletoDefaults();
                }),
              )}
          </div>
          {isCashFormId(splitPrimaryFormId) &&
          Number.isFinite(splitPrimaryNum) &&
          splitPrimaryNum >= 0.01 ? (
            <CashTenderFields
              due={splitPrimaryNum}
              tendered={splitCashTenderedPrimary}
              onTenderedChange={setSplitCashTenderedPrimary}
              label="Valor que o cliente paga em dinheiro (1ª forma)"
            />
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">2ª forma</p>
          <div className="flex flex-wrap gap-1.5">
            {orderedForms
              .filter((f) => f.id !== splitPrimaryFormId && !isRequisicaoForm(f))
              .map((f) =>
                paymentButton(f, splitSecondaryFormId === f.id, () => {
                  setSplitSecondaryFormId(f.id);
                  setSplitCashTenderedSecondary('');
                  if (isBoletoForm(f) && !boletoDue) loadBoletoDefaults();
                }),
              )}
          </div>
          {isBoletoFormId(splitPrimaryFormId) || isBoletoFormId(splitSecondaryFormId) ? (
            <BoletoTermsFields
              days={boletoDays}
              due={boletoDue}
              tipoMulta={boletoTipoMulta}
              valorMulta={boletoValorMulta}
              tipoJuros={boletoTipoJuros}
              valorJuros={boletoValorJuros}
              diasMulta={boletoDiasMulta}
              diasJuros={boletoDiasJuros}
              diasLimite={boletoDiasLimite}
              onDays={setBoletoDays}
              onDue={setBoletoDue}
              onTipoMulta={setBoletoTipoMulta}
              onValorMulta={setBoletoValorMulta}
              onTipoJuros={setBoletoTipoJuros}
              onValorJuros={setBoletoValorJuros}
              onDiasMulta={setBoletoDiasMulta}
              onDiasJuros={setBoletoDiasJuros}
              onDiasLimite={setBoletoDiasLimite}
            />
          ) : null}
          {isCashFormId(splitSecondaryFormId) && splitRemainder != null && splitRemainder >= 0.01 ? (
            <CashTenderFields
              due={splitRemainder}
              tendered={splitCashTenderedSecondary}
              onTenderedChange={setSplitCashTenderedSecondary}
              label="Valor que o cliente paga em dinheiro (2ª forma)"
            />
          ) : null}
          <Button
            type="button"
            disabled={busy || !splitPrimaryFormId || !splitSecondaryFormId}
            onClick={() => confirmSplitPayment()}
          >
            Finalizar venda
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <ModalBackdrop onClose={onClose} wide fitViewport>
      <div className="flex max-h-[min(92vh,900px)] flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 bg-emerald-800 px-4 py-3 text-white sm:px-5">
          <div>
            <h2 className="text-lg font-semibold">Realizar venda</h2>
            <p className="text-xs text-emerald-100">{title}</p>
          </div>
          <button type="button" className="text-sm font-medium text-emerald-50 hover:text-white" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {step === 'boleto' && boletoResult && lastSaleId ? (
            <BoletoSaleConfirmation
              boleto={boletoResult}
              saleId={lastSaleId}
              partnerName={partnerName || 'Cliente'}
              saleTotal={boletoSaleTotal}
              onClose={onClose}
            />
          ) : step === 'success' && success ? (
            <div className="mx-auto max-w-md py-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden>
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
              <h3 className="text-xl font-semibold text-slate-900">Venda na requisição registrada!</h3>
              <p className="mt-2 text-sm text-slate-600">
                A venda foi registrada e uma conta a receber foi criada para este cliente.
              </p>
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm">
                <p>
                  Valor: <strong>{formatBrl(success.total)}</strong>
                </p>
                <p>
                  Vencimento:{' '}
                  <strong>
                    {formatIsoPt(success.dueDate)}
                    {Number.isFinite(success.days) ? ` (${success.days} dias)` : ''}
                  </strong>
                </p>
                <p>
                  Cliente: <strong>{success.partnerName}</strong>
                </p>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button type="button" variant="secondary" onClick={startNewSale}>
                  Nova venda
                </Button>
                {lastSaleId ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      onClose();
                      navigateToReportPrint(
                        `/vendas/impressao?id=${encodeURIComponent(lastSaleId)}`,
                        '/vendas',
                      );
                    }}
                  >
                    Ver comprovante
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push('/financeiro/receber');
                  }}
                >
                  Ver conta a receber
                </Button>
              </div>
            </div>
          ) : (
            <div className={showPayment ? 'flex flex-col gap-4 lg:flex-row' : ''}>{cartBlock}{showPayment ? paymentBlock : null}</div>
          )}
        </div>

        {error ? <p className="px-4 pb-2 text-sm text-red-700 sm:px-5">{error}</p> : null}

        {step === 'sale' ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setLines([]);
                  setSaleDiscount('0');
                  setError(null);
                }}
              >
                Limpar itens
              </Button>
              {showPayment && payPanel === 'requisition' && !splitPay ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => setPayPanel('methods')}>
                    Voltar
                  </Button>
                  <Button type="button" disabled={busy} onClick={confirmRequisitionPayment}>
                    Finalizar venda
                  </Button>
                </>
              ) : showPayment && payPanel === 'boleto' && !splitPay ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setPayPanel('methods');
                      setPendingBoletoFormId(null);
                    }}
                  >
                    Voltar
                  </Button>
                  <Button type="button" disabled={busy} onClick={confirmBoletoPayment}>
                    Finalizar venda
                  </Button>
                </>
              ) : showPayment && payPanel === 'cash' && !splitPay ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setPayPanel('methods');
                      setPendingCashFormId(null);
                      setCashTendered('');
                    }}
                  >
                    Voltar
                  </Button>
                  <Button type="button" disabled={busy} onClick={confirmCashPayment}>
                    Finalizar venda
                  </Button>
                </>
              ) : showPayment ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowPayment(false);
                    setPayPanel('methods');
                    setPendingCashFormId(null);
                    setCashTendered('');
                  }}
                >
                  Voltar
                </Button>
              ) : (
                <Button type="button" disabled={lines.length === 0 || !partnerId} onClick={openPayment}>
                  Selecionar pagamento
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </ModalBackdrop>
  );
}
