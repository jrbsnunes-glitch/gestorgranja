import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import {
  BankBoletoStatus,
  PaymentApprovalStatus,
  SicoobEnvironment,
  type Partner,
  type SicoobCobrancaSettings,
} from '../generated/tenant-client';
import { readCompanyLogoDataUrl } from '../cadastros/company-logo.util';
import { FiscalCryptoService } from '../fiscal/fiscal-crypto.service';
import { buildGestorGranjaBoletoHtml } from './boleto-layout.util';
import { readFiscalCert } from '../fiscal/fiscal-storage.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { chartAccountAllowedForReceivable } from './chart-account-flow';
import {
  hasTitlePayment,
  isReceivableSettled,
  isTitleCancelled,
} from './finance-title-utils';
import { SicoobClientService, type SicoobHttpAuth } from './sicoob-client.service';
import {
  buildMensagensInstrucao,
  buildSicoobEncargosPayload,
  type SicoobEncargosConfig,
  validateEncargosConfig,
} from './sicoob-encargos.util';
import {
  clip,
  digitsOnly,
  isBoletoLiquidated,
  isoDateOnly,
  omitEmpty,
  partnerDocumentId,
  unwrapSicoobResult,
  extractQrCodeFromResultado,
  normalizeNossoNumero,
} from './sicoob-json.util';
import {
  isValidPdfBuffer,
  readSicoobBoletoPdf,
  readSicoobCert,
  sicoobBoletoPdfPath,
  writeSicoobBoletoPdf,
  writeSicoobCert,
} from './sicoob-storage.util';

