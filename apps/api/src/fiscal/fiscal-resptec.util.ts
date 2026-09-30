import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { FiscalCryptoService } from './fiscal-crypto.service';

export type FiscalRespTec = {
  cnpj: string;
  contact: string;
  email: string;
  phone: string;
  csrtId?: string;
  csrtSecret?: string;
};

type SettingsSlice = {
  respTecCnpj?: string | null;
  respTecContact?: string | null;
  respTecEmail?: string | null;
  respTecPhone?: string | null;
  respTecCsrtId?: string | null;
  respTecCsrtEnc?: string | null;
};

function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}

function escXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function envOrEmpty(key: string): string {
  return (process.env[key] ?? '').trim();
}

export function resolveFiscalRespTec(
  settings: SettingsSlice | null | undefined,
  crypto?: FiscalCryptoService,
): FiscalRespTec | null {
  const cnpj = onlyDigits(settings?.respTecCnpj ?? envOrEmpty('FISCAL_RESP_TEC_CNPJ'));
  const contact = (settings?.respTecContact ?? envOrEmpty('FISCAL_RESP_TEC_CONTACT')).trim();
  const email = (settings?.respTecEmail ?? envOrEmpty('FISCAL_RESP_TEC_EMAIL')).trim();
  const phone = onlyDigits(settings?.respTecPhone ?? envOrEmpty('FISCAL_RESP_TEC_PHONE'));

  let csrtId = (settings?.respTecCsrtId ?? envOrEmpty('FISCAL_RESP_TEC_CSRT_ID')).trim();
  let csrtSecret = envOrEmpty('FISCAL_RESP_TEC_CSRT');
  if (settings?.respTecCsrtEnc && crypto) {
    try {
      csrtSecret = crypto.decrypt(settings.respTecCsrtEnc);
    } catch {
      csrtSecret = '';
    }
  }

  if (!cnpj && !contact && !email && !phone) return null;

  return {
    cnpj,
    contact,
    email,
    phone,
    csrtId: csrtId || undefined,
    csrtSecret: csrtSecret || undefined,
  };
}

export function assertFiscalRespTec(raw: FiscalRespTec | null) {
  if (!raw) {
    throw new BadRequestException(
      'Responsável técnico (NT 2018.005): configure CNPJ, contato, e-mail e telefone em Empresa → Emissor fiscal ou variáveis FISCAL_RESP_TEC_* no servidor.',
    );
  }
  if (onlyDigits(raw.cnpj).length !== 14) {
    throw new BadRequestException('Responsável técnico: CNPJ inválido (14 dígitos).');
  }
  if (!raw.contact.trim()) {
    throw new BadRequestException('Responsável técnico: informe o nome do contato (xContato).');
  }
  if (!raw.email.includes('@')) {
    throw new BadRequestException('Responsável técnico: e-mail inválido.');
  }
  const fone = onlyDigits(raw.phone);
  if (fone.length < 10 || fone.length > 11) {
    throw new BadRequestException('Responsável técnico: telefone com DDD (10 ou 11 dígitos).');
  }
}

export function buildInfRespTecXml(respTec: FiscalRespTec, accessKey: string): string {
  const cnpj = onlyDigits(respTec.cnpj);
  const fone = onlyDigits(respTec.phone);
  let block =
    `<infRespTec>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<xContato>${escXml(respTec.contact.trim().slice(0, 60))}</xContato>` +
    `<email>${escXml(respTec.email.trim().slice(0, 60))}</email>` +
    `<fone>${fone}</fone>`;

  const csrt = respTec.csrtSecret?.trim();
  const csrtId = respTec.csrtId?.trim();
  if (csrt && csrtId) {
    const hash = createHash('sha1').update(`${csrt}${accessKey}`, 'utf8').digest('base64');
    block += `<idCSRT>${escXml(csrtId.slice(0, 2))}</idCSRT><hashCSRT>${hash}</hashCSRT>`;
  }

  block += `</infRespTec>`;
  return block;
}
