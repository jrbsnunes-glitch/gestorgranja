import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { uploadsRoot } from '../cadastros/company-logo.util';

export function fiscalTenantDir(tenantSlug: string): string {
  const dir = join(uploadsRoot(), 'tenants', tenantSlug, 'fiscal');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function fiscalCertPath(tenantSlug: string): string {
  return join(fiscalTenantDir(tenantSlug), 'certificate.pfx');
}

export function writeFiscalCert(tenantSlug: string, buffer: Buffer): string {
  const path = fiscalCertPath(tenantSlug);
  writeFileSync(path, buffer);
  return path;
}

export function readFiscalCert(tenantSlug: string): Buffer | null {
  const path = fiscalCertPath(tenantSlug);
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

export function fiscalDocDir(tenantSlug: string, docId: string): string {
  const dir = join(fiscalTenantDir(tenantSlug), 'documents', docId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeFiscalXml(tenantSlug: string, docId: string, xml: string): string {
  const file = join(fiscalDocDir(tenantSlug, docId), 'nfe.xml');
  writeFileSync(file, xml, 'utf8');
  return file;
}

export function writeFiscalDanfeHtml(tenantSlug: string, docId: string, html: string): string {
  const file = join(fiscalDocDir(tenantSlug, docId), 'danfe.html');
  writeFileSync(file, html, 'utf8');
  return file;
}

export function readFiscalFile(absPath: string): Buffer {
  return readFileSync(absPath);
}
