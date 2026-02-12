import { Test, TestingModule } from '@nestjs/testing';
import { PendingRegistrationsController } from './pending-registrations.controller';
import { PendingRegistrationsService } from './pending-registrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

describe('PendingRegistrationsController', () => {
  let controller: PendingRegistrationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PendingRegistrationsController],
      providers: [
        {
          provide: PendingRegistrationsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            reject: jest.fn(),
            approve: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PendingRegistrationsController>(
      PendingRegistrationsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
