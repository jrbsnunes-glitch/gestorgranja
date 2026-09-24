import {
  COMPANY_LOGO_API_PATH,
  readCompanyLogoDataUrl,
  resolveCompanyLogoPath,
} from './company-logo.util';

export type CompanyBrandingDto = {
  legalName: string;
  tradeName: string | null;
  cnpj: string | null;
  logoUrl: string | null;
  logoDataUrl: string | null;
};

type TenantPrisma = {
  company: {
    findFirst: () => Promise<{
      id: string;
      legalName: string;
      tradeName: string | null;
      cnpj: string | null;
      logoUrl: string | null;
    } | null>;
    update: (args: {
      where: { id: string };
      data: { logoUrl: string | null };
    }) => Promise<{
      id: string;
      legalName: string;
      tradeName: string | null;
      cnpj: string | null;
      logoUrl: string | null;
    }>;
  };
};

/** Dados de cabeçalho de relatório (logo embutida quando houver arquivo no tenant). */
export async function loadCompanyBranding(
  prisma: TenantPrisma,
  tenantSlug: string,
): Promise<CompanyBrandingDto> {
  let company = await prisma.company.findFirst();
  if (!company) {
    const logoDataUrl = await readCompanyLogoDataUrl(tenantSlug);
    return {
      legalName: 'GestorGranja',
      tradeName: null,
      cnpj: null,
      logoUrl: logoDataUrl ? COMPANY_LOGO_API_PATH : null,
      logoDataUrl,
    };
  }

  const hasFile = resolveCompanyLogoPath(tenantSlug) != null;
  if (hasFile && !company.logoUrl) {
    company = await prisma.company.update({
      where: { id: company.id },
      data: { logoUrl: COMPANY_LOGO_API_PATH },
    });
  }
  if (!hasFile && company.logoUrl) {
    company = await prisma.company.update({
      where: { id: company.id },
      data: { logoUrl: null },
    });
  }

  const logoDataUrl = await readCompanyLogoDataUrl(tenantSlug);
  return {
    legalName: company.legalName,
    tradeName: company.tradeName,
    cnpj: company.cnpj,
    logoUrl: company.logoUrl,
    logoDataUrl,
  };
}
