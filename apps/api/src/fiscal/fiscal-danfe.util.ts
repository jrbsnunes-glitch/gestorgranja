export type DanfeItemRow = {
  code: string;
  name: string;
  ncm?: string | null;
  cfop?: string | null;
  cstDisplay?: string | null;
  unit: string;
  qty: number;
  unitPrice: number;
  total: number;
  discount?: number;
  bcIcms?: number;
  vIcms?: number;
  pIcms?: number;
};

export type DanfeHtmlInput = {
  model: string;
  accessKey: string | null;
  number: number | null;
  series: number | null;
  issuedAt: Date | null;
  exitedAt?: Date | null;
  protocol?: string | null;
  operationNature?: string;
  tpNF?: '0' | '1';
  companyName: string;
  companyLegalName?: string;
  companyCnpj?: string | null;
  companyIe?: string | null;
  companyAddress?: string | null;
  companyDistrict?: string | null;
  companyCity?: string | null;
  companyState?: string | null;
  companyZip?: string | null;
  companyPhone?: string | null;
  logoDataUrl?: string | null;
  partnerName?: string;
  partnerDoc?: string | null;
  partnerIe?: string | null;
  partnerAddress?: string | null;
  partnerDistrict?: string | null;
  partnerCity?: string | null;
  partnerState?: string | null;
  partnerZip?: string | null;
  partnerPhone?: string | null;
  total: number;
  totalProducts?: number;
  environment: string;
  items: DanfeItemRow[];
  infCpl?: string | null;
  qrCode?: string;
  preview?: boolean;
  cancelled?: boolean;
};

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return '';
  return d.toLocaleDateString('pt-BR');
}

