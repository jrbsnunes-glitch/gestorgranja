/** Tabelas INSS/IRRF por competência (AAAA-MM). Fontes: Portaria MPS/MF e Receita Federal. */

export type InssBracket = { upTo: number; rate: number };

export type IrrfBracket = { upTo: number; rate: number; deduction: number };

export type PayrollTaxTables = {
  label: string;
  inssBrackets: InssBracket[];
  inssCeiling: number;
  irrfBrackets: IrrfBracket[];
  dependentDeduction: number;
  simplifiedMonthlyDeduction: number;
  fgtsRate: number;
};

const INSS_2025: InssBracket[] = [
  { upTo: 1518, rate: 0.075 },
  { upTo: 2793.88, rate: 0.09 },
  { upTo: 4190.83, rate: 0.12 },
  { upTo: 8157.41, rate: 0.14 },
];

const INSS_2026: InssBracket[] = [
  { upTo: 1621, rate: 0.075 },
  { upTo: 2902.84, rate: 0.09 },
  { upTo: 4354.27, rate: 0.12 },
  { upTo: 8475.55, rate: 0.14 },
];

/** IRRF mensal — vigência a partir de maio/2025 (mantido para 2026 até nova publicação). */
const IRRF_FROM_2025_05: IrrfBracket[] = [
  { upTo: 2428.8, rate: 0, deduction: 0 },
  { upTo: 2826.65, rate: 0.075, deduction: 182.16 },
  { upTo: 3751.05, rate: 0.15, deduction: 394.16 },
  { upTo: 4664.68, rate: 0.225, deduction: 675.49 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.275, deduction: 908.73 },
];

const IRRF_2025_01_04: IrrfBracket[] = [
  { upTo: 2259.2, rate: 0, deduction: 0 },
  { upTo: 2826.65, rate: 0.075, deduction: 169.44 },
  { upTo: 3751.05, rate: 0.15, deduction: 381.44 },
  { upTo: 4664.68, rate: 0.225, deduction: 662.77 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.275, deduction: 896 },
];

function compareYearMonth(a: string, b: string): number {
  return a.localeCompare(b);
}

export function payrollTaxTablesForCompetence(yearMonth: string): PayrollTaxTables {
  const dependentDeduction = 189.59;
  const fgtsRate = 0.08;

  if (compareYearMonth(yearMonth, '2026-01') >= 0) {
    return {
      label: 'INSS 2026 (Portaria MPS/MF nº 13/2026) · IRRF maio/2025',
      inssBrackets: INSS_2026,
      inssCeiling: 8475.55,
      irrfBrackets: IRRF_FROM_2025_05,
      dependentDeduction,
      simplifiedMonthlyDeduction: 607.2,
      fgtsRate,
    };
  }

  if (compareYearMonth(yearMonth, '2025-05') >= 0) {
    return {
      label: 'INSS 2025 · IRRF maio/2025',
      inssBrackets: INSS_2025,
      inssCeiling: 8157.41,
      irrfBrackets: IRRF_FROM_2025_05,
      dependentDeduction,
      simplifiedMonthlyDeduction: 607.2,
      fgtsRate,
    };
  }

  if (compareYearMonth(yearMonth, '2025-01') >= 0) {
    return {
      label: 'INSS 2025 · IRRF jan–abr/2025',
      inssBrackets: INSS_2025,
      inssCeiling: 8157.41,
      irrfBrackets: IRRF_2025_01_04,
      dependentDeduction,
      simplifiedMonthlyDeduction: 564.8,
      fgtsRate,
    };
  }

  return {
    label: 'INSS 2025 (referência) · IRRF maio/2025',
    inssBrackets: INSS_2025,
    inssCeiling: 8157.41,
    irrfBrackets: IRRF_FROM_2025_05,
    dependentDeduction,
    simplifiedMonthlyDeduction: 607.2,
    fgtsRate,
  };
}

export function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

