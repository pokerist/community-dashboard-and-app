import { Test, TestingModule } from '@nestjs/testing';
import { LeasesController } from './leases.controller';

describe('LeasesController', () => {
  let controller: LeasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeasesController],
    }).compile();

    controller = module.get<LeasesController>(LeasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
