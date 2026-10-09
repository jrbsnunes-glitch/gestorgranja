/** Idade zootécnica (semanas) = idade inicial no alojamento + semanas no galpão. */
export function flockAgeWeeks(housingDate: string, initialAgeWeeks = 0): number {
  const start = new Date(housingDate);
  const initial = Math.max(0, Math.floor(initialAgeWeeks));
  if (Number.isNaN(start.getTime())) return initial;
  const onFarmWeeks = Math.max(
    0,
    Math.floor((Date.now() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)),
  );
  return initial + onFarmWeeks;
}
