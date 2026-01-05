import { Test, TestingModule } from '@nestjs/testing';
import { PendingRegistrationsController } from './pending-registrations.controller';
import { PendingRegistrationsService } from './pending-registrations.service';

describe('PendingRegistrationsController', () => {
  let controller: PendingRegistrationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PendingRegistrationsController],
      providers: [PendingRegistrationsService],
    }).compile();

    controller = module.get<PendingRegistrationsController>(PendingRegistrationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
