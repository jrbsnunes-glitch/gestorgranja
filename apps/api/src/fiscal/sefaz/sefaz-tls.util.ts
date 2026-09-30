import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as forge from 'node-forge';
import { getCACertificates } from 'tls';

let cachedCas: string[] | null = null;

function addPemBlocks(raw: string, seen: Set<string>, out: string[]) {
  const add = (pem: string) => {
    const t = pem.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  const blocks = raw.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  for (const block of blocks ?? []) add(block);
}

function loadBundledSefazCas(seen: Set<string>, out: string[]) {
  const dir = join(__dirname, 'certs');
  if (!existsSync(dir)) return;

  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    try {
      if (name.endsWith('.pem')) {
        addPemBlocks(readFileSync(full, 'utf8'), seen, out);
        continue;
      }
      if (name.endsWith('.crt')) {
        const der = readFileSync(full);
        const asn1 = forge.asn1.fromDer(der.toString('binary'));
        const cert = forge.pki.certificateFromAsn1(asn1);
        addPemBlocks(forge.pki.certificateToPem(cert), seen, out);
      }
    } catch {
      /* ignora arquivo inválido */
    }
  }
}

/** CAs confiáveis para validar o certificado TLS da SEFAZ (ICP-Brasil + Mozilla + SO). */
export function buildSefazTrustedCas(): string[] {
  if (cachedCas) return cachedCas;

  const seen = new Set<string>();
  const out: string[] = [];
  const addFromList = (list: string[]) => {
    for (const pem of list) {
      const t = pem.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  };

  loadBundledSefazCas(seen, out);
  addFromList(getCACertificates('default'));
  try {
    addFromList(getCACertificates('system'));
  } catch {
    /* repositório do SO indisponível (ex.: container mínimo) */
  }

  const extraPath = process.env.FISCAL_TLS_EXTRA_CA?.trim();
  if (extraPath && existsSync(extraPath)) {
    addPemBlocks(readFileSync(extraPath, 'utf8'), seen, out);
  }

  cachedCas = out;
  return out;
}

export function sefazTlsRejectUnauthorized(): boolean {
  return process.env.FISCAL_SEFAZ_TLS_INSECURE !== '1';
}
