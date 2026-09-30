import { SefazEnvironment } from '../../generated/tenant-client';

export type FiscalModel = '55' | '65';

/**
 * URLs oficiais SEFAZ/AM (PDF + portal NFC-e). Path é case-sensitive (Nfe*, RecepcaoEvento4).
 * @see http://sistemas.sefaz.am.gov.br/nfeweb-hom/portal/pdf/Enderecos_Web_Services_SEFAZ_AM.pdf
 */
const AM = {
  nfe: {
    homologacao: {
      autorizacao:
        'https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4',
      retAutorizacao:
        'https://homnfe.sefaz.am.gov.br/services2/services/NfeRetAutorizacao4',
      consulta:
        'https://homnfe.sefaz.am.gov.br/services2/services/NfeConsulta4',
      recepcaoEvento:
        'https://homnfe.sefaz.am.gov.br/services2/services/RecepcaoEvento4',
      inutilizacao:
        'https://homnfe.sefaz.am.gov.br/services2/services/NfeInutilizacao4',
      status: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeStatusServico4',
    },
    producao: {
      autorizacao: 'https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4',
      retAutorizacao:
        'https://nfe.sefaz.am.gov.br/services2/services/NfeRetAutorizacao4',
      consulta: 'https://nfe.sefaz.am.gov.br/services2/services/NfeConsulta4',
      recepcaoEvento:
        'https://nfe.sefaz.am.gov.br/services2/services/RecepcaoEvento4',
      inutilizacao:
        'https://nfe.sefaz.am.gov.br/services2/services/NfeInutilizacao4',
      status: 'https://nfe.sefaz.am.gov.br/services2/services/NfeStatusServico4',
    },
  },
  nfce: {
    homologacao: {
      autorizacao:
        'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',
      retAutorizacao:
        'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeRetAutorizacao4',
      consulta:
        'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeConsulta4',
      recepcaoEvento:
        'https://homnfce.sefaz.am.gov.br/nfce-services/services/RecepcaoEvento4',
      inutilizacao:
        'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeInutilizacao4',
      status:
        'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4',
    },
    producao: {
      autorizacao: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',
      retAutorizacao:
        'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeRetAutorizacao4',
      consulta:
        'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeConsulta4',
      recepcaoEvento:
        'https://nfce.sefaz.am.gov.br/nfce-services/services/RecepcaoEvento4',
      inutilizacao:
        'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeInutilizacao4',
      status: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4',
    },
  },
} as const;

export function amWebservices(env: SefazEnvironment, model: FiscalModel) {
  const bucket = model === '65' ? AM.nfce : AM.nfe;
  return bucket[env];
}

export function sefazUfCode(): string {
  return '13'; // Amazonas
}