/** INSS empregado — alíquotas progressivas por faixa. */
export function calcEmployeeInss(grossRemuneration: number, tables: PayrollTaxTables): number {
  const base = Math.max(0, Math.min(grossRemuneration, tables.inssCeiling));
  let total = 0;
  let prev = 0;
  for (const band of tables.inssBrackets) {
    if (base <= prev) break;
    const slice = Math.min(base, band.upTo) - prev;
    if (slice > 0) total += slice * band.rate;
    prev = band.upTo;
  }
  return roundMoney(total);
}

export function calcIrrfOnBase(taxableBase: number, brackets: IrrfBracket[]): number {
  const base = Math.max(0, taxableBase);
  for (const row of brackets) {
    if (base <= row.upTo) {
      if (row.rate === 0) return 0;
      return roundMoney(Math.max(0, base * row.rate - row.deduction));
    }
  }
  return 0;
}

export type IrrfRegime = 'STANDARD' | 'SIMPLIFIED';

export type PayrollTaxBases = {
  grossRemuneration: number;
  inssBase: number;
  inss: number;
  irrfBase: number;
  irrf: number;
  irrfRegime: IrrfRegime;
  irrfDependents: number;
  fgtsBase: number;
  fgtsEmployer: number;
};

export function calcEmployeeIrrfDetail(
  grossRemuneration: number,
  inss: number,
  dependents: number,
  tables: PayrollTaxTables,
): { irrf: number; irrfBase: number; irrfRegime: IrrfRegime; irrfDependents: number } {
  const dep = Math.max(0, Math.floor(dependents));
  const afterInss = Math.max(0, grossRemuneration - inss);
  const baseStandard = Math.max(0, afterInss - dep * tables.dependentDeduction);
  const baseSimplified = Math.max(0, afterInss - tables.simplifiedMonthlyDeduction);
  const irrfStandard = calcIrrfOnBase(baseStandard, tables.irrfBrackets);
  const irrfSimplified = calcIrrfOnBase(baseSimplified, tables.irrfBrackets);
  if (irrfSimplified < irrfStandard) {
    return {
      irrf: irrfSimplified,
      irrfBase: baseSimplified,
      irrfRegime: 'SIMPLIFIED',
      irrfDependents: dep,
    };
  }
  return {
    irrf: irrfStandard,
    irrfBase: baseStandard,
    irrfRegime: 'STANDARD',
    irrfDependents: dep,
  };
}

export function calcEmployeeIrrf(
  grossRemuneration: number,
  inss: number,
  dependents: number,
  tables: PayrollTaxTables,
): number {
  return calcEmployeeIrrfDetail(grossRemuneration, inss, dependents, tables).irrf;
}

export type RubricIncidence = {
  integratesInss: boolean;
  integratesFgts: boolean;
  integratesIrrf: boolean;
};

export function sumIntegratingAmount(
  contractualBase: number,
  earnings: { code: string; amount: number }[],
  rubrics: Map<string, RubricIncidence>,
  field: keyof RubricIncidence,
): number {
  let total = contractualBase;
  for (const e of earnings) {
    const r = rubrics.get(e.code);
    const integrates = r ? r[field] : true;
    if (integrates) total += e.amount;
  }
  return roundMoney(total);
}

/** Impostos com bases por incidência de rubrica (ajuda de custo etc.). */
export function calcPayrollTaxBasesFromEarnings(
  contractualBase: number,
  earnings: { code: string; amount: number }[],
  rubrics: Map<string, RubricIncidence>,
  yearMonth: string,
  dependents: number,
): PayrollTaxBases {
  const tables = payrollTaxTablesForCompetence(yearMonth);
  const inssGross = sumIntegratingAmount(contractualBase, earnings, rubrics, 'integratesInss');
  const irrfGross = sumIntegratingAmount(contractualBase, earnings, rubrics, 'integratesIrrf');
  const fgtsGross = sumIntegratingAmount(contractualBase, earnings, rubrics, 'integratesFgts');
  const inss = calcEmployeeInss(inssGross, tables);
  const irrfDetail = calcEmployeeIrrfDetail(irrfGross, inss, dependents, tables);
  let irrf = irrfDetail.irrf;
  if (compareYearMonth(yearMonth, '2026-01') >= 0 && irrfDetail.irrfBase <= 5000) {
    irrf = 0;
  }
  const grossDisplay = roundMoney(Math.max(0, contractualBase + earnings.reduce((s, e) => s + e.amount, 0)));
  return {
    grossRemuneration: grossDisplay,
    inssBase: roundMoney(Math.min(inssGross, tables.inssCeiling)),
    inss,
    irrfBase: irrfDetail.irrfBase,
    irrf,
    irrfRegime: irrfDetail.irrfRegime,
    irrfDependents: irrfDetail.irrfDependents,
    fgtsBase: fgtsGross,
    fgtsEmployer: calcEmployerFgts(fgtsGross, tables),
  };
}

