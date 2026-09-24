import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const LOGO_BASENAME = 'company-logo';

export function uploadsRoot(): string {
  return process.env.UPLOAD_DIR?.trim() || join(process.cwd(), 'uploads');
}

export function tenantUploadDir(tenantSlug: string): string {
  return join(uploadsRoot(), 'tenants', tenantSlug);
}

export function logoMimeToExt(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/svg+xml') return '.svg';
  return '';
}

export const COMPANY_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const COMPANY_LOGO_API_PATH = '/v1/cadastros/company/logo';

export function allowedLogoMime(mime: string): boolean {
  return logoMimeToExt(mime) !== '';
}

export async function writeCompanyLogoFile(tenantSlug: string, buffer: Buffer, mime: string): Promise<string> {
  const ext = logoMimeToExt(mime);
  const dir = tenantUploadDir(tenantSlug);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${LOGO_BASENAME}${ext}`);
  await writeFile(filePath, buffer);
  for (const other of ['.png', '.jpg', '.webp', '.svg']) {
    if (other === ext) continue;
    const stale = join(dir, `${LOGO_BASENAME}${other}`);
    if (existsSync(stale)) {
      const { unlink } = await import('fs/promises');
      await unlink(stale).catch(() => undefined);
    }
  }
  return filePath;
}

export function resolveCompanyLogoPath(tenantSlug: string): string | null {
  const dir = tenantUploadDir(tenantSlug);
  for (const ext of ['.png', '.jpg', '.webp', '.svg']) {
    const p = join(dir, `${LOGO_BASENAME}${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

function mimeFromLogoPath(filePath: string): string {
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

/** Data URL para relatórios HTML/PDF (folha, etc.). */
export async function readCompanyLogoDataUrl(tenantSlug: string): Promise<string | null> {
  const filePath = resolveCompanyLogoPath(tenantSlug);
  if (!filePath) return null;
  const buf = await readFile(filePath);
  const mime = mimeFromLogoPath(filePath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}
