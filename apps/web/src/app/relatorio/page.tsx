'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { navigateToReportPrint } from '@/lib/report-print-nav';
import { Field, SubmitButton, inputClass } from '@/components/ui-parts';

function ReportForm() {
  const sp = useSearchParams();
  const reportKey = sp.get('key') ?? 'generic';
  const title = sp.get('title') ?? 'Relatorio';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [error, setError] = useState<string | null>(null);

  function generate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const q = new URLSearchParams({ key: reportKey, title });
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (min) q.set('min', min);
    if (max) q.set('max', max);
    navigateToReportPrint(`/relatorios/stub/impressao?${q.toString()}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <h1 className="mb-4 text-lg font-semibold">{title}</h1>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <form onSubmit={(e) => void generate(e)} className="max-w-md rounded-lg border bg-white p-4">
        <Field label="Data inicial"><input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Data final"><input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Controle minimo"><input type="number" className={inputClass} value={min} onChange={(e) => setMin(e.target.value)} /></Field>
        <Field label="Controle maximo"><input type="number" className={inputClass} value={max} onChange={(e) => setMax(e.target.value)} /></Field>
        <SubmitButton label="Gerar relatorio" />
      </form>
    </div>
  );
}

export default function RelatorioPopupPage() {
  return (<Suspense fallback={<p className="p-6">Carregando...</p>}><ReportForm /></Suspense>);
}
