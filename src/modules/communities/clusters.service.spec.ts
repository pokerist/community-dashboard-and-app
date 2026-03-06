import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClustersService } from './clusters.service';

describe('ClustersService', () => {
  let service: ClustersService;

  const prismaMock = {
    community: {
      findUnique: jest.fn(),
    },
    cluster: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    unit: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (operations: Promise<unknown>[]): Promise<unknown[]> =>
        Promise.all(operations),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClustersService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ClustersService>(ClustersService);
  });

  it('rejects deleteCluster when active units are assigned', async () => {
    prismaMock.cluster.findFirst.mockResolvedValue({ id: 'cluster-1' });
    prismaMock.unit.count.mockResolvedValue(2);

    await expect(service.deleteCluster('cluster-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects reorderClusters when orderedIds contains duplicates', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1' });
    prismaMock.cluster.findMany.mockResolvedValue([
      { id: 'cluster-1' },
      { id: 'cluster-2' },
    ]);

    await expect(
      service.reorderClusters('community-1', {
        orderedIds: ['cluster-1', 'cluster-1'],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
