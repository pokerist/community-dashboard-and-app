import { Test, TestingModule } from '@nestjs/testing';
import { FacilitiesService } from './facilities.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockPrisma: any = {
  facility: { findMany: jest.fn(), findUnique: jest.fn() },
};

describe('FacilitiesService', () => {
  let service: FacilitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacilitiesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FacilitiesService>(FacilitiesService);
    jest.clearAllMocks();
  });

  it('findAllForActor should return all facilities for facility.view_all', async () => {
    mockPrisma.facility.findMany.mockResolvedValue([{ id: 'f1' }]);

    const res = await service.findAllForActor({
      actorUserId: 'u1',
      permissions: ['facility.view_all'],
      roles: [],
    });

    expect(mockPrisma.facility.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.any(Object),
      }),
    );
    expect(res).toEqual([{ id: 'f1' }]);
  });

  it('findAllForActor should return only active facilities for facility.view_own', async () => {
    mockPrisma.facility.findMany.mockResolvedValue([{ id: 'f2' }]);

    const res = await service.findAllForActor({
      actorUserId: 'u1',
      permissions: ['facility.view_own'],
      roles: [],
    });

    expect(mockPrisma.facility.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
      }),
    );
    expect(res).toEqual([{ id: 'f2' }]);
  });
});

