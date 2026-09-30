import { Injectable, Logger } from '@nestjs/common';
import { request as httpsRequest } from 'https';
import { URL } from 'url';
import { XMLParser } from 'fast-xml-parser';
import { ParsedCert } from '../fiscal-cert.service';
import { buildSefazTrustedCas, sefazTlsRejectUnauthorized } from './sefaz-tls.util';

const SEFAZ_TIMEOUT_MS = 45_000;

@Injectable()
export class SefazSoapClient {
  private readonly logger = new Logger(SefazSoapClient.name);
  private readonly parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

  private soapContentType(url: string): string {
    const base = 'application/soap+xml; charset=utf-8';
    if (url.includes('NfeAutorizacao4')) {
      return `${base}; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"`;
    }
    if (url.includes('NfeRetAutorizacao4')) {
      return `${base}; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4/nfeRetAutorizacaoLote"`;
    }
    if (url.includes('NfeStatusServico4')) {
      return `${base}; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"`;
    }
    if (url.includes('RecepcaoEvento4')) {
      return `${base}; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento"`;
    }
    if (url.includes('NfeInutilizacao4')) {
      return `${base}; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4/nfeInutilizacaoNF"`;
    }
    if (url.includes('NfeConsulta4')) {
      return `${base}; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF"`;
    }
    return base;
  }

