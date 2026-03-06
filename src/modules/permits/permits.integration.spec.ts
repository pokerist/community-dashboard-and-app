import { BadRequestException } from '@nestjs/common';
import {
  PermitCategory,
  PermitStatus,
  ServiceFieldType,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PermitsService } from './permits.service';

type PermitTypeState = {
  id: string;
  name: string;
  slug: string;
  category: PermitCategory;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type PermitFieldState = {
  id: string;
  permitTypeId: string;
  label: string;
  type: ServiceFieldType;
  placeholder: string | null;
  required: boolean;
  displayOrder: number;
};

type PermitRequestState = {
  id: string;
  requestNumber: string;
  permitTypeId: string;
  unitId: string;
  requestedById: string;
  status: PermitStatus;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PermitValueState = {
  requestId: string;
  fieldId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueBool: boolean | null;
  valueDate: Date | null;
};

describe('PermitsService integration-style', () => {
  let service: PermitsService;

  const permitTypes: PermitTypeState[] = [];
  const permitFields: PermitFieldState[] = [];
  const permitRequests: PermitRequestState[] = [];
  const permitValues: PermitValueState[] = [];
  let sequence = BigInt(0);

  const users = new Map([
    ['user-1', { id: 'user-1', nameEN: 'Resident One', email: 'r1@example.com', phone: '0100' }],
    ['admin-1', { id: 'admin-1', nameEN: 'Admin One', email: 'a1@example.com', phone: '0111' }],
  ]);
  const units = new Map([
    ['unit-1', { id: 'unit-1', unitNumber: '101', block: 'A' }],
  ]);

  const mockPrisma = {
    unit: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        units.get(where.id) ?? null,
      ),
    },
    unitAccess: {
      findFirst: jest.fn(async () => ({
        id: 'ua-1',
        userId: 'user-1',
        unitId: 'unit-1',
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 1000),
        endsAt: null,
      })),
    },
    permitType: {
      findMany: jest.fn(async () =>
        permitTypes.map((type) => ({
          ...type,
          fields: permitFields.filter((field) => field.permitTypeId === type.id),
        })),
      ),
      findFirst: jest.fn(async ({ where }: { where: { id?: string; slug?: string } }) => {
        const found = permitTypes.find((type) => {
          if (where.id) return type.id === where.id;
          if (where.slug) return type.slug === where.slug;
          return false;
        });
        if (!found) return null;
        return {
          ...found,
          fields: permitFields.filter((field) => field.permitTypeId === found.id),
        };
      }),
      findUnique: jest.fn(async ({ where, include }: { where: { id: string }; include?: { fields?: boolean } }) => {
        const found = permitTypes.find((type) => type.id === where.id) ?? null;
        if (!found) return null;
        if (include?.fields) {
          return {
            ...found,
            fields: permitFields.filter((field) => field.permitTypeId === found.id),
          };
        }
        return found;
      }),
      aggregate: jest.fn(async () => ({
        _max: {
          displayOrder: permitTypes.length > 0 ? Math.max(...permitTypes.map((row) => row.displayOrder)) : null,
        },
      })),
      create: jest.fn(async ({ data }: { data: Omit<PermitTypeState, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const row: PermitTypeState = {
          id: `00000000-0000-0000-0000-${String(permitTypes.length + 1).padStart(12, '0')}`,
          ...data,
          isActive: data.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        permitTypes.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<PermitTypeState> }) => {
        const idx = permitTypes.findIndex((row) => row.id === where.id);
        if (idx < 0) throw new Error('Not found');
        permitTypes[idx] = {
          ...permitTypes[idx],
          ...data,
          updatedAt: new Date(),
        };
        return permitTypes[idx];
      }),
    },
    permitField: {
      createMany: jest.fn(async ({ data }: { data: Omit<PermitFieldState, 'id'>[] }) => {
        data.forEach((item) => {
          permitFields.push({
            id: `pf-${permitFields.length + 1}`,
            ...item,
          });
        });
        return { count: data.length };
      }),
      deleteMany: jest.fn(async ({ where }: { where: { permitTypeId: string } }) => {
        for (let i = permitFields.length - 1; i >= 0; i -= 1) {
          if (permitFields[i].permitTypeId === where.permitTypeId) {
            permitFields.splice(i, 1);
          }
        }
        return { count: 1 };
      }),
      aggregate: jest.fn(async ({ where }: { where: { permitTypeId: string } }) => {
        const byType = permitFields.filter((field) => field.permitTypeId === where.permitTypeId);
        return {
          _max: {
            displayOrder: byType.length > 0 ? Math.max(...byType.map((field) => field.displayOrder)) : null,
          },
        };
      }),
      create: jest.fn(async ({ data }: { data: Omit<PermitFieldState, 'id'> }) => {
        const row: PermitFieldState = {
          id: `10000000-0000-0000-0000-${String(permitFields.length + 1).padStart(12, '0')}`,
          ...data,
        };
        permitFields.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        permitFields.find((field) => field.id === where.id) ?? null,
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const idx = permitFields.findIndex((field) => field.id === where.id);
        if (idx >= 0) permitFields.splice(idx, 1);
        return { id: where.id };
      }),
    },
    permitRequestSequence: {
      upsert: jest.fn(async () => ({ name: 'permits', counter: sequence })),
      update: jest.fn(async () => {
        sequence += BigInt(1);
        return { counter: sequence };
      }),
    },
    permitRequestFieldValue: {
      createMany: jest.fn(async ({ data }: { data: PermitValueState[] }) => {
        data.forEach((row) => permitValues.push(row));
        return { count: data.length };
      }),
      count: jest.fn(async ({ where }: { where: { fieldId: string } }) =>
        permitValues.filter((value) => value.fieldId === where.fieldId).length,
      ),
    },
    permitRequest: {
      create: jest.fn(async ({ data }: { data: Omit<PermitRequestState, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const row: PermitRequestState = {
          id: `20000000-0000-0000-0000-${String(permitRequests.length + 1).padStart(12, '0')}`,
          ...data,
          status: data.status ?? PermitStatus.PENDING,
          reviewedById: data.reviewedById ?? null,
          reviewedAt: data.reviewedAt ?? null,
          rejectionReason: data.rejectionReason ?? null,
          notes: data.notes ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        permitRequests.push(row);
        return { id: row.id };
      }),
      findUnique: jest.fn(async ({ where, include, select }: { where: { id: string }; include?: unknown; select?: unknown }) => {
        const row = permitRequests.find((request) => request.id === where.id) ?? null;
        if (!row) return null;
        if (select) {
          return {
            id: row.id,
            status: row.status,
          };
        }
        if (include) {
          const permitType = permitTypes.find((type) => type.id === row.permitTypeId);
          if (!permitType) return null;
          return {
            ...row,
            permitType: {
              ...permitType,
              fields: permitFields.filter((field) => field.permitTypeId === permitType.id),
            },
            unit: units.get(row.unitId),
            requestedBy: users.get(row.requestedById),
            reviewedBy: row.reviewedById ? users.get(row.reviewedById) : null,
            fieldValues: permitValues
              .filter((value) => value.requestId === row.id)
              .map((value) => ({
                ...value,
                field: permitFields.find((field) => field.id === value.fieldId),
              })),
          };
        }
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<PermitRequestState> }) => {
        const idx = permitRequests.findIndex((request) => request.id === where.id);
        if (idx < 0) throw new Error('Not found');
        permitRequests[idx] = {
          ...permitRequests[idx],
          ...data,
          updatedAt: new Date(),
        };
        return permitRequests[idx];
      }),
      findMany: jest.fn(async () =>
        permitRequests.map((request) => ({
          status: request.status,
          reviewedAt: request.reviewedAt,
          permitType: {
            category:
              permitTypes.find((type) => type.id === request.permitTypeId)?.category ??
              PermitCategory.OPERATIONAL,
          },
        })),
      ),
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(mockPrisma)),
  };

  beforeEach(() => {
    permitTypes.length = 0;
    permitFields.length = 0;
    permitRequests.length = 0;
    permitValues.length = 0;
    sequence = BigInt(0);
    service = new PermitsService(mockPrisma as unknown as PrismaService);
  });

  it('runs permit type CRUD and request lifecycle', async () => {
    const createdType = await service.createPermitType({
      name: 'Worker Permit',
      category: PermitCategory.OPERATIONAL,
      fields: [
        {
          label: 'Worker Name',
          type: ServiceFieldType.TEXT,
          required: true,
        },
      ],
    });

    expect(createdType.slug).toBe('worker-permit');

    const updatedType = await service.updatePermitType(createdType.id, {
      description: 'Updated',
    });
    expect(updatedType.description).toBe('Updated');

    const toggled = await service.togglePermitType(createdType.id);
    expect(toggled.isActive).toBe(false);

    await service.togglePermitType(createdType.id);

    const extraField = await service.addField(createdType.id, {
      label: 'Start Date',
      type: ServiceFieldType.DATE,
      required: true,
    });
    expect(extraField.label).toBe('Start Date');

    await service.removeField(extraField.id);

    const request = await service.createPermitRequest('user-1', {
      permitTypeId: createdType.id,
      unitId: 'unit-1',
      fieldValues: [
        {
          fieldId: createdType.fields[0].id,
          value: 'John Worker',
        },
      ],
    });

    expect(request.requestNumber).toBe('PRM-000001');
    expect(request.status).toBe(PermitStatus.PENDING);

    const approved = await service.approveRequest(request.id, 'admin-1', {
      notes: 'Approved',
    });

    expect(approved.status).toBe(PermitStatus.APPROVED);
    expect(approved.reviewer?.id).toBe('admin-1');

    await expect(
      service.rejectRequest(request.id, 'admin-1', { reason: 'Invalid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