export function calcPayrollTaxBases(
  grossRemuneration: number,
  yearMonth: string,
  dependents: number,
): PayrollTaxBases {
  const tables = payrollTaxTablesForCompetence(yearMonth);
  const gross = roundMoney(Math.max(0, grossRemuneration));
  const inssBase = roundMoney(Math.min(gross, tables.inssCeiling));
  const inss = calcEmployeeInss(gross, tables);
  const irrfDetail = calcEmployeeIrrfDetail(gross, inss, dependents, tables);
  let irrf = irrfDetail.irrf;
  if (compareYearMonth(yearMonth, '2026-01') >= 0 && irrfDetail.irrfBase <= 5000) {
    irrf = 0;
  }
  const fgtsBase = gross;
  const fgtsEmployer = calcEmployerFgts(gross, tables);
  return {
    grossRemuneration: gross,
    inssBase,
    inss,
    irrfBase: irrfDetail.irrfBase,
    irrf,
    irrfRegime: irrfDetail.irrfRegime,
    irrfDependents: irrfDetail.irrfDependents,
    fgtsBase,
    fgtsEmployer,
  };
}

export function calcEmployerFgts(grossRemuneration: number, tables: PayrollTaxTables): number {
  return roundMoney(Math.max(0, grossRemuneration) * tables.fgtsRate);
}

export function calcEmployeePayrollTaxes(
  grossRemuneration: number,
  yearMonth: string,
  dependents: number,
): {
  inss: number;
  irrf: number;
  fgtsEmployer: number;
  tables: PayrollTaxTables;
} {
  const tables = payrollTaxTablesForCompetence(yearMonth);
  const inss = calcEmployeeInss(grossRemuneration, tables);
  const irrf = calcEmployeeIrrf(grossRemuneration, inss, dependents, tables);
  const fgtsEmployer = calcEmployerFgts(grossRemuneration, tables);
  return { inss, irrf, fgtsEmployer, tables };
}

export type PayrollDeductionLine = { code: string; description: string; amount: number };

function statutoryDeductionLinesFromAmounts(
  inss: number,
  irrf: number,
  fgtsEmployer: number,
  tables: PayrollTaxTables,
  dependents: number,
): PayrollDeductionLine[] {
  const lines: PayrollDeductionLine[] = [];
  const inssLabel = tables.label.split('·')[0]?.trim() ?? 'previdência';
  if (inss > 0) {
    lines.push({
      code: 'INSS',
      description: `INSS — ${inssLabel}`,
      amount: inss,
    });
  }
  if (irrf > 0) {
    lines.push({
      code: 'IRRF',
      description:
        dependents > 0
          ? `IRRF — imposto de renda (${dependents} dependente(s))`
          : 'IRRF — imposto de renda retido na fonte',
      amount: irrf,
    });
  }
  return lines;
}

