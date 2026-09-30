import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtPayload } from '../auth/jwt.strategy';
import { FiscalDocumentStatus, SefazEnvironment } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FiscalCryptoService } from './fiscal-crypto.service';
import { FiscalEmissionService } from './fiscal-emission.service';
import { writeFiscalCert, readFiscalFile } from './fiscal-storage.util';
import { FiscalCertService } from './fiscal-cert.service';
import { assertFiscalPartnerAddress } from './fiscal-partner-address.util';
import {
  assertFiscalCompany,
  assertFiscalProduct,
  pickCfopFromNature,
  resolveProductFiscalProfile,
} from './fiscal-validation.util';
import {
  DEFAULT_FISCAL_SITUATION_ID,
  DEFAULT_OPERATION_NATURE_ID,
  FISCAL_EGG_DEFAULTS,
} from '../provisioning/fiscal-product-defaults';
import { ManualNfeInput, ManualNfeItemInput } from './manual-nfe.types';
import { normalizePartnerPayload, PartnerPayload } from '../cadastros/partner-payload';
import { PartnerPersonType } from '../generated/tenant-client';
import * as forge from 'node-forge';

const HOMOLOG_TEST_PARTNER_CPF = '00000000191';
const HOMOLOG_TEST_PRODUCT_SKU = 'HOMOLOG-FISCAL-TEST';

