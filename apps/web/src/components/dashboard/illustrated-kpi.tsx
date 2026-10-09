'use client';

import Link from 'next/link';
import type { KpiTone } from '@/components/dashboard/kpi-card';
import { kpiToneClass } from '@/components/dashboard/kpi-card';

export function IllustratedKpi({
  img,
  label,
  value,
  sub,
}: {
  img: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="" className="h-12 w-12 shrink-0 object-contain" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-emerald-950">{value}</p>
        {sub ? <p className="truncate text-xs text-slate-500">{sub}</p> : null}
      </div>
    </div>
  );
}

export function IllustratedClickableKpi({
  href,
  img,
  label,
  value,
  sub,
  tone = 'default',
}: {
  href: string;
  img: string;
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${kpiToneClass(tone)}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="" className="h-11 w-11 shrink-0 object-contain" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-slate-900">{value}</p>
        {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
      </div>
    </Link>
  );
}
