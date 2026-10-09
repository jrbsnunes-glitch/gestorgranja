import { BadRequestException, Injectable } from '@nestjs/common';
import * as https from 'https';
import { URL } from 'url';
import { SicoobEnvironment } from '../generated/tenant-client';
import {
  SICOOB_API_PROD,
  SICOOB_API_SANDBOX,
  SICOOB_AUTH_URL,
  SICOOB_SCOPES,
} from './sicoob-json.util';

type TokenCache = { token: string; expiresAt: number };

export type SicoobHttpAuth = {
  environment: SicoobEnvironment;
  clientId: string;
  sandboxAccessToken?: string | null;
  pfx?: Buffer | null;
  passphrase?: string | null;
};

@Injectable()
export class SicoobClientService {
  private readonly tokens = new Map<string, TokenCache>();

  private apiBase(env: SicoobEnvironment) {
    return env === SicoobEnvironment.sandbox ? SICOOB_API_SANDBOX : SICOOB_API_PROD;
  }

  invalidateToken(tenantSlug: string) {
    this.tokens.delete(tenantSlug);
  }

  async requestJson(
    tenantSlug: string,
    auth: SicoobHttpAuth,
    method: string,
    pathAndQuery: string,
    body?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    const token = await this.accessToken(tenantSlug, auth);
    const base = this.apiBase(auth.environment);
    const url = pathAndQuery.startsWith('http') ? pathAndQuery : `${base}${pathAndQuery.startsWith('/') ? '' : '/'}${pathAndQuery}`;
    return this.rawJson(method, url, auth, token, body);
  }

  private async accessToken(tenantSlug: string, auth: SicoobHttpAuth): Promise<string> {
    if (auth.environment === SicoobEnvironment.sandbox) {
      const t = auth.sandboxAccessToken?.trim();
      if (!t) {
        throw new BadRequestException(
          'Ambiente sandbox: informe o access token estático do Portal Developers Sicoob.',
        );
      }
      return t;
    }
    const cached = this.tokens.get(tenantSlug);
    if (cached && cached.expiresAt > Date.now() + 15_000) return cached.token;

    if (!auth.clientId?.trim()) throw new BadRequestException('client_id Sicoob não configurado');
    if (!auth.pfx?.length) {
      throw new BadRequestException(
        'Certificado ICP-Brasil (.pfx) obrigatório para produção (mTLS). Envie o certificado ou use o A1 fiscal.',
      );
    }

    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: auth.clientId.trim(),
      scope: SICOOB_SCOPES,
    }).toString();

    const { status, json } = await this.rawJson('POST', SICOOB_AUTH_URL, auth, null, form, {
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    if (status >= 400) {
      const msg = this.errorMessage(json, status);
      throw new BadRequestException(`Falha ao obter token Sicoob (${status}): ${msg}`);
    }
    const token = (json as { access_token?: string }).access_token;
    const expiresIn = Number((json as { expires_in?: number }).expires_in ?? 300);
    if (!token) throw new BadRequestException('Sicoob não retornou access_token');
    this.tokens.set(tenantSlug, { token, expiresAt: Date.now() + Math.max(30, expiresIn - 30) * 1000 });
    return token;
  }

  private errorMessage(json: unknown, status: number): string {
    if (json && typeof json === 'object') {
      const o = json as Record<string, unknown>;
      if (typeof o.message === 'string') return o.message;
      if (typeof o.mensagens === 'string') return o.mensagens;
      if (Array.isArray(o.mensagens)) return JSON.stringify(o.mensagens);
      if (typeof o.error === 'string') return o.error_description ? `${o.error}: ${o.error_description}` : o.error;
    }
    return status === 403
      ? '403 — certificado vencido ou inválido (atualize o .pfx ICP-Brasil).'
      : `HTTP ${status}`;
  }

  private rawJson(
    method: string,
    urlStr: string,
    auth: SicoobHttpAuth,
    bearer: string | null,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<{ status: number; json: unknown }> {
    const url = new URL(urlStr);
    const payload =
      typeof body === 'string' ? body : body != null ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      client_id: auth.clientId.trim(),
      ...extraHeaders,
    };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (payload && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (payload) headers['Content-Length'] = String(Buffer.byteLength(payload));

    const agent =
      auth.environment === SicoobEnvironment.production && auth.pfx?.length
        ? new https.Agent({
            pfx: auth.pfx,
            passphrase: auth.passphrase ?? undefined,
            keepAlive: false,
          })
        : undefined;

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          method,
          headers,
          agent,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let json: unknown = null;
            if (text.trim()) {
              try {
                json = JSON.parse(text);
              } catch {
                json = { message: text.slice(0, 400) };
              }
            }
            resolve({ status: res.statusCode ?? 0, json });
          });
        },
      );
      req.on('error', (err) => {
        reject(
          new BadRequestException(
            `Não foi possível conectar ao Sicoob: ${err.message}. Verifique certificado, mTLS e rede da VPS.`,
          ),
        );
      });
      req.setTimeout(60_000, () => {
        req.destroy();
        reject(new BadRequestException('Timeout ao chamar a API Sicoob'));
      });
      if (payload) req.write(payload);
      req.end();
    });
  }

  throwIfFailed(status: number, json: unknown, action: string) {
    if (status >= 200 && status < 300) return;
    throw new BadRequestException(`${action} Sicoob (${status}): ${this.errorMessage(json, status)}`);
  }
}
