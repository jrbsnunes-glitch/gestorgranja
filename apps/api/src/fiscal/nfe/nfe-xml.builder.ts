import { Injectable } from '@nestjs/common';
import { SefazEnvironment } from '../../generated/tenant-client';
import { buildAccessKey, randomCNF } from './nfe-access-key.util';
import { sefazUfCode } from '../sefaz/am-webservices';
import type { NfePagRow } from './nfe-payment.util';
import { buildEnderDestXml } from '../fiscal-partner-address.util';
import { buildInfRespTecXml, FiscalRespTec } from '../fiscal-resptec.util';
import { formatNfeDateTime, nfeYearMonthForAccessKey } from './nfe-datetime.util';
import {
  addIbscbsLineTotals,
  buildIbscbsTotXml,
  buildItemIbscbsXml,
  emptyIbscbsNoteTotals,
  requiresIbscbsGroup,
} from './nfe-ibscbs.util';

export type EmitContext = {
  model: '55' | '65';
  environment: SefazEnvironment;
  company: {
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
  partner?: {
    name: string;
    document?: string | null;
    cnpj?: string | null;
    cpf?: string | null;
    stateRegistration?: string | null;
    email?: string | null;
    street?: string | null;
    addressNumber?: string | null;
    district?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  } | null;
  items: {
    nItem: number;
    name: string;
    ncm?: string | null;
    cfop: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    total: number;
    discount?: number;
    cest?: string | null;
    cst?: string | null;
    origin?: string | null;
    gtin?: string | null;
    ibsCst?: string | null;
    ibsClassTrib?: string | null;
  }[];
  series: number;
  number: number;
  totalAmount: number;
  payments?: NfePagRow[];
  respTec: FiscalRespTec;
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

/** IE no XML: somente dígitos ou literal ISENTO (sem máscara). */
function normalizeIe(ie: string): string {
  const t = ie.trim();
  if (!t || t.toUpperCase() === 'ISENTO') return 'ISENTO';
  const digits = onlyDigits(t);
  return digits || 'ISENTO';
}

const HOMOLOG_FISCAL_LABEL =
  'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';

/** xNome do destinatário (NF-e): máx. 60 caracteres no schema SEFAZ. */
const HOMOLOG_DEST_XNOME = HOMOLOG_FISCAL_LABEL.slice(0, 60);

function homologFieldText(
  name: string,
  environment: SefazEnvironment,
  maxLen: number,
): string {
  if (environment === 'producao') return name.slice(0, maxLen);
  const label = maxLen <= 60 ? HOMOLOG_DEST_XNOME : HOMOLOG_FISCAL_LABEL;
  return label.slice(0, maxLen);
}

function money(n: number) {
  return Math.round(n * 100) / 100;
}

/** NT 2026.008: homologação desde 26/10/2026, produção desde 16/11/2026. */
function schemaIncludesValorLiquido(environment: SefazEnvironment, now = new Date()): boolean {
  const from =
    environment === 'producao'
      ? Date.parse('2026-11-16T03:00:00.000Z')
      : Date.parse('2026-10-26T03:00:00.000Z');
  return now.getTime() >= from;
}

function gtinOrSem(gtin?: string | null): string {
  const digits = onlyDigits(gtin ?? '');
  if (digits.length >= 8 && digits.length <= 14 && gtin !== 'SEM GTIN') return digits;
  return 'SEM GTIN';
}

function buildIcmsXml(crt: number, origin: string, cst: string): string {
  const o = (origin || '0').replace(/\D/g, '').slice(0, 1) || '0';
  if (crt === 1 || crt === 2 || crt === 4) {
    const c = (cst || '102').replace(/\D/g, '').padStart(3, '0').slice(-3);
    if (c === '101') {
      return `<ICMS><ICMSSN101><orig>${o}</orig><CSOSN>101</CSOSN><pCredSN>0.00</pCredSN><vCredICMSSN>0.00</vCredICMSSN></ICMSSN101></ICMS>`;
    }
    if (c === '500') {
      return (
        `<ICMS><ICMSSN500><orig>${o}</orig><CSOSN>500</CSOSN>` +
        `<vBCSTRet>0.00</vBCSTRet><pST>0.00</pST><vICMSSTRet>0.00</vICMSSTRet></ICMSSN500></ICMS>`
      );
    }
    if (c === '900') {
      return (
        `<ICMS><ICMSSN900><orig>${o}</orig><CSOSN>900</CSOSN>` +
        `<modBC>3</modBC><vBC>0.00</vBC><pRedBC>0.00</pRedBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMSSN900></ICMS>`
      );
    }
    const sn = ['102', '103', '300', '400'].includes(c) ? c : '102';
    return `<ICMS><ICMSSN102><orig>${o}</orig><CSOSN>${sn}</CSOSN></ICMSSN102></ICMS>`;
  }
  const c = (cst || '00').replace(/\D/g, '').padStart(2, '0').slice(-2);
  if (['40', '41', '50'].includes(c)) {
    return `<ICMS><ICMS${c}><orig>${o}</orig><CST>${c}</CST></ICMS${c}></ICMS>`;
  }
  if (c === '20') {
    return (
      `<ICMS><ICMS20><orig>${o}</orig><CST>20</CST><modBC>3</modBC>` +
      `<vBC>0.00</vBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMS20></ICMS>`
    );
  }
  if (c === '00') {
    return (
      `<ICMS><ICMS00><orig>${o}</orig><CST>00</CST>` +
      `<modBC>3</modBC><vBC>0.00</vBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMS00></ICMS>`
    );
  }
  if (c === '60') {
    return (
      `<ICMS><ICMS60><orig>${o}</orig><CST>60</CST>` +
      `<vBCSTRet>0.00</vBCSTRet><pST>0.00</pST><vICMSSTRet>0.00</vICMSSTRet></ICMS60></ICMS>`
    );
  }
  return `<ICMS><ICMS40><orig>${o}</orig><CST>40</CST></ICMS40></ICMS>`;
}

function buildPisCofins(crt: number): string {
  if (crt === 3) {
    return (
      `<PIS><PISOutr><CST>49</CST><vBC>0.00</vBC><pPIS>0.00</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>` +
      `<COFINS><COFINSOutr><CST>49</CST><vBC>0.00</vBC><pCOFINS>0.00</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>`
    );
  }
  return `<PIS><PISNT><CST>07</CST></PISNT></PIS><COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>`;
}

@Injectable()
export class NfeXmlBuilder {
  build(ctx: EmitContext): { xml: string; accessKey: string; infId: string } {
    const tpAmb = ctx.environment === 'producao' ? '1' : '2';
    const now = new Date();
    const emitUf = (ctx.company.state || 'AM').toUpperCase();
    const dhEmi = formatNfeDateTime(now, emitUf);
    const yymm = nfeYearMonthForAccessKey(now, emitUf);
    const cNF = randomCNF();
    const tpEmis = '1';
    const accessKey = buildAccessKey({
      uf: sefazUfCode(),
      yymm,
      cnpj: ctx.company.cnpj,
      model: ctx.model,
      series: String(ctx.series),
      number: String(ctx.number),
      tpEmis,
      cNF,
    });
    const infId = `NFe${accessKey}`;
    const cUF = sefazUfCode();
    const crtNum = ctx.company.taxRegime ?? 1;
    const crt = String(crtNum);
    const includeIbscbs = requiresIbscbsGroup({
      crt: crtNum,
      environment: ctx.environment,
      emissionAt: now,
    });
    let ibscbsNoteTotals = emptyIbscbsNoteTotals();
    const natOp = ctx.model === '65' ? 'Venda de mercadoria' : 'Venda de producao do estabelecimento';

    const emitEnd =
      `<enderEmit>` +
      `<xLgr>${esc(ctx.company.street || ctx.company.city || 'Endereco')}</xLgr>` +
      `<nro>${esc(ctx.company.addressNumber || 'S/N')}</nro>` +
      `<xBairro>${esc(ctx.company.district || 'Centro')}</xBairro>` +
      `<cMun>${esc(ctx.company.municipalIbgeCode || '1302603')}</cMun>` +
      `<xMun>${esc(ctx.company.city || 'Manaus')}</xMun>` +
      `<UF>${esc((ctx.company.state || 'AM').toUpperCase())}</UF>` +
      `<CEP>${onlyDigits(ctx.company.zipCode || '69000000').padStart(8, '0')}</CEP>` +
      `<cPais>1058</cPais><xPais>Brasil</xPais>` +
      (ctx.company.phone ? `<fone>${onlyDigits(ctx.company.phone)}</fone>` : '') +
      `</enderEmit>`;

    let dest = '';
    let destIsNonContributor = true;
    let idDest = '1';

    if (ctx.model === '55' && ctx.partner) {
      const doc = onlyDigits(ctx.partner.cnpj || ctx.partner.cpf || ctx.partner.document || '');
      const isCnpj = doc.length === 14;
      const destUf = (ctx.partner.state || emitUf).toUpperCase();
      idDest = destUf !== emitUf ? '2' : '1';

      const ieRaw = ctx.partner.stateRegistration?.trim();
      let destIeBlock = '<indIEDest>9</indIEDest>';
      if (ieRaw) {
        const ieNorm = normalizeIe(ieRaw);
        if (ieNorm === 'ISENTO') {
          destIeBlock = '<indIEDest>2</indIEDest>';
          destIsNonContributor = true;
        } else {
          destIeBlock = `<indIEDest>1</indIEDest><IE>${esc(ieNorm)}</IE>`;
          destIsNonContributor = false;
        }
      }

      dest =
        `<dest>` +
        (isCnpj ? `<CNPJ>${doc}</CNPJ>` : `<CPF>${doc.padStart(11, '0').slice(-11)}</CPF>`) +
        `<xNome>${esc(homologFieldText(ctx.partner.name, ctx.environment, 60))}</xNome>` +
        buildEnderDestXml(ctx.partner, ctx.company) +
        destIeBlock +
        (ctx.partner.email ? `<email>${esc(ctx.partner.email)}</email>` : '') +
        `</dest>`;
    } else if (ctx.model === '65') {
      const doc = onlyDigits(ctx.partner?.cnpj || ctx.partner?.cpf || ctx.partner?.document || '');
      const identified = doc.length === 11 || doc.length === 14;
      dest = identified
        ? `<dest>` +
          (doc.length === 14 ? `<CNPJ>${doc}</CNPJ>` : `<CPF>${doc}</CPF>`) +
          (ctx.partner?.name
            ? `<xNome>${esc(homologFieldText(ctx.partner.name, ctx.environment, 60))}</xNome>`
            : '') +
          `<indIEDest>9</indIEDest></dest>`
        : `<dest><indIEDest>9</indIEDest></dest>`;
      destIsNonContributor = true;
    }

    const indFinal =
      ctx.model === '65' || destIsNonContributor ? '1' : '0';

    const includeValorLiquido = schemaIncludesValorLiquido(ctx.environment, now);
    let vProdSum = 0;
    let vDescSum = 0;
    const det = ctx.items
      .map((it) => {
        const gross = money(it.quantity * it.unitPrice);
        const discount = money(Math.min(gross, Math.max(0, it.discount ?? 0)));
        vProdSum = money(vProdSum + gross);
        vDescSum = money(vDescSum + discount);
        const origin = it.origin ?? '0';
        const cst = it.cst ?? (crtNum === 3 ? '40' : '102');
        const ean = gtinOrSem(it.gtin);
        const cest = onlyDigits(it.cest ?? '');
        let ibscbsBlock = '';
        if (includeIbscbs) {
          const { xml, line } = buildItemIbscbsXml({
            vProd: money(gross - discount),
            cst: it.ibsCst,
            cClassTrib: it.ibsClassTrib,
            crt: crtNum,
          });
          ibscbsBlock = xml;
          ibscbsNoteTotals = addIbscbsLineTotals(ibscbsNoteTotals, line);
        }
        const vUn = it.unitPrice.toFixed(4);
        const vProd = gross.toFixed(2);
        return (
          `<det nItem="${it.nItem}">` +
          `<prod>` +
          `<cProd>${it.nItem}</cProd>` +
          `<cEAN>${ean}</cEAN>` +
          `<xProd>${esc(homologFieldText(it.name, ctx.environment, 120))}</xProd>` +
          `<NCM>${onlyDigits(it.ncm || '04072100').padStart(8, '0')}</NCM>` +
          (cest.length === 7 ? `<CEST>${cest}</CEST>` : '') +
          `<CFOP>${it.cfop}</CFOP>` +
          `<uCom>${esc(it.unit || 'UN')}</uCom>` +
          `<qCom>${it.quantity.toFixed(4)}</qCom>` +
          `<vUnCom>${vUn}</vUnCom>` +
          `<vProd>${vProd}</vProd>` +
          (includeValorLiquido ? `<vUnComLiq>${vUn}</vUnComLiq><vProdLiq>${vProd}</vProdLiq>` : '') +
          `<cEANTrib>${ean}</cEANTrib>` +
          `<uTrib>${esc(it.unit || 'UN')}</uTrib>` +
          `<qTrib>${it.quantity.toFixed(4)}</qTrib>` +
          `<vUnTrib>${vUn}</vUnTrib>` +
          (discount > 0 ? `<vDesc>${discount.toFixed(2)}</vDesc>` : '') +
          `<indTot>1</indTot>` +
          `</prod>` +
          `<imposto><vTotTrib>0.00</vTotTrib>` +
          buildIcmsXml(crtNum, origin, cst) +
          buildPisCofins(crtNum) +
          ibscbsBlock +
          `</imposto>` +
          `</det>`
        );
      })
      .join('');

    const vNF = money(vProdSum - vDescSum).toFixed(2);
    const vProdTot = vProdSum.toFixed(2);
    const vDescTot = vDescSum.toFixed(2);
    const targetNf = Number(vNF);
    const payments =
      ctx.payments && ctx.payments.length > 0
        ? ctx.payments.map((p) => ({ ...p }))
        : [{ tPag: '01', vPag: targetNf, indPag: 0 as const }];
    const paid = money(payments.reduce((s, p) => s + p.vPag, 0));
    const payDiff = money(targetNf - paid);
    if (payments.length > 0 && Math.abs(payDiff) >= 0.01 && Math.abs(payDiff) <= 0.05) {
      const last = payments[payments.length - 1]!;
      last.vPag = money(last.vPag + payDiff);
    }
    const pagXml = payments
      .map((p) => {
        const xPag = p.tPag === '99' && p.xPag ? `<xPag>${esc(p.xPag)}</xPag>` : '';
        return (
          `<detPag><indPag>${p.indPag}</indPag><tPag>${p.tPag}</tPag>${xPag}<vPag>${p.vPag.toFixed(2)}</vPag></detPag>`
        );
      })
      .join('');

    const ide =
      `<ide>` +
      `<cUF>${cUF}</cUF>` +
      `<cNF>${cNF}</cNF>` +
      `<natOp>${esc(natOp)}</natOp>` +
      `<mod>${ctx.model}</mod>` +
      `<serie>${ctx.series}</serie>` +
      `<nNF>${ctx.number}</nNF>` +
      `<dhEmi>${dhEmi}</dhEmi>` +
      `<tpNF>1</tpNF>` +
      `<idDest>${idDest}</idDest>` +
      `<cMunFG>${esc(ctx.company.municipalIbgeCode || '1302603')}</cMunFG>` +
      `<tpImp>${ctx.model === '65' ? '4' : '1'}</tpImp>` +
      `<tpEmis>${tpEmis}</tpEmis>` +
      `<cDV>${accessKey.slice(-1)}</cDV>` +
      `<tpAmb>${tpAmb}</tpAmb>` +
      `<finNFe>1</finNFe>` +
      `<indFinal>${indFinal}</indFinal>` +
      `<indPres>${ctx.model === '65' ? '1' : '9'}</indPres>` +
      `<procEmi>0</procEmi>` +
      `<verProc>GestorGranja-1.0</verProc>` +
      `</ide>`;

    const infNFe =
      `<infNFe Id="${infId}" versao="4.00">` +
      ide +
      `<emit>` +
      `<CNPJ>${onlyDigits(ctx.company.cnpj).padStart(14, '0')}</CNPJ>` +
      `<xNome>${esc(ctx.company.legalName)}</xNome>` +
      (ctx.company.tradeName ? `<xFant>${esc(ctx.company.tradeName)}</xFant>` : '') +
      emitEnd +
      `<IE>${esc(normalizeIe(ctx.company.stateReg || 'ISENTO'))}</IE>` +
      `<CRT>${crt}</CRT>` +
      `</emit>` +
      dest +
      det +
      `<total><ICMSTot>` +
      `<vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson>` +
      `<vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>` +
      `<vProd>${vProdTot}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>${vDescTot}</vDesc><vII>0.00</vII>` +
      `<vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro>` +
      `<vNF>${vNF}</vNF>` +
      `</ICMSTot>` +
      (includeIbscbs ? buildIbscbsTotXml(ibscbsNoteTotals) : '') +
      (includeValorLiquido ? `<vProdLiqTot>${vProdTot}</vProdLiqTot>` : '') +
      `</total>` +
      `<transp><modFrete>9</modFrete></transp>` +
      `<pag>${pagXml}</pag>` +
      buildInfRespTecXml(ctx.respTec, accessKey) +
      `</infNFe>`;

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">` +
      infNFe +
      `</NFe>`;

    return { xml, accessKey, infId };
  }

  buildCancelEvent(params: {
    accessKey: string;
    protocol: string;
    reason: string;
    cnpj: string;
    environment: SefazEnvironment;
    seq: number;
  }): string {
    const tpAmb = params.environment === 'producao' ? '1' : '2';
    const dh = formatNfeDateTime(new Date(), 'AM');
    const id = `ID110111${params.accessKey}${String(params.seq).padStart(2, '0')}`;
    return (
      `<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
      `<idLote>${Date.now()}</idLote>` +
      `<evento versao="1.00">` +
      `<infEvento Id="${id}">` +
      `<cOrgao>${sefazUfCode()}</cOrgao>` +
      `<tpAmb>${tpAmb}</tpAmb>` +
      `<CNPJ>${onlyDigits(params.cnpj)}</CNPJ>` +
      `<chNFe>${params.accessKey}</chNFe>` +
      `<dhEvento>${dh}</dhEvento>` +
      `<tpEvento>110111</tpEvento>` +
      `<nSeqEvento>${params.seq}</nSeqEvento>` +
      `<verEvento>1.00</verEvento>` +
      `<detEvento versao="1.00">` +
      `<descEvento>Cancelamento</descEvento>` +
      `<nProt>${params.protocol}</nProt>` +
      `<xJust>${esc(params.reason.slice(0, 255))}</xJust>` +
      `</detEvento></infEvento></evento></envEvento>`
    );
  }

  buildCceEvent(params: {
    accessKey: string;
    correction: string;
    cnpj: string;
    environment: SefazEnvironment;
    seq: number;
  }): string {
    const tpAmb = params.environment === 'producao' ? '1' : '2';
    const dh = formatNfeDateTime(new Date(), 'AM');
    const id = `ID110110${params.accessKey}${String(params.seq).padStart(2, '0')}`;
    return (
      `<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
      `<idLote>${Date.now()}</idLote>` +
      `<evento versao="1.00">` +
      `<infEvento Id="${id}">` +
      `<cOrgao>${sefazUfCode()}</cOrgao>` +
      `<tpAmb>${tpAmb}</tpAmb>` +
      `<CNPJ>${onlyDigits(params.cnpj)}</CNPJ>` +
      `<chNFe>${params.accessKey}</chNFe>` +
      `<dhEvento>${dh}</dhEvento>` +
      `<tpEvento>110110</tpEvento>` +
      `<nSeqEvento>${params.seq}</nSeqEvento>` +
      `<verEvento>1.00</verEvento>` +
      `<detEvento versao="1.00">` +
      `<descEvento>Carta de Correcao</descEvento>` +
      `<xCorrecao>${esc(params.correction.slice(0, 1000))}</xCorrecao>` +
      `</detEvento></infEvento></evento></envEvento>`
    );
  }

  buildInutilizacao(params: {
    cnpj: string;
    series: number;
    numberFrom: number;
    numberTo: number;
    model: '55' | '65';
    reason: string;
    environment: SefazEnvironment;
  }): string {
    const tpAmb = params.environment === 'producao' ? '1' : '2';
    const y = String(new Date().getFullYear());
    const id = `ID${sefazUfCode()}${y}${onlyDigits(params.cnpj).padStart(14, '0')}${params.model}${String(params.series).padStart(3, '0')}${String(params.numberFrom).padStart(9, '0')}${String(params.numberTo).padStart(9, '0')}`;
    return (
      `<inutNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
      `<infInut Id="${id}">` +
      `<tpAmb>${tpAmb}</tpAmb>` +
      `<xServ>INUTILIZAR</xServ>` +
      `<cUF>${sefazUfCode()}</cUF>` +
      `<ano>${y.slice(2)}</ano>` +
      `<CNPJ>${onlyDigits(params.cnpj)}</CNPJ>` +
      `<mod>${params.model}</mod>` +
      `<serie>${params.series}</serie>` +
      `<nNFIni>${params.numberFrom}</nNFIni>` +
      `<nNFFin>${params.numberTo}</nNFFin>` +
      `<xJust>${esc(params.reason.slice(0, 255))}</xJust>` +
      `</infInut></inutNFe>`
    );
  }
}
