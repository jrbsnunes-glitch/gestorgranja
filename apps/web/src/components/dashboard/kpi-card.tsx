'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

export type KpiTone = 'default' | 'good' | 'warn' | 'bad';

export function kpiToneClass(tone: KpiTone = 'default') {
  if (tone === 'good') return 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80';
  if (tone === 'warn') return 'border-amber-200 bg-amber-50 hover:bg-amber-100/80';
  if (tone === 'bad') return 'border-red-200 bg-red-50 hover:bg-red-100/80';
  return 'border-slate-200 bg-white hover:bg-slate-50';
}

function kpiValueClass(tone: KpiTone = 'default') {
  if (tone === 'good') return 'text-emerald-800';
  if (tone === 'warn') return 'text-amber-950';
  if (tone === 'bad') return 'text-red-700';
  return 'text-slate-900';
}

export function Kpi({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${kpiToneClass(tone).replace(/ hover:\S+/g, '')}`}>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${kpiValueClass(tone)}`}>{value}</p>
      {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function ClickableKpi({
  href,
  label,
  value,
  sub,
  tone = 'default',
}: {
  href: string;
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border px-3 py-2 transition-colors ${kpiToneClass(tone)}`}
    >
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${kpiValueClass(tone)}`}>{value}</p>
      {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
    </Link>
  );
}

export function DashboardColumn({
  title,
  children,
  footerHref,
  footerLabel,
  accent,
}: {
  title: string;
  children: ReactNode;
  footerHref?: string;
  footerLabel?: string;
  accent?: 'pay' | 'receive';
}) {
  const shell =
    accent === 'pay'
      ? 'border-rose-200 bg-rose-50/50'
      : accent === 'receive'
        ? 'border-emerald-200 bg-emerald-50/40'
        : 'border-slate-200 bg-slate-50/50';
  const heading =
    accent === 'pay' ? 'text-rose-950' : accent === 'receive' ? 'text-emerald-950' : 'text-slate-700';
  return (
    <section className={`flex flex-col gap-3 rounded-xl border p-4 ${shell}`}>
      <h2 className={`text-sm font-semibold uppercase tracking-wide ${heading}`}>{title}</h2>
      <div className="grid gap-2">{children}</div>
      {footerHref && footerLabel ? (
        <Link href={footerHref} className="mt-auto text-sm font-medium text-emerald-800 hover:underline">
          {footerLabel} →
        </Link>
      ) : null}
    </section>
  );
}
