import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FiscalDocumentStatus, PrismaClient, SefazEnvironment } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FiscalCertService, ParsedCert } from './fiscal-cert.service';
import { buildDanfeHtml } from './fiscal-danfe.util';
import { readCompanyLogoDataUrl } from '../cadastros/company-logo.util';
import { writeFiscalDanfeHtml, writeFiscalXml } from './fiscal-storage.util';
import { assertFiscalPartnerAddress } from './fiscal-partner-address.util';
import {
  assertFiscalCompany,
  assertFiscalProduct,
  pickCfopFromNature,
  resolveProductFiscalProfile,
} from './fiscal-validation.util';
import { assertFiscalRespTec, resolveFiscalRespTec } from './fiscal-resptec.util';
import { FiscalCryptoService } from './fiscal-crypto.service';
import { NfeXmlBuilder } from './nfe/nfe-xml.builder';
import { NfeXmlSignService } from './nfe/nfe-xml-sign.service';
import { amWebservices, FiscalModel } from './sefaz/am-webservices';
import { SefazSoapClient } from './sefaz/sefaz-soap.client';

export type EmitJobPayload = {
  tenantSlug: string;
  fiscalDocumentId: string;
};

@Injectable()
export class FiscalEmissionService {
  private readonly logger = new Logger(FiscalEmissionService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly builder: NfeXmlBuilder,
    private readonly signer: NfeXmlSignService,
    private readonly soap: SefazSoapClient,
    private readonly certService: FiscalCertService,
    private readonly fiscalCrypto: FiscalCryptoService,
  ) {}

  async processEmission(payload: EmitJobPayload) {
    const prisma = await this.tenantPrisma.getClient(payload.tenantSlug);
    const doc = await prisma.fiscalDocument.findUnique({
      where: { id: payload.fiscalDocumentId },
      include: {
        salesOrder: {
          include: {
            partner: true,
            items: {
              include: {
                product: { include: { fiscalSituation: true } },
                operationNature: true,
              },
            },
          },
        },
      },
    });
    if (!doc) throw new NotFoundException('Documento fiscal não encontrado');
    if (doc.status === FiscalDocumentStatus.AUTHORIZED) return doc;

    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company?.fiscalIssuerSettings) {
      throw new BadRequestException('Configure o emissor fiscal (certificado e ambiente)');
    }
    const settings = company.fiscalIssuerSettings;
    assertFiscalCompany(company);

    const order = doc.salesOrder;
    if (!order) throw new BadRequestException('Documento sem pedido de venda');
    if (order.status !== 'CONFIRMED') {
      throw new BadRequestException('Pedido precisa estar confirmado para emitir NF');
    }

    const model: FiscalModel = doc.type === 'NFCE' ? '65' : '55';
    if (model === '65' && (!settings.nfceCscId || !settings.nfceCsc)) {
      throw new BadRequestException('NFC-e: configure CSC e ID CSC');
    }
    if (model === '55') {
      const p = order.partner;
      const docNum = onlyDigits(p.cnpj || p.cpf || p.document || '');
      if (docNum.length !== 11 && docNum.length !== 14) {
        throw new BadRequestException('NF-e: cliente com CPF/CNPJ inválido');
      }
      assertFiscalPartnerAddress(p, 'Cliente');
    }

    const certPassword = this.certService.resolvePassword(settings);
    const cert = this.certService.loadPfx(payload.tenantSlug, certPassword);
    const respTecRaw = resolveFiscalRespTec(settings, this.fiscalCrypto);
    assertFiscalRespTec(respTecRaw);
    const respTec = respTecRaw!;
    if (cert.cnpjFromCert && onlyDigits(cert.cnpjFromCert) !== onlyDigits(company.cnpj)) {
      throw new BadRequestException('CNPJ do certificado difere do CNPJ da empresa');
    }

