/** Chave de acesso da NF-e tem 44 dígitos. Número JS a transforma em notação científica. */
export function normalizeAccessKey(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 44 ? digits : null;
}

export function accessKeyFromNfeXml(xml: string | null | undefined): string | null {
  if (!xml) return null;
  const id = xml.match(/\bId="NFe(\d{44})"/i);
  if (id?.[1]) return id[1];
  const ch = xml.match(/<chNFe>(\d{44})<\/chNFe>/i);
  return ch?.[1] ?? null;
}
