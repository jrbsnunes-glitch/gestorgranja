import { BadRequestException, Injectable } from '@nestjs/common';
import * as forge from 'node-forge';
import { readFiscalCert } from './fiscal-storage.util';
import { FiscalCryptoService } from './fiscal-crypto.service';

export type ParsedCert = {
  privateKeyPem: string;
  /** Certificado do emitente (folha) — usado na assinatura XML. */
  certificatePem: string;
  /** Folha e intermediários do PFX, sem a raiz autoassinada, para o mTLS da SEFAZ. */
  certificateChainPem: string[];
  notAfter: Date;
  cnpjFromCert: string | null;
};

@Injectable()
export class FiscalCertService {
  constructor(private readonly crypto: FiscalCryptoService) {}

  resolvePassword(settings: {
    certificatePasswordEnc?: string | null;
    certificatePassword?: string | null;
  }): string {
    if (settings.certificatePasswordEnc) {
      return this.crypto.decrypt(settings.certificatePasswordEnc);
    }
    if (settings.certificatePassword) return settings.certificatePassword;
    throw new BadRequestException('Senha do certificado não configurada');
  }

  loadPfx(tenantSlug: string, password: string): ParsedCert {
    const buf = readFiscalCert(tenantSlug);
    if (!buf) throw new BadRequestException('Certificado A1 não enviado (.pfx)');

    try {
      const asn1 = forge.asn1.fromDer(buf.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
      const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = bags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
      const privateKey = keyBag?.key;
      if (!privateKey) throw new Error('Chave privada ausente no PFX');

      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const bagList = certBags[forge.pki.oids.certBag] ?? [];
      const certs = bagList.map((b) => b.cert).filter((c): c is forge.pki.Certificate => !!c);
      const cert = certs.find((c) => samePublicKey(c, privateKey)) ?? certs.find((c) => !isSelfSigned(c)) ?? certs[0];
      if (!cert) throw new Error('Certificado ausente no PFX');

      const cn = cert.subject.getField('CN')?.value as string | undefined;
      const cnpjMatch = cn?.replace(/\D/g, '').match(/\d{14}/);

      return {
        privateKeyPem: forge.pki.privateKeyToPem(privateKey),
        certificatePem: forge.pki.certificateToPem(cert),
        certificateChainPem: clientChainPem(certs, cert),
        notAfter: cert.validity.notAfter,
        cnpjFromCert: cnpjMatch?.[0] ?? null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Certificado inválido ou senha incorreta: ${msg}`);
    }
  }
}

function isSelfSigned(cert: forge.pki.Certificate): boolean {
  return cert.subject.hash === cert.issuer.hash;
}

function samePublicKey(cert: forge.pki.Certificate, key: forge.pki.PrivateKey): boolean {
  const pub = cert.publicKey as forge.pki.rsa.PublicKey;
  const priv = key as forge.pki.rsa.PrivateKey;
  if (!pub?.n || !priv?.n || !pub.e || !priv.e) return false;
  return pub.n.compareTo(priv.n) === 0 && pub.e.compareTo(priv.e) === 0;
}

/** Folha + intermediários, sem a raiz autoassinada. A raiz na cadeia do PFX quebra o TLS da SEFAZ. */
function clientChainPem(certs: forge.pki.Certificate[], leaf: forge.pki.Certificate): string[] {
  const pool = certs.filter((c) => c !== leaf && !isSelfSigned(c));
  const ordered: forge.pki.Certificate[] = [leaf];
  let current = leaf;
  while (pool.length) {
    const idx = pool.findIndex((c) => c.subject.hash === current.issuer.hash);
    if (idx < 0) break;
    const next = pool.splice(idx, 1)[0];
    ordered.push(next);
    current = next;
  }
  ordered.push(...pool);
  return ordered.map((c) => forge.pki.certificateToPem(c));
}