    const emitUf = (company.state || 'AM').toUpperCase();
    const destUf = (order.partner.state || emitUf).toUpperCase();
    const items = order.items.map((it, idx) => {
      const name = it.product?.name ?? it.eggCategory ?? 'Item';
      const product = it.product;
      if (product) assertFiscalProduct(product);
      const profile = product ? resolveProductFiscalProfile(product) : null;
      const qty = Number(it.quantity);
      const unitPrice = Number(it.unitPrice);
      const total = qty * unitPrice - Number(it.discount);
      const nature = it.operationNature;
      const cfop = nature
        ? pickCfopFromNature(nature, destUf, emitUf)
        : destUf === emitUf
          ? '5102'
          : '6102';
      return {
        nItem: idx + 1,
        name,
        ncm: profile?.ncm ?? '04072100',
        cfop,
        unit: product?.unit ?? 'UN',
        quantity: qty,
        unitPrice,
        total,
        cst: profile?.fiscalCst ?? '102',
        origin: profile?.fiscalOrigin ?? '0',
        gtin: profile?.gtin,
        ibsCst: profile?.ibsCst,
        ibsClassTrib: profile?.ibsClassTrib,
      };
    });

    const { series, number } = await this.allocateNumber(prisma, settings.id, model, settings);

    const built = this.builder.build({
      model,
      environment: settings.sefazEnvironment,
      company,
      partner: model === '55' ? order.partner : null,
      items,
      series,
      number,
      totalAmount: Number(order.totalAmount),
      nfce:
        model === '65'
          ? { cscId: settings.nfceCscId!, csc: settings.nfceCsc! }
          : undefined,
      respTec,
    });

    let signed = this.signer.signInfNfe(built.xml, built.infId, cert.privateKeyPem, cert.certificatePem);
    signed = signed.replace(/^<\?xml[^?]*\?>\s*/, '');

    const idLote = String(Date.now()).slice(-15);
    const envi = `<enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>${idLote}</idLote><indSinc>1</indSinc>${signed}</enviNFe>`;
    const soapBody = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${envi}</nfeDadosMsg>`;

    const ws = amWebservices(settings.sefazEnvironment, model);
    const soapRes = await this.soap.postSoap(ws.autorizacao, soapBody, cert);
    const parsed = await this.resolveAutorizacaoResult(
      soapRes,
      ws.retAutorizacao,
      settings.sefazEnvironment,
      cert,
    );

    const xmlPath = writeFiscalXml(payload.tenantSlug, doc.id, signed);
    await prisma.fiscalDocument.update({
      where: { id: doc.id },
      data: {
        model,
        series,
        number,
        accessKey: built.accessKey,
        xmlStorageKey: xmlPath,
      },
    });

    if (parsed.status === 'authorized') {
      const logoDataUrl = await readCompanyLogoDataUrl(payload.tenantSlug);
      const danfe = buildDanfeHtml({
        model,
        accessKey: parsed.accessKey ?? built.accessKey,
        number,
        series,
        issuedAt: new Date(),
        protocol: parsed.protocol,
        companyName: company.tradeName || company.legalName,
        companyLegalName: company.legalName,
        companyCnpj: company.cnpj,
        companyIe: company.stateReg,
        companyAddress: [company.street || company.address, company.addressNumber].filter(Boolean).join(', '),
        companyDistrict: company.district,
        companyCity: company.city,
        companyState: company.state,
        companyZip: company.zipCode,
        companyPhone: company.phone,
        logoDataUrl,
        operationNature: 'VENDA DE MERCADORIA',
        tpNF: '1',
        partnerName: order.partner.name,
        partnerDoc: order.partner.cnpj || order.partner.cpf || order.partner.document,
        partnerIe: order.partner.stateRegistration,
        partnerAddress: [order.partner.street, order.partner.addressNumber].filter(Boolean).join(', '),
        partnerDistrict: order.partner.district,
        partnerCity: order.partner.city,
        partnerState: order.partner.state,
        partnerZip: order.partner.zipCode,
        partnerPhone: order.partner.phone ?? order.partner.mobile,
        total: Number(order.totalAmount),
        totalProducts: Number(order.totalAmount),
        environment: settings.sefazEnvironment,
        items: items.map((i) => ({
          code: String(i.nItem),
          name: i.name,
          ncm: i.ncm,
          cfop: i.cfop,
          cstDisplay: `${i.origin ?? '0'}/${i.cst ?? '102'}`,
          unit: i.unit,
          qty: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
        })),
      });
      const danfePath = writeFiscalDanfeHtml(payload.tenantSlug, doc.id, danfe);
      return prisma.fiscalDocument.update({
        where: { id: doc.id },
        data: {
          status: FiscalDocumentStatus.AUTHORIZED,
          protocol: parsed.protocol,
          accessKey: parsed.accessKey ?? built.accessKey,
          issuedAt: new Date(),
          danfeStorageKey: danfePath,
          errorMessage: null,
        },
      });
    }

    const rejectMsg = parsed.message ?? 'Rejeitado pela SEFAZ';
    const soapHint =
      parsed.status === 'processing'
        ? ' (lote em processamento — consulta retorno ainda não implementada)'
        : '';
    return prisma.fiscalDocument.update({
      where: { id: doc.id },
      data: {
        status: FiscalDocumentStatus.REJECTED,
        errorMessage: `${rejectMsg}${soapHint}`.slice(0, 500),
      },
    });
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private async resolveAutorizacaoResult(
    initialSoap: string,
    retAutorizacaoUrl: string,
    environment: SefazEnvironment,
    cert: ParsedCert,
  ) {
    let parsed = this.soap.extractAutorizacaoResult(initialSoap);
    if (parsed.status !== 'processing') return parsed;

    const nRec = this.soap.extractRecibo(initialSoap);
    if (!nRec) return parsed;

    const tpAmb = environment === 'producao' ? '1' : '2';
    const cons = `<consReciNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><nRec>${nRec}</nRec></consReciNFe>`;
    const retBody = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">${cons}</nfeDadosMsg>`;

