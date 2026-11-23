'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type SheetRow = {
  lotBarn: string;
  ageWeeks: string;
  dead: string;
  live: string;
  intact: string;
  defects: string;
  total: string;
  prodPct: string;
  idealPct: string;
  water: string;
  feed: string;
  lineage: string;
  worker: string;
};

type HealthRow = { signs: string; treatment: string; guidance: string };

type Sheet = {
  companyName: string;
  logoDataUrl: string | null;
  dateLabel: string;
  veterinarian: string;
  rows: SheetRow[];
  health: HealthRow[];
};

const COLS = [
  'Lote / aviário',
  'Idade / sem',
  'Aves mortas',
  'Aves vivas',
  'Ovos íntegros',
  'Ovos c/ defeitos',
  'Total ovos',
  '% prod/dia',
  '% ideal',
  'Quant. água',
  'Quant. ração',
  'Linhagem',
  'Nome galponista',
] as const;

function cells(row: SheetRow): string[] {
  return [
    row.lotBarn,
    row.ageWeeks,
    row.dead,
    row.live,
    row.intact,
    row.defects,
    row.total,
    row.prodPct,
    row.idealPct,
    row.water,
    row.feed,
    row.lineage,
    row.worker,
  ];
}

function PrintBody() {
  const sp = useSearchParams();
  const date = sp.get('date') ?? '';
  const [data, setData] = useState<Sheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!date) {
      setError('Informe a data na tela de relatórios da Operação.');
      setLoading(false);
      return;
    }
    setLoading(true);
    void apiFetch<Sheet>(`/v1/reports/manejo-producao?date=${encodeURIComponent(date)}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [date]);

  useReportAutoPrint(!loading && !error && data != null, rootRef, 700);

  return (
    <div ref={rootRef} className="manejo-sheet mx-auto bg-white p-4 text-black print:p-0">
      <ReportPrintActions />
      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
        .manejo-sheet { max-width: 277mm; }
        .manejo-sheet table { width: 100%; border-collapse: collapse; }
        .manejo-sheet th, .manejo-sheet td {
          border: 1px solid #000;
          padding: 3px 4px;
          font-size: 9px;
          line-height: 1.2;
          vertical-align: middle;
        }
        .manejo-sheet th { font-weight: 700; text-align: center; text-transform: uppercase; }
        .manejo-sheet td { height: 22px; text-align: center; }
        .manejo-sheet td.left { text-align: left; }
        .manejo-sheet .title { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; }
        .manejo-sheet .subtitle { font-size: 9px; font-weight: 700; }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      {loading ? <p className="text-sm">Carregando ficha…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {data ? (
        <table>
          <tbody>
            <tr>
              <td rowSpan={3} style={{ width: 92 }}>
                {data.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.logoDataUrl} alt="" style={{ maxHeight: 64, maxWidth: 84, margin: '0 auto' }} />
                ) : null}
              </td>
              <td colSpan={12} className="title">
                {data.companyName}
              </td>
            </tr>
            <tr>
              <td colSpan={12} className="subtitle">
                Memorial descritivo de medidas higiênico-sanitárias, de biosseguridade e dos processos tecnológicos
              </td>
            </tr>
            <tr>
              <td colSpan={12} className="subtitle">
                PL 5 - Registro da produção diária de ovos - fornecimento de ração e água - registro de manejo
              </td>
            </tr>
            <tr>
              <td colSpan={13} className="left" style={{ fontWeight: 700 }}>
                DATA {data.dateLabel}
              </td>
            </tr>
            <tr>
              {COLS.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
            {data.rows.map((row, i) => (
              <tr key={i}>
                {cells(row).map((value, j) => (
                  <td key={j} className={j === 0 || j === 11 || j === 12 ? 'left' : undefined}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td colSpan={13} className="subtitle">
                Acompanhamento da sanidade do lote em situação de ocorrência de doenças
              </td>
            </tr>
            <tr>
              <th colSpan={5}>Sinais clínicos / lote/aviário</th>
              <th colSpan={4}>Descrição do tratamento realizado</th>
              <th colSpan={4}>Orientações técnicas repassadas</th>
            </tr>
            {data.health.map((row, i) => (
              <tr key={`h-${i}`}>
                <td colSpan={5} className="left">
                  {row.signs}
                </td>
                <td colSpan={4} className="left">
                  {row.treatment}
                </td>
                <td colSpan={4} className="left">
                  {row.guidance}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={13} className="left" style={{ height: 36, fontWeight: 700 }}>
                Médico veterinário responsável técnico (carimbo e assinatura): {data.veterinarian}
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export default function ManejoImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Carregando ficha…</p>}>
      <PrintBody />
    </Suspense>
  );
}
