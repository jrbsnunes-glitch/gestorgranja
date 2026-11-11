import { Prisma, PrismaClient, FiscalDocumentStatus } from '../generated/tenant-client';
import { calendarDayKeyInTz, prismaDateOnly, prismaDateToDayKey } from '../common/calendar-date.util';

export type SaleDateNotice = {
  saleDate: string;
  fiscalIssuedAt: string | null;
  boletoIssuedAt: string | null;
  messages: string[];
};

function formatDayKey(key: string) {
  const [y, m, d] = key.split('-');
  if (!y || !m || !d) return key;
  return `${d}/${m}/${y}`;
}

/** Dinheiro, Pix, cartão e transferência. Boleto e requisição ficam de fora. */
export function isVistaKind(kind?: string | null) {
  const k = (kind ?? '').toUpperCase();
  return k === 'CASH' || k === 'PIX' || k === 'CARD' || k === 'TRANSFER';
}

export function buildSaleDateNotice(order: {
  orderDate: Date;
  fiscalDoc?: { status: string; issuedAt: Date | null } | null;
  boletos?: { status: string; registeredAt: Date | null }[];
}): SaleDateNotice {
  const saleDate = prismaDateToDayKey(order.orderDate);
  const fiscalIssuedAt =
    order.fiscalDoc?.status === FiscalDocumentStatus.AUTHORIZED && order.fiscalDoc.issuedAt
      ? calendarDayKeyInTz(order.fiscalDoc.issuedAt)
      : null;
  const boletoDays = [
    ...new Set(
      (order.boletos ?? [])
        .filter((b) => b.status !== 'CANCELLED' && b.registeredAt)
        .map((b) => calendarDayKeyInTz(b.registeredAt!)),
    ),
  ];
  const boletoIssuedAt = boletoDays[0] ?? null;
  const messages: string[] = [];
  if (fiscalIssuedAt && fiscalIssuedAt !== saleDate) {
    messages.push(
      `A venda entrou no caixa em ${formatDayKey(saleDate)}. A nota foi autorizada em ${formatDayKey(fiscalIssuedAt)}.`,
    );
  }
  const boletoGap = boletoDays.filter((d) => d !== saleDate);
  if (boletoGap.length > 0) {
    messages.push(
      `A venda entrou no caixa em ${formatDayKey(saleDate)}. O boleto foi emitido em ${boletoGap.map(formatDayKey).join(', ')}.`,
    );
  }
  return { saleDate, fiscalIssuedAt, boletoIssuedAt, messages };
}

export type CashNfDivergence = {
  controlNumber: number;
  partnerName: string;
  amount: number;
  cashDate: string;
  authorizationDate: string;
};

function vistaAmount(order: {
  totalAmount: Prisma.Decimal | number | string;
  paymentMethod: string | null;
  primaryPaymentAmount: Prisma.Decimal | number | string | null;
  secondaryPaymentForm?: { kind: string } | null;
}) {
  const total = Math.round(Number(order.totalAmount) * 100) / 100;
  const primaryVista = isVistaKind(order.paymentMethod);
  if (!order.secondaryPaymentForm) return primaryVista ? total : 0;
  const secondaryVista = isVistaKind(order.secondaryPaymentForm.kind);
  const primaryAmt =
    order.primaryPaymentAmount != null ? Math.round(Number(order.primaryPaymentAmount) * 100) / 100 : 0;
  let amount = 0;
  if (primaryVista) amount += primaryAmt;
  if (secondaryVista) amount += Math.round((total - primaryAmt) * 100) / 100;
  return Math.round(amount * 100) / 100;
}

/** À vista cuja data no caixa difere do dia da autorização da nota. */
export async function loadVistaNfDivergences(
  prisma: PrismaClient,
  filter: { sessionIds?: string[]; fromKey?: string; toKey?: string },
): Promise<CashNfDivergence[]> {
  if (filter.sessionIds && filter.sessionIds.length === 0) return [];
  const fromKey = filter.fromKey?.slice(0, 10);
  const toKey = filter.toKey?.slice(0, 10);
  const dateLimited = Boolean(fromKey && toKey && /^\d{4}-\d{2}-\d{2}$/.test(fromKey) && /^\d{4}-\d{2}-\d{2}$/.test(toKey));
  const issuedFrom = dateLimited ? new Date(`${fromKey}T00:00:00.000Z`) : null;
  const issuedTo = dateLimited ? new Date(`${toKey}T23:59:59.999Z`) : null;
  if (issuedFrom) issuedFrom.setUTCDate(issuedFrom.getUTCDate() - 1);
  if (issuedTo) issuedTo.setUTCDate(issuedTo.getUTCDate() + 1);

  const orders = await prisma.salesOrder.findMany({
    where: {
      status: 'CONFIRMED',
      cashSessionId: filter.sessionIds ? { in: filter.sessionIds } : { not: null },
      fiscalDoc: { is: { status: FiscalDocumentStatus.AUTHORIZED } },
      ...(dateLimited && issuedFrom && issuedTo
        ? {
            OR: [
              { orderDate: { gte: prismaDateOnly(fromKey!), lte: prismaDateOnly(toKey!) } },
              { fiscalDoc: { is: { issuedAt: { gte: issuedFrom, lte: issuedTo } } } },
            ],
          }
        : {}),
    },
    include: {
      partner: { select: { name: true } },
      fiscalDoc: { select: { status: true, issuedAt: true } },
      secondaryPaymentForm: { select: { kind: true } },
    },
    orderBy: { controlNumber: 'asc' },
  });

  const rows: CashNfDivergence[] = [];
  for (const order of orders) {
    if (!order.fiscalDoc?.issuedAt) continue;
    const cashDate = prismaDateToDayKey(order.orderDate);
    const authorizationDate = calendarDayKeyInTz(order.fiscalDoc.issuedAt);
    if (cashDate === authorizationDate) continue;
    if (dateLimited && fromKey && toKey) {
      const cashIn = cashDate >= fromKey && cashDate <= toKey;
      const authIn = authorizationDate >= fromKey && authorizationDate <= toKey;
      if (!cashIn && !authIn) continue;
    }
    const amount = vistaAmount(order);
    if (amount < 0.01) continue;
    rows.push({
      controlNumber: order.controlNumber,
      partnerName: order.partner.name,
      amount,
      cashDate,
      authorizationDate,
    });
  }
  return rows;
}