@Injectable()
export class FiscalService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly crypto: FiscalCryptoService,
    private readonly certService: FiscalCertService,
    private readonly emission: FiscalEmissionService,
    @InjectQueue('fiscal-emission') private readonly emissionQueue: Queue,
  ) {}

  async getIssuerSettings(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company) throw new NotFoundException('Empresa não cadastrada');
    const s = company.fiscalIssuerSettings;
    if (!s) {
      return {
        sefazEnvironment: 'homologacao' as SefazEnvironment,
        nfceCscId: null,
        nfceCsc: null,
        series: 1,
        nfceSeries: 1,
        lastNfeNumber: 0,
        lastNfceNumber: 0,
        certificateExpiresAt: null,
        hasCertificate: false,
        hasCertificatePassword: false,
        respTecCnpj: null,
        respTecContact: null,
        respTecEmail: null,
        respTecPhone: null,
        respTecCsrtId: null,
        hasRespTecCsrt: false,
      };
    }
    const { certificatePassword, certificatePasswordEnc, respTecCsrtEnc, ...safe } = s;
    return {
      ...safe,
      hasCertificate: Boolean(s.certificatePath),
      hasCertificatePassword: Boolean(certificatePasswordEnc || certificatePassword),
      hasRespTecCsrt: Boolean(respTecCsrtEnc || process.env.FISCAL_RESP_TEC_CSRT),
    };
  }

  async updateIssuerSettings(
    user: JwtPayload,
    data: {
      sefazEnvironment?: SefazEnvironment;
      certificatePassword?: string;
      nfceCscId?: string;
      nfceCsc?: string;
      series?: number;
      nfceSeries?: number;
      respTecCnpj?: string;
      respTecContact?: string;
      respTecEmail?: string;
      respTecPhone?: string;
      respTecCsrtId?: string;
      respTecCsrt?: string;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const company = await prisma.company.findFirst();
    if (!company) throw new NotFoundException('Empresa não cadastrada');
    const patch: Record<string, unknown> = { ...data };
    delete patch.certificatePassword;
    delete patch.respTecCsrt;
    if (data.certificatePassword?.trim()) {
      patch.certificatePasswordEnc = this.crypto.encrypt(data.certificatePassword.trim());
      patch.certificatePassword = null;
    }
    if (data.respTecCsrt?.trim()) {
      patch.respTecCsrtEnc = this.crypto.encrypt(data.respTecCsrt.trim());
    }
    return prisma.fiscalIssuerSettings.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, ...patch },
      update: patch,
    });
  }

  private validatePfxBuffer(file: Buffer, password: string) {
    try {
      const asn1 = forge.asn1.fromDer(file.toString('binary'));
      forge.pkcs12.pkcs12FromAsn1(asn1, password);
    } catch {
      throw new BadRequestException('Certificado .pfx ou senha inválidos');
    }
  }

  async uploadCertificate(user: JwtPayload, file: Buffer, password: string) {
    if (!file?.length) throw new BadRequestException('Arquivo .pfx obrigatório');
    this.validatePfxBuffer(file, password);
    writeFiscalCert(user.tenantSlug, file);
    const cert = this.certService.loadPfx(user.tenantSlug, password);
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const company = await prisma.company.findFirst();
    if (!company) throw new NotFoundException('Empresa não cadastrada');
    const path = `tenants/${user.tenantSlug}/fiscal/certificate.pfx`;
    return prisma.fiscalIssuerSettings.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        certificatePath: path,
        certificatePasswordEnc: this.crypto.encrypt(password),
        certificateExpiresAt: cert.notAfter,
      },
      update: {
        certificatePath: path,
        certificatePasswordEnc: this.crypto.encrypt(password),
        certificatePassword: null,
        certificateExpiresAt: cert.notAfter,
      },
    });
  }

  async queueEmission(user: JwtPayload, salesOrderId: string, type: 'NFE' | 'NFCE' = 'NFCE') {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const order = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { fiscalDoc: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.fiscalDoc?.status === FiscalDocumentStatus.AUTHORIZED) {
      throw new BadRequestException('Pedido já possui documento fiscal autorizado');
    }

    const doc =
      order.fiscalDoc ??
      (await prisma.fiscalDocument.create({
        data: {
          salesOrderId,
          type,
          status: FiscalDocumentStatus.PROCESSING,
        },
      }));

    if (order.fiscalDoc) {
      await prisma.fiscalDocument.update({
        where: { id: doc.id },
        data: { type, status: FiscalDocumentStatus.PROCESSING, errorMessage: null },
      });
    }

    await this.emissionQueue.add(
      'emit',
      { tenantSlug: user.tenantSlug, fiscalDocumentId: doc.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return prisma.fiscalDocument.findUnique({ where: { id: doc.id } });
  }

  listDocuments(user: JwtPayload) {
    return this.tenantPrisma.getClient(user.tenantSlug).then((p) =>
      p.fiscalDocument.findMany({
        orderBy: { issuedAt: 'desc' },
        take: 200,
        include: {
          salesOrder: { include: { partner: true } },
        },
      }),
    );
  }

  async getDocumentFile(user: JwtPayload, docId: string, kind: 'xml' | 'danfe') {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const doc = await prisma.fiscalDocument.findUnique({
      where: { id: docId },
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
    if (!doc) throw new NotFoundException('Documento não encontrado');
    if (kind === 'xml') {
      const path = doc.xmlStorageKey;
      if (!path) throw new NotFoundException('Arquivo não disponível');
      const buf = readFiscalFile(path);
      return { buf, mime: 'application/xml' };
    }

    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company?.fiscalIssuerSettings) throw new BadRequestException('Emissor não configurado');
    const { renderDanfeHtmlForDocument } = await import('./fiscal-danfe.assemble');
    const html = await renderDanfeHtmlForDocument(
      user.tenantSlug,
      doc,
      company,
      company.fiscalIssuerSettings,
      { preview: doc.status === FiscalDocumentStatus.DRAFT },
    );
    return { buf: Buffer.from(html, 'utf8'), mime: 'text/html; charset=utf-8' };
  }

  async deleteDocument(user: JwtPayload, docId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const doc = await prisma.fiscalDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    if (
      doc.status !== FiscalDocumentStatus.DRAFT &&
      doc.status !== FiscalDocumentStatus.REJECTED
    ) {
      throw new BadRequestException('Somente rascunhos ou notas rejeitadas podem ser excluídos');
    }
    await prisma.fiscalDocument.delete({ where: { id: docId } });
    return { ok: true };
  }

  consultDocument(user: JwtPayload, docId: string) {
    return this.emission.consultDocumentSituation(user.tenantSlug, docId);
  }

  cancel(user: JwtPayload, docId: string, reason: string) {
    return this.emission.cancelDocument(user.tenantSlug, docId, reason);
  }

  cce(user: JwtPayload, docId: string, text: string) {
    return this.emission.correctionLetter(user.tenantSlug, docId, text);
  }

  inutilize(
    user: JwtPayload,
    body: { model: '55' | '65'; series: number; numberFrom: number; numberTo: number; reason: string },
  ) {
    return this.emission.inutilizeNumbers(user.tenantSlug, body);
  }

  testSefaz(user: JwtPayload) {
    return this.emission.testSefazStatus(user.tenantSlug);
  }

  /** Cria venda mínima e emite na SEFAZ (somente ambiente homologação). */
  async emitHomologationTest(user: JwtPayload, type: 'NFE' | 'NFCE' = 'NFCE') {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company?.fiscalIssuerSettings) {
      throw new BadRequestException('Configure certificado e ambiente em Emissor fiscal');
    }
    const settings = company.fiscalIssuerSettings;
    if (settings.sefazEnvironment !== 'homologacao') {
      throw new BadRequestException('Nota de teste só com ambiente SEFAZ = homologação');
    }
    if (!settings.certificatePath) {
      throw new BadRequestException('Envie o certificado A1 antes de emitir');
    }
    assertFiscalCompany(company);
    if (type === 'NFCE' && (!settings.nfceCscId?.trim() || !settings.nfceCsc?.trim())) {
      throw new BadRequestException('NFC-e de teste: informe ID CSC e CSC de homologação no emissor fiscal');
    }

    let partner = await prisma.partner.findFirst({
      where: { cpf: HOMOLOG_TEST_PARTNER_CPF, isCustomer: true },
    });
    if (!partner) {
      partner = await prisma.partner.create({
        data: {
          name: 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
          personType: 'PF',
          cpf: HOMOLOG_TEST_PARTNER_CPF,
          isCustomer: true,
          state: company.state || 'AM',
          city: company.city || 'Manaus',
          street: company.street || 'Rua Homologacao SEFAZ',
          addressNumber: company.addressNumber || 'S/N',
          district: company.district || 'Centro',
          zipCode: company.zipCode || '69000000',
        },
      });
    } else if (!partner.street?.trim()) {
      partner = await prisma.partner.update({
        where: { id: partner.id },
        data: {
          street: company.street || 'Rua Homologacao SEFAZ',
          addressNumber: partner.addressNumber || company.addressNumber || 'S/N',
          district: partner.district || company.district || 'Centro',
          zipCode: partner.zipCode || company.zipCode || '69000000',
          city: partner.city || company.city || 'Manaus',
          state: partner.state || company.state || 'AM',
        },
      });
    }

    let product = await prisma.product.findUnique({ where: { sku: HOMOLOG_TEST_PRODUCT_SKU } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          sku: HOMOLOG_TEST_PRODUCT_SKU,
          name: 'Ovos caixa teste homologacao',
          type: 'PACKAGED_EGG',
          unit: 'UN',
          salePrice: 1,
          fiscalOrigin: FISCAL_EGG_DEFAULTS.fiscalOrigin,
          fiscalSituationId: DEFAULT_FISCAL_SITUATION_ID,
        },
      });
    } else if (!product.fiscalSituationId) {
      product = await prisma.product.update({
        where: { id: product.id },
        data: {
          fiscalOrigin: FISCAL_EGG_DEFAULTS.fiscalOrigin,
          fiscalSituationId: DEFAULT_FISCAL_SITUATION_ID,
        },
      });
    }

    const unitPrice = 1;
    const order = await prisma.salesOrder.create({
      data: {
        partnerId: partner.id,
        status: 'CONFIRMED',
        totalAmount: unitPrice,
        items: {
          create: {
            productId: product.id,
            operationNatureId: DEFAULT_OPERATION_NATURE_ID,
            quantity: 1,
            unitPrice,
            discount: 0,
          },
        },
      },
    });

    const doc = await prisma.fiscalDocument.create({
      data: {
        salesOrderId: order.id,
        type,
        status: FiscalDocumentStatus.PROCESSING,
      },
    });

    try {
      return await this.emission.processEmission({
        tenantSlug: user.tenantSlug,
        fiscalDocumentId: doc.id,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.fiscalDocument.update({
        where: { id: doc.id },
        data: { status: FiscalDocumentStatus.REJECTED, errorMessage: msg.slice(0, 500) },
      });
      throw new BadRequestException(msg);
    }
  }

  async createManualNfe(user: JwtPayload, input: ManualNfeInput) {
    if (!input.items?.length) {
      throw new BadRequestException('Informe ao menos um item na NF-e');
    }

    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company?.fiscalIssuerSettings?.certificatePath) {
      throw new BadRequestException('Configure certificado A1 em Emissor fiscal');
    }
    assertFiscalCompany(company);

    const partnerId = await this.resolveManualNfePartner(prisma, input);
    const partnerForNfe = await prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partnerForNfe) throw new BadRequestException('Cliente não encontrado');
    assertFiscalPartnerAddress(partnerForNfe, 'Cliente');

    const productIds: string[] = [];
    for (let i = 0; i < input.items.length; i++) {
      productIds.push(await this.resolveManualNfeItemProduct(prisma, input.items[i], i + 1));
    }

    const total = Math.round(
      input.items.reduce((s, it) => s + it.quantity * it.unitPrice - (it.discount ?? 0), 0) * 100,
    ) / 100;
    if (total <= 0) throw new BadRequestException('Total da NF-e deve ser maior que zero');

    const order = await prisma.salesOrder.create({
      data: {
        partnerId,
        status: 'CONFIRMED',
        totalAmount: total,
        items: {
          create: input.items.map((it, idx) => ({
            productId: productIds[idx],
            operationNatureId: it.operationNatureId ?? DEFAULT_OPERATION_NATURE_ID,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discount: it.discount ?? 0,
          })),
        },
      },
      include: { partner: true, items: { include: { product: true } } },
    });

    const doc = await prisma.fiscalDocument.create({
      data: {
        salesOrderId: order.id,
        type: 'NFE',
        model: '55',
        status: FiscalDocumentStatus.DRAFT,
      },
    });

    if (input.emitNow === true) {
      const fiscalDocument = await this.sendDraftDocument(user, doc.id);
      return { order, fiscalDocument };
    }

    return { order, fiscalDocument: doc };
  }

  async previewManualNfe(user: JwtPayload, input: ManualNfeInput) {
    if (!input.items?.length) {
      throw new BadRequestException('Informe ao menos um item na NF-e');
    }
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company?.fiscalIssuerSettings) {
      throw new BadRequestException('Configure o emissor fiscal');
    }
    assertFiscalCompany(company);
    const partner = await this.resolvePreviewPartner(prisma, input);
    assertFiscalPartnerAddress(partner, 'Cliente');
    const emitUf = (company.state || 'AM').toUpperCase();
    const destUf = (partner.state || emitUf).toUpperCase();
    const { items, totalAmount } = await this.buildPreviewLineItems(
      prisma,
      input.items,
      emitUf,
      destUf,
    );
    if (totalAmount <= 0) throw new BadRequestException('Total da NF-e deve ser maior que zero');

    return this.emission.buildManualNfePreview(user.tenantSlug, {
      company,
      settings: company.fiscalIssuerSettings,
      partner,
      items,
      totalAmount,
    });
  }

  async getManualNfeDraft(user: JwtPayload, docId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const doc = await this.loadEditableManualNfeDocument(prisma, docId);
    const order = doc.salesOrder!;
    const partner = order.partner;
    if (!partner) throw new BadRequestException('Pedido sem destinatário');

    return {
      documentId: doc.id,
      partnerId: order.partnerId,
      items: order.items.map((row) => {
        const product = row.product;
        const sku = product?.sku ?? '';
        const isAvulso = sku.startsWith('NFE-AVULSO-');
        const quantity = Number(row.quantity);
        const unitPrice = Number(row.unitPrice);
        const discount = Number(row.discount);
        if (product && !isAvulso) {
          return {
            mode: 'catalog' as const,
            productId: product.id,
            operationNatureId: row.operationNatureId ?? DEFAULT_OPERATION_NATURE_ID,
            quantity,
            unitPrice,
            discount,
          };
        }
        return {
          mode: 'manual' as const,
          description: product?.name ?? 'Item',
          fiscalSituationId: product?.fiscalSituationId ?? DEFAULT_FISCAL_SITUATION_ID,
          operationNatureId: row.operationNatureId ?? DEFAULT_OPERATION_NATURE_ID,
          unit: product?.unit ?? 'UN',
          quantity,
          unitPrice,
          discount,
        };
      }),
    };
  }

  async updateManualNfe(user: JwtPayload, docId: string, input: ManualNfeInput) {
    if (!input.items?.length) {
      throw new BadRequestException('Informe ao menos um item na NF-e');
    }

    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const doc = await this.loadEditableManualNfeDocument(prisma, docId);
    const order = doc.salesOrder!;

    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company?.fiscalIssuerSettings?.certificatePath) {
      throw new BadRequestException('Configure certificado A1 em Emissor fiscal');
    }
    assertFiscalCompany(company);

    const partnerId = await this.resolveManualNfePartner(prisma, input);
    const partnerForNfe = await prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partnerForNfe) throw new BadRequestException('Cliente não encontrado');
    assertFiscalPartnerAddress(partnerForNfe, 'Cliente');

    const productIds: string[] = [];
    for (let i = 0; i < input.items.length; i++) {
      productIds.push(await this.resolveManualNfeItemProduct(prisma, input.items[i], i + 1));
    }

    const total = Math.round(
      input.items.reduce((s, it) => s + it.quantity * it.unitPrice - (it.discount ?? 0), 0) * 100,
    ) / 100;
    if (total <= 0) throw new BadRequestException('Total da NF-e deve ser maior que zero');

    await prisma.$transaction(async (tx) => {
      await tx.salesOrderItem.deleteMany({ where: { salesOrderId: order.id } });
      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          partnerId,
          totalAmount: total,
          items: {
            create: input.items.map((it, idx) => ({
              productId: productIds[idx],
              operationNatureId: it.operationNatureId ?? DEFAULT_OPERATION_NATURE_ID,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discount: it.discount ?? 0,
            })),
          },
        },
      });
      await tx.fiscalDocument.update({
        where: { id: docId },
        data: {
          status: FiscalDocumentStatus.DRAFT,
          errorMessage: null,
        },
      });
    });

    return prisma.fiscalDocument.findUnique({
      where: { id: docId },
      include: { salesOrder: { include: { partner: true } } },
    });
  }

  async sendDraftDocument(user: JwtPayload, docId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const doc = await prisma.fiscalDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    if (doc.status !== FiscalDocumentStatus.DRAFT && doc.status !== FiscalDocumentStatus.REJECTED) {
      throw new BadRequestException('Somente notas em rascunho ou rejeitadas podem ser enviadas');
    }
    if (!doc.salesOrderId) throw new BadRequestException('Documento sem pedido vinculado');

    await prisma.fiscalDocument.update({
      where: { id: docId },
      data: { status: FiscalDocumentStatus.PROCESSING, errorMessage: null, type: 'NFE' },
    });

    try {
      return await this.emission.processEmission({
        tenantSlug: user.tenantSlug,
        fiscalDocumentId: docId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.fiscalDocument.update({
        where: { id: docId },
        data: { status: FiscalDocumentStatus.REJECTED, errorMessage: msg.slice(0, 500) },
      });
      throw new BadRequestException(msg);
    }
  }

  private async loadEditableManualNfeDocument(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    docId: string,
  ) {
    const doc = await prisma.fiscalDocument.findUnique({
      where: { id: docId },
      include: {
        salesOrder: {
          include: {
            partner: true,
            items: {
              include: {
                product: { include: { fiscalSituation: true } },
                operationNature: true,
              },
              orderBy: { id: 'asc' },
            },
          },
        },
      },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    if (doc.type !== 'NFE') {
      throw new BadRequestException('Somente NF-e manual pode ser editada por aqui');
    }
    if (!doc.salesOrder) {
      throw new BadRequestException('Documento sem pedido vinculado');
    }
    if (doc.status !== FiscalDocumentStatus.DRAFT && doc.status !== FiscalDocumentStatus.REJECTED) {
      throw new BadRequestException('Somente notas em rascunho ou rejeitadas podem ser editadas');
    }
    return doc;
  }

  private async resolvePreviewPartner(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    input: ManualNfeInput,
  ) {
    const patch = input.partner ?? {};
    if (input.partnerId) {
      const existing = await prisma.partner.findUnique({ where: { id: input.partnerId } });
      if (!existing) throw new BadRequestException('Cliente selecionado não encontrado');
      const docDigits = onlyDigits(existing.cnpj || existing.cpf || existing.document || '');
      if (docDigits.length !== 11 && docDigits.length !== 14) {
        throw new BadRequestException('Cliente: CPF/CNPJ inválido para NF-e');
      }
      return {
        name: patch.name?.trim() || existing.name,
        cnpj: existing.cnpj,
        cpf: existing.cpf,
        document: existing.document,
        state: patch.state ?? existing.state,
        stateRegistration: patch.stateRegistration ?? existing.stateRegistration,
        email: patch.email ?? existing.email,
        street: patch.street ?? existing.street,
        addressNumber: patch.addressNumber ?? existing.addressNumber,
        district: patch.district ?? existing.district,
        city: patch.city ?? existing.city,
        zipCode: patch.zipCode ?? existing.zipCode,
      };
    }
    if (!patch.name?.trim()) {
      throw new BadRequestException('Informe o destinatário');
    }
    const personType = patch.personType === 'PF' ? PartnerPersonType.PF : PartnerPersonType.PJ;
    const cpf = patch.cpf?.replace(/\D/g, '');
    const cnpj = patch.cnpj?.replace(/\D/g, '');
    const expected = personType === PartnerPersonType.PF ? 11 : 14;
    const docLen = personType === PartnerPersonType.PF ? cpf?.length : cnpj?.length;
    if (docLen !== expected) {
      throw new BadRequestException(
        personType === PartnerPersonType.PF ? 'CPF do destinatário inválido' : 'CNPJ do destinatário inválido',
      );
    }
    return {
      name: patch.name.trim(),
      cpf: patch.cpf,
      cnpj: patch.cnpj,
      document: personType === PartnerPersonType.PF ? cpf : cnpj,
      state: patch.state,
      stateRegistration: patch.stateRegistration,
      email: patch.email,
      street: patch.street,
      addressNumber: patch.addressNumber,
      district: patch.district,
      city: patch.city,
      zipCode: patch.zipCode,
    };
  }

  private async loadOperationNature(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    operationNatureId: string | undefined,
    lineNo: number,
  ) {
    const id = operationNatureId?.trim() || DEFAULT_OPERATION_NATURE_ID;
    const nature = await prisma.operationNature.findUnique({ where: { id } });
    if (!nature || !nature.isActive) {
      throw new BadRequestException(`Item ${lineNo}: natureza da operação inválida ou inativa`);
    }
    return nature;
  }

  private async buildPreviewLineItems(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    rawItems: ManualNfeItemInput[],
    emitUf: string,
    destUf: string,
  ) {
    const items: {
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
      ibsCst?: string | null;
      ibsClassTrib?: string | null;
    }[] = [];
    let totalAmount = 0;
    for (let idx = 0; idx < rawItems.length; idx++) {
      const it = rawItems[idx];
      const lineNo = idx + 1;
      const qty = it.quantity;
      const unitPrice = it.unitPrice;
      const total = qty * unitPrice - (it.discount ?? 0);
      totalAmount += total;
      const nature = await this.loadOperationNature(prisma, it.operationNatureId, lineNo);
      const cfop = pickCfopFromNature(nature, destUf, emitUf);

      if (it.productId) {
        const product = await prisma.product.findUnique({
          where: { id: it.productId },
          include: { fiscalSituation: true },
        });
        if (!product) throw new BadRequestException(`Item ${lineNo}: produto não encontrado`);
        assertFiscalProduct(product);
        const profile = resolveProductFiscalProfile(product);
        items.push({
          nItem: lineNo,
          name: product.name,
          ncm: profile.ncm,
          cfop,
          unit: product.unit ?? 'UN',
          quantity: qty,
          unitPrice,
          total,
          cst: profile.fiscalCst ?? '102',
          origin: profile.fiscalOrigin ?? '0',
          gtin: profile.gtin,
          ibsCst: profile.ibsCst,
          ibsClassTrib: profile.ibsClassTrib,
        });
        continue;
      }

      const name = it.description?.trim();
      if (!name) throw new BadRequestException(`Item ${lineNo}: descrição obrigatória`);
      const fsId = it.fiscalSituationId?.trim() || DEFAULT_FISCAL_SITUATION_ID;
      const fs = await prisma.productFiscalSituation.findUnique({ where: { id: fsId } });
      if (!fs?.ncm?.trim()) {
        throw new BadRequestException(`Item ${lineNo}: informe situação fiscal com NCM (Cadastros → Situação fiscal)`);
      }
      items.push({
        nItem: lineNo,
        name,
        ncm: fs.ncm,
        cfop,
        unit: it.unit?.trim() || 'UN',
        quantity: qty,
        unitPrice,
        total,
        cst: fs.fiscalCst ?? '102',
        origin: '0',
        ibsCst: fs.ibsCst,
        ibsClassTrib: fs.ibsClassTrib,
      });
    }
    totalAmount = Math.round(totalAmount * 100) / 100;
    return { items, totalAmount };
  }

  private async resolveManualNfePartner(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    input: ManualNfeInput,
  ): Promise<string> {
    const patch = input.partner ?? {};

    if (input.partnerId) {
      const existing = await prisma.partner.findUnique({ where: { id: input.partnerId } });
      if (!existing) throw new BadRequestException('Cliente selecionado não encontrado');
      const docDigits = onlyDigits(existing.cnpj || existing.cpf || existing.document || '');
      if (docDigits.length !== 11 && docDigits.length !== 14) {
        throw new BadRequestException('Cliente: CPF/CNPJ inválido para NF-e');
      }
      const hasPatch = Object.values(patch).some((v) => v != null && String(v).trim() !== '');
      if (hasPatch) {
        const normalized = normalizePartnerPayload({
          ...existing,
          personType: (patch.personType as PartnerPersonType) ?? existing.personType,
          name: patch.name ?? existing.name,
          cpf: patch.cpf ?? existing.cpf ?? undefined,
          cnpj: patch.cnpj ?? existing.cnpj ?? undefined,
          stateRegistration: patch.stateRegistration ?? existing.stateRegistration ?? undefined,
          email: patch.email ?? existing.email ?? undefined,
          phone: patch.phone ?? existing.phone ?? undefined,
          zipCode: patch.zipCode ?? existing.zipCode ?? undefined,
          street: patch.street ?? existing.street ?? undefined,
          addressNumber: patch.addressNumber ?? existing.addressNumber ?? undefined,
          district: patch.district ?? existing.district ?? undefined,
          city: patch.city ?? existing.city ?? undefined,
          state: patch.state ?? existing.state ?? undefined,
          isCustomer: true,
        } as PartnerPayload);
        await prisma.partner.update({ where: { id: existing.id }, data: normalized });
      }
      return existing.id;
    }

    if (!patch.name?.trim()) {
      throw new BadRequestException('Informe o destinatário (cliente cadastrado ou dados manuais)');
    }
    const personType = patch.personType === 'PF' ? PartnerPersonType.PF : PartnerPersonType.PJ;
    const cpf = patch.cpf?.replace(/\D/g, '');
    const cnpj = patch.cnpj?.replace(/\D/g, '');
    const docLen = personType === PartnerPersonType.PF ? cpf?.length : cnpj?.length;
    const expected = personType === PartnerPersonType.PF ? 11 : 14;
    if (docLen !== expected) {
      throw new BadRequestException(
        personType === PartnerPersonType.PF ? 'CPF do destinatário inválido' : 'CNPJ do destinatário inválido',
      );
    }

    const normalized = normalizePartnerPayload({
      personType,
      name: patch.name,
      cpf: patch.cpf,
      cnpj: patch.cnpj,
      stateRegistration: patch.stateRegistration,
      email: patch.email,
      phone: patch.phone,
      zipCode: patch.zipCode,
      street: patch.street,
      addressNumber: patch.addressNumber,
      district: patch.district,
      city: patch.city,
      state: patch.state,
      isCustomer: true,
      isSupplier: false,
    });

    const found =
      personType === PartnerPersonType.PF
        ? await prisma.partner.findFirst({ where: { cpf: normalized.cpf } })
        : await prisma.partner.findFirst({ where: { cnpj: normalized.cnpj } });
    if (found) {
      await prisma.partner.update({
        where: { id: found.id },
        data: { ...normalized, isCustomer: true },
      });
      return found.id;
    }

    const created = await prisma.partner.create({ data: normalized });
    return created.id;
  }

  private async resolveManualNfeItemProduct(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    item: ManualNfeItemInput,
    lineNo: number,
  ): Promise<string> {
    if (item.productId) {
      const p = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { fiscalSituation: true },
      });
      if (!p) throw new BadRequestException(`Item ${lineNo}: produto não encontrado`);
      assertFiscalProduct(p);
      return p.id;
    }

    const name = item.description?.trim();
    if (!name) throw new BadRequestException(`Item ${lineNo}: informe produto do estoque ou descrição`);
    const fsId = item.fiscalSituationId?.trim() || DEFAULT_FISCAL_SITUATION_ID;
    const fs = await prisma.productFiscalSituation.findUnique({ where: { id: fsId } });
    if (!fs?.ncm?.trim()) {
      throw new BadRequestException(`Item ${lineNo}: situação fiscal com NCM obrigatória`);
    }
    const slug = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20).toUpperCase() || 'LINHA';
    const sku = `NFE-AVULSO-${slug}-${String(lineNo).padStart(2, '0')}`;

    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) return existing.id;

    const created = await prisma.product.create({
      data: {
        sku,
        name,
        type: 'SUPPLY',
        unit: item.unit?.trim() || 'UN',
        fiscalOrigin: '0',
        fiscalSituationId: fsId,
      },
    });
    return created.id;
  }
}

function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}
