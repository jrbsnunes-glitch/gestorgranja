'use client';

import type { ReactNode } from 'react';
import type { RecordViewField } from './record-view-modal';

const ICON = {
  generic: '/icons/record-view/generic.svg',
  code: '/icons/record-view/code.svg',
  money: '/icons/record-view/money.svg',
  partner: '/icons/record-view/partner.svg',
  product: '/icons/record-view/product.svg',
  status: '/icons/record-view/status.svg',
  notes: '/icons/record-view/notes.svg',
  chart: '/icons/record-view/chart-account.svg',
  quantity: '/icons/record-view/quantity.svg',
  calendar: '/producao/calendario.svg',
  barn: '/producao/galpao.svg',
  lot: '/producao/silhueta-galinha-erp.png',
  egg: '/producao/ovo.svg',
  mortality: '/producao/mortalidade.svg',
  graph: '/producao/grafico.svg',
  bird: '/producao/galinha.svg',
} as const;

/** Ícone padrão de ovo (postura / classificação). */
export const RECORD_VIEW_EGG_ICON = ICON.egg;

function normLabel(label: string) {
  return label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function iconForRecordField(label: string, explicit?: string): string {
  if (explicit) return explicit;
  const n = normLabel(label);
  if (/codigo|sku|controle|nosso numero|linha digitavel|pedido|placa/.test(n)) return ICON.code;
  if (/valor|preco|custo|saldo|pago|lucro|cotac|total|amount/.test(n)) return ICON.money;
  if (/parceiro|cliente|fornecedor|visitante|responsavel/.test(n)) return ICON.partner;
  if (/produto|gtin|ncm|grupo|unidade|estoque/.test(n)) return ICON.product;
  if (/status|situacao|ativa|analitica|epi|tipo(?! de ovo)/.test(n)) return ICON.status;
  if (/data|vencimento|alojamento|aplicado|previsao|hora|registr/.test(n)) return ICON.calendar;
  if (/galpao|capacidade|ocupacao/.test(n)) return ICON.barn;
  if (/lote|linhagem|aves|mortalidade|plantel|alojad|vivas|entrada|saida|ajuste/.test(n)) return ICON.lot;
  if (
    /ovo|postura|comerciais|trincad|sujos|deformad|peso medio|motivo do descarte/.test(n) ||
    /^(extra|grande|medio|pequeno|descarte)$/.test(n.trim())
  ) {
    return ICON.egg;
  }
  if (/conta contabil|plano|pai/.test(n)) return ICON.chart;
  if (/quantidade|qtd|carência|carencia|dias|semanas/.test(n)) return ICON.quantity;
  if (/nota|observ|descricao|finalidade|motivo|justific/.test(n)) return ICON.notes;
  if (/nome(?!cl)/.test(n)) return ICON.partner;
  return ICON.generic;
}

export function fieldValueText(value: ReactNode): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
}

export function RecordViewTile({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: ReactNode;
}) {
  const text = fieldValueText(value);
  const display = value == null || value === '' ? '—' : value;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" className="mt-0.5 h-8 w-8 shrink-0 object-contain" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900 break-words line-clamp-3" title={text}>
          {display}
        </p>
      </div>
    </div>
  );
}

export function RecordViewMiniMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-white px-2 py-1.5 text-center ring-1 ring-slate-100">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-slate-800">{fieldValueText(value)}</p>
    </div>
  );
}

export function RecordViewHero({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/90 to-white px-3 py-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" className="h-14 w-14 shrink-0 object-contain" />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold text-emerald-950">{title}</p>
        {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
      </div>
    </div>
  );
}

const HERO_LABEL = /^(código|codigo|sku|nome|descrição|descricao|controle|cod\.)/i;

export function splitHeroField(fields: RecordViewField[]): {
  hero: RecordViewField | null;
  rest: RecordViewField[];
} {
  const idx = fields.findIndex((f) => HERO_LABEL.test(f.label.trim()));
  if (idx < 0) return { hero: null, rest: fields };
  return {
    hero: fields[idx],
    rest: [...fields.slice(0, idx), ...fields.slice(idx + 1)],
  };
}

export function RecordViewFieldsGrid({
  fields,
  showHero,
}: {
  fields: RecordViewField[];
  /** Exibe destaque no primeiro campo principal (só na 1ª seção). */
  showHero?: boolean;
}) {
  const { hero, rest } = showHero ? splitHeroField(fields) : { hero: null, rest: fields };

  return (
    <div className="space-y-3">
      {hero ? (
        <RecordViewHero
          icon={iconForRecordField(hero.label, hero.icon)}
          title={fieldValueText(hero.value)}
          subtitle={hero.label}
        />
      ) : null}
      {rest.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {rest.map((f) => (
            <RecordViewTile
              key={f.label}
              icon={iconForRecordField(f.label, f.icon)}
              label={f.label}
              value={f.value}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
