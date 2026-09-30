/** Data civil local (YYYY-MM-DD) para filtros e exibição, evitando deslocamento UTC. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateKeyInRange(d: Date, from: Date, to: Date): boolean {
  const key = localDateKey(d);
  const fromKey = localDateKey(from);
  const toKey = localDateKey(to);
  return key >= fromKey && key <= toKey;
}
