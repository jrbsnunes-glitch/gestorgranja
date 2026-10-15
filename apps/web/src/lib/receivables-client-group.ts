import { titleDueDayOffset } from '@/lib/finance-title-due';
import { prismaDateDayKey } from '@/lib/calendar-date';

export type ReceivablePartner = {
  id: string;
  name: string;
  controlNumber?: number;
  cpf?: string | null;
  cnpj?: string | null;
  document?: string | null;
  phone?: string | null;
  mobile?: string | null;
};

export type ReceivableForGrouping = {
  id: string;
  controlNumber?: number;
  description: string;
  amount: string;
  amountPaid?: string;
  dueDate: string;
  balance?: number;
  settled?: boolean;
  partner: ReceivablePartner;
  salesOrder?: {
    controlNumber?: number;
    orderDate?: string;
  } | null;
  boletos?: { id: string }[];
};

export type ClientReceivableGroup = {
  partnerId: string;
  partner: ReceivablePartner;
  titles: ReceivableForGrouping[];
  totalOpen: number;
  openCount: number;
  overdueCount: number;
  oldestDue: string;
  newestDue: string;
};

export function partnerDocumentLabel(p: ReceivablePartner): string {
  const raw = p.cnpj?.trim() || p.cpf?.trim() || p.document?.trim();
  return raw || '—';
}

export function partnerPhoneLabel(p: ReceivablePartner): string {
  return p.mobile?.trim() || p.phone?.trim() || '—';
}

export function partnerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function receivableOpenBalance(r: ReceivableForGrouping): number {
  if (r.settled) return 0;
  if (r.balance != null) return r.balance;
  return Number(r.amount) - Number(r.amountPaid ?? 0);
}

export function isReceivableOverdue(dueDate: string, settled: boolean): boolean {
  if (settled) return false;
  return titleDueDayOffset(dueDate) < 0;
}

export function groupOpenReceivablesByClient(items: ReceivableForGrouping[]): ClientReceivableGroup[] {
  const map = new Map<string, ClientReceivableGroup>();

  for (const r of items) {
    const balance = receivableOpenBalance(r);
    if (balance <= 0.004) continue;

    const overdue = isReceivableOverdue(r.dueDate, r.settled === true);
    let g = map.get(r.partner.id);
    if (!g) {
      g = {
        partnerId: r.partner.id,
        partner: r.partner,
        titles: [],
        totalOpen: 0,
        openCount: 0,
        overdueCount: 0,
        oldestDue: r.dueDate,
        newestDue: r.dueDate,
      };
      map.set(r.partner.id, g);
    }
    g.titles.push(r);
    g.totalOpen += balance;
    g.openCount += 1;
    if (overdue) g.overdueCount += 1;
    if (prismaDateDayKey(r.dueDate) < prismaDateDayKey(g.oldestDue)) g.oldestDue = r.dueDate;
    if (prismaDateDayKey(r.dueDate) > prismaDateDayKey(g.newestDue)) g.newestDue = r.dueDate;
  }

  return [...map.values()].sort((a, b) => a.partner.name.localeCompare(b.partner.name, 'pt-BR'));
}

export function receivablesKpis(items: ReceivableForGrouping[], clientGroups: ClientReceivableGroup[]) {
  let totalOpen = 0;
  let totalOverdue = 0;
  let dueSoon = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;

  for (const r of items) {
    const balance = receivableOpenBalance(r);
    if (balance <= 0.004) continue;
    totalOpen += balance;
    const overdue = isReceivableOverdue(r.dueDate, r.settled === true);
    if (overdue) {
      totalOverdue += balance;
      overdueCount += 1;
    } else {
      dueSoon += balance;
      dueSoonCount += 1;
    }
  }

  const allPartnerIds = new Set(items.map((r) => r.partner.id));
  const openPartnerIds = new Set(clientGroups.map((g) => g.partnerId));

  return {
    totalOpen,
    totalOverdue,
    dueSoon,
    openTitleCount: overdueCount + dueSoonCount,
    overdueTitleCount: overdueCount,
    dueSoonTitleCount: dueSoonCount,
    clientsListed: clientGroups.length,
    clientsTotal: allPartnerIds.size,
    openClients: openPartnerIds.size,
  };
}
