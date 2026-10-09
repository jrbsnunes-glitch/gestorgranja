export function omitEmpty(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return undefined;
  if (Array.isArray(value)) {
    const items = value.map(omitEmpty).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = omitEmpty(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

export function isoDateOnly(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function clip(s: string | null | undefined, max: number): string | undefined {
  const t = s?.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

export function partnerDocumentId(partner: {
  cnpj?: string | null;
  cpf?: string | null;
  document?: string | null;
}): string {
  const raw = partner.cnpj || partner.cpf || partner.document || '';
  return raw.replace(/[^0-9A-Za-z]/g, '');
}

export function digitsOnly(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

/** Sandbox/mock do Sicoob pode devolver overflow de int32; não usar em consultas. */
/** EMV Pix (copia e cola) retornado no registro/consulta do boleto híbrido. */
export function extractQrCodeFromResultado(body: Record<string, unknown>): string | null {
  const tryStr = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (t.startsWith('000201') && t.length > 30) return t;
    return null;
  };
  const direct = tryStr(body.qrCode) ?? tryStr(body.qrcode) ?? tryStr(body.pixCopiaECola) ?? tryStr(body.emv);
  if (direct) return direct;
  const pix = body.pix;
  if (pix && typeof pix === 'object' && !Array.isArray(pix)) {
    const p = pix as Record<string, unknown>;
    return (
      tryStr(p.qrCode) ??
      tryStr(p.emv) ??
      tryStr(p.copiaECola) ??
      tryStr(p.pixCopiaECola) ??
      tryStr(p.urlPix)
    );
  }
  return null;
}

/** Converte linha digitável (47) em código de barras (44) — FEBRABAN. */
export function linhaDigitavelToCodigoBarras(linha: string | null | undefined): string | null {
  const s = digitsOnly(linha);
  if (s.length !== 47) return null;
  return s.slice(0, 4) + s.slice(32, 47) + s.slice(4, 9) + s.slice(10, 20) + s.slice(21, 31);
}

export function resolveCodigoBarras(
  codigoBarras: string | null | undefined,
  linhaDigitavel: string | null | undefined,
): string | null {
  const b = digitsOnly(codigoBarras);
  if (b.length === 44) return b;
  const fromLinha = linhaDigitavelToCodigoBarras(linhaDigitavel);
  if (fromLinha) return fromLinha;
  if (b.length === 47) return linhaDigitavelToCodigoBarras(b) ?? b.slice(0, 44);
  if (b.length > 44) return b.slice(0, 44);
  return null;
}

export function normalizeNossoNumero(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s || s.startsWith('-')) return null;
  if (!/^\d{1,20}$/.test(s)) return null;
  return s;
}

export function unwrapSicoobResult(body: unknown): Record<string, unknown> {
  if (Array.isArray(body)) {
    const last = body.find((x) => x && typeof x === 'object' && 'resultado' in (x as object)) ?? body[body.length - 1];
    if (last && typeof last === 'object' && 'resultado' in last) {
      return (last as { resultado: Record<string, unknown> }).resultado;
    }
    if (last && typeof last === 'object') return last as Record<string, unknown>;
  }
  if (body && typeof body === 'object' && 'resultado' in body) {
    const r = (body as { resultado: unknown }).resultado;
    if (Array.isArray(r)) return unwrapSicoobResult(r);
    if (r && typeof r === 'object') return r as Record<string, unknown>;
  }
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  throw new Error('Resposta do Sicoob sem resultado');
}

export function isBoletoLiquidated(situacao?: string | null, historico?: unknown): boolean {
  const sit = (situacao ?? '').toLowerCase();
  if (/liquidado|liquidação|liquidacao/.test(sit)) return true;
  if (/\bpago\b/.test(sit) && !/em aberto/.test(sit)) return true;
  if (!Array.isArray(historico)) return false;
  return historico.some((h) => {
    if (!h || typeof h !== 'object') return false;
    const row = h as { tipoHistorico?: unknown; descricaoHistorico?: unknown };
    const tipo = String(row.tipoHistorico ?? '');
    const desc = String(row.descricaoHistorico ?? '').toLowerCase();
    return tipo === '6' && /liquid/.test(desc);
  });
}

export const SICOOB_AUTH_URL =
  'https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token';
export const SICOOB_API_PROD = 'https://api.sicoob.com.br/cobranca-bancaria/v3';
export const SICOOB_API_SANDBOX = 'https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria/v3';
export const SICOOB_SCOPES = 'boletos_inclusao boletos_consulta boletos_alteracao';
