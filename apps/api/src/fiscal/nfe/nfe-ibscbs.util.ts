import { SefazEnvironment } from '../../generated/tenant-client';

export type IbscbsLineTotals = {
  vBC: number;
  vIBSUF: number;
  vIBSMun: number;
  vIBS: number;
  vCBS: number;
};

export type IbscbsNoteTotals = IbscbsLineTotals;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmtMoney(n: number) {
  return n.toFixed(2);
}

function fmtAliq(n: number) {
  return n.toFixed(4);
}

/** Alíquotas de teste 2026 (LC 214 — fase de transição). Sobrescreva via env na API. */
export function resolveRtcAliquots(): { pIbsUf: number; pIbsMun: number; pCbs: number } {
  const env = process.env;
  const pIbsUf = env.FISCAL_RTC_P_IBS_UF != null ? Number(env.FISCAL_RTC_P_IBS_UF) : 0.1;
  const pIbsMun = env.FISCAL_RTC_P_IBS_MUN != null ? Number(env.FISCAL_RTC_P_IBS_MUN) : 0;
  const pCbs = env.FISCAL_RTC_P_CBS != null ? Number(env.FISCAL_RTC_P_CBS) : 0.9;
  return {
    pIbsUf: Number.isFinite(pIbsUf) ? pIbsUf : 0.1,
    pIbsMun: Number.isFinite(pIbsMun) ? pIbsMun : 0,
    pCbs: Number.isFinite(pCbs) ? pCbs : 0.9,
  };
}

/**
 * UB12-10: grupo IBSCBS obrigatório em homologação (CRT 3, emissão ≥ 01/07/2026).
 * Simples/MEI: a partir de 04/01/2027 (homolog/prod conforme NT).
 */
export function requiresIbscbsGroup(params: {
  crt: number;
  environment: SefazEnvironment;
  emissionAt: Date;
}): boolean {
  if (process.env.FISCAL_RTC_IBSCBS_ALWAYS === '1') return true;

  const t = params.emissionAt.getTime();
  const jul2026 = Date.parse('2026-07-01T00:00:00-04:00');
  const aug2026 = Date.parse('2026-08-03T00:00:00-04:00');
  const jan2027 = Date.parse('2027-01-04T00:00:00-04:00');
  const crt = params.crt;

  // Homologação: grupo exigido para testes RTC (rejeição 1115) a partir de 01/07/2026.
  if (params.environment === 'homologacao' && t >= jul2026) return true;

  if (crt === 3 && params.environment === 'producao' && t >= aug2026) return true;
  if ((crt === 1 || crt === 2 || crt === 4) && t >= jan2027) return true;
  return false;
}

export function emptyIbscbsNoteTotals(): IbscbsNoteTotals {
  return { vBC: 0, vIBSUF: 0, vIBSMun: 0, vIBS: 0, vCBS: 0 };
}

export function addIbscbsLineTotals(acc: IbscbsNoteTotals, line: IbscbsLineTotals): IbscbsNoteTotals {
  return {
    vBC: round2(acc.vBC + line.vBC),
    vIBSUF: round2(acc.vIBSUF + line.vIBSUF),
    vIBSMun: round2(acc.vIBSMun + line.vIBSMun),
    vIBS: round2(acc.vIBS + line.vIBS),
    vCBS: round2(acc.vCBS + line.vCBS),
  };
}

/** Rejeição 1065: CST/cClassTrib com redução/isenção parcial exige grupo gTribRegular. */
function requiresGTribRegular(cst: string): boolean {
  if (cst === '410' || cst === '400') return false;
  if (cst === '200' || cst === '510' || cst === '515') return true;
  return /^2\d{2}$/.test(cst);
}

function resolveTribRegularCodes(): { cstReg: string; cClassTribReg: string } {
  const env = process.env;
  const cstReg = (env.FISCAL_RTC_CST_REG ?? '000').replace(/\D/g, '').padStart(3, '0').slice(-3);
  const cClassTribReg = (env.FISCAL_RTC_CLASS_TRIB_REG ?? '000001')
    .replace(/\D/g, '')
    .padStart(6, '0')
    .slice(-6);
  return { cstReg, cClassTribReg };
}

