/**
 * Operações manuais de licença (onboarding comercial).
 *
 * tenant:license-show -- <slug>
 * tenant:license-activate -- <slug> <plan> [--entry-paid YYYY-MM-DD] [--status active|suspended|expired|trial]
 * tenant:license-extend -- <slug> [--months 1]
 */
import { LicenseStatus, PrismaClient } from '../src/generated/central-client';
import { buildActivateLicenseUpdate, extendLicenseExpiresAt } from '../src/commercial/license-ops';
import type { CommercialPlanCode } from '../src/commercial/plans';

const PLANS: CommercialPlanCode[] = ['trial', 'package_a', 'package_b', 'package_c', 'pilot'];

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') continue;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function parseDate(s: string): Date {
  const d = new Date(`${s}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Data inválida: ${s}`);
  return d;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  const url = process.env.CENTRAL_DATABASE_URL;
  if (!url) throw new Error('CENTRAL_DATABASE_URL é obrigatório');

  const central = new PrismaClient({ datasources: { db: { url } } });

  try {
    if (command === 'show') {
      const slug = positional[0];
      if (!slug) throw new Error('Uso: tenant-license.ts show <slug>');
      const t = await central.tenant.findUnique({ where: { slug } });
      if (!t) throw new Error(`Tenant não encontrado: ${slug}`);
      console.log(JSON.stringify(t, null, 2));
      return;
    }

    if (command === 'activate') {
      const slug = positional[0];
      const plan = positional[1] as CommercialPlanCode | undefined;
      if (!slug || !plan || !PLANS.includes(plan)) {
        throw new Error(
          `Uso: tenant-license.ts activate <slug> <${PLANS.join('|')}> [--entry-paid YYYY-MM-DD] [--status ...]`,
        );
      }
      const statusRaw = flags.status as string | undefined;
      const status = statusRaw ? (statusRaw as LicenseStatus) : undefined;
      const entryPaid = flags['entry-paid'] ? parseDate(String(flags['entry-paid'])) : undefined;
      const billingDay = flags['billing-day'] ? Number(flags['billing-day']) : undefined;

      const update = buildActivateLicenseUpdate({
        slug,
        plan,
        entryPaidAt: entryPaid,
        contractStartedAt: entryPaid,
        billingDay,
        status,
      });

      const row = await central.tenant.update({
        where: { slug },
        data: update,
      });
      console.log('Licença atualizada:', {
        slug: row.slug,
        commercialPlan: row.commercialPlan,
        licenseStatus: row.licenseStatus,
        licenseExpiresAt: row.licenseExpiresAt,
        maxBirds: row.maxBirds,
        maxBarns: row.maxBarns,
        maxUsers: row.maxUsers,
        billingDay: row.billingDay,
      });
      return;
    }

    if (command === 'extend') {
      const slug = positional[0];
      if (!slug) throw new Error('Uso: tenant-license.ts extend <slug> [--months 1]');
      const months = flags.months ? Number(flags.months) : 1;
      const t = await central.tenant.findUnique({ where: { slug } });
      if (!t) throw new Error(`Tenant não encontrado: ${slug}`);
      const licenseExpiresAt = extendLicenseExpiresAt(t, months);
      const row = await central.tenant.update({
        where: { slug },
        data: {
          licenseExpiresAt,
          licenseStatus: LicenseStatus.active,
        },
      });
      console.log('Validade estendida:', row.slug, row.licenseExpiresAt);
      return;
    }

    throw new Error(
      'Comando desconhecido. Use: show | activate | extend (ver docs/comercial/onboarding-licenca.md)',
    );
  } finally {
    await central.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