/** Linhas INSS/IRRF com incidência por rubrica. */
export function buildStatutoryDeductionLinesFromEarnings(
  contractualBase: number,
  earnings: { code: string; amount: number }[],
  rubrics: Map<string, RubricIncidence>,
  yearMonth: string,
  dependents: number,
): {
  lines: PayrollDeductionLine[];
  inss: number;
  irrf: number;
  fgtsEmployer: number;
  tables: PayrollTaxTables;
  taxBases: PayrollTaxBases;
} {
  const tables = payrollTaxTablesForCompetence(yearMonth);
  const taxBases = calcPayrollTaxBasesFromEarnings(
    contractualBase,
    earnings,
    rubrics,
    yearMonth,
    dependents,
  );
  const lines = statutoryDeductionLinesFromAmounts(
    taxBases.inss,
    taxBases.irrf,
    taxBases.fgtsEmployer,
    tables,
    dependents,
  );
  return {
    lines,
    inss: taxBases.inss,
    irrf: taxBases.irrf,
    fgtsEmployer: taxBases.fgtsEmployer,
    tables,
    taxBases,
  };
}

/** Linhas INSS/IRRF para folha ou impressão (sempre recalculadas pela competência). */
export function buildStatutoryDeductionLines(
  grossRemuneration: number,
  yearMonth: string,
  dependents: number,
): {
  lines: PayrollDeductionLine[];
  inss: number;
  irrf: number;
  fgtsEmployer: number;
  tables: PayrollTaxTables;
} {
  const { inss, irrf, fgtsEmployer, tables } = calcEmployeePayrollTaxes(
    grossRemuneration,
    yearMonth,
    dependents,
  );
  const taxBases = calcPayrollTaxBases(grossRemuneration, yearMonth, dependents);
  const lines = statutoryDeductionLinesFromAmounts(inss, taxBases.irrf, fgtsEmployer, tables, dependents);
  return { lines, inss, irrf: taxBases.irrf, fgtsEmployer, tables };
}

/** Impostos recalculados + demais descontos já lançados na linha. */
export function mergePayrollDeductionsForDisplay(
  storedDeductions: PayrollDeductionLine[],
  grossRemuneration: number,
  yearMonth: string,
  dependents: number,
): {
  deductionItems: PayrollDeductionLine[];
  totalDeductionItems: number;
  netPay: number;
  inss: number;
  irrf: number;
  fgtsEmployer: number;
  taxTablesLabel: string;
  grossRemuneration: number;
  taxBases: PayrollTaxBases;
} {
  const statutory = buildStatutoryDeductionLines(grossRemuneration, yearMonth, dependents);
  const taxBases = calcPayrollTaxBases(grossRemuneration, yearMonth, dependents);
  const other = storedDeductions.filter((i) => i.code !== 'INSS' && i.code !== 'IRRF');
  const deductionItems = [...statutory.lines, ...other];
  const totalDeductionItems = roundMoney(deductionItems.reduce((s, i) => s + i.amount, 0));
  const netPay = roundMoney(Math.max(0, grossRemuneration - totalDeductionItems));
  return {
    deductionItems,
    totalDeductionItems,
    netPay,
    inss: statutory.inss,
    irrf: statutory.irrf,
    fgtsEmployer: statutory.fgtsEmployer,
    taxTablesLabel: statutory.tables.label,
    grossRemuneration: roundMoney(grossRemuneration),
    taxBases,
  };
}

/** Ajusta exibição de RET_PROD no holerite (consolidado vs detalhado). Valores totais permanecem iguais. */
export function applyWithdrawalPayslipDisplay(
  deductionItems: PayrollDeductionLine[],
  detailOnSlip: boolean,
): { deductionItems: PayrollDeductionLine[]; withdrawalDetailAppendix: PayrollDeductionLine[] } {
  const withdrawalLines = deductionItems.filter((i) => i.code === 'RET_PROD');
  if (detailOnSlip || withdrawalLines.length === 0) {
    return { deductionItems, withdrawalDetailAppendix: [] };
  }
  const other = deductionItems.filter((i) => i.code !== 'RET_PROD');
  const total = roundMoney(withdrawalLines.reduce((s, i) => s + i.amount, 0));
  return {
    deductionItems: [
      ...other,
      {
        code: 'RET_PROD',
        description: `Retirada de produtos — ${withdrawalLines.length} item(ns) (consolidado)`,
        amount: total,
      },
    ],
    withdrawalDetailAppendix: withdrawalLines,
  };
}
