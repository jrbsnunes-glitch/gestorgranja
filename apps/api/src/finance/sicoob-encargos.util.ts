import { clip, isoDateOnly } from './sicoob-json.util';

/** Campos de encargos usados na emissão e no layout (subset de SicoobCobrancaSettings). */
export type SicoobEncargosConfig = {
  tipoMulta: number;
  tipoJurosMora: number;
  valorMulta: { toString(): string } | number | null;
  valorJurosMora: { toString(): string } | number | null;
  diasInicioMultaAposVencimento: number;
  diasInicioJurosAposVencimento: number;
  diasLimitePagamentoAposVencimento: number | null;
  encargosNasInstrucoes: boolean;
};

export type SicoobEncargosPayload = {
  tipoMulta: number;
  tipoJurosMora: number;
  dataMulta?: string;
  valorMulta?: number;
  dataJurosMora?: string;
  valorJurosMora?: number;
  dataLimitePagamento?: string;
};

function addDaysIso(vencIso: string, days: number): string {
  const d = new Date(`${vencIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDateOnly(d);
}

function num(v: { toString(): string } | number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function validateEncargosConfig(cfg: SicoobEncargosConfig): void {
  if (cfg.tipoMulta !== 0 && cfg.tipoMulta !== 1 && cfg.tipoMulta !== 2) {
    throw new Error('Tipo de multa inválido (0, 1 ou 2).');
  }
  if (cfg.tipoJurosMora !== 1 && cfg.tipoJurosMora !== 2 && cfg.tipoJurosMora !== 3) {
    throw new Error('Tipo de juros inválido (1, 2 ou 3).');
  }
  const vm = num(cfg.valorMulta);
  if (cfg.tipoMulta > 0 && (vm == null || vm <= 0)) {
    throw new Error('Informe o valor da multa quando a multa não for isenta.');
  }
  const vj = num(cfg.valorJurosMora);
  if (cfg.tipoJurosMora !== 3 && (vj == null || vj <= 0)) {
    throw new Error('Informe o valor dos juros quando os juros não forem isentos.');
  }
  if (cfg.diasInicioMultaAposVencimento < 1 || cfg.diasInicioJurosAposVencimento < 1) {
    throw new Error('Dias para início de multa/juros devem ser pelo menos 1 após o vencimento.');
  }
  if (
    cfg.diasLimitePagamentoAposVencimento != null &&
    cfg.diasLimitePagamentoAposVencimento < 0
  ) {
    throw new Error('Dias para limite de pagamento não pode ser negativo.');
  }
}

export function buildSicoobEncargosPayload(
  cfg: SicoobEncargosConfig,
  dueDate: Date | string,
): SicoobEncargosPayload {
  const venc = isoDateOnly(dueDate);
  const out: SicoobEncargosPayload = {
    tipoMulta: cfg.tipoMulta,
    tipoJurosMora: cfg.tipoJurosMora,
  };

  const vm = num(cfg.valorMulta);
  if (cfg.tipoMulta > 0 && vm != null && vm > 0) {
    out.dataMulta = addDaysIso(venc, Math.max(1, cfg.diasInicioMultaAposVencimento));
    out.valorMulta = Math.round(vm * 10000) / 10000;
  }

  const vj = num(cfg.valorJurosMora);
  if (cfg.tipoJurosMora !== 3 && vj != null && vj > 0) {
    out.dataJurosMora = addDaysIso(venc, Math.max(1, cfg.diasInicioJurosAposVencimento));
    out.valorJurosMora = Math.round(vj * 10000) / 10000;
  }

  const hasEncargos = Boolean(out.dataMulta || out.dataJurosMora);
  let limiteDias = cfg.diasLimitePagamentoAposVencimento;
  if (limiteDias == null && hasEncargos) {
    limiteDias = Math.max(
      90,
      cfg.diasInicioMultaAposVencimento,
      cfg.diasInicioJurosAposVencimento,
    );
  }
  if (limiteDias != null) {
    out.dataLimitePagamento = addDaysIso(venc, limiteDias);
  }

  if (out.dataLimitePagamento && out.dataMulta && out.dataMulta > out.dataLimitePagamento) {
    throw new Error('Data da multa não pode ser posterior ao limite de pagamento.');
  }
  if (out.dataLimitePagamento && out.dataJurosMora && out.dataJurosMora > out.dataLimitePagamento) {
    throw new Error('Data dos juros não pode ser posterior ao limite de pagamento.');
  }

  return out;
}

function formatDateBrIso(iso: string): string {
  return iso.split('-').reverse().join('/');
}

export function describeMulta(cfg: SicoobEncargosConfig): string | null {
  const vm = num(cfg.valorMulta);
  if (cfg.tipoMulta === 0 || vm == null || vm <= 0) return null;
  if (cfg.tipoMulta === 2) {
    return `Multa ${vm.toLocaleString('pt-BR')}% após o venc.`;
  }
  return `Multa R$ ${vm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} após venc.`;
}

export function describeJuros(cfg: SicoobEncargosConfig): string | null {
  const vj = num(cfg.valorJurosMora);
  if (cfg.tipoJurosMora === 3 || vj == null || vj <= 0) return null;
  if (cfg.tipoJurosMora === 2) {
    return `Juros ${vj.toLocaleString('pt-BR')}% a.m. após venc.`;
  }
  return `Juros R$ ${vj.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/dia após venc.`;
}

export function describeLimitePagamento(
  cfg: SicoobEncargosConfig,
  dueDate: Date | string,
): string | null {
  const payload = buildSicoobEncargosPayload(cfg, dueDate);
  if (!payload.dataLimitePagamento) return null;
  return `Pagável até ${formatDateBrIso(payload.dataLimitePagamento)}`;
}

export function formatMoraMultaJurosCol(cfg: SicoobEncargosConfig): string {
  const parts = [describeMulta(cfg), describeJuros(cfg)].filter(Boolean) as string[];
  return parts.length ? parts.join(' ') : '—';
}

/** Até 5 linhas de 40 caracteres (mensagensInstrucao Sicoob). */
export function buildMensagensInstrucao(
  description: string,
  cfg: SicoobEncargosConfig,
  dueDate: Date | string,
): string[] {
  const lines: string[] = [];
  const desc = clip(description, 40);
  if (desc) lines.push(desc);

  if (cfg.encargosNasInstrucoes) {
    for (const part of [
      describeMulta(cfg),
      describeJuros(cfg),
      describeLimitePagamento(cfg, dueDate),
    ]) {
      if (!part) continue;
      const c = clip(part, 40);
      if (c) lines.push(c);
    }
  }

  return lines.slice(0, 5);
}
