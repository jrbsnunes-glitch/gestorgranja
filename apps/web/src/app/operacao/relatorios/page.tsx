'use client';

import { useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { OperationBarnComparisonReportLauncher } from '@/components/operation-barn-comparison-report-launcher';
import { ProductionReportLauncher } from '@/components/production-report-launcher';
import { apiFetch } from '@/lib/api';
import { navigateToReportPrint } from '@/lib/report-print-nav';

type Lot = { id: string; code: string; barn: { name: string } };

export default function OperacaoRelatoriosPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [domain, setDomain] = useState<'comparativo' | 'postura' | 'mortalidade' | 'manejo'>('comparativo');
  const [manejoDate, setManejoDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  useEffect(() => {
    void apiFetch<Lot[]>('/v1/production/lots').then(setLots).catch(() => setLots([]));
  }, []);

  return (
    <AdminShell title="Relatórios de produção">
      <PageIntro
        title="Relatórios"
        description="Compare galpões e lotes e acompanhe a evolução da produção e da mortalidade no período."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            { id: 'comparativo' as const, label: 'Comparativo galpões' },
            { id: 'postura' as const, label: 'Produção (detalhe)' },
            { id: 'mortalidade' as const, label: 'Mortalidade' },
            { id: 'manejo' as const, label: 'PL 5 — Manejo' },
          ] as const
        ).map((d) => (
          <button
            key={d.id}
            type="button"
            className={`rounded-full px-4 py-2 text-sm ${domain === d.id ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'}`}
            onClick={() => setDomain(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>
      {domain === 'manejo' ? (
        <section className="max-w-xl rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Registro de manejo na fase de produção</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ficha PL 5 do dia, no leiaute do memorial sanitário, preenchida com postura, mortalidade, ração, água,
            linhagem e sanidade já lançados.
          </p>
          <label className="mt-4 block text-sm text-slate-700">
            Data
            <input
              type="date"
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
              value={manejoDate}
              onChange={(e) => setManejoDate(e.target.value)}
            />
          </label>
          <Button
            type="button"
            className="mt-4"
            onClick={() =>
              navigateToReportPrint(
                `/relatorios/operacao/manejo/impressao?date=${encodeURIComponent(manejoDate)}`,
                '/operacao/relatorios',
              )
            }
          >
            Gerar ficha do dia
          </Button>
        </section>
      ) : domain === 'comparativo' ? (
        <OperationBarnComparisonReportLauncher />
      ) : (
        <ProductionReportLauncher
          domain={domain}
          lots={lots}
          returnHref={domain === 'mortalidade' ? '/producao?tab=mortalidade' : '/operacao/relatorios'}
        />
      )}
    </AdminShell>
  );
}
