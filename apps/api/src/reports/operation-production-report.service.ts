import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { OperationDashboardService } from '../operation/operation-dashboard.service';

function formatDateBr(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtPct(n: number | null) {
  return n == null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function fmtNum(n: number | null | undefined) {
  return n == null ? '—' : n.toLocaleString('pt-BR');
}

@Injectable()
export class OperationProductionReportService {
  constructor(private readonly dashboard: OperationDashboardService) {}

  async report(user: JwtPayload, fromRaw?: string, toRaw?: string) {
    const from = fromRaw?.trim().slice(0, 10);
    const to = toRaw?.trim().slice(0, 10);
    if (!from || !to) {
      throw new BadRequestException('Informe o período (de e até).');
    }
    if (from > to) throw new BadRequestException('Período inválido.');

    const dash = await this.dashboard.build(user, { from, to });

    const barnComparison = dash.byBarn.map((b) => {
      const lots = dash.byLot.filter((l) => l.barn.id === b.barn.id);
      return {
        code: b.barn.code,
        name: b.barn.name,
        lots: b.lots,
        liveBirds: b.liveBirds,
        commercial: b.commercial,
        produced: b.produced,
        formas: lots.reduce((s, l) => s + l.formas, 0),
        packagingBoxes: lots.reduce((s, l) => s + l.packagingBoxes, 0),
        packagingLooseCartons: lots.reduce((s, l) => s + l.packagingLooseCartons, 0),
        layRatePct: b.layRatePct,
        layRatePctFmt: fmtPct(b.layRatePct),
        lossPct: b.lossPct,
        lossPctFmt: fmtPct(b.lossPct),
        mortality: b.mortality,
      };
    });

    const dailyEvolution = dash.series.map((s) => ({
      date: s.date,
      dateLabel: formatDateBr(s.date),
      commercial: s.commercial,
      produced: s.produced,
      layRatePctFmt: fmtPct(s.layRatePct),
      mortality: s.mortality,
      lotsRecorded: s.lotsRecorded,
    }));

    const barnCols = dash.evolutionByBarn.barns;
    const evolutionMatrixColumns = [
      { key: 'dateLabel', label: 'Data' },
      ...barnCols.map((b) => ({ key: `barn_${b.id}`, label: `${b.code}` })),
      { key: 'commercialTotal', label: 'Total comerciais' },
      { key: 'producedTotal', label: 'Total produzidos' },
    ];
    const evolutionMatrixRows = dash.evolutionByBarn.rows.map((row) => {
      const out: Record<string, string | number> = {
        dateLabel: formatDateBr(row.date),
        commercialTotal: row.commercialTotal,
        producedTotal: row.producedTotal,
      };
      for (const b of barnCols) {
        out[`barn_${b.id}`] = row.commercialByBarn[b.id] ?? 0;
      }
      return out;
    });

    const comparisonColumns = [
      { key: 'code', label: 'Galpão' },
      { key: 'name', label: 'Nome' },
      { key: 'lots', label: 'Lotes' },
      { key: 'liveBirds', label: 'Aves vivas' },
      { key: 'commercial', label: 'Comerciais' },
      { key: 'produced', label: 'Produzidos' },
      { key: 'formas', label: 'Formas' },
      { key: 'packagingBoxes', label: 'Caixas' },
      { key: 'packagingLooseCartons', label: 'Cart. avulsas' },
      { key: 'layRatePctFmt', label: 'Postura média' },
      { key: 'mortality', label: 'Mortalidade' },
      { key: 'lossPctFmt', label: 'Perdas ovos' },
    ];
    const comparisonRows = barnComparison.map((b) => ({
      code: b.code,
      name: b.name,
      lots: b.lots,
      liveBirds: b.liveBirds,
      commercial: b.commercial,
      produced: b.produced,
      formas: b.formas,
      packagingBoxes: b.packagingBoxes,
      packagingLooseCartons: b.packagingLooseCartons,
      layRatePctFmt: b.layRatePctFmt,
      mortality: b.mortality,
      lossPctFmt: b.lossPctFmt,
    }));

    const evolutionColumns = [
      { key: 'dateLabel', label: 'Data' },
      { key: 'commercial', label: 'Comerciais' },
      { key: 'produced', label: 'Produzidos' },
      { key: 'layRatePctFmt', label: 'Postura do dia' },
      { key: 'mortality', label: 'Mortalidade' },
      { key: 'lotsRecorded', label: 'Lotes c/ registro' },
    ];

    return {
      title: 'Comparativo de galpões e evolução da produção',
      period: { from, to, fromLabel: formatDateBr(from), toLabel: formatDateBr(to) },
      totals: {
        commercial: dash.totals.commercial,
        produced: dash.totals.produced,
        commercialFmt: fmtNum(dash.totals.commercial),
        producedFmt: fmtNum(dash.totals.produced),
        layRatePctFmt: fmtPct(dash.totals.layRatePct),
        barns: dash.totals.barns,
        lots: dash.totals.lots,
      },
      sections: [
        {
          id: 'comparison',
          heading: 'Comparativo entre galpões (totais no período)',
          columns: comparisonColumns,
          rows: comparisonRows,
        },
        {
          id: 'evolution',
          heading: 'Evolução diária da produção (granja)',
          columns: evolutionColumns,
          rows: dailyEvolution,
        },
        {
          id: 'evolutionByBarn',
          heading: 'Evolução diária — ovos comerciais por galpão',
          columns: evolutionMatrixColumns,
          rows: evolutionMatrixRows,
          barnLegend: barnCols.map((b) => `${b.code} — ${b.name}`),
        },
      ],
    };
  }
}
