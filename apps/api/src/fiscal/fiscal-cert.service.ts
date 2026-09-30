import { BadRequestException, Injectable } from '@nestjs/common';
import * as forge from 'node-forge';
import { readFiscalCert } from './fiscal-storage.util';
import { FiscalCryptoService } from './fiscal-crypto.service';

export type ParsedCert = {
  privateKeyPem: string;
  /** Certificado do emitente (folha) — usado na assinatura XML. */
  certificatePem: string;
  /** Cadeia completa do PFX (folha + intermediários) para mTLS na SEFAZ. */
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
      if (!keyBag?.key) throw new Error('Chave privada ausente no PFX');

      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const bagList = certBags[forge.pki.oids.certBag] ?? [];
      const certBag = bagList[0];
      if (!certBag?.cert) throw new Error('Certificado ausente no PFX');

      const cert = certBag.cert;
      const certificateChainPem = bagList
        .map((b) => (b.cert ? forge.pki.certificateToPem(b.cert) : ''))
        .filter(Boolean);
      const cn = cert.subject.getField('CN')?.value as string | undefined;
      const cnpjMatch = cn?.replace(/\D/g, '').match(/\d{14}/);

      return {
        privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
        certificatePem: forge.pki.certificateToPem(cert),
        certificateChainPem: certificateChainPem.length ? certificateChainPem : [forge.pki.certificateToPem(cert)],
        notAfter: cert.validity.notAfter,
        cnpjFromCert: cnpjMatch?.[0] ?? null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Certificado inválido ou senha incorreta: ${msg}`);
    }
  }
}
