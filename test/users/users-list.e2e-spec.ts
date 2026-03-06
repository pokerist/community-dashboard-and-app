import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { UsersHubController } from '../../src/modules/users/users-hub.controller';
import { UsersService } from '../../src/modules/users/users.service';

describe('UsersHubController list endpoints (e2e)', () => {
  let app: INestApplication;

  const mockUsersService = {
    listOwners: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    }),
    listFamilyMembers: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    }),
    listTenants: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    }),
    listHomeStaff: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    }),
    listDelegates: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    }),
    listBrokers: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    }),
    listSystemUsers: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    }),
    listCompoundStaff: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UsersHubController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /users/owners passes parsed filters', async () => {
    await request(app.getHttpServer())
      .get('/users/owners')
      .query({ page: '2', limit: '10', status: 'ACTIVE', search: 'ahmed' })
      .expect(200);

    expect(mockUsersService.listOwners).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        status: 'ACTIVE',
        search: 'ahmed',
      }),
    );
  });

  it('GET /users/family-members passes parsed filters', async () => {
    await request(app.getHttpServer())
      .get('/users/family-members')
      .query({ status: 'SUSPENDED', ownerUserId: '11111111-1111-4111-8111-111111111111' })
      .expect(200);

    expect(mockUsersService.listFamilyMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SUSPENDED',
        ownerUserId: '11111111-1111-4111-8111-111111111111',
      }),
    );
  });

  it('GET /users/tenants passes parsed filters', async () => {
    await request(app.getHttpServer())
      .get('/users/tenants')
      .query({ status: 'ACTIVE', leaseStatus: 'EXPIRED', search: 'unit 12' })
      .expect(200);

    expect(mockUsersService.listTenants).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ACTIVE',
        leaseStatus: 'EXPIRED',
        search: 'unit 12',
      }),
    );
  });

  it('GET /users/home-staff passes parsed filters', async () => {
    await request(app.getHttpServer())
      .get('/users/home-staff')
      .query({ status: 'APPROVED', staffType: 'DRIVER' })
      .expect(200);

    expect(mockUsersService.listHomeStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'APPROVED',
        staffType: 'DRIVER',
      }),
    );
  });

  it('GET /users/delegates passes parsed filters', async () => {
    await request(app.getHttpServer())
      .get('/users/delegates')
      .query({ status: 'PENDING', search: 'delegate' })
      .expect(200);

    expect(mockUsersService.listDelegates).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PENDING',
        search: 'delegate',
      }),
    );
  });

  it('GET /users/brokers passes parsed filters', async () => {
    await request(app.getHttpServer())
      .get('/users/brokers')
      .query({ status: 'ACTIVE', search: 'agency' })
      .expect(200);

    expect(mockUsersService.listBrokers).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ACTIVE',
        search: 'agency',
      }),
    );
  });

  it('GET /users/system-users passes parsed filters', async () => {
    await request(app.getHttpServer())
      .get('/users/system-users')
      .query({ status: 'ACTIVE', roleId: '22222222-2222-4222-8222-222222222222' })
      .expect(200);

    expect(mockUsersService.listSystemUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ACTIVE',
        roleId: '22222222-2222-4222-8222-222222222222',
      }),
    );
  });

  it('GET /users/compound-staff passes query through', async () => {
    await request(app.getHttpServer())
      .get('/users/compound-staff')
      .query({ communityId: '33333333-3333-4333-8333-333333333333', status: 'ACTIVE' })
      .expect(200);

    expect(mockUsersService.listCompoundStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        communityId: '33333333-3333-4333-8333-333333333333',
        status: 'ACTIVE',
      }),
    );
  });
});
