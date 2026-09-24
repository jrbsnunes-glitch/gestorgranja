import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { NutritionService } from '../nutrition/nutrition.service';
import { ProductionService } from '../production/production.service';

export type ProductionReportDomain = 'postura' | 'mortalidade' | 'racao' | 'ambiente' | 'transferencia';
export type ProductionReportVariant = 'geral' | 'periodo' | 'lote' | 'totais';

export type ProductionReportQuery = {
  domain: ProductionReportDomain;
  variant: ProductionReportVariant;
  from?: string;
  to?: string;
  flockLotId?: string;
};

function parseDay(raw: string | undefined, mode: 'start' | 'end'): Date | undefined {
  if (!raw?.trim()) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (mode === 'end') d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function inRange(date: Date, from?: Date, to?: Date) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

type ReportRow = Record<string, string | number>;

function sumNumericColumn(rows: ReportRow[], key: string): number {
  let sum = 0;
  for (const row of rows) {
    const v = row[key];
    if (typeof v === 'number' && Number.isFinite(v)) sum += v;
    else if (typeof v === 'string' && v !== '—') {
      const n = Number(v.replace(',', '.'));
      if (Number.isFinite(n)) sum += n;
    }
  }
  return sum;
}

function buildSumFooter(
  columns: { key: string }[],
  rows: ReportRow[],
  sumKeys: string[],
  decimalKeys: string[] = [],
): ReportRow | null {
  if (rows.length === 0) return null;
  const decimals = new Set(decimalKeys);
  const footer: ReportRow = {};
  for (const col of columns) {
    if (col.key === columns[0].key) {
      footer[col.key] = 'Total';
      continue;
    }
    if (sumKeys.includes(col.key)) {
      const sum = sumNumericColumn(rows, col.key);
      footer[col.key] = decimals.has(col.key) ? sum.toFixed(3) : sum;
    } else if (col.key === columns[1]?.key) {
      footer[col.key] = `${rows.length} registro(s)`;
    } else {
      footer[col.key] = '—';
    }
  }
  return footer;
}

@Injectable()
export class ProductionDailyReportService {
  constructor(
    private readonly production: ProductionService,
    private readonly nutrition: NutritionService,
  ) {}

  async report(user: JwtPayload, query: ProductionReportQuery) {
    this.validateQuery(query);
    switch (query.domain) {
      case 'postura':
        return this.reportEggs(user, query);
      case 'mortalidade':
        return this.reportMortality(user, query);
      case 'racao':
        return this.reportFeed(user, query);
      case 'ambiente':
        return this.reportEnvironment(user, query);
      case 'transferencia':
        return this.reportTransfer(user, query);
    }
  }

  private validateQuery(query: ProductionReportQuery) {
    if (query.domain === 'ambiente' || query.domain === 'transferencia') {
      if (query.variant !== 'geral') {
        throw new BadRequestException('Este módulo suporta apenas listagem geral.');
      }
      return;
    }
    if (query.variant === 'periodo') {
      const from = parseDay(query.from, 'start');
      const to = parseDay(query.to, 'end');
      if (!from || !to) throw new BadRequestException('Informe período de e até.');
      if (from > to) throw new BadRequestException('Período inválido.');
    }
    if (query.variant === 'lote' && !query.flockLotId?.trim()) {
      throw new BadRequestException('Informe o lote.');
    }
  }

  private periodMeta(query: ProductionReportQuery) {
    const from = parseDay(query.from, 'start');
    const to = parseDay(query.to, 'end');
    return {
      from: from ? isoDate(from) : null,
      to: to ? isoDate(to) : null,
      fromDate: from,
      toDate: to,
    };
  }

  private async lotCode(user: JwtPayload, flockLotId?: string) {
    if (!flockLotId) return null;
    const lots = await this.production.listLots(user);
    return lots.find((l) => l.id === flockLotId)?.code ?? null;
  }

  private async reportEggs(user: JwtPayload, query: ProductionReportQuery) {
    const { fromDate, toDate, from, to } = this.periodMeta(query);
    let rows = await this.production.listDailyEggs(
      user,
      query.variant === 'lote' ? query.flockLotId : undefined,
    );
    rows = rows.filter((r) => inRange(new Date(r.date), fromDate, toDate));

    if (query.variant === 'totais') {
      let commercial = 0;
      const byLot = new Map<string, number>();
      for (const r of rows) {
        const c = this.production.commercialEggs(r);
        commercial += c;
        byLot.set(r.flockLot.code, (byLot.get(r.flockLot.code) ?? 0) + c);
      }
      return {
        domain: query.domain,
        variant: query.variant,
        title: 'Totais de Postura',
        period: { from, to },
        flockLotCode: await this.lotCode(user, query.flockLotId),
        columns: [
          { key: 'label', label: 'Descrição' },
          { key: 'value', label: 'Valor' },
        ],
        rows: [
          { label: 'Registros no filtro', value: String(rows.length) },
          { label: 'Total comerciais (un)', value: String(commercial) },
          ...[...byLot.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([code, total]) => ({ label: `Lote ${code}`, value: String(total) })),
        ],
        totals: [{ label: 'Total comerciais (un)', value: commercial }],
      };
    }

    const columns = [
      { key: 'date', label: 'Data' },
      { key: 'lot', label: 'Lote' },
      { key: 'commercial', label: 'Comerciais (un)' },
      { key: 'extra', label: 'Extra' },
      { key: 'large', label: 'Grande' },
      { key: 'medium', label: 'Médio' },
      { key: 'small', label: 'Pequeno' },
    ];
    const mapped = rows.map((r) => ({
      date: isoDate(new Date(r.date)),
      lot: r.flockLot.code,
      commercial: this.production.commercialEggs(r),
      extra: r.extra,
      large: r.large,
      medium: r.medium,
      small: r.small,
    }));
    return {
      domain: query.domain,
      variant: query.variant,
      title: this.titleFor(query, 'Postura'),
      period: { from, to },
      flockLotCode: await this.lotCode(user, query.flockLotId),
      columns,
      rows: mapped,
      footer: buildSumFooter(columns, mapped, [
        'commercial',
        'extra',
        'large',
        'medium',
        'small',
      ]),
    };
  }

  private async reportMortality(user: JwtPayload, query: ProductionReportQuery) {
    const { fromDate, toDate, from, to } = this.periodMeta(query);
    let rows = await this.production.listDailyMortality(
      user,
      query.variant === 'lote' ? query.flockLotId : undefined,
    );
    rows = rows.filter((r) => inRange(new Date(r.date), fromDate, toDate));

    if (query.variant === 'totais') {
      let total = 0;
      const byLot = new Map<string, number>();
      for (const r of rows) {
        total += r.quantity;
        byLot.set(r.flockLot.code, (byLot.get(r.flockLot.code) ?? 0) + r.quantity);
      }
      return {
        domain: query.domain,
        variant: query.variant,
        title: 'Totais de Mortalidade',
        period: { from, to },
        flockLotCode: await this.lotCode(user, query.flockLotId),
        columns: [
          { key: 'label', label: 'Descrição' },
          { key: 'value', label: 'Valor' },
        ],
        rows: [
          { label: 'Registros no filtro', value: String(rows.length) },
          { label: 'Total aves', value: String(total) },
          ...[...byLot.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([code, qty]) => ({ label: `Lote ${code}`, value: String(qty) })),
        ],
        totals: [{ label: 'Total aves', value: total }],
      };
    }

    const columns = [
      { key: 'date', label: 'Data' },
      { key: 'lot', label: 'Lote' },
      { key: 'quantity', label: 'Quantidade' },
      { key: 'notes', label: 'Observação' },
    ];
    const mapped = rows.map((r) => ({
      date: isoDate(new Date(r.date)),
      lot: r.flockLot.code,
      quantity: r.quantity,
      notes: r.causeNotes ?? '—',
    }));
    return {
      domain: query.domain,
      variant: query.variant,
      title: this.titleFor(query, 'Mortalidade'),
      period: { from, to },
      flockLotCode: await this.lotCode(user, query.flockLotId),
      columns,
      rows: mapped,
      footer: buildSumFooter(columns, mapped, ['quantity']),
    };
  }

  private async reportFeed(user: JwtPayload, query: ProductionReportQuery) {
    const { fromDate, toDate, from, to } = this.periodMeta(query);
    const lots = await this.production.listLots(user);
    const lotIds = new Set(lots.map((l) => l.id));
    let rows = await this.nutrition.listDailyFeed(
      user,
      query.variant === 'lote' ? query.flockLotId : undefined,
    );
    rows = rows.filter((r) => lotIds.has(r.flockLotId) && inRange(new Date(r.date), fromDate, toDate));

    if (query.variant === 'totais') {
      let consumed = 0;
      let leftover = 0;
      const byLot = new Map<string, { consumed: number; leftover: number }>();
      for (const r of rows) {
        const c = Number(r.consumedKg);
        const l = Number(r.leftoverKg);
        consumed += c;
        leftover += l;
        const prev = byLot.get(r.flockLot.code) ?? { consumed: 0, leftover: 0 };
        byLot.set(r.flockLot.code, { consumed: prev.consumed + c, leftover: prev.leftover + l });
      }
      return {
        domain: query.domain,
        variant: query.variant,
        title: 'Totais de Ração',
        period: { from, to },
        flockLotCode: await this.lotCode(user, query.flockLotId),
        columns: [
          { key: 'label', label: 'Descrição' },
          { key: 'value', label: 'Valor' },
        ],
        rows: [
          { label: 'Registros no filtro', value: String(rows.length) },
          { label: 'Consumido total (kg)', value: consumed.toFixed(3) },
          { label: 'Sobra total (kg)', value: leftover.toFixed(3) },
          ...[...byLot.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .flatMap(([code, t]) => [
              { label: `Lote ${code} — consumido (kg)`, value: t.consumed.toFixed(3) },
              { label: `Lote ${code} — sobra (kg)`, value: t.leftover.toFixed(3) },
            ]),
        ],
        totals: [
          { label: 'Consumido (kg)', value: consumed },
          { label: 'Sobra (kg)', value: leftover },
        ],
      };
    }

    const columns = [
      { key: 'date', label: 'Data' },
      { key: 'lot', label: 'Lote' },
      { key: 'consumed', label: 'Consumido (kg)' },
      { key: 'leftover', label: 'Sobra (kg)' },
    ];
    const mapped = rows.map((r) => ({
      date: isoDate(new Date(r.date)),
      lot: r.flockLot.code,
      consumed: Number(r.consumedKg).toFixed(3),
      leftover: Number(r.leftoverKg).toFixed(3),
    }));
    return {
      domain: query.domain,
      variant: query.variant,
      title: this.titleFor(query, 'Ração'),
      period: { from, to },
      flockLotCode: await this.lotCode(user, query.flockLotId),
      columns,
      rows: mapped,
      footer: buildSumFooter(columns, mapped, ['consumed', 'leftover'], ['consumed', 'leftover']),
    };
  }

  private async reportEnvironment(user: JwtPayload, query: ProductionReportQuery) {
    const rows = await this.production.listEnvironmental(user);
    const columns = [
      { key: 'recordedAt', label: 'Registro' },
      { key: 'barn', label: 'Galpão' },
      { key: 'temperature', label: 'Temp. (°C)' },
      { key: 'humidity', label: 'Umidade (%)' },
      { key: 'ventilation', label: 'Ventilação' },
    ];
    const mapped = rows.map((r) => ({
      recordedAt: new Date(r.recordedAt).toLocaleString('pt-BR'),
      barn: `${r.barn.code} — ${r.barn.name}`,
      temperature: r.temperatureC ?? '—',
      humidity: r.humidityPct ?? '—',
      ventilation: r.ventilationNote ?? '—',
    }));
    let tempSum = 0;
    let tempN = 0;
    let humSum = 0;
    let humN = 0;
    for (const r of rows) {
      if (r.temperatureC != null) {
        tempSum += Number(r.temperatureC);
        tempN += 1;
      }
      if (r.humidityPct != null) {
        humSum += Number(r.humidityPct);
        humN += 1;
      }
    }
    const footer: ReportRow | null =
      mapped.length === 0
        ? null
        : {
            recordedAt: 'Total',
            barn: `${mapped.length} registro(s)`,
            temperature: tempN > 0 ? Math.round((tempSum / tempN) * 10) / 10 : '—',
            humidity: humN > 0 ? Math.round((humSum / humN) * 10) / 10 : '—',
            ventilation: '—',
          };
    return {
      domain: query.domain,
      variant: query.variant,
      title: 'Ambiente — Listagem Geral',
      period: { from: null, to: null },
      flockLotCode: null,
      columns,
      rows: mapped,
      footer,
    };
  }

  private async reportTransfer(user: JwtPayload, query: ProductionReportQuery) {
    const rows = await this.nutrition.listFeedTransfers(user);
    const columns = [
      { key: 'date', label: 'Data' },
      { key: 'fromLot', label: 'Origem' },
      { key: 'toLot', label: 'Destino' },
      { key: 'quantity', label: 'Quantidade (kg)' },
    ];
    const mapped = rows.map((r) => ({
      date: isoDate(new Date(r.date)),
      fromLot: r.fromLot.code,
      toLot: r.toLot.code,
      quantity: Number(r.quantityKg).toFixed(3),
    }));
    return {
      domain: query.domain,
      variant: query.variant,
      title: 'Transferência — Listagem Geral',
      period: { from: null, to: null },
      flockLotCode: null,
      columns,
      rows: mapped,
      footer: buildSumFooter(columns, mapped, ['quantity'], ['quantity']),
    };
  }

  private titleFor(query: ProductionReportQuery, moduleLabel: string) {
    if (query.variant === 'geral') return `${moduleLabel} — Listagem Geral`;
    if (query.variant === 'periodo') return `${moduleLabel} — Por período`;
    if (query.variant === 'lote') return `${moduleLabel} — Por lote`;
    return `${moduleLabel} — Totais`;
  }
}
