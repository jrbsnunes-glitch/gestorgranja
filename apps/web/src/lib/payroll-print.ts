import { navigateToReportPrint } from '@/lib/report-print-nav';

export type PayrollPrintLine = {
  code: string;
  description: string;
  amount: number;
};

export type PayrollTaxBasesPrint = {
  grossRemuneration: number;
  inssBase: number;
  inss: number;
  irrfBase: number;
  irrf: number;
  irrfRegime: 'STANDARD' | 'SIMPLIFIED';
  irrfDependents: number;
  fgtsBase: number;
  fgtsEmployer: number;
};

export type PayslipFieldsConfig = {
  showCompanyAddressOnSlip: boolean;
  showPis: boolean;
  showInternalId: boolean;
  showAdmissionDate: boolean;
  showIrrfDependents: boolean;
  showBankPayment: boolean;
  showPaymentDate: boolean;
  showWorkDaysReference: boolean;
};

export type PayrollPrintSlip = {
  employeeName: string;
  jobTitle: string | null;
  cpf: string | null;
  controlNumber?: number;
  pisPasep?: string | null;
  hiredAt?: string | null;
  bankCode?: string | null;
  bankAgency?: string | null;
  bankAccount?: string | null;
  bankAccountDigit?: string | null;
  baseSalary: number;
  additions: number;
  deductions: number;
  netPay: number;
  earnings: PayrollPrintLine[];
  deductionItems: PayrollPrintLine[];
  totalEarnings: number;
  totalDeductionItems: number;
  inss?: number;
  irrf?: number;
  fgtsEmployer?: number;
  taxTablesLabel?: string;
  grossRemuneration?: number;
  taxBases?: PayrollTaxBasesPrint;
  calendarDays?: number;
  /** Detalhamento das retiradas quando o holerite usa linha consolidada. */
  withdrawalDetailAppendix?: PayrollPrintLine[];
};