function buildGTribRegularXml(vBC: number): string {
  const { pIbsUf, pIbsMun, pCbs } = resolveRtcAliquots();
  const { cstReg, cClassTribReg } = resolveTribRegularCodes();
  const vRegIbsUf = round2((vBC * pIbsUf) / 100);
  const vRegIbsMun = round2((vBC * pIbsMun) / 100);
  const vRegCbs = round2((vBC * pCbs) / 100);
  return (
    `<gTribRegular>` +
    `<CSTReg>${cstReg}</CSTReg>` +
    `<cClassTribReg>${cClassTribReg}</cClassTribReg>` +
    `<pAliqEfetRegIBSUF>${fmtAliq(pIbsUf)}</pAliqEfetRegIBSUF>` +
    `<vTribRegIBSUF>${fmtMoney(vRegIbsUf)}</vTribRegIBSUF>` +
    `<pAliqEfetRegIBSMun>${fmtAliq(pIbsMun)}</pAliqEfetRegIBSMun>` +
    `<vTribRegIBSMun>${fmtMoney(vRegIbsMun)}</vTribRegIBSMun>` +
    `<pAliqEfetRegCBS>${fmtAliq(pCbs)}</pAliqEfetRegCBS>` +
    `<vTribRegCBS>${fmtMoney(vRegCbs)}</vTribRegCBS>` +
    `</gTribRegular>`
  );
}

export function buildItemIbscbsXml(params: {
  vProd: number;
  cst?: string | null;
  cClassTrib?: string | null;
  crt?: number;
}): { xml: string; line: IbscbsLineTotals } {
  const { pIbsUf, pIbsMun, pCbs } = resolveRtcAliquots();
  const isSimples = params.crt === 1 || params.crt === 2 || params.crt === 4;
  const defaultCst = isSimples ? '200' : '000';
  const defaultClass = isSimples ? '200022' : '000001';
  const cst = (params.cst ?? defaultCst).replace(/\D/g, '').padStart(3, '0').slice(-3);
  const cClassTrib = (params.cClassTrib ?? defaultClass).replace(/\D/g, '').padStart(6, '0').slice(-6);

  const vBC = round2(params.vProd);
  const useReducedZero =
    isSimples || cst === '200' || cst === '400' || cst === '410';
  const pUf = useReducedZero ? 0 : pIbsUf;
  const pMun = useReducedZero ? 0 : pIbsMun;
  const pCbsEff = useReducedZero ? 0 : pCbs;
  const vIBSUF = round2((vBC * pUf) / 100);
  const vIBSMun = round2((vBC * pMun) / 100);
  const vIBS = round2(vIBSUF + vIBSMun);
  const vCBS = round2((vBC * pCbsEff) / 100);

  const redBlock = useReducedZero
    ? `<gRed><pRedAliq>100.0000</pRedAliq><pAliqEfet>0.0000</pAliqEfet></gRed>`
    : '';

  const tribRegularBlock =
    useReducedZero && requiresGTribRegular(cst) ? buildGTribRegularXml(vBC) : '';

  const xml =
    `<IBSCBS>` +
    `<CST>${cst}</CST>` +
    `<cClassTrib>${cClassTrib}</cClassTrib>` +
    `<gIBSCBS>` +
    `<vBC>${fmtMoney(vBC)}</vBC>` +
    `<gIBSUF><pIBSUF>${fmtAliq(pUf)}</pIBSUF>${redBlock}<vIBSUF>${fmtMoney(vIBSUF)}</vIBSUF></gIBSUF>` +
    `<gIBSMun><pIBSMun>${fmtAliq(pMun)}</pIBSMun>${redBlock}<vIBSMun>${fmtMoney(vIBSMun)}</vIBSMun></gIBSMun>` +
    `<vIBS>${fmtMoney(vIBS)}</vIBS>` +
    `<gCBS><pCBS>${fmtAliq(pCbsEff)}</pCBS>${redBlock}<vCBS>${fmtMoney(vCBS)}</vCBS></gCBS>` +
    tribRegularBlock +
    `</gIBSCBS>` +
    `</IBSCBS>`;

  return { xml, line: { vBC, vIBSUF, vIBSMun, vIBS, vCBS } };
}

export function buildIbscbsTotXml(tot: IbscbsNoteTotals): string {
  return (
    `<IBSCBSTot>` +
    `<vBCIBSCBS>${fmtMoney(tot.vBC)}</vBCIBSCBS>` +
    `<gIBS>` +
    `<gIBSUF><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vIBSUF>${fmtMoney(tot.vIBSUF)}</vIBSUF></gIBSUF>` +
    `<gIBSMun><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vIBSMun>${fmtMoney(tot.vIBSMun)}</vIBSMun></gIBSMun>` +
    `<vIBS>${fmtMoney(tot.vIBS)}</vIBS>` +
    `<vCredPres>0.00</vCredPres>` +
    `<vCredPresCondSus>0.00</vCredPresCondSus>` +
    `</gIBS>` +
    `<gCBS>` +
    `<vDif>0.00</vDif>` +
    `<vDevTrib>0.00</vDevTrib>` +
    `<vCBS>${fmtMoney(tot.vCBS)}</vCBS>` +
    `<vCredPres>0.00</vCredPres>` +
    `<vCredPresCondSus>0.00</vCredPresCondSus>` +
    `</gCBS>` +
    `</IBSCBSTot>`
  );
}
