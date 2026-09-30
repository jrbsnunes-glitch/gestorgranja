export type ManualNfeItemInput = {
  productId?: string;
  /** Cadastros → Natureza da operação (CFOP) */
  operationNatureId?: string;
  description?: string;
  /** Item avulso: situação fiscal com NCM/CST/IBS */
  fiscalSituationId?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
};

export type ManualNfePartnerInput = {
  personType?: 'PF' | 'PJ';
  name?: string;
  cpf?: string;
  cnpj?: string;
  stateRegistration?: string;
  email?: string;
  phone?: string;
  zipCode?: string;
  street?: string;
  addressNumber?: string;
  district?: string;
  city?: string;
  state?: string;
};

export type ManualNfeInput = {
  partnerId?: string;
  partner?: ManualNfePartnerInput;
  items: ManualNfeItemInput[];
  /** Default true — envia NF-e após gravar o pedido. */
  emitNow?: boolean;
};
