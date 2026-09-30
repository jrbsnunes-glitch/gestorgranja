import { BadRequestException } from '@nestjs/common';
import {
  pickCfopFromNature,
  ProductWithFiscalSituation,
  resolveProductFiscalProfile,
} from './fiscal-product-profile.util';

export function assertFiscalCompany(company: {
  cnpj?: string;
  legalName?: string;
  stateReg?: string | null;
  municipalIbgeCode?: string | null;
  taxRegime?: number | null;
}) {
  if (!company.cnpj || company.cnpj.replace(/\D/g, '').length !== 14) {
    throw new BadRequestException('Empresa: CNPJ inválido para emissão fiscal');
  }
  if (!company.legalName?.trim()) throw new BadRequestException('Empresa: razão social obrigatória');
  if (!company.stateReg?.trim()) throw new BadRequestException('Empresa: inscrição estadual obrigatória');
  if (!company.municipalIbgeCode?.trim()) {
    throw new BadRequestException('Empresa: código IBGE do município obrigatório (ex.: 1302603 Manaus)');
  }
  if (!company.taxRegime) {
    throw new BadRequestException('Empresa: CRT (regime tributário) obrigatório');
  }
}

export function assertFiscalProduct(product: ProductWithFiscalSituation) {
  const profile = resolveProductFiscalProfile(product);
  if (!product.fiscalSituationId || !product.fiscalSituation) {
    throw new BadRequestException(
      `Produto "${product.name}": vincule uma situação fiscal em Cadastros → Situação fiscal`,
    );
  }
  if (!profile.ncm?.trim()) {
    throw new BadRequestException(
      `Produto "${product.name}": NCM obrigatório na situação fiscal "${product.fiscalSituation.code}"`,
    );
  }
  if (!profile.fiscalCst?.trim()) {
    throw new BadRequestException(
      `Produto "${product.name}": CSOSN/CST obrigatório na situação fiscal "${product.fiscalSituation.code}"`,
    );
  }
}

export function pickCfop(
  source: { cfopInternal?: string | null; cfopExternal?: string | null },
  destUf: string,
  emitUf: string,
) {
  const internal = source.cfopInternal?.trim() || '5102';
  const external = source.cfopExternal?.trim() || '6102';
  return destUf.toUpperCase() === emitUf.toUpperCase() ? internal : external;
}

export { pickCfopFromNature, resolveProductFiscalProfile };
