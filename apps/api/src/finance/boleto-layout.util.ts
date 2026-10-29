import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
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
  localPagamento: 'Pagável preferencialmente nas cooperativas do Sistema Sicoob',
  agenciaCodigoBeneficiario: '—',
  especieDocumento: 'DM',
  carteira: '1',
};

const SICOOB_MARK = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect fill="#003641" x="2" y="4" width="12" height="24" rx="2"/><rect fill="#00AE9D" x="18" y="4" width="12" height="24" rx="2"/></svg>`;

let systemLogoDataUrl: string | null | undefined;

/** Logo do GestorGranja (login / painel), embutida na ficha. */
export function readSystemLogoDataUrl(): string | null {
  if (systemLogoDataUrl !== undefined) return systemLogoDataUrl;
  const file = 'login-logo.png';
  const candidates = [
    join(process.cwd(), 'apps/web/public/branding', file),
    join(process.cwd(), 'web/public/branding', file),
    join(process.cwd(), '../web/public/branding', file),
    join(__dirname, '../../../../apps/web/public/branding', file),
    join(__dirname, '../../../web/public/branding', file),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    systemLogoDataUrl = `data:image/png;base64,${readFileSync(path).toString('base64')}`;
    return systemLogoDataUrl;
  }
  systemLogoDataUrl = null;
  return null;
}

/**
 * Ficha de compensação no padrão do boleto híbrido Sicoob (756):
 * recibo do pagador, linha digitável, código de barras ITF e QR Code Pix à direita.
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

  const brandSrc = readSystemLogoDataUrl() || logoDataUrl;
  const brandImg = brandSrc
    ? `<img src="${brandSrc}" alt="Logo" class="system-logo" />`
    : '';
  const benefEnd = formatAddressLine([
    [company?.street, company?.addressNumber].filter(Boolean).join(', '),
    company?.district,
    formatCep(company?.zipCode),
    [company?.city, company?.state].filter(Boolean).join('/'),
  ]);
  const benefLine = `${beneficiary} — ${beneficiaryDoc}`;

  const qrCell = pixQrDataUrl
    ? `<td class="qr-col" rowspan="2">
        <div class="pix-kicker">Pague com</div>
        <div class="pix-word">PIX</div>
        <img class="qr-img" src="${pixQrDataUrl}" alt="QR Code Pix" />
      </td>`
    : pix
      ? `<td class="qr-col" rowspan="2"><span class="lbl">Pix copia e cola</span><span class="pix-fallback">${esc(pix)}</span></td>`
      : '';

  const head = (compact: boolean) => `<table class="head">
      <colgroup><col style="width:24%" /><col style="width:14%" /><col style="width:62%" /></colgroup>
      <tr>
        <td class="top-bank">${SICOOB_MARK}<span class="brand-name">Sicoob</span></td>
        <td class="top-code">${esc(bank.codigoBanco)}</td>
        <td class="${compact ? 'top-linha linha-sm' : 'top-linha'}">${esc(linhaFmt)}</td>
      </tr>
    </table>`;

  const benefEndHtml = benefEnd !== '—' ? `<span class="val end">${esc(benefEnd)}</span>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Boleto ${esc(row.seuNumero)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 12px; background: #e7e5e4; font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000; }
    .note, .cut, .toolbar, .boleto { width: 180mm; max-width: 100%; margin-left: auto; margin-right: auto; }
    .note { margin-bottom: 8px; font-size: 11px; color: #44403c; }
    .boleto { background: #fff; border: 1px solid #000; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td { border: 1px solid #000; vertical-align: top; padding: 2px 4px; }
    .head td { height: 38px; }
    .boleto-recibo .head td { height: 30px; }
    .lbl { font-size: 6.5px; text-transform: uppercase; display: block; line-height: 1.15; color: #111; }
    .val { font-size: 10px; font-weight: 600; min-height: 13px; word-break: break-word; }
    .val.end { font-weight: 500; font-size: 9px; }
    .val-lg { font-size: 12px; font-weight: 700; }
    .top-bank { border-right: 2px solid #000; text-align: center; vertical-align: middle; white-space: nowrap; }
    .brand-mark { width: 22px; height: 22px; vertical-align: middle; }
    .brand-name { display: inline-block; margin-left: 6px; font-weight: 800; font-size: 16px; color: #003641; letter-spacing: -0.4px; vertical-align: middle; }
    .top-code { border-right: 2px solid #000; text-align: center; vertical-align: middle; font-size: 15px; font-weight: 700; }
    .top-linha { vertical-align: middle; text-align: right; padding-right: 6px; font-family: "Courier New", Courier, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.2px; }
    .linha-sm { font-size: 8.5px; letter-spacing: 0; }
    .table-comp col.col-instr { width: 72%; }
    .table-comp col.col-side { width: 28%; }
    td.instr { min-height: 92px; vertical-align: top; }
    .instr-text { margin-top: 2px; }
    .instr-line { font-size: 9px; font-weight: 600; line-height: 1.35; word-break: break-word; }
    .instr-line + .instr-line { margin-top: 2px; }
    .side-col .val { min-height: 14px; }
    .qr-col { width: 36mm; text-align: center; vertical-align: middle; padding: 3px 2px; background: #fff; }
    .pix-kicker { font-size: 8px; font-weight: 700; color: #32BCAD; line-height: 1; }
    .pix-word { font-size: 13px; font-weight: 800; letter-spacing: 1.2px; color: #32BCAD; line-height: 1.15; margin: 0 0 2px; }
    .qr-img { width: 30mm; height: 30mm; display: block; margin: 0 auto; }
    .pix-fallback { font-size: 6px; word-break: break-all; line-height: 1.2; display: block; }
    .barcode-cell { padding: 3px 6px 2px; vertical-align: bottom; }
    .barcode-cell svg { width: 100%; height: 13mm; display: block; }
    .auth { text-align: right; font-size: 8px; font-weight: 700; padding: 2px 0 1px; }
    .recibo-title { text-align: right; font-size: 8px; font-weight: 700; padding: 2px 6px 3px; }
    .sign { display: block; margin-top: 12px; border-top: 1px solid #000; font-size: 7px; text-transform: uppercase; padding-top: 2px; font-weight: 500; }
    .sacador { margin-top: 4px; }
    table.benef-inner, table.benef-inner td { border: 0; padding: 0; vertical-align: middle; }
    table.benef-inner { width: 100%; }
    .logo-cell { width: 48mm; padding-right: 6px !important; }
    .system-logo { height: 18mm; width: auto; max-width: 46mm; object-fit: contain; display: block; }
    .boleto-recibo .system-logo { height: 14mm; max-width: 40mm; }
    .cut {
      text-align: right;
      font-size: 8px;
      color: #44403c;
      padding: 5px 4px 6px;
      border-top: 1px dashed #000;
      background: #fff;
    }
    .boleto-recibo { border-bottom: 0; }
    .toolbar { margin-top: 10px; }
    button { padding: 8px 14px; background: #003641; color: #fff; border: 0; border-radius: 4px; cursor: pointer; font-size: 13px; }
    @page { size: A4; margin: 8mm; }
    @media print {
      body { background: #fff; padding: 0; }
      .note, .toolbar { display: none; }
      .cut { color: #000; background: #fff; }
      .boleto-recibo { page-break-after: avoid; }
      .boleto-ficha { page-break-before: avoid; }
      .boleto, .cut { width: 180mm; max-width: none; }
      .qr-img, .brand-mark, .pix-word, .pix-kicker, .system-logo { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${note ? `<p class="note">${esc(note)}</p>` : ''}

  <div class="boleto boleto-recibo">
    ${head(true)}
    <table>
      <colgroup><col style="width:58%" /><col style="width:20%" /><col style="width:22%" /></colgroup>
      <tr>
        <td>
          <span class="lbl">Beneficiário</span>
          <table class="benef-inner"><tr>
            ${brandImg ? `<td class="logo-cell">${brandImg}</td>` : ''}
            <td><span class="val">${esc(benefLine)}</span></td>
          </tr></table>
        </td>
        <td><span class="lbl">Agência / Código beneficiário</span><span class="val">${esc(bank.agenciaCodigoBeneficiario)}</span></td>
        <td><span class="lbl">Vencimento</span><span class="val val-lg">${esc(venc)}</span></td>
      </tr>
      <tr>
        <td>
          <span class="lbl">Pagador</span>
          <span class="val">${esc(pagador)} — ${esc(pagadorDoc)}</span>
          <span class="val end">${esc(pagadorEnd)}</span>
        </td>
        <td><span class="lbl">Nosso número</span><span class="val">${esc(nn ?? '—')}</span></td>
        <td>
          <span class="lbl">Valor do documento</span>
          <span class="val val-lg">${esc(valor)}</span>
          <span class="sign">Assinatura do pagador</span>
        </td>
      </tr>
    </table>
    <div class="recibo-title">Recibo do pagador</div>
  </div>

  <div class="cut" role="presentation">Corte na linha pontilhada</div>

  <div class="boleto boleto-ficha">
    ${head(false)}

    <table>
      <colgroup><col style="width:72%" /><col style="width:28%" /></colgroup>
      <tr>
        <td><span class="lbl">Local de pagamento</span><span class="val">${esc(bank.localPagamento)}</span></td>
        <td><span class="lbl">Vencimento</span><span class="val val-lg">${esc(venc)}</span></td>
      </tr>
      <tr>
        <td>
          <span class="lbl">Beneficiário</span>
          <table class="benef-inner"><tr>
            ${brandImg ? `<td class="logo-cell">${brandImg}</td>` : ''}
            <td>
              <span class="val">${esc(benefLine)}</span>
              ${benefEndHtml}
            </td>
          </tr></table>
        </td>
        <td><span class="lbl">Agência / Código do beneficiário</span><span class="val">${esc(bank.agenciaCodigoBeneficiario)}</span></td>
      </tr>
    </table>

    <table>
      <colgroup>
        <col style="width:16%" /><col style="width:16%" /><col style="width:10%" /><col style="width:8%" /><col style="width:16%" /><col style="width:34%" />
      </colgroup>
      <tr>
        <td><span class="lbl">Data do documento</span><span class="val">${esc(dataDoc)}</span></td>
        <td><span class="lbl">Nº do documento</span><span class="val">${esc(row.seuNumero)}</span></td>
        <td><span class="lbl">Espécie doc.</span><span class="val">${esc(bank.especieDocumento)}</span></td>
        <td><span class="lbl">Aceite</span><span class="val">N</span></td>
        <td><span class="lbl">Data processamento</span><span class="val">${esc(dataProc)}</span></td>
        <td><span class="lbl">Nosso número</span><span class="val">${esc(nn ?? '—')}</span></td>
      </tr>
    </table>

    <table>
      <colgroup>
        <col style="width:16%" /><col style="width:12%" /><col style="width:12%" /><col style="width:16%" /><col style="width:16%" /><col style="width:28%" />
      </colgroup>
      <tr>
        <td><span class="lbl">Uso do banco</span><span class="val">&nbsp;</span></td>
        <td><span class="lbl">Carteira</span><span class="val">${esc(bank.carteira)}</span></td>
        <td><span class="lbl">Espécie</span><span class="val">R$</span></td>
        <td><span class="lbl">Quantidade</span><span class="val">&nbsp;</span></td>
        <td><span class="lbl">Valor</span><span class="val">&nbsp;</span></td>
        <td><span class="lbl">(=) Valor do documento</span><span class="val val-lg">${esc(valor)}</span></td>
      </tr>
    </table>

    <table class="table-comp">
      <colgroup><col class="col-instr" /><col class="col-side" /></colgroup>
      <tr>
        <td rowspan="5" class="instr">
          <span class="lbl">Instruções (texto de responsabilidade do beneficiário)</span>
          <div class="instr-text">${instrucoesHtml}</div>
        </td>
        <td class="side-col"><span class="lbl">(-) Desconto / Abatimento</span><span class="val">&nbsp;</span></td>
      </tr>
      <tr>
        <td class="side-col"><span class="lbl">(-) Outras deduções</span><span class="val">&nbsp;</span></td>
      </tr>
      <tr>
        <td class="side-col"><span class="lbl">(+) Mora / Multa / Juros</span><span class="val">${moraMultaJuros}</span></td>
      </tr>
      <tr>
        <td class="side-col"><span class="lbl">(+) Outros acréscimos</span><span class="val">&nbsp;</span></td>
      </tr>
      <tr>
        <td class="side-col"><span class="lbl">(=) Valor cobrado</span><span class="val">&nbsp;</span></td>
      </tr>
    </table>

    <table class="bottom">
      <tr>
        <td class="pagador-cell">
          <span class="lbl">Pagador</span>
          <span class="val">${esc(pagador)} — CPF/CNPJ ${esc(pagadorDoc)}</span>
          <span class="val end">${esc(pagadorEnd)}</span>
          <span class="lbl sacador">Sacador / Avalista</span>
          <span class="val">${esc(benefLine)}</span>
        </td>
        ${qrCell}
      </tr>
      <tr>
        <td class="barcode-cell">
          ${barcodeSvg ?? '<span class="lbl">Código de barras indisponível — use a linha digitável.</span>'}
          <div class="auth">Autenticação mecânica — Ficha de compensação</div>
        </td>
      </tr>
    </table>
  </div>

  <div class="toolbar">
    <button type="button" onclick="window.print()">Imprimir boleto</button>
  </div>
</body>
</html>`;
}
