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
