import JsBarcode from 'jsbarcode';
import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
import QRCode from 'qrcode';
import { digitsOnly } from './sicoob-json.util';

export async function pixEmvToQrDataUrl(emv: string): Promise<string | null> {
  const t = emv.trim();
  if (!t.startsWith('000201') || t.length < 30) return null;
  try {
    return await QRCode.toDataURL(t, { width: 200, margin: 1, errorCorrectionLevel: 'M' });
  } catch {
    return null;
  }
}

export function itfBarcodeToSvg(codigoBarras: string): string | null {
  const digits = digitsOnly(codigoBarras);
  if (digits.length !== 44) return null;
  const g = globalThis as typeof globalThis & { document?: Document };
  const prevDoc = g.document;
  try {
    const document = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html', null);
    // jsbarcode acessa `document` global mesmo quando o SVG é do xmldom
    g.document = document as unknown as Document;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, digits, {
      format: 'ITF',
      width: 1.15,
      height: 50,
      displayValue: false,
      margin: 0,
    });
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return null;
  } finally {
    g.document = prevDoc;
  }
}
