import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { uploadsRoot } from '../cadastros/company-logo.util';

export function sicoobTenantDir(tenantSlug: string): string {
  const dir = join(uploadsRoot(), 'tenants', tenantSlug, 'sicoob');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function sicoobCertPath(tenantSlug: string): string {
  return join(sicoobTenantDir(tenantSlug), 'certificate.pfx');
}

export function writeSicoobCert(tenantSlug: string, buffer: Buffer): string {
  const path = sicoobCertPath(tenantSlug);
  writeFileSync(path, buffer);
  return path;
}

export function readSicoobCert(tenantSlug: string): Buffer | null {
  const path = sicoobCertPath(tenantSlug);
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

export function sicoobBoletoPdfPath(tenantSlug: string, boletoId: string): string {
  const dir = join(sicoobTenantDir(tenantSlug), 'boletos');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `${boletoId}.pdf`);
}

export function writeSicoobBoletoPdf(tenantSlug: string, boletoId: string, pdf: Buffer): string {
  const path = sicoobBoletoPdfPath(tenantSlug, boletoId);
  writeFileSync(path, pdf);
  return path;
}

export function readSicoobBoletoPdf(absPath: string): Buffer | null {
  if (!existsSync(absPath)) return null;
  return readFileSync(absPath);
}

/** PDF do sandbox/registro incompleto pode ser só o cabeçalho (%PDF-) — não abre no navegador. */
export function isValidPdfBuffer(buf: Buffer | null | undefined): buf is Buffer {
  if (!buf || buf.length < 800) return false;
  if (buf.subarray(0, 5).toString('ascii') !== '%PDF-') return false;
  const tail = buf.subarray(Math.max(0, buf.length - 32)).toString('ascii');
  return tail.includes('%%EOF');
}