export type PayrollPrintDocument = {
  generatedAt: string;
  logoDataUrl?: string | null;
  company: {
    legalName: string;
    tradeName: string | null;
    cnpj: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  run: { id: string; yearMonth: string; status: string; paymentDate?: string | null };
  payslipDisplay?: {
    detailWithdrawalsOnPayslip: boolean;
    fields?: PayslipFieldsConfig;
  };
  printWarnings?: string[];
  slips: PayrollPrintSlip[];
  summary: {
    headcount: number;
    totalBase: number;
    totalAdditions: number;
    totalDeductions: number;
    totalNet: number;
  };
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMoneyPtBR(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatYearMonthPtBR(yearMonth: string): string {
  const [y, m] = yearMonth.split('-');
  if (!y || !m) return yearMonth;
  return `${m}/${y}`;
}

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatCpf(cpf: string | null): string {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatPis(pis: string | null | undefined): string {
  if (!pis) return '—';
  const d = pis.replace(/\D/g, '');
  if (d.length !== 11) return pis;
  return `${d.slice(0, 3)}.${d.slice(3, 8)}.${d.slice(8)}`;
}

function formatDatePtBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const DEFAULT_PAYSLIP_FIELDS: PayslipFieldsConfig = {
  showCompanyAddressOnSlip: true,
  showPis: true,
  showInternalId: true,
  showAdmissionDate: false,
  showIrrfDependents: true,
  showBankPayment: false,
  showPaymentDate: false,
  showWorkDaysReference: false,
};

function resolvePayslipFields(doc: PayrollPrintDocument): PayslipFieldsConfig {
  return { ...DEFAULT_PAYSLIP_FIELDS, ...doc.payslipDisplay?.fields };
}

/** Faixa IRRF (tabela mensal maio/2025+) — exibição no rodapé do holerite. */
function irrfFaixaLabel(base: number): string {
  if (base <= 0) return '—';
  if (base <= 2428.8) return 'Isento';
  if (base <= 2826.65) return '1';
  if (base <= 3751.05) return '2';
  if (base <= 4664.68) return '3';
  return '4';
}

const CLASSIC_DESC: Record<string, string> = {
  SAL_BASE: 'Salário',
  INSS: 'Contribuição previdenciária',
  IRRF: 'Imposto de renda retido na fonte',
};

function classicDescription(item: PayrollPrintLine): string {
  return CLASSIC_DESC[item.code] ?? item.description;
}

function referenceForLine(item: PayrollPrintLine, slip: PayrollPrintSlip): string {
  if (item.code === 'SAL_BASE') return '220 h';
  const days = item.description.match(/(\d+)\s*dia\(s\)/i);
  if (days) return `${days[1]} d`;
  const hours = item.description.match(/(\d+(?:[.,]\d+)?)\s*h\b/i);
  if (hours) return `${hours[1].replace(',', '.')} h`;
  const pct = item.description.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pct) return `${pct[1].replace(',', '.')}%`;
  if (slip.calendarDays && item.code.startsWith('FERIAS')) return `${slip.calendarDays} d`;
  return '—';
}

function renderClassicEmployeeBand(slip: PayrollPrintSlip, fields: PayslipFieldsConfig): string {
  const cod =
    fields.showInternalId && slip.controlNumber != null ? String(slip.controlNumber) : '—';
  const cbo = '—';
  const emp = '1';
  const meta = [
    fields.showPis && slip.pisPasep ? `PIS ${formatPis(slip.pisPasep)}` : null,
    slip.cpf ? `CPF ${formatCpf(slip.cpf)}` : null,
    fields.showAdmissionDate && slip.hiredAt ? `Adm. ${formatDatePtBR(slip.hiredAt)}` : null,
    slip.jobTitle ? slip.jobTitle : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return `
    <table class="classic-emp">
      <thead>
        <tr>
          <th>Código</th>
          <th class="emp-name">Nome do Funcionário</th>
          <th>CBO</th>
          <th>Emp.</th>
          <th>Local</th>
          <th>Depto.</th>
          <th>Setor</th>
          <th>Seção</th>
          <th>Fl.</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(cod)}</td>
          <td class="emp-name"><strong>${escapeHtml(slip.employeeName)}</strong>${meta ? `<span class="emp-meta">${escapeHtml(meta)}</span>` : ''}</td>
          <td>${escapeHtml(cbo)}</td>
          <td>${emp}</td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td>1</td>
        </tr>
      </tbody>
    </table>`;
}

function renderClassicItemsTable(slip: PayrollPrintSlip): string {
  const earningRows = slip.earnings.map(
    (i) =>
      `<tr>
        <td class="cod">${escapeHtml(i.code)}</td>
        <td class="desc">${escapeHtml(classicDescription(i))}</td>
        <td class="ref">${escapeHtml(referenceForLine(i, slip))}</td>
        <td class="amt venc">${formatMoneyPtBR(i.amount)}</td>
        <td class="amt desc-val muted-dash">—</td>
      </tr>`,
  );
  const deductionRows = slip.deductionItems.map(
    (i) =>
      `<tr>
        <td class="cod">${escapeHtml(i.code)}</td>
        <td class="desc">${escapeHtml(classicDescription(i))}</td>
        <td class="ref">${escapeHtml(referenceForLine(i, slip))}</td>
        <td class="amt venc muted-dash">—</td>
        <td class="amt desc-val">${formatMoneyPtBR(i.amount)}</td>
      </tr>`,
  );
  const body =
    earningRows.length || deductionRows.length
      ? [...earningRows, ...deductionRows].join('')
      : `<tr><td colspan="5" class="muted">Sem lançamentos na competência</td></tr>`;

  return `
    <table class="classic-items">
      <thead>
        <tr>
          <th class="cod">Cód.</th>
          <th class="desc">Descrição</th>
          <th class="ref">Referência</th>
          <th class="amt">Vencimentos</th>
          <th class="amt">Descontos</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function renderClassicTotals(slip: PayrollPrintSlip): string {
  return `
    <div class="classic-totals-wrap">
      <div class="classic-totals-spacer" aria-hidden="true"></div>
      <table class="classic-totals">
        <tbody>
          <tr>
            <td>Total de Vencimentos</td>
            <td class="amt venc">${formatMoneyPtBR(slip.totalEarnings)}</td>
          </tr>
          <tr class="row-deductions">
            <td>Total de Descontos</td>
            <td class="amt desc-val">${formatMoneyPtBR(slip.totalDeductionItems)}</td>
          </tr>
          <tr class="row-liquid">
            <td>Valor Líquido</td>
            <td class="amt liquid">${formatMoneyPtBR(slip.netPay)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function renderClassicBasesFooter(slip: PayrollPrintSlip, fields: PayslipFieldsConfig): string {
  const bases = slip.taxBases;
  const gross = bases?.grossRemuneration ?? slip.grossRemuneration ?? slip.totalEarnings;
  const inssBase = bases?.inssBase ?? gross;
  const fgtsBase = bases?.fgtsBase ?? gross;
  const irrfBase = bases?.irrfBase ?? 0;
  const faixa = irrfFaixaLabel(irrfBase);
  const depNote =
    fields.showIrrfDependents && bases && bases.irrfDependents > 0
      ? `<p class="classic-bases-note">Dependentes IRRF: ${bases.irrfDependents}${slip.taxTablesLabel ? ` · ${escapeHtml(slip.taxTablesLabel)}` : ''}</p>`
      : slip.taxTablesLabel
        ? `<p class="classic-bases-note">${escapeHtml(slip.taxTablesLabel)}</p>`
        : '';

  return `
    <table class="classic-bases">
      <thead>
        <tr>
          <th>Salário Base</th>
          <th>Sal. Contr. INSS</th>
          <th>Base Cálc. FGTS</th>
          <th>FGTS do Mês</th>
          <th>Base Cálc. IRRF</th>
          <th>Faixa IRRF</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${formatMoneyPtBR(slip.baseSalary)}</td>
          <td>${formatMoneyPtBR(inssBase)}</td>
          <td>${formatMoneyPtBR(fgtsBase)}</td>
          <td>${formatMoneyPtBR(bases?.fgtsEmployer ?? slip.fgtsEmployer ?? 0)}</td>
          <td>${formatMoneyPtBR(irrfBase)}</td>
          <td>${escapeHtml(faixa)}</td>
        </tr>
      </tbody>
    </table>
    ${depNote}`;
}

function renderSlip(
  slip: PayrollPrintSlip,
  yearMonth: string,
  companyLine: string,
  opts: {
    companyAddressLine?: string;
    fields: PayslipFieldsConfig;
    paymentDate?: string | null;
  },
): string {
  const { fields } = opts;
  const addressBlock =
    fields.showCompanyAddressOnSlip && opts.companyAddressLine
      ? `<p class="employer-addr">${escapeHtml(opts.companyAddressLine)}</p>`
      : '';
  const bankLine =
    fields.showBankPayment && (slip.bankCode || slip.bankAccount)
      ? `<p class="holerite-extra">Crédito: ${escapeHtml([slip.bankCode, slip.bankAgency, slip.bankAccount, slip.bankAccountDigit].filter(Boolean).join(' / '))}</p>`
      : '';
  const payLine =
    fields.showPaymentDate && opts.paymentDate
      ? `<p class="holerite-extra">Pagamento: ${escapeHtml(formatDatePtBR(opts.paymentDate))}</p>`
      : '';
  const daysLine =
    fields.showWorkDaysReference && slip.calendarDays
      ? `<p class="holerite-extra">Referência: ${slip.calendarDays} dias no mês</p>`
      : '';

  return `
  <section class="holerite holerite-classic">
    <header class="holerite-head">
      <div>
        <p class="doc-type">Recibo de pagamento de salário</p>
        <p class="competencia">Competência ${escapeHtml(formatYearMonthPtBR(yearMonth))}</p>
      </div>
      <div class="employer">${escapeHtml(companyLine)}${addressBlock}${bankLine}${payLine}${daysLine}</div>
    </header>
    ${renderClassicEmployeeBand(slip, fields)}
    ${renderClassicItemsTable(slip)}
    ${renderClassicTotals(slip)}
    ${
      slip.withdrawalDetailAppendix && slip.withdrawalDetailAppendix.length > 0
        ? `<div class="withdrawal-appendix">
      <p class="appendix-title">Detalhamento — retirada de produtos</p>
      <table class="classic-items appendix-table">
        <thead><tr><th class="cod">Cód.</th><th class="desc">Descrição</th><th class="ref">Ref.</th><th class="amt">Vencimentos</th><th class="amt">Descontos</th></tr></thead>
        <tbody>
          ${slip.withdrawalDetailAppendix
            .map(
              (i) =>
                `<tr><td class="cod">${escapeHtml(i.code)}</td><td class="desc">${escapeHtml(i.description)}</td><td class="ref">—</td><td class="amt muted-dash">—</td><td class="amt desc-val">${formatMoneyPtBR(i.amount)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`
        : ''
    }
    ${renderClassicBasesFooter(slip, fields)}
    <p class="sign">Declaro ter recebido a importância líquida acima discriminada.</p>
    <div class="sign-line">Assinatura do funcionário</div>
  </section>`;
}

type PayrollPrintBodyParts = {
  doc: PayrollPrintDocument;
  displayName: string;
  addressParts: string;
  generated: string;
  statusLabel: string;
  summaryRows: string;
  slipsHtml: string;
  companyLegalName: string;
};

function buildPayrollPrintBodyInner(parts: PayrollPrintBodyParts): string {
  const { doc, addressParts, generated, statusLabel, summaryRows, slipsHtml, companyLegalName } =
    parts;
  const logoHtml = doc.logoDataUrl
    ? `<img class="cover-logo" src="${doc.logoDataUrl.replace(/"/g, '&quot;')}" alt="" />`
    : '';
  return `
  <div class="cover">
    <div class="cover-head">${logoHtml}<div><h1>Folha de pagamento — ${escapeHtml(formatYearMonthPtBR(doc.run.yearMonth))}</h1>
    <p class="legal">${escapeHtml(companyLegalName)}${addressParts ? ` · ${escapeHtml(addressParts)}` : ''}</p></div></div>
    <div class="meta">
      <span>Status da competência: <strong>${escapeHtml(statusLabel)}</strong></span>
      <span>Funcionários: <strong>${doc.summary.headcount}</strong></span>
      <span>Emitido em: ${escapeHtml(generated)}</span>
    </div>
  </div>

  <p class="section-title">Resumo da folha</p>
  <table class="summary">
    <thead>
      <tr>
        <th>Funcionário</th>
        <th class="num">Salário base</th>
        <th class="num">Adicionais</th>
        <th class="num">Descontos</th>
        <th class="num">Líquido</th>
      </tr>
    </thead>
    <tbody>${summaryRows}</tbody>
    <tfoot>
      <tr>
        <td>Totais</td>
        <td class="num">${formatMoneyPtBR(doc.summary.totalBase)}</td>
        <td class="num">${formatMoneyPtBR(doc.summary.totalAdditions)}</td>
        <td class="num">${formatMoneyPtBR(doc.summary.totalDeductions)}</td>
        <td class="num strong">${formatMoneyPtBR(doc.summary.totalNet)}</td>
      </tr>
    </tfoot>
  </table>

  <p class="section-title">Demonstrativos individuais (holerites)</p>
  ${slipsHtml}
`;
}

/** Margens imprimíveis A4 (20 mm — padrão usual em documentos corporativos no Brasil). */
export const PAYROLL_A4_MARGIN_MM = 20;

export const PAYROLL_PRINT_STYLES = `
    * { box-sizing: border-box; }
    @page {
      size: A4 portrait;
      margin: ${PAYROLL_A4_MARGIN_MM}mm;
    }
    html, body { margin: 0; padding: 0; }
    .payroll-print-page {
      min-height: 100vh;
      background: #e2e8f0;
      padding: 16px;
    }
    .payroll-print-sheet {
      width: 210mm;
      max-width: 100%;
      min-height: 297mm;
      margin: 0 auto;
      padding: ${PAYROLL_A4_MARGIN_MM}mm;
      background: #ffffff;
      box-shadow: 0 4px 24px rgba(15, 23, 42, 0.12);
    }
    .payroll-print-root,
    .payroll-print-root * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .payroll-print-root { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.35; }
    .cover { border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 20px; }
    .cover-head { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
    .cover-logo { max-height: 80px; max-width: 200px; object-fit: contain; }
    .cover h1 { margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #0f766e; }
    .cover .legal { font-size: 12px; color: #475569; margin: 0; }
    .cover .meta { margin-top: 8px; font-size: 10px; color: #64748b; display: flex; flex-wrap: wrap; gap: 12px 24px; }
    .summary { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 11px; }
    .summary th, .summary td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    .summary th { background: #f1f5f9; font-weight: 600; }
    .summary .num { text-align: right; white-space: nowrap; }
    .summary .strong { font-weight: 700; }
    .summary tfoot td { background: #ecfdf5; font-weight: 700; }
    .section-title { font-size: 13px; font-weight: 700; margin: 24px 0 12px; color: #334155; }
    .holerite { border: 1px solid #7cb87c; border-radius: 2px; padding: 10px 12px; margin-bottom: 20px; page-break-inside: avoid; background: #fff; }
    .holerite-classic { --hol-green: #b8ddb8; --hol-green-dark: #6b9e6b; --hol-red: #c0392b; }
    .holerite-head { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--hol-green-dark); padding-bottom: 6px; margin-bottom: 8px; }
    .doc-type { margin: 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #2d5016; }
    .competencia { margin: 2px 0 0; font-size: 13px; font-weight: 700; color: #1a3d0a; }
    .employer { text-align: right; font-size: 9px; color: #334155; max-width: 52%; }
    .employer-addr, .holerite-extra { margin: 3px 0 0; font-size: 9px; color: #475569; line-height: 1.3; }
    .print-warnings { margin-bottom: 12px; padding: 8px 10px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; font-size: 11px; color: #92400e; }
    .classic-emp, .classic-items, .classic-bases, .classic-totals { width: 100%; border-collapse: collapse; font-size: 10px; }
    .classic-emp { margin-bottom: 0; border: 1px solid var(--hol-green-dark); }
    .classic-emp th { background: var(--hol-green); color: #1a3d0a; font-weight: 600; padding: 3px 5px; border: 1px solid var(--hol-green-dark); font-size: 8px; text-align: center; }
    .classic-emp td { padding: 4px 5px; border: 1px solid var(--hol-green-dark); text-align: center; vertical-align: middle; }
    .classic-emp .emp-name { text-align: left; min-width: 28%; }
    .classic-emp .emp-meta { display: block; font-size: 8px; font-weight: 400; color: #475569; margin-top: 2px; }
    .classic-items { border: 1px solid var(--hol-green-dark); border-top: none; margin-bottom: 0; }
    .classic-items th { background: var(--hol-green); color: #1a3d0a; font-weight: 600; padding: 4px 6px; border: 1px solid var(--hol-green-dark); }
    .classic-items th.amt, .classic-items td.amt { text-align: right; }
    .classic-items td { padding: 3px 6px; border: 1px solid #c5dcc5; vertical-align: top; }
    .classic-items .cod { width: 9%; text-align: center; font-size: 9px; color: #475569; }
    .classic-items .desc { width: 38%; text-align: left; }
    .classic-items .ref { width: 12%; text-align: center; color: #475569; }
    .classic-items .venc { color: #1a3d0a; font-variant-numeric: tabular-nums; }
    .classic-items .desc-val { color: var(--hol-red); font-weight: 600; font-variant-numeric: tabular-nums; }
    .classic-items .muted-dash { color: #94a3b8; text-align: center; font-weight: 400; }
    .classic-items .muted { text-align: center; color: #94a3b8; font-style: italic; padding: 8px; }
    .classic-totals-wrap { display: flex; border-left: 1px solid var(--hol-green-dark); border-right: 1px solid var(--hol-green-dark); }
    .classic-totals-spacer { flex: 1; min-height: 1px; border-bottom: 1px solid #c5dcc5; }
    .classic-totals { width: 42%; border-collapse: collapse; margin-left: auto; }
    .classic-totals td { padding: 4px 8px; border: 1px solid #c5dcc5; border-top: none; }
    .classic-totals td:first-child { text-align: right; font-weight: 600; background: #f4faf4; }
    .classic-totals .venc { text-align: right; font-variant-numeric: tabular-nums; }
    .classic-totals .row-deductions .desc-val { color: var(--hol-red); font-weight: 700; text-align: right; }
    .classic-totals .row-liquid td { background: var(--hol-green); border-top: 2px solid var(--hol-green-dark); font-weight: 700; }
    .classic-totals .liquid { text-align: right; font-size: 13px; color: #1a3d0a; font-variant-numeric: tabular-nums; }
    .classic-bases { margin-top: 0; border: 1px solid var(--hol-green-dark); border-top: 2px solid var(--hol-green-dark); }
    .classic-bases th { background: var(--hol-green); color: #1a3d0a; font-size: 8px; font-weight: 600; padding: 4px 4px; border: 1px solid var(--hol-green-dark); text-align: center; }
    .classic-bases td { padding: 5px 4px; border: 1px solid var(--hol-green-dark); text-align: center; font-variant-numeric: tabular-nums; font-weight: 600; }
    .classic-bases-note { margin: 4px 0 0; font-size: 8px; color: #64748b; text-align: right; }
    .withdrawal-appendix { margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--hol-green-dark); }
    .appendix-title { font-size: 9px; font-weight: 600; color: #475569; margin: 0 0 4px; }
    .sign { margin: 12px 0 28px; font-size: 9px; color: #64748b; }
    .sign-line { border-top: 1px solid #334155; width: 220px; text-align: center; font-size: 9px; color: #64748b; padding-top: 4px; margin-bottom: 8px; }
    @media print {
      html, body {
        width: 100%;
        height: auto;
        background: #ffffff !important;
      }
      .payroll-print-page {
        background: #ffffff !important;
        padding: 0 !important;
        min-height: auto;
      }
      .payroll-print-sheet {
        width: auto !important;
        max-width: none !important;
        min-height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        background: #ffffff !important;
      }
      .no-print { display: none !important; }
      .payroll-view-toolbar { display: none !important; }
      .cover { border-bottom-color: #0f766e !important; }
      .summary th { background: #f1f5f9 !important; }
      .summary tfoot td { background: #ecfdf5 !important; }
      .classic-emp th, .classic-items th, .classic-bases th, .classic-totals .row-liquid td { background: #b8ddb8 !important; }
      .holerite-classic .desc-val { color: #c0392b !important; }
      .holerite {
        page-break-inside: avoid;
        break-inside: avoid;
        border-color: #94a3b8 !important;
        background: #ffffff !important;
      }
      .section-title { page-break-after: avoid; }
      .summary { page-break-inside: avoid; }
    }
    .payroll-view-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .payroll-view-toolbar .actions { display: flex; gap: 8px; }
`;

function compilePayrollPrintBody(doc: PayrollPrintDocument): string {
  const c = doc.company;
  const displayName = c?.tradeName?.trim() || c?.legalName || 'Empresa';
  const addressParts = [c?.address, c?.city, c?.state, c?.zipCode].filter(Boolean).join(' — ');
  const generated = new Date(doc.generatedAt).toLocaleString('pt-BR');
  const statusLabel = doc.run.status === 'CLOSED' ? 'Fechada' : 'Em aberto';
  const companyLine = c ? `${displayName} · CNPJ ${formatCnpj(c.cnpj)}` : 'Empresa';
  const companyAddressLine = addressParts;
  const fields = resolvePayslipFields(doc);

  const summaryRows = doc.slips
    .map(
      (s) =>
        `<tr>
          <td>${escapeHtml(s.employeeName)}</td>
          <td class="num">${formatMoneyPtBR(s.baseSalary)}</td>
          <td class="num">${formatMoneyPtBR(s.additions)}</td>
          <td class="num">${formatMoneyPtBR(s.deductions)}</td>
          <td class="num strong">${formatMoneyPtBR(s.netPay)}</td>
        </tr>`,
    )
    .join('');

  const slipsHtml = doc.slips
    .map((s) =>
      renderSlip(s, doc.run.yearMonth, companyLine, {
        companyAddressLine,
        fields,
        paymentDate: doc.run.paymentDate,
      }),
    )
    .join('');

  const warningsHtml =
    doc.printWarnings && doc.printWarnings.length
      ? `<div class="print-warnings no-print-slip"><p><strong>Avisos:</strong> ${doc.printWarnings.map((w) => escapeHtml(w)).join(' · ')}</p></div>`
      : '';

  return (
    warningsHtml +
    buildPayrollPrintBodyInner({
      doc,
      displayName,
      addressParts,
      generated,
      statusLabel,
      summaryRows,
      slipsHtml,
      companyLegalName: c?.legalName ?? displayName,
    })
  );
}

export function buildPayrollPrintBody(doc: PayrollPrintDocument): string {
  return compilePayrollPrintBody(doc);
}

export function buildPayrollPrintHtml(doc: PayrollPrintDocument): string {
  const c = doc.company;
  const displayName = c?.tradeName?.trim() || c?.legalName || 'Empresa';
  const body = compilePayrollPrintBody(doc);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Folha ${escapeHtml(doc.run.yearMonth)} — ${escapeHtml(displayName)}</title>
  <style>${PAYROLL_PRINT_STYLES}</style>
</head>
<body class="payroll-print-page">
  <div class="payroll-print-sheet">
    <div class="payroll-print-root">
  ${body}
    </div>
  </div>
  <p class="no-print" style="margin-top:24px;font-size:10px;color:#64748b;">Use Ctrl+P ou o diálogo de impressão do navegador. Cada holerite evita quebra no meio da página.</p>
</body>
</html>`;
}

export function openPayrollPrintWindow(doc: PayrollPrintDocument): void {
  const html = buildPayrollPrintHtml(doc).replace(
    '</body>',
    '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},200)})</script></body>',
  );
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  navigateToReportPrint(URL.createObjectURL(blob));
}
