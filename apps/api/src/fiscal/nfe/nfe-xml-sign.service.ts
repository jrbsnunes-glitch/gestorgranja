import { Injectable } from '@nestjs/common';
import { SignedXml } from 'xml-crypto';

const DIGEST_SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';
const SIG_RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const TRANSFORMS = [
  'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
  C14N,
] as const;

@Injectable()
export class NfeXmlSignService {
  signInfNfe(xml: string, id: string, privateKeyPem: string, certPem: string): string {
    if (!new RegExp(`<infNFe[^>]*Id="${id}"`).test(xml)) {
      throw new Error('infNFe não encontrado para assinatura');
    }
    return this.signElement(xml, 'infNFe', id, privateKeyPem, certPem);
  }

  signInfInut(inutXml: string, infId: string, privateKeyPem: string, certPem: string): string {
    if (!new RegExp(`<infInut[^>]*Id="${infId}"`).test(inutXml)) {
      throw new Error('infInut não encontrado');
    }
    return this.signElement(inutXml, 'infInut', infId, privateKeyPem, certPem);
  }

  signEventoXml(eventXml: string, infId: string, privateKeyPem: string, certPem: string): string {
    if (!new RegExp(`<infEvento[^>]*Id="${infId}"`).test(eventXml)) {
      throw new Error('infEvento não encontrado para assinatura');
    }
    return this.signElement(eventXml, 'infEvento', infId, privateKeyPem, certPem);
  }

  private signElement(
    xml: string,
    localName: 'infNFe' | 'infInut' | 'infEvento',
    infId: string,
    privateKeyPem: string,
    certPem: string,
  ): string {
    const doc = xml.replace(/^<\?xml[^?]*\?>\s*/, '');
    const xpathExpr = `//*[local-name()='${localName}' and @Id='${infId}']`;

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      publicCert: certPem,
      signatureAlgorithm: SIG_RSA_SHA1,
      canonicalizationAlgorithm: C14N,
    });

    sig.addReference({
      xpath: xpathExpr,
      transforms: [...TRANSFORMS],
      digestAlgorithm: DIGEST_SHA1,
      uri: `#${infId}`,
    });

    sig.computeSignature(doc, {
      location: { reference: xpathExpr, action: 'after' },
    });

    const signed = sig.getSignedXml();
    sig.checkSignature(signed);
    return signed;
  }
}
