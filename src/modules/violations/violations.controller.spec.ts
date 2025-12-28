import { Test, TestingModule } from '@nestjs/testing';
import { ViolationsController } from './violations.controller';

describe('ViolationsController', () => {
  let controller: ViolationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ViolationsController],
    }).compile();

    controller = module.get<ViolationsController>(ViolationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
