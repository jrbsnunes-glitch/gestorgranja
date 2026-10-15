function digitsOnly(raw: string) {
  return raw.replace(/\D/g, '');
}

/** Linha digitável no formato bancário (grupos). */
export function formatBoletoLinhaDigitavel(linha: string | null | undefined): string {
  const d = digitsOnly(linha ?? '');
  if (d.length < 47) return linha?.trim() || '—';
  return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d.slice(32, 33)} ${d.slice(33)}`;
}

export function boletoBarcodeDigits(boleto: {
  codigoBarras?: string | null;
  linhaDigitavel?: string | null;
}): string {
  const fromBars = digitsOnly(boleto.codigoBarras ?? '');
  if (fromBars.length >= 44) return fromBars.slice(0, 44);
  return digitsOnly(boleto.linhaDigitavel ?? '').slice(0, 44);
}

export type BankBoletoDto = {
  id: string;
  receivableId?: string | null;
  salesOrderId?: string | null;
  seuNumero: string;
  nossoNumero?: string | null;
  codigoBarras?: string | null;
  linhaDigitavel?: string | null;
  qrCode?: string | null;
  hasPdf?: boolean;
  status: string;
  valor: number;
  dataVencimento: string;
  situacaoBoleto?: string | null;
  lastError?: string | null;
  error?: string;
};