    for (let attempt = 0; attempt < 10; attempt++) {
      await this.sleep(attempt === 0 ? 1500 : 2500);
      const retSoap = await this.soap.postSoap(retAutorizacaoUrl, retBody, cert);
      parsed = this.soap.extractAutorizacaoResult(retSoap);
      if (parsed.status === 'authorized') return parsed;
      if (parsed.status === 'rejected') {
        const code = parsed.message?.match(/^(\d+)/)?.[1];
        if (code === '105' || code === '106') continue;
        return parsed;
      }
    }

    return {
      status: 'rejected' as const,
      message: 'Lote em processamento na SEFAZ — tente consultar o retorno em alguns segundos',
    };
  }

  private async allocateNumber(
    prisma: PrismaClient,
    settingsId: string,
    model: FiscalModel,
    settings: { series: number; nfceSeries: number; lastNfeNumber: number; lastNfceNumber: number },
  ) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.fiscalIssuerSettings.findUniqueOrThrow({ where: { id: settingsId } });
      if (model === '65') {
        const number = current.lastNfceNumber + 1;
        await tx.fiscalIssuerSettings.update({
          where: { id: settingsId },
          data: { lastNfceNumber: number },
        });
        return { series: current.nfceSeries, number };
      }
      const number = current.lastNfeNumber + 1;
      await tx.fiscalIssuerSettings.update({
        where: { id: settingsId },
        data: { lastNfeNumber: number },
      });
      return { series: current.series, number };
    });
  }

  async cancelDocument(tenantSlug: string, docId: string, reason: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const doc = await prisma.fiscalDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    if (doc.status !== FiscalDocumentStatus.AUTHORIZED || !doc.accessKey || !doc.protocol) {
      throw new BadRequestException('Somente NF autorizada pode ser cancelada');
    }
    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company?.fiscalIssuerSettings) throw new BadRequestException('Emissor não configurado');
    const settings = company.fiscalIssuerSettings;
    const cert = this.certService.loadPfx(
      tenantSlug,
      this.certService.resolvePassword(settings),
    );
    const model = (doc.model as FiscalModel) || '55';
    const infId = `ID110111${doc.accessKey}01`;
    let eventXml = this.builder.buildCancelEvent({
      accessKey: doc.accessKey,
      protocol: doc.protocol,
      reason,
      cnpj: company.cnpj,
      environment: settings.sefazEnvironment,
      seq: 1,
    });
    eventXml = this.signer.signEventoXml(eventXml, infId, cert.privateKeyPem, cert.certificatePem);
    const body = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${eventXml}</nfeDadosMsg>`;
    const ws = amWebservices(settings.sefazEnvironment, model);
    const res = await this.soap.postSoap(ws.recepcaoEvento, body, cert);
    const out = this.soap.extractEventResult(res);
    if (!out.ok) throw new BadRequestException(out.message ?? 'Falha no cancelamento');
    return prisma.fiscalDocument.update({
      where: { id: docId },
      data: {
        status: FiscalDocumentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelProtocol: out.protocol,
      },
    });
  }

  async correctionLetter(tenantSlug: string, docId: string, text: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const doc = await prisma.fiscalDocument.findUnique({
      where: { id: docId },
      include: { correctionLetters: true },
    });
    if (!doc?.accessKey || doc.status !== FiscalDocumentStatus.AUTHORIZED) {
      throw new BadRequestException('NF autorizada necessária para CC-e');
    }
    const seq = doc.correctionLetters.length + 1;
    if (seq > 20) throw new BadRequestException('Limite de 20 cartas de correção');
    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company?.fiscalIssuerSettings) throw new BadRequestException('Emissor não configurado');
    const settings = company.fiscalIssuerSettings;
    const cert = this.certService.loadPfx(
      tenantSlug,
      this.certService.resolvePassword(settings),
    );
    const model = (doc.model as FiscalModel) || '55';
    const infId = `ID110110${doc.accessKey}${String(seq).padStart(2, '0')}`;
    let eventXml = this.builder.buildCceEvent({
      accessKey: doc.accessKey,
      correction: text,
      cnpj: company.cnpj,
      environment: settings.sefazEnvironment,
      seq,
    });
    eventXml = this.signer.signEventoXml(eventXml, infId, cert.privateKeyPem, cert.certificatePem);
    const body = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${eventXml}</nfeDadosMsg>`;
    const ws = amWebservices(settings.sefazEnvironment, model);
    const res = await this.soap.postSoap(ws.recepcaoEvento, body, cert);
    const out = this.soap.extractEventResult(res);
    if (!out.ok) throw new BadRequestException(out.message ?? 'Falha na CC-e');
    return prisma.fiscalCorrectionLetter.create({
      data: {
        fiscalDocumentId: docId,
        sequence: seq,
        correctionText: text,
        protocol: out.protocol,
      },
    });
  }

  async inutilizeNumbers(
    tenantSlug: string,
    data: {
      model: '55' | '65';
      series: number;
      numberFrom: number;
      numberTo: number;
      reason: string;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company?.fiscalIssuerSettings) throw new BadRequestException('Emissor não configurado');
    const settings = company.fiscalIssuerSettings;
    const cert = this.certService.loadPfx(
      tenantSlug,
      this.certService.resolvePassword(settings),
    );
    const y = String(new Date().getFullYear());
    const infId = `ID${'13'}${y}${company.cnpj.replace(/\D/g, '').padStart(14, '0')}${data.model}${String(data.series).padStart(3, '0')}${String(data.numberFrom).padStart(9, '0')}${String(data.numberTo).padStart(9, '0')}`;
    let xml = this.builder.buildInutilizacao({
      cnpj: company.cnpj,
      series: data.series,
      numberFrom: data.numberFrom,
      numberTo: data.numberTo,
      model: data.model,
      reason: data.reason,
      environment: settings.sefazEnvironment,
    });
    xml = this.signer.signInfInut(xml, infId, cert.privateKeyPem, cert.certificatePem);
    const body = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4">${xml}</nfeDadosMsg>`;
    const ws = amWebservices(settings.sefazEnvironment, data.model);
    const res = await this.soap.postSoap(ws.inutilizacao, body, cert);
    const out = this.soap.extractEventResult(res);
    if (!out.ok) throw new BadRequestException(out.message ?? 'Falha na inutilização');
    return { ok: true, protocol: out.protocol, message: out.message };
  }

  async buildManualNfePreview(tenantSlug: string, params: {
    company: {
      address?: string | null;
      cnpj: string;
      legalName: string;
      tradeName?: string | null;
      stateReg?: string | null;
      taxRegime?: number | null;
      street?: string | null;
      addressNumber?: string | null;
      district?: string | null;
      city?: string | null;
      state?: string | null;
      zipCode?: string | null;
      municipalIbgeCode?: string | null;
      phone?: string | null;
    };
    settings: {
      sefazEnvironment: 'homologacao' | 'producao';
      series: number;
      lastNfeNumber: number;
      respTecCnpj?: string | null;
      respTecContact?: string | null;
      respTecEmail?: string | null;
      respTecPhone?: string | null;
      respTecCsrtId?: string | null;
      respTecCsrtEnc?: string | null;
    };
    partner: {
      name: string;
      cnpj?: string | null;
      cpf?: string | null;
      document?: string | null;
      state?: string | null;
      stateRegistration?: string | null;
      email?: string | null;
      street?: string | null;
      addressNumber?: string | null;
      district?: string | null;
      city?: string | null;
      zipCode?: string | null;
      phone?: string | null;
      mobile?: string | null;
    };
    items: {
      nItem: number;
      name: string;
      ncm?: string | null;
      cfop: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      total: number;
      cst?: string | null;
      origin?: string | null;
      gtin?: string | null;
    }[];
    totalAmount: number;
  }) {
    const { company, settings, partner, items, totalAmount } = params;
    const series = settings.series;
    const number = settings.lastNfeNumber + 1;
    const respTecRaw = resolveFiscalRespTec(settings, this.fiscalCrypto);
    assertFiscalRespTec(respTecRaw);
    const built = this.builder.build({
      model: '55',
      environment: settings.sefazEnvironment,
      company,
      partner,
      items,
      series,
      number,
      totalAmount,
      respTec: respTecRaw!,
    });
    const logoDataUrl = await readCompanyLogoDataUrl(tenantSlug);
    const html = buildDanfeHtml({
      model: '55',
      accessKey: built.accessKey,
      series,
      number,
      issuedAt: new Date(),
      companyName: company.tradeName || company.legalName,
      companyLegalName: company.legalName,
      companyCnpj: company.cnpj,
      companyIe: company.stateReg,
      companyAddress: [company.street || company.address, company.addressNumber].filter(Boolean).join(', '),
      companyDistrict: company.district,
      companyCity: company.city,
      companyState: company.state,
      companyZip: company.zipCode,
      companyPhone: company.phone,
      logoDataUrl,
      operationNature: 'VENDA DE MERCADORIA',
      tpNF: '1',
      partnerName: partner.name,
      partnerDoc: partner.cnpj || partner.cpf || partner.document,
      partnerIe: partner.stateRegistration,
      partnerAddress: [partner.street, partner.addressNumber].filter(Boolean).join(', '),
      partnerDistrict: partner.district,
      partnerCity: partner.city,
      partnerState: partner.state,
      partnerZip: partner.zipCode,
      partnerPhone: partner.phone ?? partner.mobile,
      total: totalAmount,
      totalProducts: totalAmount,
      environment: settings.sefazEnvironment,
      items: items.map((i) => ({
        code: String(i.nItem),
        name: i.name,
        ncm: i.ncm,
        cfop: i.cfop,
        cstDisplay: `${i.origin ?? '0'}/${i.cst ?? '102'}`,
        unit: i.unit,
        qty: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
      })),
      preview: true,
    });
    return {
      html,
      accessKey: built.accessKey,
      series,
      number,
      total: totalAmount,
      partnerName: partner.name,
    };
  }

  async consultDocumentSituation(tenantSlug: string, docId: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const doc = await prisma.fiscalDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    const chave = doc.accessKey?.replace(/\D/g, '');
    if (!chave || chave.length !== 44) {
      throw new BadRequestException('Documento ainda não possui chave de acesso para consulta na SEFAZ');
    }

    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company?.fiscalIssuerSettings) throw new BadRequestException('Emissor não configurado');
    const settings = company.fiscalIssuerSettings;
    const cert = this.certService.loadPfx(
      tenantSlug,
      this.certService.resolvePassword(settings),
    );
    const model = (doc.model as FiscalModel) || (doc.type === 'NFCE' ? '65' : '55');
    const tpAmb = settings.sefazEnvironment === 'producao' ? '1' : '2';
    const cons = `<consSitNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe>`;
    const body = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">${cons}</nfeDadosMsg>`;
    const ws = amWebservices(settings.sefazEnvironment, model);
    const res = await this.soap.postSoap(ws.consulta, body, cert);
    const parsed = this.soap.extractConsultaSitNFe(res);

    if (parsed.sefazStatus === 'authorized' && doc.status !== FiscalDocumentStatus.AUTHORIZED) {
      await prisma.fiscalDocument.update({
        where: { id: docId },
        data: {
          status: FiscalDocumentStatus.AUTHORIZED,
          protocol: parsed.protocol ?? doc.protocol,
          errorMessage: null,
        },
      });
    } else if (parsed.sefazStatus === 'cancelled' && doc.status !== FiscalDocumentStatus.CANCELLED) {
      await prisma.fiscalDocument.update({
        where: { id: docId },
        data: {
          status: FiscalDocumentStatus.CANCELLED,
          cancelProtocol: parsed.protocol ?? doc.cancelProtocol,
          cancelledAt: new Date(),
          errorMessage: null,
        },
      });
    } else if (parsed.sefazStatus === 'rejected' && doc.status === FiscalDocumentStatus.PROCESSING) {
      await prisma.fiscalDocument.update({
        where: { id: docId },
        data: {
          status: FiscalDocumentStatus.REJECTED,
          errorMessage: (parsed.message ?? 'Rejeitada na consulta SEFAZ').slice(0, 500),
        },
      });
    }

    const refreshed = await prisma.fiscalDocument.findUnique({ where: { id: docId } });
    return { ...parsed, document: refreshed };
  }

  async testSefazStatus(tenantSlug: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company?.fiscalIssuerSettings) throw new BadRequestException('Emissor não configurado');
    const settings = company.fiscalIssuerSettings;
    const cert = this.certService.loadPfx(
      tenantSlug,
      this.certService.resolvePassword(settings),
    );
    const tpAmb = settings.sefazEnvironment === 'producao' ? '1' : '2';
    const cons = `<consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><cUF>${'13'}</cUF><xServ>STATUS</xServ></consStatServ>`;
    const body = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">${cons}</nfeDadosMsg>`;
    const ws = amWebservices(settings.sefazEnvironment, '55');
    try {
      const res = await this.soap.postSoap(ws.status, body, cert);
      const parsed = this.soap.extractStatusServico(res);
      return {
        ok: parsed.ok,
        cStat: parsed.cStat,
        message: parsed.message,
        raw: res.slice(0, 800),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const tlsHint = /self-signed certificate|certificate chain|unable to verify/i.test(msg)
        ? ' No servidor Linux, defina FISCAL_TLS_EXTRA_CA com a cadeia ICP-Brasil; em dev com proxy, só FISCAL_SEFAZ_TLS_INSECURE=1.'
        : '';
      throw new BadRequestException(
        `Não foi possível consultar a SEFAZ AM: ${msg}. Confira certificado, senha e internet do servidor.${tlsHint}`,
      );
    }
  }
}

function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}
