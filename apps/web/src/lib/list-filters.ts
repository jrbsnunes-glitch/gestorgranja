export type ControlRangeFilter = {
  controlMin: string;
  controlMax: string;
};

export const EMPTY_CONTROL_RANGE: ControlRangeFilter = {
  controlMin: '',
  controlMax: '',
};

export type DateRangeFilter = {
  from: string;
  to: string;
};

export const EMPTY_DATE_RANGE: DateRangeFilter = {
  from: '',
  to: '',
};

export function parseOptionalControlInt(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export function controlRangeActive(f: ControlRangeFilter): boolean {
  return f.controlMin.trim() !== '' || f.controlMax.trim() !== '';
}

export function dateRangeActive(f: DateRangeFilter): boolean {
  return f.from.trim() !== '' || f.to.trim() !== '';
}

export function matchesControlValue(value: number, minRaw: string, maxRaw: string): boolean {
  const min = parseOptionalControlInt(minRaw);
  const max = parseOptionalControlInt(maxRaw);
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

export function matchesListControlIndex(indexZeroBased: number, minRaw: string, maxRaw: string): boolean {
  return matchesControlValue(indexZeroBased + 1, minRaw, maxRaw);
}

export function dateInInclusiveRange(iso: string, from: string, to: string): boolean {
  const day = iso.slice(0, 10);
  if (from.trim() && day < from.trim()) return false;
  if (to.trim() && day > to.trim()) return false;
  return true;
}

export function applyControlRangeSlice<T>(items: T[], minRaw: string, maxRaw: string): T[] {
  if (!controlRangeActive({ controlMin: minRaw, controlMax: maxRaw })) return items;
  return items.filter((_, idx) => matchesListControlIndex(idx, minRaw, maxRaw));
}
