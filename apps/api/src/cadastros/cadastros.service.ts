import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { loadUserNames, userLabel } from '../common/user-names';
import { BarnSituation, FlockLotStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { normalizePartnerPayload, type PartnerPayload } from './partner-payload';

export type BarnPayload = {
  code?: string;
  name?: string;
  capacity?: number | null;
  isActive?: boolean;
  situation?: BarnSituation;
  responsibleUserId?: string | null;
  notes?: string | null;
};

@Injectable()
export class CadastrosService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private client(user: JwtPayload) {
    return this.tenantPrisma.getClient(user.tenantSlug);
  }

  async listBarns(user: JwtPayload) {
    const p = await this.client(user);
    const rows = await p.barn.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { flockLots: true } },
        flockLots: {
          where: { status: FlockLotStatus.ACTIVE },
          select: { id: true, code: true, housedQty: true },
        },
      },
    });
    const names = await loadUserNames(p, rows.map((r) => r.responsibleUserId));
    return rows.map(({ flockLots, ...b }) => ({
      ...b,
      responsibleName: userLabel(names, b.responsibleUserId),
      activeLots: flockLots,
      activeLotCount: flockLots.length,
      housedActive: flockLots.reduce((s, l) => s + l.housedQty, 0),
    }));
  }

  /** Usuários ativos para seleção de responsável (nome e login apenas). */
  async listResponsibleOptions(user: JwtPayload) {
    const p = await this.client(user);
    return p.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, username: true },
      orderBy: { name: 'asc' },
    });
  }

  createBarn(user: JwtPayload, data: BarnPayload) {
    if (!data.code?.trim() || !data.name?.trim()) {
      throw new BadRequestException('Código e nome do galpão são obrigatórios.');
    }
    return this.client(user).then((p) =>
      p.barn.create({
        data: {
          code: data.code!.trim(),
          name: data.name!.trim(),
          capacity: data.capacity ?? undefined,
          situation: data.situation ?? undefined,
          responsibleUserId: data.responsibleUserId || undefined,
          notes: data.notes?.trim() || undefined,
        },
      }),
    );
  }

  updateBarn(user: JwtPayload, id: string, data: BarnPayload) {
    return this.client(user).then((p) =>
      p.barn.update({
        where: { id },
        data: {
          code: data.code?.trim(),
          name: data.name?.trim(),
          capacity: data.capacity === undefined ? undefined : data.capacity,
          isActive: data.isActive,
          situation: data.situation,
          responsibleUserId:
            data.responsibleUserId === undefined ? undefined : data.responsibleUserId || null,
          notes: data.notes === undefined ? undefined : data.notes?.trim() || null,
        },
      }),
    );
  }

  listBreedLineages(user: JwtPayload) {
    return this.client(user).then((p) =>
      p.breedLineage.findMany({
        orderBy: { name: 'asc' },
        include: { standardPoints: { orderBy: { ageDays: 'asc' }, take: 5 } },
      }),
    );
  }

  listPartners(user: JwtPayload) {
    return this.client(user).then((p) => p.partner.findMany({ orderBy: { name: 'asc' } }));
  }

  createPartner(user: JwtPayload, data: PartnerPayload) {
    const row = normalizePartnerPayload(data);
    return this.client(user).then((p) => p.partner.create({ data: row }));
  }

  updatePartner(user: JwtPayload, id: string, data: PartnerPayload) {
    const row = normalizePartnerPayload({ ...data, name: data.name || '' });
    return this.client(user).then((p) =>
      p.partner.update({
        where: { id },
        data: {
          personType: row.personType,
          name: row.name,
          tradeName: row.tradeName,
          document: row.document,
          cpf: row.cpf,
          cnpj: row.cnpj,
          email: row.email,
          phone: row.phone,
          mobile: row.mobile,
          stateRegistration: row.stateRegistration,
          zipCode: row.zipCode,
          street: row.street,
          addressNumber: row.addressNumber,
          addressComplement: row.addressComplement,
          district: row.district,
          city: row.city,
          state: row.state,
          isCustomer: data.isCustomer,
          isSupplier: data.isSupplier,
        },
      }),
    );
  }

  createFlockLot(
    user: JwtPayload,
    data: {
      code: string;
      barnId: string;
      breedLineageId: string;
      housingDate: string;
      housedQty: number;
    },
  ) {
    return this.client(user).then((p) =>
      p.flockLot.create({
        data: {
          code: data.code.trim(),
          barnId: data.barnId,
          breedLineageId: data.breedLineageId,
          housingDate: new Date(data.housingDate),
          housedQty: data.housedQty,
          status: FlockLotStatus.ACTIVE,
        },
        include: { barn: true, breedLineage: true },
      }),
    );
  }

  updateFlockLot(user: JwtPayload, id: string, data: Record<string, unknown>) {
    return this.client(user).then((p) =>
      p.flockLot.update({
        where: { id },
        data: {
          eggType: data.eggType as never,
          strainNotes: data.strainNotes ? String(data.strainNotes) : undefined,
          supplierBatch: data.supplierBatch ? String(data.supplierBatch) : undefined,
          expectedEndDate: data.expectedEndDate ? new Date(String(data.expectedEndDate)) : undefined,
          plantNotes: data.plantNotes ? String(data.plantNotes) : undefined,
          housedQty: data.housedQty !== undefined ? Number(data.housedQty) : undefined,
        },
        include: { barn: true, breedLineage: true },
      }),
    );
  }
}
