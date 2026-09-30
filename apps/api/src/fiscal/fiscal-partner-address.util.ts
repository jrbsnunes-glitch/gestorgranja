import { BadRequestException } from '@nestjs/common';

const CITY_IBGE: Record<string, string> = {
  'MANAUS:AM': '1302603',
  'MANACAPURU:AM': '1302603',
};

export type PartnerAddressFields = {
  street?: string | null;
  addressNumber?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
};

function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}

function escXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function assertFiscalPartnerAddress(partner: PartnerAddressFields, label = 'Cliente') {
  if (!partner.street?.trim()) {
    throw new BadRequestException(`${label}: informe logradouro no cadastro para NF-e (rejeição 726).`);
  }
  if (!partner.city?.trim()) {
    throw new BadRequestException(`${label}: informe município no cadastro para NF-e.`);
  }
  if (!partner.state?.trim() || partner.state.trim().length !== 2) {
    throw new BadRequestException(`${label}: informe UF (2 letras) no cadastro para NF-e.`);
  }
  const cep = onlyDigits(partner.zipCode || '');
  if (cep.length !== 8) {
    throw new BadRequestException(`${label}: informe CEP válido (8 dígitos) no cadastro para NF-e.`);
  }
}

export function resolvePartnerMunicipalIbge(
  partner: PartnerAddressFields,
  company: { city?: string | null; state?: string | null; municipalIbgeCode?: string | null },
): string {
  const pCity = partner.city?.trim().toUpperCase() ?? '';
  const pUf = (partner.state || company.state || 'AM').trim().toUpperCase();
  const cCity = company.city?.trim().toUpperCase() ?? '';
  const cUf = (company.state || 'AM').trim().toUpperCase();
  if (pCity && cCity && pCity === cCity && pUf === cUf && company.municipalIbgeCode?.trim()) {
    return company.municipalIbgeCode.trim();
  }
  return CITY_IBGE[`${pCity}:${pUf}`] ?? company.municipalIbgeCode?.trim() ?? '1302603';
}

export function buildEnderDestXml(
  partner: PartnerAddressFields,
  company: { city?: string | null; state?: string | null; municipalIbgeCode?: string | null },
): string {
  const uf = (partner.state || company.state || 'AM').toUpperCase();
  const city = partner.city?.trim() || company.city || 'Manaus';
  const cMun = resolvePartnerMunicipalIbge(partner, company);
  const cep = onlyDigits(partner.zipCode || '69000000').padStart(8, '0');
  const street = partner.street!.trim();
  const nro = partner.addressNumber?.trim() || 'S/N';
  const bairro = partner.district?.trim() || 'Centro';

  return (
    `<enderDest>` +
    `<xLgr>${escXml(street.slice(0, 60))}</xLgr>` +
    `<nro>${escXml(nro.slice(0, 60))}</nro>` +
    `<xBairro>${escXml(bairro.slice(0, 60))}</xBairro>` +
    `<cMun>${cMun}</cMun>` +
    `<xMun>${escXml(city.slice(0, 60))}</xMun>` +
    `<UF>${uf}</UF>` +
    `<CEP>${cep}</CEP>` +
    `<cPais>1058</cPais>` +
    `<xPais>Brasil</xPais>` +
    `</enderDest>`
  );
}
