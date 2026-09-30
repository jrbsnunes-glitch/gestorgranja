import { readCompanyLogoDataUrl } from '../cadastros/company-logo.util';
import {
  assertFiscalProduct,
  pickCfopFromNature,
  resolveProductFiscalProfile,
} from './fiscal-validation.util';
import { buildDanfeHtml, DanfeHtmlInput, DanfeItemRow } from './fiscal-danfe.util';
import type { FiscalDocument, Company, FiscalIssuerSettings, Prisma } from '../generated/tenant-client';

type DocWithOrder = FiscalDocument & {
  salesOrder: Prisma.SalesOrderGetPayload<{
    include: {
      partner: true;
      items: {
        include: {
          product: { include: { fiscalSituation: true } };
          operationNature: true;
        };
      };
    };
  }> | null;
};

function formatStreetLine(street?: string | null, number?: string | null, fallback?: string | null) {
  const line = [street || fallback, number].filter(Boolean).join(', ');
  return line || fallback || null;
}

function partnerDoc(p: { cnpj?: string | null; cpf?: string | null; document?: string | null }) {
  return p.cnpj || p.cpf || p.document || null;
}

export async function buildDanfeInputFromDocument(
  tenantSlug: string,
  doc: DocWithOrder,
  company: Company,
  settings: FiscalIssuerSettings,
  opts?: { preview?: boolean },
): Promise<DanfeHtmlInput> {
  const order = doc.salesOrder;
  const partner = order?.partner;
  const emitUf = (company.state || 'AM').toUpperCase();
  const destUf = (partner?.state || emitUf).toUpperCase();
  const logoDataUrl = await readCompanyLogoDataUrl(tenantSlug);

  let items: DanfeItemRow[] = [];
  let operationNatureLabel = 'VENDA DE MERCADORIA';
  if (order?.items?.length) {
    const firstNature = order.items[0]?.operationNature;
    if (firstNature?.description) {
      operationNatureLabel = firstNature.description.toUpperCase();
    }
    items = order.items.map((it, idx) => {
      const product = it.product;
      if (product) assertFiscalProduct(product);
      const profile = product ? resolveProductFiscalProfile(product) : null;
      const nature = it.operationNature;
      const cfop = nature
        ? pickCfopFromNature(nature, destUf, emitUf)
        : destUf === emitUf
          ? '5102'
          : '6102';
      const qty = Number(it.quantity);
      const unitPrice = Number(it.unitPrice);
      const discount = Number(it.discount);
      const total = qty * unitPrice - discount;
      const origin = product?.fiscalOrigin ?? '0';
      const cst = profile?.fiscalCst ?? '102';
      return {
        code: String(idx + 1),
        name: product?.name ?? it.eggCategory ?? 'Item',
        ncm: profile?.ncm ?? '04072100',
        cfop,
        cstDisplay: `${origin}/${cst}`,
        unit: product?.unit ?? 'UN',
        qty,
        unitPrice,
        total,
        discount,
      };
    });
  }

  const total =
    order != null
      ? Number(order.totalAmount)
      : items.reduce((s, i) => s + i.total, 0);

  return {
    model: doc.model ?? (doc.type === 'NFCE' ? '65' : '55'),
    accessKey: doc.accessKey,
    number: doc.number,
    series: doc.series,
    issuedAt: doc.issuedAt ?? new Date(),
    protocol: doc.protocol,
    companyName: company.tradeName || company.legalName,
    companyLegalName: company.legalName,
    companyCnpj: company.cnpj,
    companyIe: company.stateReg,
    companyAddress: formatStreetLine(company.street, company.addressNumber, company.address),
    companyDistrict: company.district,
    companyCity: company.city,
    companyState: company.state,
    companyZip: company.zipCode,
    companyPhone: company.phone,
    logoDataUrl,
    operationNature: operationNatureLabel,
    tpNF: '1',
    partnerName: partner?.name,
    partnerDoc: partner ? partnerDoc(partner) : null,
    partnerIe: partner?.stateRegistration,
    partnerAddress: partner
      ? formatStreetLine(partner.street, partner.addressNumber, null)
      : null,
    partnerDistrict: partner?.district,
    partnerCity: partner?.city,
    partnerState: partner?.state,
    partnerZip: partner?.zipCode,
    partnerPhone: partner?.phone ?? partner?.mobile,
    total,
    totalProducts: total,
    environment: settings.sefazEnvironment,
    items,
    preview: opts?.preview,
    cancelled: doc.status === 'CANCELLED',
  };
}

export async function renderDanfeHtmlForDocument(
  tenantSlug: string,
  doc: DocWithOrder,
  company: Company,
  settings: FiscalIssuerSettings,
  opts?: { preview?: boolean },
): Promise<string> {
  const input = await buildDanfeInputFromDocument(tenantSlug, doc, company, settings, opts);
  return buildDanfeHtml(input);
}
