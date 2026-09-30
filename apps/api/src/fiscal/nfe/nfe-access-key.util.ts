const WEIGHTS = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function nfeCheckDigit(base43: string): string {
  let sum = 0;
  for (let i = 0; i < 43; i++) {
    sum += Number(base43[i]) * WEIGHTS[i]!;
  }
  const mod = sum % 11;
  const dv = mod === 0 || mod === 1 ? 0 : 11 - mod;
  return String(dv);
}

export function buildAccessKey(parts: {
  uf: string;
  yymm: string;
  cnpj: string;
  model: string;
  series: string;
  number: string;
  tpEmis: string;
  cNF: string;
}): string {
  const base43 =
    parts.uf.padStart(2, '0') +
    parts.yymm +
    parts.cnpj.replace(/\D/g, '').padStart(14, '0').slice(-14) +
    parts.model.padStart(2, '0') +
    parts.series.padStart(3, '0') +
    parts.number.padStart(9, '0') +
    parts.tpEmis +
    parts.cNF.padStart(8, '0').slice(-8);
  return base43 + nfeCheckDigit(base43);
}

export function randomCNF(): string {
  return String(Math.floor(Math.random() * 99_999_999)).padStart(8, '0');
}
