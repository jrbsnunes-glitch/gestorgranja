import { PartnerPersonType } from '../generated/tenant-client';

export type PartnerPayload = {
  personType?: PartnerPersonType;
  name: string;
  tradeName?: string;
  cpf?: string;
  cnpj?: string;
  document?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  stateRegistration?: string;
  zipCode?: string;
  street?: string;
  addressNumber?: string;
  addressComplement?: string;
  district?: string;
  city?: string;
  state?: string;
  isCustomer?: boolean;
  isSupplier?: boolean;
};

export function normalizePartnerPayload(data: PartnerPayload) {
  const personType = data.personType ?? PartnerPersonType.PJ;
  const cpf = data.cpf?.replace(/\D/g, '') || undefined;
  const cnpj = data.cnpj?.replace(/\D/g, '') || undefined;
  const document =
    data.document?.trim() ||
    (personType === PartnerPersonType.PF ? cpf : cnpj) ||
    cpf ||
    cnpj;

  return {
    personType,
    name: data.name.trim(),
    tradeName: data.tradeName?.trim() || undefined,
    document,
    cpf: personType === PartnerPersonType.PF ? cpf : cpf || undefined,
    cnpj: personType === PartnerPersonType.PJ ? cnpj : cnpj || undefined,
    email: data.email?.trim().toLowerCase() || undefined,
    phone: data.phone?.trim() || undefined,
    mobile: data.mobile?.trim() || undefined,
    stateRegistration: data.stateRegistration?.trim() || undefined,
    zipCode: data.zipCode?.replace(/\D/g, '') || undefined,
    street: data.street?.trim() || undefined,
    addressNumber: data.addressNumber?.trim() || undefined,
    addressComplement: data.addressComplement?.trim() || undefined,
    district: data.district?.trim() || undefined,
    city: data.city?.trim() || undefined,
    state: data.state?.trim().toUpperCase().slice(0, 2) || undefined,
    isCustomer: data.isCustomer ?? false,
    isSupplier: data.isSupplier ?? true,
  };
}
