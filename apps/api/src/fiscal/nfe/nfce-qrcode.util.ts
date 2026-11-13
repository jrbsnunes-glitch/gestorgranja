import { createHash } from 'crypto';
import { SefazEnvironment } from '../../generated/tenant-client';

/** AM: homologação usa QR v3 (NT 2025.001); produção permanece no v2 com CSC. */
export function nfceQrUsesCsc(environment: SefazEnvironment): boolean {
  return environment === 'producao';
}

export function nfceConsultaBase(environment: SefazEnvironment): string {
  return environment === 'producao'
    ? 'http://nfce.sefaz.am.gov.br/nfce/consulta'
    : 'http://homnfce.sefaz.am.gov.br/nfce/consulta';
}

export const NFCE_URL_CHAVE = 'http://www.sefaz.am.gov.br/nfce/consulta';

export function nfceQrCodeUrl(params: {
  accessKey: string;
  environment: SefazEnvironment;
  cscId?: string | null;
  csc?: string | null;
}): string {
  const tpAmb = params.environment === 'producao' ? '1' : '2';
  const base = nfceConsultaBase(params.environment);
  if (!nfceQrUsesCsc(params.environment)) {
    return `${base}?p=${params.accessKey}|3|${tpAmb}`;
  }
  const cscId = String(Number((params.cscId ?? '').replace(/\D/g, '') || '0'));
  const digestInput = `${params.accessKey}|2|${tpAmb}|${cscId}${params.csc ?? ''}`;
  const hash = createHash('sha1').update(digestInput, 'utf8').digest('hex').toUpperCase();
  return `${base}?p=${params.accessKey}|2|${tpAmb}|${cscId}|${hash}`;
}

function escQr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** infNFeSupl fica entre infNFe e Signature. Inserir depois da assinatura. */
export function appendNfceSupl(signedXml: string, qrUrl: string, urlChave = NFCE_URL_CHAVE): string {
  const supl =
    `<infNFeSupl><qrCode>${escQr(qrUrl)}</qrCode><urlChave>${escQr(urlChave)}</urlChave></infNFeSupl>`;
  if (/<Signature[\s>]/.test(signedXml)) {
    return signedXml.replace(/<Signature[\s>]/, `${supl}$&`);
  }
  return signedXml.replace(/<\/NFe>\s*$/, `${supl}</NFe>`);
}
