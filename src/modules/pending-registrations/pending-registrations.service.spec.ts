import { Test, TestingModule } from '@nestjs/testing';
import { PendingRegistrationsService } from './pending-registrations.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('PendingRegistrationsService', () => {
  let service: PendingRegistrationsService;

  beforeEach(async () => {
    const mockPrisma: any = {
      pendingRegistration: {},
      user: {},
      resident: {},
      residentUnit: {},
      owner: {},
      tenant: {},
      userStatusLog: {},
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PendingRegistrationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<PendingRegistrationsService>(
      PendingRegistrationsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