@Injectable()
export class SicoobCobrancaService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly crypto: FiscalCryptoService,
    private readonly client: SicoobClientService,
  ) {}

  async getSettings(user: JwtPayload) {
    const row = await this.loadSettings(user.tenantSlug);
    if (!row) return this.emptySettingsDto();
    return this.toSettingsDto(row);
  }

  async updateSettings(
    user: JwtPayload,
    data: {
      environment?: 'sandbox' | 'production';
      clientId?: string | null;
      numeroCliente?: number | null;
      numeroContaCorrente?: string | null;
      codigoModalidade?: number;
      codigoEspecieDocumento?: string;
      identificacaoEmissaoBoleto?: number;
      identificacaoDistribuicaoBoleto?: number;
      codigoCadastrarPIX?: number;
      tipoMulta?: number;
      tipoJurosMora?: number;
      valorMulta?: number | null;
      valorJurosMora?: number | null;
      diasInicioMultaAposVencimento?: number;
      diasInicioJurosAposVencimento?: number;
      diasLimitePagamentoAposVencimento?: number | null;
      encargosNasInstrucoes?: boolean;
      codigoProtesto?: number;
      codigoNegativacao?: number;
      dueDaysDefault?: number;
      useFiscalCertificate?: boolean;
      certificatePassword?: string;
      sandboxAccessToken?: string;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const company = await prisma.company.findFirst();
    if (!company) throw new NotFoundException('Empresa não cadastrada');

    const patch: Record<string, unknown> = {};
    if (data.environment) patch.environment = data.environment;
    if (data.clientId !== undefined) patch.clientId = data.clientId?.trim() || null;
    if (data.numeroCliente !== undefined) patch.numeroCliente = data.numeroCliente;
    if (data.numeroContaCorrente !== undefined) {
      patch.numeroContaCorrente = data.numeroContaCorrente?.trim() || null;
    }
    if (data.codigoModalidade != null) patch.codigoModalidade = data.codigoModalidade;
    if (data.codigoEspecieDocumento != null) {
      patch.codigoEspecieDocumento = data.codigoEspecieDocumento.trim() || 'DM';
    }
    if (data.identificacaoEmissaoBoleto != null) {
      patch.identificacaoEmissaoBoleto = data.identificacaoEmissaoBoleto;
    }
    if (data.identificacaoDistribuicaoBoleto != null) {
      patch.identificacaoDistribuicaoBoleto = data.identificacaoDistribuicaoBoleto;
    }
    if (data.codigoCadastrarPIX != null) patch.codigoCadastrarPIX = data.codigoCadastrarPIX;
    if (data.tipoMulta != null) patch.tipoMulta = data.tipoMulta;
    if (data.tipoJurosMora != null) patch.tipoJurosMora = data.tipoJurosMora;
    if (data.valorMulta !== undefined) {
      patch.valorMulta = data.valorMulta != null && data.valorMulta > 0 ? data.valorMulta : null;
    }
    if (data.valorJurosMora !== undefined) {
      patch.valorJurosMora =
        data.valorJurosMora != null && data.valorJurosMora > 0 ? data.valorJurosMora : null;
    }
    if (data.diasInicioMultaAposVencimento != null) {
      patch.diasInicioMultaAposVencimento = Math.max(1, data.diasInicioMultaAposVencimento);
    }
    if (data.diasInicioJurosAposVencimento != null) {
      patch.diasInicioJurosAposVencimento = Math.max(1, data.diasInicioJurosAposVencimento);
    }
    if (data.diasLimitePagamentoAposVencimento !== undefined) {
      const d = data.diasLimitePagamentoAposVencimento;
      patch.diasLimitePagamentoAposVencimento =
        d != null && Number.isFinite(d) && d >= 0 ? Math.floor(d) : null;
    }
    if (data.encargosNasInstrucoes != null) patch.encargosNasInstrucoes = data.encargosNasInstrucoes;
    if (data.codigoProtesto != null) patch.codigoProtesto = data.codigoProtesto;
    if (data.codigoNegativacao != null) patch.codigoNegativacao = data.codigoNegativacao;
    if (data.dueDaysDefault != null) patch.dueDaysDefault = Math.max(0, data.dueDaysDefault);
    if (data.useFiscalCertificate != null) patch.useFiscalCertificate = data.useFiscalCertificate;
    if (data.certificatePassword?.trim()) {
      patch.certificatePasswordEnc = this.crypto.encrypt(data.certificatePassword.trim());
    }
    if (data.sandboxAccessToken?.trim()) {
      patch.sandboxAccessTokenEnc = this.crypto.encrypt(data.sandboxAccessToken.trim());
    }

    const row = await prisma.sicoobCobrancaSettings.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        ...(patch as object),
      },
      update: patch,
    });
    try {
      validateEncargosConfig(this.encargosFromRow(row));
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Encargos inválidos');
    }
    this.client.invalidateToken(user.tenantSlug);
    return this.toSettingsDto(row);
  }

  async uploadCertificate(user: JwtPayload, file: Buffer, password: string) {
    if (!file?.length) throw new BadRequestException('Selecione o arquivo .pfx ICP-Brasil');
    if (!password?.trim()) throw new BadRequestException('Informe a senha do certificado');
    const path = writeSicoobCert(user.tenantSlug, file);
    const dto = await this.updateSettings(user, {
      useFiscalCertificate: false,
      certificatePassword: password.trim(),
    });
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const company = await prisma.company.findFirst();
    if (company) {
      await prisma.sicoobCobrancaSettings.update({
        where: { companyId: company.id },
        data: { certificatePath: path },
      });
    }
    return { ...dto, hasCertificate: true };
  }

  async emitForReceivable(user: JwtPayload, receivableId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.accountReceivable.findUnique({
      where: { id: receivableId },
      include: { partner: true },
    });
    if (!row) throw new NotFoundException('Conta a receber não encontrada');
    if (isTitleCancelled(row.approvalStatus)) throw new BadRequestException('Título cancelado');
    if (hasTitlePayment(row.amountPaid) || row.receivedAt || isReceivableSettled(row)) {
      throw new BadRequestException('Estorne o recebimento antes de gerar boleto');
    }
    const existing = await prisma.bankBoleto.findFirst({
      where: { receivableId, status: BankBoletoStatus.REGISTERED },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return this.toBoletoDto(existing);
    return this.registerBoleto(user, {
      partner: row.partner,
      amount: Number(row.amount),
      dueDate: row.dueDate,
      seuNumero: this.seuNumero('CR', row.controlNumber),
      description: row.description,
      receivableId: row.id,
      salesOrderId: row.salesOrderId,
    });
  }

  async emitForSalesOrder(user: JwtPayload, salesOrderId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const order = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { partner: true, paymentForm: true, secondaryPaymentForm: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== 'CONFIRMED') {
      throw new BadRequestException('Confirme o pedido antes de gerar o boleto');
    }
    const boletoAmount = this.boletoAmountFromOrder(order);
    if (boletoAmount <= 0.004) {
      throw new BadRequestException('Este pedido não tem parcela em boleto');
    }
    const existing = await prisma.bankBoleto.findFirst({
      where: { salesOrderId, status: { in: [BankBoletoStatus.REGISTERED, BankBoletoStatus.PAID] } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return this.toBoletoDto(existing);

    const receivable = await this.ensureReceivableForOrder(user, order, boletoAmount);
    const settings = await this.requireSettings(user.tenantSlug);
    const due = new Date();
    due.setDate(due.getDate() + (settings.dueDaysDefault || 7));
    return this.registerBoleto(user, {
      partner: order.partner,
      amount: boletoAmount,
      dueDate: due,
      seuNumero: this.seuNumero('VD', order.controlNumber),
      description: `Venda ${order.controlNumber}`,
      receivableId: receivable.id,
      salesOrderId: order.id,
    });
  }

  async afterSaleConfirmed(user: JwtPayload, salesOrderId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const order = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { paymentForm: true, secondaryPaymentForm: true },
    });
    if (!order) return null;
    if (this.boletoAmountFromOrder(order) <= 0.004) return null;
    try {
      return await this.emitForSalesOrder(user, salesOrderId);
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : 'Falha ao registrar boleto Sicoob',
      };
    }
  }

  async getBoleto(user: JwtPayload, id: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.bankBoleto.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Boleto não encontrado');
    return this.toBoletoDto(row);
  }

  async listForReceivable(user: JwtPayload, receivableId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const rows = await prisma.bankBoleto.findMany({
      where: { receivableId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toBoletoDto(r));
  }

  async refreshBoleto(user: JwtPayload, id: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.bankBoleto.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Boleto não encontrado');
    const settings = await this.requireSettings(user.tenantSlug);
    const auth = await this.buildAuth(user.tenantSlug, settings);
    const qs = this.consultQuery(settings, row);
    const { status, json } = await this.client.requestJson(
      user.tenantSlug,
      auth,
      'GET',
      `/boletos?${qs}`,
    );
    this.client.throwIfFailed(status, json, 'Consultar boleto');
    const resultado = unwrapSicoobResult(json);
    const situacao = String(resultado.situacaoBoleto ?? row.situacaoBoleto ?? '');
    const liquidated = isBoletoLiquidated(situacao, resultado.listaHistorico);
    const pdfB64 = typeof resultado.pdfBoleto === 'string' ? resultado.pdfBoleto : null;
    let pdfStorageKey = row.pdfStorageKey;
    if (pdfB64) {
      pdfStorageKey = writeSicoobBoletoPdf(user.tenantSlug, row.id, Buffer.from(pdfB64, 'base64'));
    }
    const updated = await prisma.bankBoleto.update({
      where: { id },
      data: {
        situacaoBoleto: situacao || null,
        nossoNumero: normalizeNossoNumero(resultado.nossoNumero) ?? normalizeNossoNumero(row.nossoNumero),
        codigoBarras: (resultado.codigoBarras as string) || row.codigoBarras,
        linhaDigitavel: (resultado.linhaDigitavel as string) || row.linhaDigitavel,
        qrCode: extractQrCodeFromResultado(resultado) ?? row.qrCode,
        pdfStorageKey,
        status: liquidated ? BankBoletoStatus.PAID : row.status,
        paidAt: liquidated ? row.paidAt ?? new Date() : row.paidAt,
      },
    });
    if (liquidated && updated.receivableId) {
      await this.markReceivablePaidFromBoleto(user, updated.receivableId, Number(updated.valor));
    }
    return this.toBoletoDto(updated);
  }

  async segundaViaPdf(user: JwtPayload, id: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.bankBoleto.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Boleto não encontrado');
    if (row.pdfStorageKey) {
      const cached = readSicoobBoletoPdf(row.pdfStorageKey);
      if (isValidPdfBuffer(cached)) return cached;
    }
    const pdf = await this.fetchPdfFromSicoob(user.tenantSlug, row);
    const path = writeSicoobBoletoPdf(user.tenantSlug, row.id, pdf);
    await prisma.bankBoleto.update({
      where: { id },
      data: {
        pdfStorageKey: path,
        nossoNumero: normalizeNossoNumero(row.nossoNumero),
      },
    });
    return pdf;
  }

  async getBoletoDocument(user: JwtPayload, id: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.bankBoleto.findUnique({
      where: { id },
      include: {
        receivable: { include: { partner: true } },
        salesOrder: { include: { partner: true } },
      },
    });
    if (!row) throw new NotFoundException('Boleto não encontrado');

    const company = await prisma.company.findFirst();
    const sicoobSettings = company
      ? await prisma.sicoobCobrancaSettings.findUnique({ where: { companyId: company.id } })
      : null;
    const clienteEmiteLayout =
      sicoobSettings?.identificacaoEmissaoBoleto === 2 &&
      sicoobSettings?.identificacaoDistribuicaoBoleto === 2;

    const renderClienteHtml = async (note?: string) => {
      let layoutRow = row;
      if (!layoutRow.qrCode?.trim() && layoutRow.linhaDigitavel) {
        try {
          await this.refreshBoleto(user, layoutRow.id);
          layoutRow =
            (await prisma.bankBoleto.findUnique({
              where: { id: layoutRow.id },
              include: {
                receivable: { include: { partner: true } },
                salesOrder: { include: { partner: true } },
              },
            })) ?? layoutRow;
        } catch {
          /* consulta opcional */
        }
      }
      const logoDataUrl = await readCompanyLogoDataUrl(user.tenantSlug);
      const agCod =
        [sicoobSettings?.numeroContaCorrente?.trim(), sicoobSettings?.numeroCliente]
          .filter((v) => v != null && String(v).length > 0)
          .join(' / ') || '—';
      const encargos = sicoobSettings ? this.encargosFromRow(sicoobSettings) : null;
      const limiteTxt =
        encargos && sicoobSettings
          ? buildSicoobEncargosPayload(encargos, layoutRow.dataVencimento).dataLimitePagamento
          : null;
      const localPagamento = limiteTxt
        ? `Pagável na rede bancária até ${limiteTxt.split('-').reverse().join('/')}`
        : 'Pagável preferencialmente na rede Sicoob ou em qualquer banco até o vencimento';
      const html = await buildGestorGranjaBoletoHtml({
        row: layoutRow,
        company,
        logoDataUrl,
        bank: {
          codigoBanco: '756-0',
          localPagamento,
          agenciaCodigoBeneficiario: agCod,
          especieDocumento: sicoobSettings?.codigoEspecieDocumento?.trim() || 'DM',
          carteira: '1',
        },
        encargos,
        note: note ?? null,
      });
      return {
        buffer: Buffer.from(html, 'utf8'),
        contentType: 'text/html; charset=utf-8',
        filename: `boleto-${id}.html`,
      };
    };

    if (clienteEmiteLayout) {
      return renderClienteHtml(
        'Emissão e distribuição pelo beneficiário — layout GestorGranja (registro Sicoob + linha digitável/código de barras).',
      );
    }

    const path = row.pdfStorageKey ?? sicoobBoletoPdfPath(user.tenantSlug, id);
    const cached = readSicoobBoletoPdf(path);
    if (isValidPdfBuffer(cached)) {
      return {
        buffer: cached,
        contentType: 'application/pdf',
        filename: `boleto-${id}.pdf`,
      };
    }

    try {
      const pdf = await this.fetchPdfFromSicoob(user.tenantSlug, row);
      const savedPath = writeSicoobBoletoPdf(user.tenantSlug, row.id, pdf);
      await prisma.bankBoleto.update({
        where: { id },
        data: { pdfStorageKey: savedPath, nossoNumero: normalizeNossoNumero(row.nossoNumero) },
      });
      return {
        buffer: pdf,
        contentType: 'application/pdf',
        filename: `boleto-${id}.pdf`,
      };
    } catch {
      return renderClienteHtml('PDF do banco indisponível — exibindo layout GestorGranja com os dados registrados.');
    }
  }

  getStoredPdf(user: JwtPayload, id: string) {
    return this.getBoletoDocument(user, id).then((d) => d.buffer);
  }

  private extractPdfBase64(resultado: Record<string, unknown>): string | null {
    for (const key of ['pdfBoleto', 'pdf', 'arquivoPdf']) {
      const v = resultado[key];
      if (typeof v === 'string' && v.length > 100) return v;
    }
    return null;
  }

  private async fetchPdfFromSicoob(
    tenantSlug: string,
    row: { id: string; linhaDigitavel?: string | null; codigoBarras?: string | null; nossoNumero?: string | null },
  ): Promise<Buffer> {
    const settings = await this.requireSettings(tenantSlug);
    const auth = await this.buildAuth(tenantSlug, settings);
    const qs = this.consultQuery(settings, row);
    const attempts: { label: string; path: string }[] = [
      { label: 'Segunda via', path: `/boletos/segunda-via?${qs}&gerarPdf=true` },
      { label: 'Consulta com PDF', path: `/boletos?${qs}&gerarPdf=true` },
    ];
    let lastMsg = 'Sicoob não retornou PDF do boleto';
    for (const attempt of attempts) {
      const { status, json } = await this.client.requestJson(tenantSlug, auth, 'GET', attempt.path);
      if (status >= 400) {
        try {
          this.client.throwIfFailed(status, json, attempt.label);
        } catch (e) {
          lastMsg = e instanceof Error ? e.message : lastMsg;
        }
        continue;
      }
      const resultado = unwrapSicoobResult(json);
      const pdfB64 = this.extractPdfBase64(resultado);
      if (!pdfB64) continue;
      const pdf = Buffer.from(pdfB64, 'base64');
      if (isValidPdfBuffer(pdf)) return pdf;
      lastMsg = `${attempt.label}: PDF inválido ou incompleto`;
    }
    throw new BadRequestException(lastMsg);
  }

  async baixarBoleto(user: JwtPayload, id: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.bankBoleto.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Boleto não encontrado');
    if (row.status === BankBoletoStatus.PAID) {
      throw new BadRequestException('Boleto já liquidado');
    }
    const settings = await this.requireSettings(user.tenantSlug);
    const auth = await this.buildAuth(user.tenantSlug, settings);
    if (!row.nossoNumero) throw new BadRequestException('Boleto sem nosso número para baixa');
    const payload = omitEmpty({
      numeroCliente: settings.numeroCliente,
      codigoModalidade: settings.codigoModalidade,
    });
    const { status, json } = await this.client.requestJson(
      user.tenantSlug,
      auth,
      'POST',
      `/boletos/${encodeURIComponent(row.nossoNumero)}/baixar`,
      payload,
    );
    this.client.throwIfFailed(status, json, 'Baixa de boleto');
    const updated = await prisma.bankBoleto.update({
      where: { id },
      data: { status: BankBoletoStatus.CANCELLED, situacaoBoleto: 'Baixado' },
    });
    return this.toBoletoDto(updated);
  }

  async conciliateTenant(tenantSlug: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const open = await prisma.bankBoleto.findMany({
      where: { status: BankBoletoStatus.REGISTERED, nossoNumero: { not: null } },
      take: 40,
      orderBy: { updatedAt: 'asc' },
    });
    if (!open.length) return { checked: 0, paid: 0 };
    const settings = await this.loadSettings(tenantSlug);
    if (!settings?.clientId || settings.numeroCliente == null) return { checked: 0, paid: 0 };
    const auth = await this.buildAuth(tenantSlug, settings);
    let paid = 0;
    for (const row of open) {
      try {
        const qs = this.consultQuery(settings, row);
        const { status, json } = await this.client.requestJson(tenantSlug, auth, 'GET', `/boletos?${qs}`);
        if (status >= 400) continue;
        const resultado = unwrapSicoobResult(json);
        const situacao = String(resultado.situacaoBoleto ?? '');
        if (!isBoletoLiquidated(situacao, resultado.listaHistorico)) {
          await prisma.bankBoleto.update({
            where: { id: row.id },
            data: { situacaoBoleto: situacao || row.situacaoBoleto },
          });
          continue;
        }
        await prisma.bankBoleto.update({
          where: { id: row.id },
          data: {
            status: BankBoletoStatus.PAID,
            situacaoBoleto: situacao || 'Liquidado',
            paidAt: new Date(),
          },
        });
        if (row.receivableId) {
          await this.markReceivablePaidBySlug(tenantSlug, row.receivableId, Number(row.valor));
        }
        paid += 1;
      } catch {
        /* próximo título */
      }
    }
    return { checked: open.length, paid };
  }

  private consultQuery(
    settings: SicoobCobrancaSettings,
    row: { nossoNumero?: string | null; linhaDigitavel?: string | null; codigoBarras?: string | null },
  ) {
    const p = new URLSearchParams();
    p.set('numeroCliente', String(settings.numeroCliente));
    p.set('codigoModalidade', String(settings.codigoModalidade));
    const nn = normalizeNossoNumero(row.nossoNumero);
    const linha = digitsOnly(row.linhaDigitavel);
    const barras = digitsOnly(row.codigoBarras);
    if (nn) p.set('nossoNumero', nn);
    else if (linha.length >= 47) p.set('linhaDigitavel', linha);
    else if (barras.length >= 44) p.set('codigoBarras', barras);
    else throw new BadRequestException('Boleto sem nosso número, linha digitável ou código de barras');
    return p.toString();
  }

  private async registerBoleto(
    user: JwtPayload,
    input: {
      partner: Partner;
      amount: number;
      dueDate: Date;
      seuNumero: string;
      description: string;
      receivableId?: string | null;
      salesOrderId?: string | null;
    },
  ) {
    const settings = await this.requireSettings(user.tenantSlug);
    this.assertReadyToEmit(settings);
    const pagador = this.buildPagador(input.partner);
    const venc = isoDateOnly(input.dueDate);
    const emissao = isoDateOnly(new Date());
    const conta = settings.numeroContaCorrente ? Number(settings.numeroContaCorrente) : undefined;
    const encCfg = this.encargosFromRow(settings);
    try {
      validateEncargosConfig(encCfg);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Encargos inválidos');
    }
    let encPayload: ReturnType<typeof buildSicoobEncargosPayload>;
    try {
      encPayload = buildSicoobEncargosPayload(encCfg, input.dueDate);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Encargos inválidos');
    }
    const instrucoes = buildMensagensInstrucao(input.description, encCfg, input.dueDate);

    const body = omitEmpty({
      numeroCliente: settings.numeroCliente,
      codigoModalidade: settings.codigoModalidade,
      numeroContaCorrente: Number.isFinite(conta) ? conta : undefined,
      codigoEspecieDocumento: settings.codigoEspecieDocumento || 'DM',
      dataEmissao: emissao,
      seuNumero: input.seuNumero.slice(0, 18),
      identificacaoEmissaoBoleto: settings.identificacaoEmissaoBoleto,
      identificacaoDistribuicaoBoleto: settings.identificacaoDistribuicaoBoleto,
      valor: Math.round(input.amount * 100) / 100,
      dataVencimento: venc,
      tipoDesconto: 0,
      tipoMulta: encPayload.tipoMulta,
      tipoJurosMora: encPayload.tipoJurosMora,
      dataMulta: encPayload.dataMulta,
      valorMulta: encPayload.valorMulta,
      dataJurosMora: encPayload.dataJurosMora,
      valorJurosMora: encPayload.valorJurosMora,
      dataLimitePagamento: encPayload.dataLimitePagamento,
      numeroParcela: 1,
      aceite: true,
      codigoNegativacao: settings.codigoNegativacao,
      codigoProtesto: settings.codigoProtesto,
      pagador,
      mensagensInstrucao: instrucoes.length ? instrucoes : undefined,
      gerarPdf: true,
      codigoCadastrarPIX: settings.codigoCadastrarPIX,
    });

    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const draft = await prisma.bankBoleto.create({
      data: {
        receivableId: input.receivableId ?? null,
        salesOrderId: input.salesOrderId ?? null,
        seuNumero: input.seuNumero.slice(0, 18),
        status: BankBoletoStatus.FAILED,
        valor: input.amount,
        dataVencimento: new Date(`${venc}T12:00:00`),
        lastError: 'Aguardando registro',
      },
    });

    const auth = await this.buildAuth(user.tenantSlug, settings);
    try {
      const { status, json } = await this.client.requestJson(
        user.tenantSlug,
        auth,
        'POST',
        '/boletos',
        body,
      );
      this.client.throwIfFailed(status, json, 'Incluir boleto');
      const resultado = unwrapSicoobResult(json);
      const pdfB64 = this.extractPdfBase64(resultado);
      let pdfPath: string | null = null;
      if (pdfB64) {
        const pdfBuf = Buffer.from(pdfB64, 'base64');
        if (isValidPdfBuffer(pdfBuf)) {
          pdfPath = writeSicoobBoletoPdf(user.tenantSlug, draft.id, pdfBuf);
        }
      }
      const saved = await prisma.bankBoleto.update({
        where: { id: draft.id },
        data: {
          status: BankBoletoStatus.REGISTERED,
          nossoNumero: normalizeNossoNumero(resultado.nossoNumero),
          codigoBarras: (resultado.codigoBarras as string) || null,
          linhaDigitavel: (resultado.linhaDigitavel as string) || null,
          qrCode: extractQrCodeFromResultado(resultado),
          pdfStorageKey: pdfPath,
          situacaoBoleto: (resultado.situacaoBoleto as string) || 'Em Aberto',
          registeredAt: new Date(),
          lastError: null,
        },
      });
      return this.toBoletoDto(saved);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha no registro';
      await prisma.bankBoleto.update({
        where: { id: draft.id },
        data: { status: BankBoletoStatus.FAILED, lastError: msg.slice(0, 500) },
      });
      throw e;
    }
  }

  private buildPagador(partner: Partner) {
    const doc = partnerDocumentId(partner);
    if (doc.length < 11) {
      throw new BadRequestException('Cliente sem CPF/CNPJ válido para o boleto');
    }
    const endereco = [partner.street, partner.addressNumber].filter(Boolean).join(', ');
    const cep = digitsOnly(partner.zipCode);
    if (!endereco.trim() || !partner.district?.trim() || !partner.city?.trim() || !partner.state?.trim() || cep.length !== 8) {
      throw new BadRequestException(
        'Complete endereço do cliente (logradouro, bairro, cidade, UF e CEP) para emitir o boleto',
      );
    }
    return omitEmpty({
      numeroCpfCnpj: doc,
      nome: clip(partner.name, 50),
      endereco: clip(endereco, 40),
      bairro: clip(partner.district, 30),
      cidade: clip(partner.city, 40),
      cep,
      uf: clip(partner.state, 2)?.toUpperCase(),
      email: clip(partner.email, 50),
    });
  }

  private boletoAmountFromOrder(order: {
    totalAmount: { toString(): string } | number;
    paymentMethod?: string | null;
    paymentForm?: { kind: string } | null;
    secondaryPaymentForm?: { kind: string } | null;
    primaryPaymentAmount?: { toString(): string } | number | null;
    secondaryPaymentFormId?: string | null;
  }) {
    const total = Number(order.totalAmount);
    const primaryKind = (order.paymentForm?.kind || order.paymentMethod || '').toUpperCase();
    const secondaryKind = (order.secondaryPaymentForm?.kind || '').toUpperCase();
    const isPrimary = primaryKind === 'BOLETO';
    const isSecondary = secondaryKind === 'BOLETO';
    if (order.secondaryPaymentFormId && order.primaryPaymentAmount != null) {
      const primaryAmt = Number(order.primaryPaymentAmount);
      const secondaryAmt = Math.round((total - primaryAmt) * 100) / 100;
      if (isPrimary && isSecondary) return total;
      if (isPrimary) return primaryAmt;
      if (isSecondary) return secondaryAmt;
      return 0;
    }
    return isPrimary ? total : 0;
  }

  private async ensureReceivableForOrder(
    user: JwtPayload,
    order: { id: string; partnerId: string; controlNumber: number; partner: Partner },
    amount: number,
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const existing = await prisma.accountReceivable.findFirst({
      where: { salesOrderId: order.id },
    });
    if (existing) return existing;
    const chart = await prisma.chartAccount.findFirst({
      where: { isActive: true, isPosting: true },
      orderBy: { code: 'asc' },
    });
    const accounts = await prisma.chartAccount.findMany({
      where: { isActive: true, isPosting: true },
      orderBy: { code: 'asc' },
    });
    const revenue = accounts.find((a) => chartAccountAllowedForReceivable(a.code, a.type));
    const chartAccountId = revenue?.id ?? chart?.id;
    if (!chartAccountId) {
      throw new BadRequestException('Cadastre uma conta contábil de receita para gerar o título do boleto');
    }
    const max = await prisma.accountReceivable.aggregate({ _max: { controlNumber: true } });
    const settings = await this.loadSettings(user.tenantSlug);
    const due = new Date();
    due.setDate(due.getDate() + (settings?.dueDaysDefault || 7));
    return prisma.accountReceivable.create({
      data: {
        controlNumber: (max._max.controlNumber ?? 0) + 1,
        partnerId: order.partnerId,
        chartAccountId,
        description: `Boleto venda ${order.controlNumber}`.slice(0, 200),
        amount,
        dueDate: due,
        approvalStatus: PaymentApprovalStatus.APPROVED,
        salesOrderId: order.id,
      },
    });
  }

  private async markReceivablePaidFromBoleto(user: JwtPayload, receivableId: string, amount: number) {
    await this.markReceivablePaidBySlug(user.tenantSlug, receivableId, amount);
  }

  private async markReceivablePaidBySlug(tenantSlug: string, receivableId: string, amount: number) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const row = await prisma.accountReceivable.findUnique({ where: { id: receivableId } });
    if (!row || isReceivableSettled(row)) return;
    await prisma.accountReceivable.update({
      where: { id: receivableId },
      data: {
        amountPaid: amount,
        receivedAt: new Date(),
        approvalStatus: PaymentApprovalStatus.PAID,
        settlementNotes: 'Liquidação boleto Sicoob',
      },
    });
  }

  private seuNumero(prefix: string, n: number) {
    return `${prefix}${String(n).padStart(10, '0')}`.slice(0, 18);
  }

  private assertReadyToEmit(settings: SicoobCobrancaSettings) {
    if (!settings.clientId?.trim()) throw new BadRequestException('Informe o client_id do aplicativo Sicoob');
    if (settings.numeroCliente == null) {
      throw new BadRequestException('Informe o número do cliente (Sisbr) nas configurações de boleto');
    }
    if (settings.environment === SicoobEnvironment.sandbox && !settings.sandboxAccessTokenEnc) {
      throw new BadRequestException('Informe o token sandbox do Portal Developers');
    }
  }

  private async requireSettings(tenantSlug: string) {
    const row = await this.loadSettings(tenantSlug);
    if (!row) {
      throw new BadRequestException('Configure a cobrança Sicoob em Empresa → Boletos Sicoob');
    }
    return row;
  }

  private async loadSettings(tenantSlug: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    return prisma.sicoobCobrancaSettings.findFirst();
  }

  private async buildAuth(tenantSlug: string, settings: SicoobCobrancaSettings): Promise<SicoobHttpAuth> {
    let pfx: Buffer | null = null;
    let passphrase: string | null = null;
    if (settings.environment === SicoobEnvironment.production) {
      if (settings.useFiscalCertificate) {
        pfx = readFiscalCert(tenantSlug);
        const prisma = await this.tenantPrisma.getClient(tenantSlug);
        const fiscal = await prisma.fiscalIssuerSettings.findFirst();
        if (fiscal?.certificatePasswordEnc) passphrase = this.crypto.decrypt(fiscal.certificatePasswordEnc);
        else if (fiscal?.certificatePassword) passphrase = fiscal.certificatePassword;
      } else {
        pfx = readSicoobCert(tenantSlug);
        if (settings.certificatePasswordEnc) passphrase = this.crypto.decrypt(settings.certificatePasswordEnc);
      }
    }
    return {
      environment: settings.environment,
      clientId: settings.clientId ?? '',
      sandboxAccessToken: settings.sandboxAccessTokenEnc
        ? this.crypto.decrypt(settings.sandboxAccessTokenEnc)
        : null,
      pfx,
      passphrase,
    };
  }

  private encargosFromRow(row: SicoobCobrancaSettings): SicoobEncargosConfig {
    return {
      tipoMulta: row.tipoMulta,
      tipoJurosMora: row.tipoJurosMora,
      valorMulta: row.valorMulta,
      valorJurosMora: row.valorJurosMora,
      diasInicioMultaAposVencimento: row.diasInicioMultaAposVencimento,
      diasInicioJurosAposVencimento: row.diasInicioJurosAposVencimento,
      diasLimitePagamentoAposVencimento: row.diasLimitePagamentoAposVencimento,
      encargosNasInstrucoes: row.encargosNasInstrucoes,
    };
  }

  private emptySettingsDto() {
    return {
      environment: 'sandbox' as const,
      clientId: null as string | null,
      numeroCliente: null as number | null,
      numeroContaCorrente: null as string | null,
      codigoModalidade: 1,
      codigoEspecieDocumento: 'DM',
      identificacaoEmissaoBoleto: 1,
      identificacaoDistribuicaoBoleto: 1,
      codigoCadastrarPIX: 0,
      tipoMulta: 0,
      tipoJurosMora: 3,
      valorMulta: null as number | null,
      valorJurosMora: null as number | null,
      diasInicioMultaAposVencimento: 1,
      diasInicioJurosAposVencimento: 1,
      diasLimitePagamentoAposVencimento: null as number | null,
      encargosNasInstrucoes: true,
      codigoProtesto: 3,
      codigoNegativacao: 3,
      dueDaysDefault: 7,
      useFiscalCertificate: true,
      hasCertificate: false,
      hasCertificatePassword: false,
      hasSandboxToken: false,
    };
  }

  private toSettingsDto(row: SicoobCobrancaSettings) {
    return {
      environment: row.environment,
      clientId: row.clientId,
      numeroCliente: row.numeroCliente,
      numeroContaCorrente: row.numeroContaCorrente,
      codigoModalidade: row.codigoModalidade,
      codigoEspecieDocumento: row.codigoEspecieDocumento,
      identificacaoEmissaoBoleto: row.identificacaoEmissaoBoleto,
      identificacaoDistribuicaoBoleto: row.identificacaoDistribuicaoBoleto,
      codigoCadastrarPIX: row.codigoCadastrarPIX,
      tipoMulta: row.tipoMulta,
      tipoJurosMora: row.tipoJurosMora,
      valorMulta: row.valorMulta != null ? Number(row.valorMulta) : null,
      valorJurosMora: row.valorJurosMora != null ? Number(row.valorJurosMora) : null,
      diasInicioMultaAposVencimento: row.diasInicioMultaAposVencimento,
      diasInicioJurosAposVencimento: row.diasInicioJurosAposVencimento,
      diasLimitePagamentoAposVencimento: row.diasLimitePagamentoAposVencimento,
      encargosNasInstrucoes: row.encargosNasInstrucoes,
      codigoProtesto: row.codigoProtesto,
      codigoNegativacao: row.codigoNegativacao,
      dueDaysDefault: row.dueDaysDefault,
      useFiscalCertificate: row.useFiscalCertificate,
      hasCertificate: Boolean(row.certificatePath) || !row.useFiscalCertificate,
      hasCertificatePassword: Boolean(row.certificatePasswordEnc),
      hasSandboxToken: Boolean(row.sandboxAccessTokenEnc),
    };
  }

  toBoletoDto(row: {
    id: string;
    receivableId: string | null;
    salesOrderId: string | null;
    seuNumero: string;
    nossoNumero: string | null;
    codigoBarras: string | null;
    linhaDigitavel: string | null;
    qrCode: string | null;
    pdfStorageKey: string | null;
    status: BankBoletoStatus;
    valor: { toString(): string } | number;
    dataVencimento: Date;
    situacaoBoleto: string | null;
    lastError: string | null;
    registeredAt: Date | null;
    paidAt: Date | null;
  }) {
    return {
      id: row.id,
      receivableId: row.receivableId,
      salesOrderId: row.salesOrderId,
      seuNumero: row.seuNumero,
      nossoNumero: normalizeNossoNumero(row.nossoNumero),
      codigoBarras: row.codigoBarras,
      linhaDigitavel: row.linhaDigitavel,
      qrCode: row.qrCode,
      hasPdf: Boolean(row.pdfStorageKey),
      status: row.status,
      valor: Number(row.valor),
      dataVencimento: row.dataVencimento,
      situacaoBoleto: row.situacaoBoleto,
      lastError: row.lastError,
      registeredAt: row.registeredAt,
      paidAt: row.paidAt,
    };
  }
}
