import * as fs from 'fs';
import * as path from 'path';
import { ChartAccountType, PrismaClient } from '../generated/tenant-client';

export const CHART_ACCOUNTS_SEED_VERSION = 'granja-rfb-v1';

type Row = {
  code: string;
  name: string;
  type: ChartAccountType;
  parentCode?: string | null;
  isPosting?: boolean;
};

function dataFilePath(): string {
  const candidates = [
    path.join(__dirname, '../../prisma/seed-data/chart-accounts-granja.json'),
    path.join(__dirname, '../../../prisma/seed-data/chart-accounts-granja.json'),
    path.join(process.cwd(), 'prisma/seed-data/chart-accounts-granja.json'),
    path.join(process.cwd(), 'apps/api/prisma/seed-data/chart-accounts-granja.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0]!;
}

function sortForInsert(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => {
    const depthA = a.code.split('.').length;
    const depthB = b.code.split('.').length;
    if (depthA !== depthB) return depthA - depthB;
    return a.code.localeCompare(b.code, 'pt-BR', { numeric: true });
  });
}

function loadRows(): Row[] {
  const file = dataFilePath();
  if (!fs.existsSync(file)) {
    throw new Error(`Plano de contas seed não encontrado: ${file}`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Row[];
  if (!Array.isArray(raw) || !raw.length) {
    throw new Error('JSON do plano de contas deve ser um array não vazio');
  }
  return sortForInsert(
    raw.filter((r) => r.code?.trim() && r.name?.trim() && r.type),
  );
}

/**
 * Carrega plano referencial (estrutura 1–7 como GestorVend) em ChartAccount.
 * Não sobrescreve contas existentes, salvo forceReplace.
 */
export async function ensureChartAccountsSeeded(
  prisma: PrismaClient,
  opts?: { forceReplace?: boolean },
): Promise<number> {
  const existing = await prisma.chartAccount.count();
  if (existing > 0 && !opts?.forceReplace) {
    return existing;
  }

  const rows = loadRows();
  const idByCode = new Map<string, string>();

  if (opts?.forceReplace) {
    await prisma.chartAccount.deleteMany({});
  }

  for (const row of rows) {
    const code = row.code.trim();
    const parentCode = row.parentCode?.trim() || null;
    const parentId = parentCode ? idByCode.get(parentCode) : undefined;
    if (parentCode && !parentId) {
      throw new Error(`Plano de contas: pai "${parentCode}" não encontrado para "${code}"`);
    }

    const saved = await prisma.chartAccount.upsert({
      where: { code },
      create: {
        code,
        name: row.name.trim(),
        type: row.type,
        parentId: parentId ?? null,
        isPosting: row.isPosting ?? true,
        isActive: true,
      },
      update: {
        name: row.name.trim(),
        type: row.type,
        parentId: parentId ?? null,
        isPosting: row.isPosting ?? true,
        isActive: true,
      },
    });
    idByCode.set(code, saved.id);
  }

  return rows.length;
}
