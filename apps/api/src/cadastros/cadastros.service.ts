import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { FlockLotStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { normalizePartnerPayload, type PartnerPayload } from './partner-payload';

@Injectable()
export class CadastrosService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private client(user: JwtPayload) {
    return this.tenantPrisma.getClient(user.tenantSlug);
  }

  listBarns(user: JwtPayload) {
    return this.client(user).then((p) =>
      p.barn.findMany({ orderBy: { code: 'asc' }, include: { _count: { select: { flockLots: true } } } }),
    );
  }

  createBarn(user: JwtPayload, data: { code: string; name: string; capacity?: number }) {
    return this.client(user).then((p) =>
      p.barn.create({
        data: { code: data.code.trim(), name: data.name.trim(), capacity: data.capacity },
      }),
    );
  }

  updateBarn(
    user: JwtPayload,
    id: string,
    data: { code?: string; name?: string; capacity?: number; isActive?: boolean },
  ) {
    return this.client(user).then((p) =>
      p.barn.update({
        where: { id },
        data: {
          code: data.code?.trim(),
          name: data.name?.trim(),
          capacity: data.capacity,
          isActive: data.isActive,
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
