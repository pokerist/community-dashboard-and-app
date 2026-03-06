import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { RentRequestsService } from './rent-requests.service';

describe('RentRequestsService', () => {
  let service: RentRequestsService;

  const prismaMock = {
    systemSetting: {
      findUnique: jest.fn(),
    },
    unitAccess: {
      findFirst: jest.fn(),
    },
  };

  const emailServiceMock = {
    sendEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentRequestsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: EmailService,
          useValue: emailServiceMock,
        },
      ],
    }).compile();

    service = module.get<RentRequestsService>(RentRequestsService);
  });

  it('blocks create when leasing is disabled', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({
      value: {
        leasingEnabled: false,
        suspensionReason: 'Emergency freeze',
      },
    });

    await expect(
      service.create('owner-1', {
        unitId: 'unit-1',
        tenantName: 'Tenant',
        tenantEmail: 'tenant@example.com',
        tenantPhone: '+201000000000',
        contractFileId: 'file-1',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});

