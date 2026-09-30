import { Product, ProductFiscalSituation } from '../generated/tenant-client';

export type ProductFiscalProfile = {
  ncm: string | null;
  cest: string | null;
  fiscalCst: string | null;
  ibsCst: string | null;
  ibsClassTrib: string | null;
  fiscalOrigin: string | null;
  gtin: string | null;
};

export type ProductWithFiscalSituation = Product & {
  fiscalSituation?: ProductFiscalSituation | null;
};

export function resolveProductFiscalProfile(product: ProductWithFiscalSituation): ProductFiscalProfile {
  const fs = product.fiscalSituation;
  return {
    ncm: fs?.ncm ?? null,
    cest: fs?.cest ?? null,
    fiscalCst: fs?.fiscalCst ?? null,
    ibsCst: fs?.ibsCst ?? null,
    ibsClassTrib: fs?.ibsClassTrib ?? null,
    fiscalOrigin: product.fiscalOrigin ?? null,
    gtin: product.gtin ?? null,
  };
}

export function pickCfopFromNature(
  nature: { cfopInternal: string; cfopExternal: string },
  destUf: string,
  emitUf: string,
): string {
  const internal = nature.cfopInternal?.trim() || '5102';
  const external = nature.cfopExternal?.trim() || '6102';
  return destUf.toUpperCase() === emitUf.toUpperCase() ? internal : external;
}
