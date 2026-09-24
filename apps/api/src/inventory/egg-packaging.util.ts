/** Vínculo cartela/caixa (config. postura ou cadastro futuro). */
export type EggPackagingLinks = {
  cartonProductId: string | null;
  boxProductId: string | null;
  eggsPerCarton: number;
  cartonsPerBox: number;
};

export function eggProductRole(
  links: EggPackagingLinks,
  productId: string,
): 'carton' | 'box' | null {
  if (links.cartonProductId && productId === links.cartonProductId) return 'carton';
  if (links.boxProductId && productId === links.boxProductId) return 'box';
  return null;
}

/** Total de cartelas → caixas fechadas + cartelas avulsas (sem contagem dupla). */
export function partitionTotalCartons(totalCartons: number, cartonsPerBox: number) {
  const cpb = Math.max(cartonsPerBox, 1);
  const total = Math.max(0, Math.floor(totalCartons));
  const boxes = Math.floor(total / cpb);
  const looseCartons = total - boxes * cpb;
  return { boxes, looseCartons };
}

export function equivalentCartonsFromStock(
  looseCartons: number,
  boxes: number,
  cartonsPerBox: number,
) {
  const cpb = Math.max(cartonsPerBox, 1);
  return Math.max(0, looseCartons) + Math.max(0, boxes) * cpb;
}

export function qtyToEquivalentCartons(
  role: 'carton' | 'box',
  qty: number,
  cartonsPerBox: number,
) {
  const cpb = Math.max(cartonsPerBox, 1);
  if (qty <= 0) return 0;
  return role === 'box' ? qty * cpb : qty;
}

export function productionStockTargets(
  commercialEggs: number,
  cfg: {
    eggsPerCarton: number;
    cartonsPerBox: number;
    syncCartons: boolean;
    syncBoxes: boolean;
    cartonProductId: string | null;
    boxProductId: string | null;
  },
) {
  const eggsPerCarton = Math.max(cfg.eggsPerCarton, 1);
  const cartonsPerBox = Math.max(cfg.cartonsPerBox, 1);
  const totalCartons =
    cfg.syncCartons || cfg.syncBoxes ? Math.floor(Math.max(0, commercialEggs) / eggsPerCarton) : 0;

  const targetBoxes =
    cfg.syncBoxes && cfg.boxProductId ? Math.floor(totalCartons / cartonsPerBox) : 0;

  let targetLooseCartons = 0;
  if (cfg.syncCartons && cfg.cartonProductId) {
    if (cfg.syncBoxes && cfg.boxProductId) {
      targetLooseCartons = totalCartons - targetBoxes * cartonsPerBox;
    } else {
      targetLooseCartons = totalCartons;
    }
  }

  return { totalCartons, targetLooseCartons, targetBoxes };
}
