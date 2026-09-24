import { Suspense } from 'react';
import { PayrollVerClient } from './payroll-ver-client';

export default function PayrollVerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white p-6 text-sm text-slate-600">Carregando folha…</div>
      }
    >
      <PayrollVerClient />
    </Suspense>
  );
}
