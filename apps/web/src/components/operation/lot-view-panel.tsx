'use client';

import {
  RecordViewHero,
  RecordViewMiniMetric,
  RecordViewTile,
  iconForRecordField,
} from '@/components/crud/record-view-presentation';
import { flockAgeWeeks } from '@/lib/flock-age';
import { labelEnum } from '@/lib/labels';

type LotViewData = {
  code: string;
  housedQty: number;
  mortalityTotal: number;
  liveBirds: number;
  housingDate: string;
  initialAgeWeeks?: number;
  status: string;
  eggType: string | null;
  strainNotes: string | null;
  supplierBatch: string | null;
  expectedEndDate: string | null;
  plantNotes: string | null;
  barn: { name: string };
  breedLineage: { name: string };
  balance?: { movementsIn?: number; movementsOut?: number; adjustments?: number };
};

function nf(n: number) {
  return n.toLocaleString('pt-BR');
}

export function LotViewPanel({ lot }: { lot: LotViewData }) {
  const live = lot.liveBirds ?? lot.housedQty;
  const housing = new Date(lot.housingDate).toLocaleDateString('pt-BR');
  const end = lot.expectedEndDate ? new Date(lot.expectedEndDate).toLocaleDateString('pt-BR') : '—';

  return (
    <div className="space-y-3">
      <RecordViewHero
        icon="/producao/silhueta-galinha-erp.png"
        title={lot.code}
        subtitle={`${labelEnum(lot.status)} · ${flockAgeWeeks(lot.housingDate, lot.initialAgeWeeks ?? 0)} semanas de idade`}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <RecordViewTile icon={iconForRecordField('Galpão')} label="Galpão" value={lot.barn.name} />
        <RecordViewTile icon={iconForRecordField('Linhagem')} label="Linhagem" value={lot.breedLineage.name} />
        <RecordViewTile icon={iconForRecordField('Data de alojamento')} label="Alojamento" value={housing} />
        <RecordViewTile
          icon={iconForRecordField('Idade')}
          label="Idade inicial"
          value={`${lot.initialAgeWeeks ?? 0} sem.`}
        />
        <RecordViewTile icon={iconForRecordField('Aves alojadas')} label="Aves alojadas" value={nf(lot.housedQty)} />
        <RecordViewTile icon={iconForRecordField('Aves vivas')} label="Aves vivas" value={nf(live)} />
        <RecordViewTile
          icon={iconForRecordField('Mortalidade')}
          label="Mortalidade acum."
          value={nf(lot.mortalityTotal ?? 0)}
        />
        <RecordViewTile icon={iconForRecordField('Tipo de ovo')} label="Tipo de ovo" value={labelEnum(lot.eggType) || '—'} />
        <RecordViewTile icon={iconForRecordField('Previsão encerramento')} label="Previsão fim" value={end} />
        <RecordViewTile icon={iconForRecordField('Lote fornecedor')} label="Lote fornecedor" value={lot.supplierBatch?.trim() || '—'} />
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Movimentações de aves</p>
        <div className="grid grid-cols-3 gap-2">
          <RecordViewMiniMetric label="Entradas" value={nf(lot.balance?.movementsIn ?? 0)} />
          <RecordViewMiniMetric label="Saídas" value={nf(lot.balance?.movementsOut ?? 0)} />
          <RecordViewMiniMetric label="Ajustes" value={nf(lot.balance?.adjustments ?? 0)} />
        </div>
      </div>

      {(lot.strainNotes?.trim() || lot.plantNotes?.trim()) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {lot.strainNotes?.trim() ? (
            <p className="line-clamp-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600" title={lot.strainNotes}>
              <span className="font-medium text-slate-700">Linhagem: </span>
              {lot.strainNotes}
            </p>
          ) : null}
          {lot.plantNotes?.trim() ? (
            <p className="line-clamp-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600" title={lot.plantNotes}>
              <span className="font-medium text-slate-700">Plantel: </span>
              {lot.plantNotes}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
