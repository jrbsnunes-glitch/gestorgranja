import { createHash } from 'crypto';
import { SefazEnvironment } from '../../generated/tenant-client';

export function nfceQrCodeUrl(params: {
  accessKey: string;
  environment: SefazEnvironment;
  cscId: string;
  csc: string;
  tpEmis: string;
}): string {
  const base =
    params.environment === 'producao'
      ? 'http://nfce.sefaz.am.gov.br/nfce/consulta'
      : 'http://homnfce.sefaz.am.gov.br/nfce/consulta';
  const digestInput = `${params.accessKey}|2|${params.tpEmis}|${params.cscId}${params.csc}`;
  const hash = createHash('sha1').update(digestInput).digest('hex').toUpperCase();
  return `${base}?p=${params.accessKey}|2|${params.tpEmis}|${params.cscId}|${hash}`;
}
