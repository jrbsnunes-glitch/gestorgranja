'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { OperationBarnComparisonReportLauncher } from '@/components/operation-barn-comparison-report-launcher';
import { ProductionReportLauncher } from '@/components/production-report-launcher';
import { apiFetch } from '@/lib/api';

type Lot = { id: string; code: string; barn: { name: string } };

export default function OperacaoRelatoriosPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [domain, setDomain] = useState<'comparativo' | 'postura' | 'mortalidade'>('comparativo');

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
      {domain === 'comparativo' ? (
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
