import { StockMovementType } from '../generated/tenant-client';

type Move = {
  productId: string;
  type: StockMovementType;
  quantity: { toString(): string };
  unitCost: { toString(): string } | null;
};

function dec(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

/** Custo médio móvel e saldo físico por produto (a partir das movimentações). */
export function averageCostByProduct(moves: Move[]): Map<string, { qty: number; averageCost: number }> {
  const state = new Map<string, { qty: number; value: number }>();

  for (const m of moves) {
    const pid = m.productId;
    if (!state.has(pid)) state.set(pid, { qty: 0, value: 0 });
    const b = state.get(pid)!;
    const q = dec(m.quantity);
    const cost = m.unitCost != null ? dec(m.unitCost) : 0;

    if (m.type === StockMovementType.OUT) {
      const avg = b.qty > 0 ? b.value / b.qty : cost;
      b.qty -= q;
      b.value -= q * avg;
      if (b.qty <= 0.0001) {
        b.qty = 0;
        b.value = 0;
      }
    } else {
      b.qty += q;
      b.value += q * cost;
    }
  }

  const out = new Map<string, { qty: number; averageCost: number }>();
  for (const [pid, b] of state) {
    out.set(pid, {
      qty: b.qty,
      averageCost: b.qty > 0 ? b.value / b.qty : 0,
    });
  }
  return out;
}
