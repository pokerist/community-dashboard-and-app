import { Test, TestingModule } from '@nestjs/testing';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesService } from './facilities.service';

describe('FacilitiesController', () => {
  let controller: FacilitiesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FacilitiesController],
      providers: [
        {
          provide: FacilitiesService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    controller = module.get<FacilitiesController>(FacilitiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('list should return array', async () => {
    const res = await controller.findAll();
    expect(res).toEqual([]);
  });
});
