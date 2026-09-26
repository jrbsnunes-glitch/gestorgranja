import { FlockMovementType } from '../generated/tenant-client';

type MovementLike = { type: FlockMovementType; quantity: number };

/** Delta de aves de uma movimentação (positivo entra, negativo sai; CLOSE não altera). */
export function flockMovementDelta(m: MovementLike): number {
  const q = Math.abs(m.quantity);
  switch (m.type) {
    case FlockMovementType.ENTRY:
    case FlockMovementType.TRANSFER_IN:
      return q;
    case FlockMovementType.TRANSFER_OUT:
    case FlockMovementType.EXIT:
      return -q;
    case FlockMovementType.ADJUST:
      return m.quantity;
    case FlockMovementType.CLOSE:
      return 0;
  }
}

export type FlockBalance = {
  housedQty: number;
  movementsIn: number;
  movementsOut: number;
  adjustments: number;
  mortalityTotal: number;
  liveBirds: number;
};

/**
 * Aves vivas = alojadas + entradas − saídas ± ajustes − mortalidade.
 * Mantém a origem de cada parcela para exibição ("de onde veio o número").
 */
export function computeFlockBalance(
  housedQty: number,
  movements: MovementLike[],
  mortalityTotal: number,
): FlockBalance {
  let movementsIn = 0;
  let movementsOut = 0;
  let adjustments = 0;
  for (const m of movements) {
    const d = flockMovementDelta(m);
    if (m.type === FlockMovementType.ADJUST) adjustments += d;
    else if (d > 0) movementsIn += d;
    else movementsOut += -d;
  }
  const liveBirds = Math.max(housedQty + movementsIn - movementsOut + adjustments - mortalityTotal, 0);
  return { housedQty, movementsIn, movementsOut, adjustments, mortalityTotal, liveBirds };
}
