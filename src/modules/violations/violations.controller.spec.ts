import { Test, TestingModule } from '@nestjs/testing';
import { ViolationsController } from './violations.controller';
import { ViolationsService } from './violations.service';

describe('ViolationsController', () => {
  let controller: ViolationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ViolationsController],
      providers: [{ provide: ViolationsService, useValue: {} }],
    })
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(
        require('../auth/guards/permissions.guard').PermissionsGuard,
      )
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ViolationsController>(ViolationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