  postSoap(url: string, bodyInnerXml: string, cert: ParsedCert): Promise<string> {
    const envelope = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>${bodyInnerXml}</soap12:Body></soap12:Envelope>`;

    return new Promise((resolve, reject) => {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        reject(new Error(`URL SEFAZ inválida: ${url}`));
        return;
      }

      const req = httpsRequest(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: 'POST',
          cert: cert.certificateChainPem,
          key: cert.privateKeyPem,
          ca: buildSefazTrustedCas(),
          rejectUnauthorized: sefazTlsRejectUnauthorized(),
          timeout: SEFAZ_TIMEOUT_MS,
          headers: {
            'Content-Type': this.soapContentType(url),
            'Content-Length': Buffer.byteLength(envelope, 'utf8'),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              this.logger.warn(`SEFAZ HTTP ${res.statusCode} ${url}`);
            }
            resolve(data);
          });
        },
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Tempo esgotado ao contactar a SEFAZ (AM). Tente novamente.'));
      });
      req.on('error', (err) => {
        reject(new Error(err.message || 'Falha de rede ao contactar a SEFAZ'));
      });
      req.write(envelope);
      req.end();
    });
  }

  extractStatusServico(soapResponse: string): {
    ok: boolean;
    cStat?: string;
    message?: string;
  } {
    try {
      const parsed = this.parser.parse(soapResponse);
      const body = parsed?.Envelope?.Body ?? parsed?.Body ?? parsed;
      const fault = body?.Fault;
      if (fault) {
        const reason =
          fault?.Reason?.Text ??
          fault?.faultstring ??
          fault?.Reason ??
          'Falha SOAP na SEFAZ';
        const text = typeof reason === 'object' ? String(reason['#text'] ?? reason) : String(reason);
        return { ok: false, message: text.trim() };
      }
      const ret = body?.nfeResultMsg ?? body?.retConsStatServ ?? body;
      const inner = typeof ret === 'string' ? this.parser.parse(ret) : ret;
      const stat = inner?.retConsStatServ ?? inner;
      const cStat = String(stat?.cStat ?? '');
      const xMotivo = String(stat?.xMotivo ?? '');
      if (cStat === '107') {
        return { ok: true, cStat, message: xMotivo || 'Serviço em operação' };
      }
      if (cStat) {
        return { ok: false, cStat, message: xMotivo || `Status ${cStat}` };
      }
      return { ok: false, message: 'Resposta de status SEFAZ não reconhecida' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Falha ao interpretar status SEFAZ' };
    }
  }

  private parseNestedNfePayload(raw: unknown): Record<string, unknown> | null {
    if (raw == null) return null;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed.startsWith('<')) return null;
      try {
        return this.parser.parse(trimmed) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    return null;
  }

  private extractSoapFault(body: Record<string, unknown> | null): string | null {
    if (!body?.Fault) return null;
    const fault = body.Fault as Record<string, unknown>;
    const reason =
      fault.Reason ??
      fault.faultstring ??
      fault.detail ??
      'Falha SOAP na SEFAZ';
    if (typeof reason === 'object' && reason !== null) {
      const r = reason as Record<string, unknown>;
      const text = r.Text ?? r['#text'];
      if (text != null) return String(text).trim();
    }
    return String(reason).trim();
  }

  private deepFindInfProt(node: unknown, depth = 0): Record<string, unknown> | null {
    if (node == null || depth > 14) return null;
    if (typeof node === 'string') {
      const trimmed = node.trim();
      if (trimmed.startsWith('<')) {
        try {
          return this.deepFindInfProt(this.parser.parse(trimmed), depth + 1);
        } catch {
          return null;
        }
      }
      return null;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = this.deepFindInfProt(item, depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (typeof node !== 'object') return null;
    const o = node as Record<string, unknown>;
    if (o.infProt && typeof o.infProt === 'object') {
      return o.infProt as Record<string, unknown>;
    }
    const cStat = o.cStat != null ? String(o.cStat) : '';
    if (cStat && (o.chNFe != null || o.nProt != null)) {
      return o;
    }
    for (const v of Object.values(o)) {
      const found = this.deepFindInfProt(v, depth + 1);
      if (found) return found;
    }
    return null;
  }

  private pickInfProt(ret: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!ret) return null;
    const envi = (ret.retEnviNFe ?? ret) as Record<string, unknown>;
    let protNFe = envi.protNFe;
    if (Array.isArray(protNFe)) protNFe = protNFe[0];
    const fromProt = protNFe && typeof protNFe === 'object' ? (protNFe as Record<string, unknown>).infProt : null;
    if (fromProt && typeof fromProt === 'object') return fromProt as Record<string, unknown>;
    const direct = envi.infProt;
    if (direct && typeof direct === 'object') return direct as Record<string, unknown>;
    const nfeProc = envi.nfeProc as Record<string, unknown> | undefined;
    const procProt = nfeProc?.protNFe;
    if (procProt && typeof procProt === 'object') {
      const inf = (procProt as Record<string, unknown>).infProt;
      if (inf && typeof inf === 'object') return inf as Record<string, unknown>;
    }
    return null;
  }

  extractRecibo(soapResponse: string): string | null {
    const m = soapResponse.match(/<nRec>(\d{1,15})<\/nRec>/);
    return m?.[1] ?? null;
  }

  private extractInfProtRegex(soapResponse: string): {
    cStat: string;
    xMotivo: string;
    nProt: string;
    chNFe: string;
  } | null {
    const blockMatch = soapResponse.match(/<infProt[^>]*>([\s\S]*?)<\/infProt>/i);
    if (!blockMatch) return null;
    const block = blockMatch[1];
    const tag = (name: string) => {
      const m = block.match(new RegExp(`<${name}>([^<]*)</${name}>`, 'i'));
      return m?.[1]?.trim() ?? '';
    };
    const cStat = tag('cStat');
    if (!cStat) return null;
    return { cStat, xMotivo: tag('xMotivo'), nProt: tag('nProt'), chNFe: tag('chNFe') };
  }

  private resultFromInfProt(prot: {
    cStat: string;
    xMotivo: string;
    nProt: string;
    chNFe: string;
  }): {
    status: 'authorized' | 'rejected' | 'processing';
    protocol?: string;
    accessKey?: string;
    message?: string;
  } {
    const { cStat, xMotivo, nProt, chNFe } = prot;
    if (cStat === '100') {
      return {
        status: 'authorized',
        protocol: nProt,
        accessKey: chNFe,
        message: xMotivo,
      };
    }
    return { status: 'rejected', message: `${cStat} — ${xMotivo}`.trim() };
  }

  extractAutorizacaoResult(soapResponse: string): {
    status: 'authorized' | 'rejected' | 'processing';
    protocol?: string;
    accessKey?: string;
    message?: string;
  } {
    try {
      const trimmed = soapResponse.trim();
      if (!trimmed) {
        return { status: 'rejected', message: 'SEFAZ retornou resposta vazia' };
      }
      if (!trimmed.startsWith('<')) {
        return {
          status: 'rejected',
          message: `Resposta SEFAZ não é XML (${trimmed.slice(0, 120)}…)`,
        };
      }

      const parsed = this.parser.parse(soapResponse);
      const bodyRaw = (parsed?.Envelope?.Body ?? parsed?.Body ?? parsed) as Record<string, unknown>;
      const faultMsg = this.extractSoapFault(bodyRaw);
      if (faultMsg) {
        return { status: 'rejected', message: faultMsg };
      }

      const prot =
        this.deepFindInfProt(bodyRaw) ??
        this.pickInfProt(
          this.parseNestedNfePayload(
            bodyRaw?.nfeResultMsg ??
              bodyRaw?.nfeAutorizacaoLoteResult ??
              bodyRaw?.NfeAutorizacaoLoteResult ??
              bodyRaw,
          ),
        );
      if (prot) {
        const cStat = String(prot.cStat ?? '');
        const xMotivo = String(prot.xMotivo ?? '');
        if (cStat === '100') {
          return {
            status: 'authorized',
            protocol: String(prot.nProt ?? ''),
            accessKey: String(prot.chNFe ?? ''),
            message: xMotivo,
          };
        }
        return { status: 'rejected', message: `${cStat} — ${xMotivo}`.trim() };
      }

      const ret = this.parseNestedNfePayload(
        bodyRaw?.nfeResultMsg ?? bodyRaw?.nfeAutorizacaoLoteResult ?? bodyRaw,
      );
      const cStat = String(ret?.cStat ?? '');
      const xMotivo = String(ret?.xMotivo ?? '');
      if (cStat === '103' || cStat === '104') {
        return { status: 'processing', message: xMotivo || 'Lote em processamento' };
      }
      if (cStat) {
        return { status: 'rejected', message: `${cStat} — ${xMotivo}`.trim() || `Status ${cStat}` };
      }

      const regexProt = this.extractInfProtRegex(trimmed);
      if (regexProt) {
        return this.resultFromInfProt(regexProt);
      }

      const looseCStat = trimmed.match(/<cStat>(\d+)<\/cStat>/);
      const looseMotivo = trimmed.match(/<xMotivo>([^<]*)<\/xMotivo>/);
      if (looseCStat) {
        const cs = looseCStat[1];
        const mot = looseMotivo?.[1]?.trim() ?? '';
        if (cs === '103' || cs === '104' || cs === '105') {
          return { status: 'processing', message: mot || 'Lote em processamento' };
        }
        return { status: 'rejected', message: `${cs} — ${mot}`.trim() || `Status ${cs}` };
      }

      this.logger.warn(
        `Autorização NF-e: resposta não mapeada (${trimmed.length} bytes): ${trimmed.slice(0, 400).replace(/\s+/g, ' ')}`,
      );
      return { status: 'rejected', message: xMotivo || 'Resposta SEFAZ não reconhecida' };
    } catch (e) {
      return { status: 'rejected', message: e instanceof Error ? e.message : 'Falha ao interpretar XML SEFAZ' };
    }
  }

  extractConsultaSitNFe(soapResponse: string): {
    ok: boolean;
    cStat?: string;
    message?: string;
    protocol?: string;
    accessKey?: string;
    sefazStatus: 'authorized' | 'cancelled' | 'rejected' | 'unknown';
  } {
    try {
      const trimmed = soapResponse.trim();
      const fault = this.parser.parse(trimmed)?.Envelope?.Body?.Fault;
      if (fault) {
        const msg = this.extractSoapFault(
          this.parser.parse(trimmed)?.Envelope?.Body as Record<string, unknown>,
        );
        return { ok: false, message: msg ?? 'Falha SOAP', sefazStatus: 'unknown' };
      }
      const parsed = this.parser.parse(trimmed);
      const body = (parsed?.Envelope?.Body ?? parsed?.Body ?? parsed) as Record<string, unknown>;
      const raw = body?.nfeResultMsg ?? body?.retConsSitNFe ?? body;
      const inner =
        typeof raw === 'string'
          ? (this.parser.parse(raw) as Record<string, unknown>)
          : (raw as Record<string, unknown>);
      const ret = (inner?.retConsSitNFe ?? inner) as Record<string, unknown>;
      const cStat = String(ret?.cStat ?? '');
      const xMotivo = String(ret?.xMotivo ?? '');
      const protNode = ret?.protNFe as Record<string, unknown> | undefined;
      const infProt =
        protNode?.infProt && typeof protNode.infProt === 'object'
          ? (protNode.infProt as Record<string, unknown>)
          : null;
      const protCStat = infProt ? String(infProt.cStat ?? '') : '';
      const protocol = infProt ? String(infProt.nProt ?? '') : undefined;
      const accessKey = infProt ? String(infProt.chNFe ?? '') : undefined;

      const proc = protCStat || cStat;
      if (proc === '100' || cStat === '100') {
        return {
          ok: true,
          cStat: proc || cStat,
          message: xMotivo || String(infProt?.xMotivo ?? 'Autorizado o uso da NF-e'),
          protocol,
          accessKey,
          sefazStatus: 'authorized',
        };
      }
      if (proc === '101' || cStat === '101' || cStat === '151') {
        return {
          ok: true,
          cStat: proc || cStat,
          message: xMotivo || 'Cancelamento homologado',
          protocol,
          accessKey,
          sefazStatus: 'cancelled',
        };
      }
      if (cStat === '217') {
        return {
          ok: false,
          cStat,
          message: xMotivo || 'NF-e não consta na base da SEFAZ',
          sefazStatus: 'rejected',
        };
      }
      if (cStat) {
        return {
          ok: cStat === '105' || cStat === '106',
          cStat,
          message: xMotivo || `Status ${cStat}`,
          sefazStatus: 'unknown',
        };
      }
      return { ok: false, message: 'Resposta de consulta não reconhecida', sefazStatus: 'unknown' };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : 'Falha ao interpretar consulta SEFAZ',
        sefazStatus: 'unknown',
      };
    }
  }

  extractEventResult(soapResponse: string): { ok: boolean; protocol?: string; message?: string } {
    try {
      const parsed = this.parser.parse(soapResponse);
      const body = parsed?.Envelope?.Body ?? parsed?.Body ?? parsed;
      const ret = body?.nfeResultMsg ?? body?.retEnvEvento ?? body;
      const inf = ret?.retEvento?.infEvento ?? ret?.infEvento;
      const cStat = String(inf?.cStat ?? ret?.cStat ?? '');
      if (cStat === '135' || cStat === '136' || cStat === '155') {
        return { ok: true, protocol: String(inf?.nProt ?? ''), message: String(inf?.xMotivo ?? '') };
      }
      return { ok: false, message: String(inf?.xMotivo ?? ret?.xMotivo ?? cStat) };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Falha evento SEFAZ' };
    }
  }
}