function fmtTime(d: Date | null | undefined) {
  if (!d) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDateTimeFull(d: Date | null | undefined) {
  if (!d) return '';
  return `${fmtDate(d)} ${fmtTime(d)}`;
}

function fmtDoc(doc?: string | null) {
  if (!doc) return '';
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc;
}

function fmtChave(chave: string | null) {
  if (!chave) return '';
  const d = chave.replace(/\D/g, '');
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function fmtMoney(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNfNumber(n: number | null) {
  if (n == null) return '';
  const s = String(n).padStart(9, '0');
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}`;
}

function fmtSerie(s: number | null) {
  if (s == null) return '';
  return String(s).padStart(3, '0');
}

function lbl(text: string) {
  return `<span class="lbl">${escapeHtml(text)}</span>`;
}

function td(content: string, attrs = '') {
  return `<td ${attrs}>${content}</td>`;
}

const DANFE_STYLES = `
@page { size: A4 portrait; margin: 6mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #000; margin: 0; padding: 6px; line-height: 1.2; }
.danfe { max-width: 210mm; margin: 0 auto; position: relative; }
table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
table.grid td, table.grid th { border: 1px solid #000; padding: 2px 4px; vertical-align: top; word-wrap: break-word; }
table.grid.fineline td, table.grid.fineline th { border: 0.35px solid #555; }
table.grid.compact td { padding: 2px 4px; line-height: 1.18; }
.texto-canhoto { font-size: 8px; line-height: 1.22; }
.lbl { display: block; font-size: 7px; font-weight: 400; text-transform: uppercase; margin-bottom: 1px; line-height: 1.15; }
.val { font-size: 9px; font-weight: 600; line-height: 1.2; }
.sec { font-size: 7px; font-weight: 700; text-transform: uppercase; background: #f5f5f5; padding: 2px 4px !important; }
.center { text-align: center; }
.right { text-align: right; }
.emitente-stack { display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: 3px; }
.emitente-txt { width: 100%; font-size: 8px; line-height: 1.22; }
.emitente-stack .logo { flex: none; width: 100%; margin: 0 0 4px; }
.emitente-stack .logo img { display: block; max-width: 100px; max-height: 40px; margin: 0 auto; object-fit: contain; }
.cel-emitente > .lbl { text-align: left; }
.danfe-box { text-align: center; line-height: 1.15; }
.danfe-title { font-size: 13px; font-weight: 700; line-height: 1.05; margin: 0; }
.danfe-sub { font-size: 8px; line-height: 1.1; margin: 0; }
.tipo-nf { font-size: 8px; margin: 2px 0; }
.tipo-nf .mark { font-weight: 700; border: 1px solid #000; padding: 0 3px; font-size: 8px; }
.nf-linha { font-size: 9px; font-weight: 600; margin: 2px 0; }
.barcode { text-align: center; line-height: 0; margin: 2px 0; }
.barcode svg { max-height: 40px; }
.chave { font-size: 8px; text-align: center; letter-spacing: 0.35px; line-height: 1.25; margin: 0; }
.consulta { font-size: 7px; text-align: center; line-height: 1.15; margin-top: 2px; }
table.prod thead th { font-size: 7px; font-weight: 700; text-transform: uppercase; background: #eee; text-align: center; padding: 2px 1px; }
table.prod tbody td { font-size: 8px; padding: 2px 3px; }
.watermark { position: fixed; left: 10%; right: 10%; top: 28%; font-size: 32px; font-weight: 700; color: rgba(180,0,0,0.1); text-align: center; transform: rotate(-22deg); pointer-events: none; z-index: 0; }
.content { position: relative; z-index: 1; }
.banner-preview { background: #fef3c7; border: 1px dashed #d97706; padding: 6px; font-weight: 600; text-align: center; margin-bottom: 6px; font-size: 10px; }
.banner-homolog { border: 1px solid #000; padding: 5px; text-align: center; font-weight: 700; font-size: 10px; margin-bottom: 4px; line-height: 1.2; }
.banner-cancel { background: #fee2e2; border: 1px solid #b91c1c; color: #991b1b; padding: 6px; text-align: center; font-weight: 700; margin-bottom: 4px; font-size: 10px; }
.rodape-impressao { font-size: 7px; text-align: right; margin-top: 6px; }
.toolbar { margin-bottom: 6px; display: flex; gap: 8px; justify-content: flex-end; }
.toolbar button { font-size: 13px; padding: 8px 16px; cursor: pointer; border: 1px solid #333; background: #fff; border-radius: 4px; }
.toolbar button.primary { background: #065f46; color: #fff; border-color: #065f46; }
@media print {
  .no-print { display: none !important; }
  body { padding: 0; font-size: 10px; }
  table.grid td, table.grid th { padding: 2px 5px; }
  .lbl { font-size: 7.5px; }
  .val { font-size: 10px; }
  .emitente-txt { font-size: 9px; }
  .texto-canhoto { font-size: 9px; }
  .danfe-title { font-size: 15px; }
  .danfe-sub { font-size: 9px; }
  .tipo-nf, .tipo-nf .mark { font-size: 9px; }
  .nf-linha { font-size: 10px; }
  .chave { font-size: 9px; letter-spacing: 0.4px; }
  .consulta { font-size: 8px; }
  table.prod thead th { font-size: 7.5px; }
  table.prod tbody td { font-size: 9px; }
  .emitente-stack .logo img { max-height: 44px; }
  table.grid.fineline td, table.grid.fineline th { border: 0.5pt solid #444; }
  .barcode svg { max-height: 44px; }
  .rodape-impressao { font-size: 8px; }
}
`;

function buildNfeBody(doc: DanfeHtmlInput): string {
  const envHomolog = doc.environment !== 'producao';
  const chaveDigits = doc.accessKey?.replace(/\D/g, '') ?? '';
  const nfNumFmt = fmtNfNumber(doc.number);
  const serieFmt = fmtSerie(doc.series);
  const tpNF = doc.tpNF ?? '1';
  const natOp = doc.operationNature ?? 'VENDA DE MERCADORIA';
  const totalProd = doc.totalProducts ?? doc.total;
  const destFull = [
    doc.partnerName,
    doc.partnerAddress,
    doc.partnerDistrict,
    [doc.partnerCity, doc.partnerState].filter(Boolean).join('-'),
  ]
    .filter(Boolean)
    .join(' - ');

  const emitCityLine = [
    [doc.companyDistrict, doc.companyCity].filter(Boolean).join(' - '),
    doc.companyState,
    doc.companyZip ? doc.companyZip.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2') : '',
  ]
    .filter(Boolean)
    .join(' ');

  const logoBlock = doc.logoDataUrl
    ? `<div class="logo"><img src="${doc.logoDataUrl}" alt=""/></div>`
    : '';
  const emitenteInner = `
      <div class="emitente-stack">
        ${logoBlock}
        <div class="emitente-txt">
          <div class="val">${escapeHtml(doc.companyName)}</div>
          ${escapeHtml(doc.companyAddress ?? '')}<br/>
          ${escapeHtml(emitCityLine)}${doc.companyPhone ? `<br/>Fone/Fax: ${escapeHtml(doc.companyPhone)}` : ''}
        </div>
      </div>`;

  const protocolLine = doc.protocol
    ? `${escapeHtml(doc.protocol)}${doc.issuedAt ? ` - ${escapeHtml(fmtDateTimeFull(doc.issuedAt))}` : ''}`
    : '';

  const itemRows = doc.items
    .map((i) => {
      const disc = i.discount ?? 0;
      const bc = i.bcIcms ?? i.total;
      const vIcms = i.vIcms ?? 0;
      const pIcms = i.pIcms ?? 0;
      return (
        `<tr>` +
        `<td>${escapeHtml(i.code)}</td>` +
        `<td>${escapeHtml(i.name)}</td>` +
        `<td class="center">${escapeHtml(i.ncm ?? '')}</td>` +
        `<td class="center">${escapeHtml(i.cstDisplay ?? '0/102')}</td>` +
        `<td class="center">${escapeHtml(i.cfop ?? '')}</td>` +
        `<td class="center">${escapeHtml(i.unit)}</td>` +
        `<td class="right">${i.qty.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>` +
        `<td class="right">${i.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>` +
        `<td class="right">${fmtMoney(i.total)}</td>` +
        `<td class="right">${fmtMoney(disc)}</td>` +
        `<td class="right">${fmtMoney(bc)}</td>` +
        `<td class="right">${fmtMoney(vIcms)}</td>` +
        `<td class="right">0,00</td>` +
        `<td class="right">${pIcms > 0 ? pIcms.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}</td>` +
        `<td class="right">0,00</td>` +
        `</tr>`
      );
    })
    .join('');

  const infCpl =
    doc.infCpl?.trim() ||
    (envHomolog ? 'Documento emitido em ambiente de homologação — sem valor fiscal.' : '');

  const canhoto = `
<table class="grid compact">
  <tr>
    <td style="width:58%">
      <div class="texto-canhoto">
        RECEBEMOS DE <strong>${escapeHtml(doc.companyName)}</strong> OS PRODUTOS/SERVIÇOS CONSTANTES DA NF-e ABAIXO.
        EMISSÃO: ${fmtDate(doc.issuedAt)} · TOTAL: R$ ${fmtMoney(doc.total)} · DEST: ${escapeHtml(destFull)}
      </div>
    </td>
    <td class="center" style="width:18%">
      ${lbl('NF-e')} <span class="val">Nº ${nfNumFmt}</span> · ${lbl('Série')} <span class="val">${serieFmt}</span>
    </td>
    <td style="width:24%;height:22px">
      ${lbl('Data recebimento / assinatura do recebedor')}
    </td>
  </tr>
</table>`;

  const cabecalho = `
<table class="grid compact" style="margin-top:-1px">
  <tr>
    <td style="width:40%" class="cel-emitente">
      ${lbl('Identificação do emitente')}
      ${emitenteInner}
    </td>
    <td style="width:60%" class="danfe-box">
      <div class="danfe-title">DANFE</div>
      <div class="danfe-sub">Documento Auxiliar da Nota Fiscal Eletrônica</div>
      <div class="tipo-nf">
        0-ENTRADA<span class="mark">${tpNF === '0' ? 'X' : '&nbsp;'}</span>
        1-SAÍDA<span class="mark">${tpNF === '1' ? 'X' : '&nbsp;'}</span>
        <span class="nf-linha">Nº ${nfNumFmt} · Série ${serieFmt} · 1/1</span>
      </div>
      <div class="barcode"><svg id="danfe-barcode"></svg></div>
      ${lbl('Chave de acesso')}
      <div class="chave">${fmtChave(doc.accessKey)}</div>
      <div class="consulta">Consulta em www.nfe.fazenda.gov.br/portal ou Sefaz Autorizadora</div>
    </td>
  </tr>
</table>
<table class="grid compact fineline" style="margin-top:-1px">
  <tr>
    <td colspan="2">
      ${lbl('Natureza da operação')} <span class="val">${escapeHtml(natOp)}</span>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      ${lbl('Protocolo de autorização')} <span class="val">${protocolLine || '—'}</span>
    </td>
  </tr>
  <tr>
    <td>
      ${lbl('Inscr. estadual')} <span class="val">${escapeHtml(doc.companyIe ?? '')}</span>
      · ${lbl('Inscr. municipal')} —
      · ${lbl('Inscr. subst. trib.')} —
    </td>
    <td>${lbl('CNPJ / CPF')} <span class="val">${escapeHtml(fmtDoc(doc.companyCnpj))}</span></td>
  </tr>
</table>`;

  const dest = `
<table class="grid fineline" style="margin-top:-1px">
  <tr><td colspan="4" class="sec">Destinatário / Remetente</td></tr>
  <tr>
    <td colspan="2">${lbl('Nome / razão social')}<br/><span class="val">${escapeHtml(doc.partnerName ?? '')}</span></td>
    <td>${lbl('CNPJ / CPF')}<br/><span class="val">${escapeHtml(fmtDoc(doc.partnerDoc))}</span></td>
    <td>${lbl('Data da emissão')}<br/><span class="val">${fmtDate(doc.issuedAt)}</span></td>
  </tr>
  <tr>
    <td colspan="2">${lbl('Endereço')}<br/><span class="val">${escapeHtml(doc.partnerAddress ?? '')}</span></td>
    <td>${lbl('Bairro / distrito')}<br/><span class="val">${escapeHtml(doc.partnerDistrict ?? '')}</span></td>
    <td>${lbl('CEP')}<br/><span class="val">${escapeHtml(doc.partnerZip ?? '')}</span></td>
  </tr>
  <tr>
    <td>${lbl('Município')}<br/><span class="val">${escapeHtml(doc.partnerCity ?? '')}</span></td>
    <td style="width:8%">${lbl('UF')}<br/><span class="val">${escapeHtml(doc.partnerState ?? '')}</span></td>
    <td>${lbl('Fone / fax')}<br/><span class="val">${escapeHtml(doc.partnerPhone ?? '')}</span></td>
    <td>
      ${lbl('Inscrição estadual')}<br/><span class="val">${escapeHtml(doc.partnerIe ?? '')}</span><br/>
      ${lbl('Data saída')} <span class="val">${fmtDate(doc.exitedAt ?? doc.issuedAt)}</span>
      &nbsp; ${lbl('Hora')} <span class="val">${fmtTime(doc.exitedAt ?? doc.issuedAt)}</span>
    </td>
  </tr>
</table>`;

  const imposto = `
<table class="grid fineline" style="margin-top:-1px">
  <tr><td colspan="8" class="sec">Cálculo do imposto</td></tr>
  <tr>
    ${td(`${lbl('Base cálc. ICMS')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('Valor ICMS')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('Base cálc. ICMS S.T.')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('Valor ICMS subst.')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('V. imp. importação')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('V. ICMS UF remet.')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('V. FCP UF dest.')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('V. total produtos')}<br/><span class="val right">${fmtMoney(totalProd)}</span>`)}
  </tr>
  <tr>
    ${td(`${lbl('Valor frete')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('Valor seguro')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('Desconto')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('Outras despesas')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('Valor total IPI')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('V. ICMS UF dest.')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('V. tot. trib.')}<br/><span class="val right">${fmtMoney(0)}</span>`)}
    ${td(`${lbl('V. total da nota')}<br/><span class="val right">${fmtMoney(doc.total)}</span>`)}
  </tr>
</table>`;

  const transporte = `
<table class="grid fineline" style="margin-top:-1px">
  <tr><td colspan="7" class="sec">Transportador / volumes transportados</td></tr>
  <tr>
    <td colspan="2">${lbl('Nome / razão social')}</td>
    <td>${lbl('Frete')}<br/><span class="val">0 — Emitente</span></td>
    <td>${lbl('Código ANTT')}</td>
    <td>${lbl('Placa')}</td>
    <td>${lbl('UF')}</td>
    <td>${lbl('CNPJ / CPF')}</td>
  </tr>
  <tr>
    <td colspan="2">${lbl('Endereço')}</td>
    <td>${lbl('Município')}</td>
    <td>${lbl('UF')}</td>
    <td colspan="2">${lbl('Inscrição estadual')}</td>
    <td>${lbl('Quantidade')}<br/><span class="val">1</span></td>
  </tr>
</table>`;

  const produtos = `
<table class="grid prod" style="margin-top:-1px">
  <thead>
    <tr><td colspan="15" class="sec">Dados dos produtos / serviços</td></tr>
    <tr>
      <th>Cód.<br/>produto</th>
      <th style="width:22%">Descrição do produto / serviço</th>
      <th>NCM/SH</th>
      <th>O/CST</th>
      <th>CFOP</th>
      <th>UN</th>
      <th>Quant.</th>
      <th>Valor<br/>unit.</th>
      <th>Valor<br/>total</th>
      <th>Valor<br/>desc.</th>
      <th>B.cálc<br/>ICMS</th>
      <th>Valor<br/>ICMS</th>
      <th>Valor<br/>IPI</th>
      <th>Alíq.<br/>ICMS</th>
      <th>Alíq.<br/>IPI</th>
    </tr>
  </thead>
  <tbody>${itemRows || `<tr><td colspan="15">&nbsp;</td></tr>`}</tbody>
</table>`;

  const adicionais = `
<table class="grid compact" style="margin-top:-1px">
  <tr><td colspan="2" class="sec">Dados adicionais</td></tr>
  <tr>
    <td style="width:70%">
      ${lbl('Informações complementares')}
      <span class="val" style="font-weight:400">${escapeHtml(infCpl)}</span>
    </td>
    <td style="width:30%">${lbl('Reservado ao fisco')}</td>
  </tr>
</table>`;

  return canhoto + cabecalho + dest + imposto + transporte + produtos + adicionais;
}

function buildNfceBody(doc: DanfeHtmlInput): string {
  const chaveDigits = doc.accessKey?.replace(/\D/g, '') ?? '';
  const nfNumFmt = fmtNfNumber(doc.number);
  return `
<table class="grid">
  <tr>
    <td class="center" colspan="2">
      ${doc.logoDataUrl ? `<div class="logo center"><img src="${doc.logoDataUrl}" alt=""/></div>` : ''}
      <div class="val">${escapeHtml(doc.companyName)}</div>
      <div style="font-size:7px">CNPJ ${escapeHtml(fmtDoc(doc.companyCnpj))}</div>
    </td>
  </tr>
  <tr>
    <td class="center danfe-title" colspan="2">DANFE NFC-e — Documento Auxiliar</td>
  </tr>
  <tr>
    <td>Nº ${nfNumFmt} · Série ${fmtSerie(doc.series)}</td>
    <td class="right">${fmtDateTimeFull(doc.issuedAt)}</td>
  </tr>
  <tr><td colspan="2" class="chave">${fmtChave(doc.accessKey)}</td></tr>
  <tr><td colspan="2"><div class="barcode"><svg id="danfe-barcode"></svg></div></td></tr>
</table>
<table class="grid prod" style="margin-top:-1px">
  <tbody>
    ${doc.items
      .map(
        (i) =>
          `<tr><td>${escapeHtml(i.name)}</td><td class="right">${fmtMoney(i.total)}</td></tr>`,
      )
      .join('')}
    <tr><td><strong>Total</strong></td><td class="right"><strong>R$ ${fmtMoney(doc.total)}</strong></td></tr>
  </tbody>
</table>
${doc.qrCode ? `<p class="center"><img alt="QR" width="100" src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&amp;data=${encodeURIComponent(doc.qrCode)}"/></p>` : ''}
`;
}

export function buildDanfeHtml(doc: DanfeHtmlInput): string {
  const isNfce = doc.model === '65';
  const envHomolog = doc.environment !== 'producao';
  const chaveDigits = doc.accessKey?.replace(/\D/g, '') ?? '';

  const watermark =
    envHomolog && !doc.preview
      ? `<div class="watermark">SEM VALOR FISCAL</div>`
      : doc.cancelled
        ? `<div class="watermark">CANCELADA</div>`
        : '';

  const barcodeScript =
    chaveDigits.length === 44
      ? `<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<script>try{JsBarcode("#danfe-barcode","${chaveDigits}",{format:"CODE128",width:1.05,height:36,displayValue:false,margin:0});}catch(e){}<\/script>`
      : '';

  const body = isNfce ? buildNfceBody(doc) : buildNfeBody(doc);
  const printedAt = fmtDateTimeFull(new Date());

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>DANFE ${isNfce ? 'NFC-e' : 'NF-e'}</title>
<style>${DANFE_STYLES}</style></head>
<body>
<div class="toolbar no-print">
  <button type="button" class="primary" onclick="window.print()">Imprimir</button>
</div>
${doc.preview ? '<div class="banner-preview">PRÉ-VISUALIZAÇÃO — confira os dados antes de gravar e enviar à SEFAZ</div>' : ''}
${doc.cancelled ? '<div class="banner-cancel">NOTA FISCAL CANCELADA</div>' : ''}
${envHomolog && !doc.preview ? '<div class="banner-homolog">EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL</div>' : ''}
<div class="danfe content">${watermark}${body}
<p class="rodape-impressao">Impresso em ${escapeHtml(printedAt)} · Gestor Granja</p>
</div>
${barcodeScript}
</body></html>`;
}
