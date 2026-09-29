'use client';

import { useSearchParams } from 'next/navigation';
import { FinanceiroScreen } from '../financeiro-screen';

export default function FinanceiroReceberPage() {
  const sp = useSearchParams();
  const dueDays = sp.get('dueDays') ? Number(sp.get('dueDays')) : undefined;
  const overdueOnly = sp.get('overdue') === '1';
  return <FinanceiroScreen tab="receber" listFilter={{ dueDays, overdueOnly }} />;
}
