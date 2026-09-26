type StandardPointLike = { ageDays: number; layRatePct: unknown; avgEggWeightG?: unknown };

export type StandardAt = { layRatePct: number; avgEggWeightG: number | null } | null;

/**
 * Padrão da linhagem em uma idade (dias), com interpolação linear entre os pontos
 * cadastrados. Antes do primeiro ponto retorna null (fase de recria); após o último, mantém o último.
 */
export function standardAt(points: StandardPointLike[], ageDays: number): StandardAt {
  if (!points.length) return null;
  const sorted = points
    .map((p) => ({
      ageDays: p.ageDays,
      lay: Number(p.layRatePct),
      w: p.avgEggWeightG != null ? Number(p.avgEggWeightG) : null,
    }))
    .sort((a, b) => a.ageDays - b.ageDays);
  if (ageDays < sorted[0].ageDays) return null;
  const last = sorted[sorted.length - 1];
  if (ageDays >= last.ageDays) return { layRatePct: last.lay, avgEggWeightG: last.w };
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (ageDays >= a.ageDays && ageDays <= b.ageDays) {
      const span = b.ageDays - a.ageDays || 1;
      const t = (ageDays - a.ageDays) / span;
      const lay = a.lay + (b.lay - a.lay) * t;
      const w = a.w != null && b.w != null ? a.w + (b.w - a.w) * t : (a.w ?? b.w);
      return { layRatePct: Number(lay.toFixed(2)), avgEggWeightG: w != null ? Number(w.toFixed(2)) : null };
    }
  }
  return { layRatePct: last.lay, avgEggWeightG: last.w };
}

export function ageDaysAt(housingDate: Date, at: Date) {
  return Math.floor((at.getTime() - housingDate.getTime()) / 86400000);
}

/** Conversão alimentar (kg ração / kg massa de ovos) em uma janela de registros pareados por data. */
export function feedConversion(
  pairs: Array<{ consumedKg: number; commercialEggs: number; avgEggWeightG: number | null }>,
  defaultEggWeightG = 62,
): number | null {
  let feed = 0;
  let mass = 0;
  for (const p of pairs) {
    feed += p.consumedKg;
    mass += (p.commercialEggs * (p.avgEggWeightG ?? defaultEggWeightG)) / 1000;
  }
  if (mass <= 0) return null;
  return Number((feed / mass).toFixed(3));
}
