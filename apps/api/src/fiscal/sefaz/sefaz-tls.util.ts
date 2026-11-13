import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as forge from 'node-forge';
import * as tls from 'tls';

type CaStore = 'default' | 'system';

/** Node 22.15+ e 24 expõem getCACertificates. No Node 20 do VPS ela não existe. */
function readNodeCaStore(type: CaStore): readonly string[] {
  const reader = (tls as typeof tls & { getCACertificates?: (type?: string) => string[] }).getCACertificates;
  if (typeof reader === 'function') return reader(type);
  if (type === 'default') return tls.rootCertificates;
  return [];
}

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

const SYSTEM_CA_FILES = [
  '/etc/ssl/certs/ca-certificates.crt',
  '/etc/pki/tls/certs/ca-bundle.crt',
  '/etc/ssl/cert.pem',
];

function loadCertMaterial(full: string, seen: Set<string>, out: string[]) {
  const raw = readFileSync(full);
  const text = raw.toString('utf8');
  if (text.includes('-----BEGIN CERTIFICATE-----')) {
    addPemBlocks(text, seen, out);
    return;
  }
  const asn1 = forge.asn1.fromDer(raw.toString('binary'));
  const cert = forge.pki.certificateFromAsn1(asn1);
  addPemBlocks(forge.pki.certificateToPem(cert), seen, out);
}

function loadBundledSefazCas(seen: Set<string>, out: string[]) {
  const dir = join(__dirname, 'certs');
  if (!existsSync(dir)) return;

  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.pem') && !name.endsWith('.crt') && !name.endsWith('.cer')) continue;
    try {
      loadCertMaterial(join(dir, name), seen, out);
    } catch {
      /* ignora arquivo inválido */
    }
  }
}

/** Node 20 não lê o depósito do SO. No Linux os arquivos do ca-certificates cobrem a ICP-Brasil. */
function loadSystemCaFiles(seen: Set<string>, out: string[]) {
  for (const file of SYSTEM_CA_FILES) {
    if (!existsSync(file)) continue;
    try {
      addPemBlocks(readFileSync(file, 'utf8'), seen, out);
    } catch {
      /* arquivo ilegível */
    }
  }
}

/** CAs confiáveis para validar o certificado TLS da SEFAZ (ICP-Brasil + Mozilla + SO). */
export function buildSefazTrustedCas(): string[] {
  if (cachedCas) return cachedCas;

  const seen = new Set<string>();
  const out: string[] = [];
  const addFromList = (list: readonly string[]) => {
    for (const pem of list) {
      const t = pem.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  };

  loadBundledSefazCas(seen, out);
  addFromList(readNodeCaStore('default'));
  try {
    addFromList(readNodeCaStore('system'));
  } catch {
    /* repositório do SO indisponível (ex.: container mínimo) */
  }
  loadSystemCaFiles(seen, out);

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
