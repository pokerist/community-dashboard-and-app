import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { CommunitiesService } from './communities.service';

describe('CommunitiesService', () => {
  let service: CommunitiesService;

  const prismaMock = {
    community: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    unit: {
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    residentUnit: {
      count: jest.fn(),
    },
    complaint: {
      count: jest.fn(),
    },
    cluster: {
      findMany: jest.fn(),
    },
    gate: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunitiesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<CommunitiesService>(CommunitiesService);
  });

  it('calculates community stats from aggregated counts', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1' });
    prismaMock.unit.count
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(60);
    prismaMock.residentUnit.count.mockResolvedValue(95);
    prismaMock.complaint.count.mockResolvedValue(14);

    const stats = await service.getCommunityStats('community-1');

    expect(stats).toEqual({
      totalUnits: 120,
      occupiedUnits: 80,
      deliveredUnits: 60,
      activeResidents: 95,
      openComplaints: 14,
    });
  });
});

