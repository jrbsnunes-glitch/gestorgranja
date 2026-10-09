import type { Partner } from '../generated/tenant-client';
import { itfBarcodeToSvg, pixEmvToQrDataUrl } from './boleto-barcode.util';
import {
  buildMensagensInstrucao,
  formatMoraMultaJurosCol,
  type SicoobEncargosConfig,
} from './sicoob-encargos.util';
import { digitsOnly, isoDateOnly, normalizeNossoNumero, resolveCodigoBarras } from './sicoob-json.util';

export type BoletoLayoutCompany = {
  legalName: string;
  tradeName?: string | null;
  cnpj: string;
  street?: string | null;
  addressNumber?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type BoletoLayoutBank = {
  codigoBanco: string;
  localPagamento: string;
  agenciaCodigoBeneficiario: string;
  especieDocumento: string;
  carteira: string;
};

export type BoletoLayoutRow = {
  id: string;
  seuNumero: string;
  nossoNumero?: string | null;
  valor: { toString(): string } | number;
  dataVencimento: Date;
  linhaDigitavel: string | null;
  codigoBarras: string | null;
  qrCode: string | null;
  situacaoBoleto: string | null;
  registeredAt?: Date | null;
  receivable?: { partner: Partner; description?: string } | null;
  salesOrder?: { partner: Partner } | null;
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatLinhaDigitavel(linha: string | null | undefined): string {
  const d = digitsOnly(linha);
  if (d.length < 47) return linha?.trim() || '—';
  return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d.slice(32, 33)} ${d.slice(33)}`;
}

export function formatCnpjCpf(raw: string | null | undefined): string {
  const d = digitsOnly(raw);
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return raw?.trim() || '—';
}

function formatAddressLine(parts: (string | null | undefined)[]): string {
  return parts.filter((p) => p?.trim()).join(', ') || '—';
}

function formatCep(cep: string | null | undefined): string {
  const d = digitsOnly(cep);
  if (d.length !== 8) return cep?.trim() || '—';
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatDateBr(d: Date | string | null | undefined): string {
  if (!d) return '—';
  if (typeof d === 'string') return isoDateOnly(d).split('-').reverse().join('/');
  return isoDateOnly(d).split('-').reverse().join('/');
}

const DEFAULT_BANK: BoletoLayoutBank = {
  codigoBanco: '756-0',
  localPagamento: 'Pagável preferencialmente na rede Sicoob ou em qualquer banco até o vencimento',
  agenciaCodigoBeneficiario: '—',
  especieDocumento: 'DM',
  carteira: '1',
};

/**
 * Layout FEBRABAN (ficha de compensação) inspirado no boleto Sicoob —
 * para emissão/distribuição pelo cliente (Cliente emite + Cliente distribui).
 */
export async function buildGestorGranjaBoletoHtml(input: {
  row: BoletoLayoutRow;
  company: BoletoLayoutCompany | null;
  logoDataUrl: string | null;
  bank?: BoletoLayoutBank | null;
  encargos?: SicoobEncargosConfig | null;
  note?: string | null;
}): Promise<string> {
  const { row, company, logoDataUrl, note } = input;
  const bank = { ...DEFAULT_BANK, ...input.bank };
  const partner = row.receivable?.partner ?? row.salesOrder?.partner;
  const linhaFmt = formatLinhaDigitavel(row.linhaDigitavel);
  const barras = resolveCodigoBarras(row.codigoBarras, row.linhaDigitavel) ?? '';
  const barcodeSvg = barras ? itfBarcodeToSvg(barras) : null;
  const valorNum = Number(row.valor);
  const valor = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const venc = formatDateBr(row.dataVencimento);
  const beneficiary = company?.tradeName?.trim() || company?.legalName || 'Beneficiário';
  const beneficiaryDoc = formatCnpjCpf(company?.cnpj);
  const pagador = partner?.name?.trim() || '—';
  const pagadorDoc = formatCnpjCpf(partner?.cnpj || partner?.cpf || partner?.document);
  const pagadorEnd = formatAddressLine([
    [partner?.street, partner?.addressNumber].filter(Boolean).join(', '),
    partner?.district,
    formatCep(partner?.zipCode),
    [partner?.city, partner?.state].filter(Boolean).join('/'),
  ]);
  const nn = normalizeNossoNumero(row.nossoNumero);
  const desc = row.receivable?.description?.trim() || '';
  const instrucaoLines = input.encargos
    ? buildMensagensInstrucao(desc, input.encargos, row.dataVencimento)
    : desc
      ? [desc.slice(0, 40)]
      : [];
  const instrFallback =
    input.encargos ? formatMoraMultaJurosCol(input.encargos) : 'Não receber após o vencimento.';
  const instrLinesForHtml = instrucaoLines.length ? instrucaoLines : [instrFallback];
  const instrucoesHtml = instrLinesForHtml
    .map((line) => `<div class="instr-line">${esc(line)}</div>`)
    .join('');
  /** Na ficha FEBRABAN este campo fica em branco na emissão; o banco preenche na liquidação. */
  const moraMultaJuros = ' ';
  const pix = row.qrCode?.trim() ?? '';
  const pixQrDataUrl = pix ? await pixEmvToQrDataUrl(pix) : null;
  const dataDoc = formatDateBr(row.registeredAt ?? new Date());
  const dataProc = dataDoc;

  const companyLogo = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="" class="benef-logo" />`
    : '';

  const qrBlock = pixQrDataUrl
    ? `<div class="qr-box" title="Pix no boleto"><img class="qr-img" src="${pixQrDataUrl}" alt="QR Pix" /></div>`
    : pix
      ? `<div class="qr-box"><span class="lbl">Pix copia e cola</span><span class="pix-fallback">${esc(pix)}</span></div>`
      : '';

  const instrCell = `<div class="instr-body">
      <span class="lbl">Instruções (texto de responsabilidade do beneficiário)</span>
      <div class="instr-text">${instrucoesHtml}</div>
      ${qrBlock ? `<div class="instr-qr">${qrBlock}</div>` : ''}
    </div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Boleto ${esc(row.seuNumero)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 12px; background: #e2e8f0; font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000; }
    .note { max-width: 666px; margin: 0 auto 8px; font-size: 11px; color: #475569; }
    .boleto { width: 666px; max-width: 100%; margin: 0 auto; background: #fff; border: 1px solid #000; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td { border: 1px solid #000; vertical-align: top; padding: 2px 4px; }
    .lbl { font-size: 7px; text-transform: uppercase; display: block; line-height: 1.2; }
    .val { font-size: 10px; font-weight: 600; min-height: 14px; word-break: break-word; }
    .val-lg { font-size: 12px; font-weight: 700; }
    .top-bank { width: 28%; border-right: 2px solid #000; text-align: center; vertical-align: middle; padding: 6px 4px; }
    .top-code { width: 12%; border-right: 2px solid #000; text-align: center; vertical-align: middle; font-size: 16px; font-weight: 700; }
    .top-linha { vertical-align: middle; padding: 4px 6px; font-family: "Courier New", monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
    .sicoob-mark { display: inline-flex; align-items: center; gap: 6px; font-weight: 800; font-size: 13px; color: #006b3f; letter-spacing: -0.5px; }
    .sicoob-mark svg { width: 28px; height: 28px; }
    .table-comp col.col-instr { width: 413px; }
    .table-comp col.col-side { width: 126px; }
    td.instr {
      width: 413px;
      max-width: 413px;
      min-height: 96px;
      vertical-align: top;
      padding: 2px 4px;
      overflow: hidden;
    }
    .instr-body { width: 100%; max-width: 405px; overflow: hidden; }
    .instr-text { margin-top: 2px; }
    .instr-line { font-size: 9px; font-weight: 600; line-height: 1.35; word-break: break-word; overflow-wrap: anywhere; }
    .instr-line + .instr-line { margin-top: 3px; }
    .instr-qr { margin-top: 6px; text-align: right; clear: both; width: 100%; max-width: 405px; }
    .side-col .val { min-height: 12px; font-weight: 500; font-size: 9px; }
    .qr-box {
      width: 72px;
      height: 72px;
      margin-left: auto;
      border: 1px solid #ccc;
      display: inline-block;
      vertical-align: top;
      background: #fff;
      padding: 2px;
      line-height: 0;
    }
    .qr-box canvas, .qr-box img, .qr-img { width: 68px; height: 68px; max-width: 68px; max-height: 68px; display: block; margin: 0 auto; }
    .pix-fallback { font-size: 6px; word-break: break-all; line-height: 1.2; max-height: 56px; overflow: hidden; display: block; }
    .barcode-area { border-top: 1px solid #000; padding: 6px 8px 4px; }
    .barcode-area svg { width: 100%; height: 52px; }
    .auth { text-align: right; font-size: 8px; padding: 2px 4px 6px; border-top: 0; }
    .recibo-title { font-size: 9px; font-weight: 700; padding: 4px 6px; border-bottom: 1px solid #000; background: #f8fafc; }
    .benef-logo { max-height: 36px; max-width: 100px; object-fit: contain; display: block; margin-bottom: 2px; }
    .cut {
      text-align: center;
      font-size: 8px;
      color: #64748b;
      margin: 0 auto;
      max-width: 666px;
      padding: 6px 4px;
      border-top: 1px dashed #64748b;
      background: #fff;
    }
    .boleto-recibo { margin-bottom: 0; border-bottom: 0; }
    .toolbar { max-width: 666px; margin: 10px auto 0; }
    button { padding: 8px 14px; background: #006b3f; color: #fff; border: 0; border-radius: 4px; cursor: pointer; font-size: 13px; }
    @page { size: A4; margin: 8mm; }
    @media print {
      body { background: #fff; padding: 0; }
      .note, .toolbar { display: none; }
      .cut {
        display: block;
        color: #000;
        border-top: 1px dashed #000;
        padding: 4px 0;
        margin: 0 auto;
        background: #fff;
      }
      .boleto-recibo { page-break-after: avoid; }
      .boleto-ficha { page-break-before: avoid; }
      .boleto { width: 666px; max-width: none; }
      td.instr, .instr-body, .instr-qr { max-width: 413px; overflow: hidden; }
      .table-comp { width: 666px; table-layout: fixed; }
      .table-comp col.col-instr { width: 413px !important; }
      .table-comp col.col-side { width: 126px !important; }
      .qr-box, .qr-img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${note ? `<p class="note">${esc(note)}</p>` : ''}

  <div class="boleto boleto-recibo">
    <div class="recibo-title">Recibo do pagador</div>
    <table>
      <colgroup><col style="width:70%" /><col style="width:30%" /></colgroup>
      <tr>
        <td><span class="lbl">Beneficiário</span><span class="val">${esc(beneficiary)}</span></td>
        <td><span class="lbl">Vencimento</span><span class="val val-lg">${esc(venc)}</span></td>
      </tr>
      <tr>
        <td><span class="lbl">Pagador</span><span class="val">${esc(pagador)}</span></td>
        <td><span class="lbl">Valor do documento</span><span class="val val-lg">${esc(valor)}</span></td>
      </tr>
      <tr>
        <td colspan="2"><span class="lbl">Endereço do pagador</span><span class="val">${esc(pagadorEnd)}</span></td>
      </tr>
    </table>
  </div>

  <div class="cut" role="presentation">Corte na linha pontilhada</div>

  <div class="boleto boleto-ficha">
    <table>
      <tr>
        <td class="top-bank">
          <div class="sicoob-mark">
            <svg viewBox="0 0 32 32" aria-hidden="true"><rect fill="#006b3f" x="2" y="6" width="12" height="20" rx="1"/><rect fill="#7ab800" x="18" y="6" width="12" height="20" rx="1"/></svg>
            SICOOB
          </div>
        </td>
        <td class="top-code">${esc(bank.codigoBanco)}</td>
        <td class="top-linha">${esc(linhaFmt)}</td>
      </tr>
    </table>

    <table>
      <colgroup><col style="width:75%" /><col style="width:25%" /></colgroup>
      <tr>
        <td><span class="lbl">Local de pagamento</span><span class="val">${esc(bank.localPagamento)}</span></td>
        <td><span class="lbl">Vencimento</span><span class="val val-lg">${esc(venc)}</span></td>
      </tr>
      <tr>
        <td><span class="lbl">Beneficiário</span><span class="val">${esc(beneficiary)}${companyLogo ? `<br/>${companyLogo}` : ''}</span></td>
        <td><span class="lbl">Agência / Código do beneficiário</span><span class="val">${esc(bank.agenciaCodigoBeneficiario)}</span></td>
      </tr>
    </table>

    <table>
      <colgroup>
        <col style="width:14%" /><col style="width:14%" /><col style="width:10%" /><col style="width:8%" />
        <col style="width:14%" /><col style="width:14%" /><col style="width:10%" /><col style="width:16%" />
      </colgroup>
      <tr>
        <td><span class="lbl">Data do documento</span><span class="val">${esc(dataDoc)}</span></td>
        <td><span class="lbl">Número do documento</span><span class="val">${esc(row.seuNumero)}</span></td>
        <td><span class="lbl">Espécie doc.</span><span class="val">${esc(bank.especieDocumento)}</span></td>
        <td><span class="lbl">Aceite</span><span class="val">N</span></td>
        <td><span class="lbl">Data processamento</span><span class="val">${esc(dataProc)}</span></td>
        <td colspan="3"><span class="lbl">Nosso número</span><span class="val">${esc(nn ?? '—')}</span></td>
      </tr>
      <tr>
        <td colspan="2"><span class="lbl">Uso do banco</span><span class="val">&nbsp;</span></td>
        <td><span class="lbl">Carteira</span><span class="val">${esc(bank.carteira)}</span></td>
        <td colspan="2"><span class="lbl">Espécie</span><span class="val">R$</span></td>
        <td colspan="2"><span class="lbl">Quantidade</span><span class="val">&nbsp;</span></td>
        <td><span class="lbl">(=) Valor do documento</span><span class="val val-lg">${esc(valor)}</span></td>
      </tr>
    </table>

    <table class="table-comp">
      <colgroup><col class="col-instr" /><col class="col-side" /><col class="col-side" /></colgroup>
      <tr>
        <td rowspan="5" class="instr">${instrCell}</td>
        <td class="side-col"><span class="lbl">(-) Desconto / Abatimento</span><span class="val">&nbsp;</span></td>
        <td class="side-col"><span class="lbl">&nbsp;</span><span class="val">&nbsp;</span></td>
      </tr>
      <tr>
        <td class="side-col" colspan="2"><span class="lbl">(-) Outras deduções</span><span class="val">&nbsp;</span></td>
      </tr>
      <tr>
        <td class="side-col" colspan="2"><span class="lbl">(+) Mora / Multa / Juros</span><span class="val">${moraMultaJuros}</span></td>
      </tr>
      <tr>
        <td class="side-col" colspan="2"><span class="lbl">(+) Outros acréscimos</span><span class="val">&nbsp;</span></td>
      </tr>
      <tr>
        <td class="side-col" colspan="2"><span class="lbl">(=) Valor cobrado</span><span class="val">&nbsp;</span></td>
      </tr>
      <tr>
        <td colspan="3">
          <span class="lbl">Pagador</span>
          <span class="val">${esc(pagador)} — ${esc(pagadorDoc)}</span>
          <span class="lbl" style="margin-top:4px">Endereço</span>
          <span class="val">${esc(pagadorEnd)}</span>
        </td>
      </tr>
      <tr>
        <td><span class="lbl">Beneficiário final</span><span class="val">${esc(beneficiary)} — ${esc(beneficiaryDoc)}</span></td>
        <td colspan="2"><span class="lbl">Código de baixa</span><span class="val">&nbsp;</span></td>
      </tr>
    </table>

    <div class="barcode-area">
      ${barcodeSvg ?? '<p class="lbl">Código de barras indisponível — use a linha digitável.</p>'}
    </div>
    <div class="auth">Autenticação mecânica — Ficha de compensação</div>
  </div>

  <div class="toolbar">
    <button type="button" onclick="window.print()">Imprimir boleto</button>
  </div>
</body>
</html>`;
}
