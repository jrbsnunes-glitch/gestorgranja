import { partitionTotalCartons } from '../inventory/egg-packaging.util';

/** Bandeja de coleta na operação (30 ovos). */
export const EGGS_PER_FORMA = 30;

export type EggPackagingBreakdown = {
  /** Bandejas de coleta (comerciais ÷ 30, arred. para baixo). */
  formas: number;
  /** Cartelas cheias equivalentes aos comerciais (comerciais ÷ ovos/cartela). */
  equivalentCartons: number;
  /** Caixas fechadas (mesma regra da entrada de estoque pela postura). */
  packagingBoxes: number;
  /** Cartelas avulsas (resto após fechar caixas). */
  packagingLooseCartons: number;
  /** Ovos comerciais que não fecham cartela inteira. */
  remainderEggs: number;
  eggsPerForma: number;
  eggsPerCarton: number;
  cartonsPerBox: number;
};

export function eggPackagingFromCommercial(
  commercialEggs: number,
  eggsPerCarton: number,
  cartonsPerBox: number,
): EggPackagingBreakdown {
  const perCarton = Math.max(1, Math.floor(eggsPerCarton));
  const cpb = Math.max(1, Math.floor(cartonsPerBox));
  const commercial = Math.max(0, Math.floor(commercialEggs));
  const equivalentCartons = Math.floor(commercial / perCarton);
  const { boxes, looseCartons } = partitionTotalCartons(equivalentCartons, cpb);
  const packedEggs = equivalentCartons * perCarton;

  return {
    formas: Math.floor(commercial / EGGS_PER_FORMA),
    equivalentCartons,
    packagingBoxes: boxes,
    packagingLooseCartons: looseCartons,
    remainderEggs: commercial - packedEggs,
    eggsPerForma: EGGS_PER_FORMA,
    eggsPerCarton: perCarton,
    cartonsPerBox: cpb,
  };
}

/** @deprecated Use eggPackagingFromCommercial */
export function eggPackagingTotals(commercialEggs: number, eggsPerCarton: number) {
  const p = eggPackagingFromCommercial(commercialEggs, eggsPerCarton, 12);
  return {
    formas: p.formas,
    cartelas: p.equivalentCartons,
    eggsPerForma: p.eggsPerForma,
    eggsPerCarton: p.eggsPerCarton,
  };
}
