import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AccessGrantPermission, AccessStatus, QRType } from '@prisma/client';
import { AccessControlService } from './access-control.service';

describe('AccessControlService', () => {
  const prismaMock = {
    unitAccess: { findFirst: jest.fn() },
    accessQRCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    accessProfile: { create: jest.fn(), delete: jest.fn() },
    accessGrant: { create: jest.fn(), delete: jest.fn() },
  };

  const hikCentralMock = {
    createQrCode: jest.fn(),
  };

  const makeService = () =>
    new AccessControlService(prismaMock as any, hikCentralMock as any);

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.QR_ENFORCE_SINGLE_ACTIVE = 'true';
  });

  it('rejects VISITOR QR without visitorName', async () => {
    const service = makeService();

    await expect(
      service.generateQrCode(
        {
          unitId: '11111111-1111-1111-1111-111111111111',
          type: QRType.VISITOR,
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects validTo <= validFrom', async () => {
    const service = makeService();

    prismaMock.unitAccess.findFirst.mockResolvedValueOnce({
      canGenerateQR: true,
      status: AccessStatus.ACTIVE,
    });
    prismaMock.accessQRCode.findFirst.mockResolvedValueOnce(null);

    const validFrom = new Date('2026-02-03T10:00:00.000Z');
    const validTo = new Date('2026-02-03T10:00:00.000Z');

    await expect(
      service.generateQrCode(
        {
          unitId: '11111111-1111-1111-1111-111111111111',
          type: QRType.SELF,
          validFrom,
          validTo,
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids user without canGenerateQR', async () => {
    const service = makeService();

    prismaMock.unitAccess.findFirst.mockResolvedValueOnce({
      canGenerateQR: false,
      status: AccessStatus.ACTIVE,
    });

    await expect(
      service.generateQrCode(
        {
          unitId: '11111111-1111-1111-1111-111111111111',
          type: QRType.SELF,
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate active QR when enforced', async () => {
    const service = makeService();

    prismaMock.unitAccess.findFirst.mockResolvedValueOnce({
      canGenerateQR: true,
      status: AccessStatus.ACTIVE,
    });
    prismaMock.accessQRCode.findFirst.mockResolvedValueOnce({ id: 'existing' });

    await expect(
      service.generateQrCode(
        {
          unitId: '11111111-1111-1111-1111-111111111111',
          type: QRType.SELF,
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates AccessGrant for VISITOR and stores AccessQRCode', async () => {
    const service = makeService();

    prismaMock.unitAccess.findFirst.mockResolvedValueOnce({
      canGenerateQR: true,
      status: AccessStatus.ACTIVE,
    });
    prismaMock.accessQRCode.findFirst.mockResolvedValueOnce(null);
    prismaMock.accessProfile.create.mockResolvedValueOnce({ id: 'profile-1' });
    prismaMock.accessGrant.create.mockResolvedValueOnce({ id: 'grant-1' });
    hikCentralMock.createQrCode.mockResolvedValueOnce({
      qrId: 'hik-qr-1',
      qrImageBase64: 'base64-qr',
    });
    prismaMock.accessQRCode.create.mockResolvedValueOnce({
      id: 'qr-1',
      qrId: 'hik-qr-1',
    });

    const validFrom = new Date('2026-02-03T10:00:00.000Z');
    const validTo = new Date('2026-02-03T11:00:00.000Z');

    const result = await service.generateQrCode(
      {
        unitId: '11111111-1111-1111-1111-111111111111',
        type: QRType.VISITOR,
        visitorName: 'John Visitor',
        validFrom,
        validTo,
        permissions: [AccessGrantPermission.ENTER],
      } as any,
      'user-1',
    );

    expect(hikCentralMock.createQrCode).toHaveBeenCalledTimes(1);
    expect(prismaMock.accessGrant.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.accessQRCode.create).toHaveBeenCalledTimes(1);
    expect(result.qrImageBase64).toBe('base64-qr');
  });

  it('cleans up AccessGrant/AccessProfile when HikCentral fails', async () => {
    const service = makeService();

    prismaMock.unitAccess.findFirst.mockResolvedValueOnce({
      canGenerateQR: true,
      status: AccessStatus.ACTIVE,
    });
    prismaMock.accessQRCode.findFirst.mockResolvedValueOnce(null);
    prismaMock.accessProfile.create.mockResolvedValueOnce({ id: 'profile-1' });
    prismaMock.accessGrant.create.mockResolvedValueOnce({ id: 'grant-1' });
    prismaMock.accessGrant.delete.mockResolvedValueOnce({ id: 'grant-1' });
    prismaMock.accessProfile.delete.mockResolvedValueOnce({ id: 'profile-1' });
    hikCentralMock.createQrCode.mockRejectedValueOnce(new Error('down'));

    await expect(
      service.generateQrCode(
        {
          unitId: '11111111-1111-1111-1111-111111111111',
          type: QRType.VISITOR,
          visitorName: 'John Visitor',
          validFrom: new Date('2026-02-03T10:00:00.000Z'),
          validTo: new Date('2026-02-03T11:00:00.000Z'),
        } as any,
        'user-1',
      ),
    ).rejects.toBeDefined();

    expect(prismaMock.accessGrant.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.accessProfile.delete).toHaveBeenCalledTimes(1);
  });
});
