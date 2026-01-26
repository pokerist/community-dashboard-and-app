import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { CreatePendingRegistrationDto } from './dto/create-pending-registration.dto';
import { UpdatePendingRegistrationDto } from './dto/update-pending-registration.dto';
import { ApprovePendingRegistrationDto } from './dto/approve-pending-registration.dto';
import { PendingRegistrationApprovedEvent } from '../../events/contracts/pending-registration-approved.event';
import * as crypto from 'crypto';

@Injectable()
export class PendingRegistrationsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreatePendingRegistrationDto) {
    const exists = await this.prisma.pendingRegistration.findUnique({
      where: { phone: dto.phone },
    });

    if (exists) {
      throw new BadRequestException(
        'Phone number already pending or registered',
      );
    }

    const { password, ...data } = dto;
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

    return this.prisma.pendingRegistration.create({
      data: {
        ...data,
        passwordHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  async findAll() {
    return this.prisma.pendingRegistration.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { id },
      include: { personalPhoto: true },
    });

    if (!pending) {
      throw new NotFoundException('Pending registration not found');
    }

    return pending;
  }

  async update(id: string, dto: UpdatePendingRegistrationDto) {
    return this.prisma.pendingRegistration.update({
      where: { id },
      data: dto,
    });
  }

  async reject(id: string) {
    const pending = await this.findOne(id);

    if (pending.status !== 'PENDING') {
      throw new BadRequestException('Cannot reject non-pending registration');
    }

    return this.prisma.pendingRegistration.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }

  private async validatePendingRegistration(id: string) {
    const pending = await this.findOne(id);

    if (pending.expiresAt < new Date()) {
      await this.prisma.pendingRegistration.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Registration expired');
    }

    if (pending.status !== 'PENDING') {
      throw new ConflictException('Registration already processed');
    }

    return pending;
  }

  private async lockPendingRegistration(id: string, prisma: any) {
    const locked = await prisma.pendingRegistration.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });

    if (locked.count !== 1) {
      throw new ConflictException('Registration already processed');
    }
  }

  private async checkUniqueness(pending: any, prisma: any) {
    if (pending.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: pending.email },
      });
      if (emailExists) {
        throw new BadRequestException('Email already registered');
      }
    }

    const phoneExists = await prisma.user.findFirst({
      where: { phone: pending.phone },
    });
    if (phoneExists) {
      throw new BadRequestException('Phone already registered');
    }
  }

  private async createUserAndResident(pending: any, prisma: any) {
    const passwordHash =
      pending.passwordHash ??
      (await bcrypt.hash(crypto.randomBytes(12).toString('hex'), 12));

    const user = await prisma.user.create({
      data: {
        nameEN: pending.name,
        email: pending.email,
        phone: pending.phone,
        passwordHash,
        profilePhotoId: pending.personalPhotoId,
        userStatus: 'ACTIVE',
        signupSource: pending.origin,
      },
    });

    await prisma.resident.create({
      data: {
        userId: user.id,
        nationalId: pending.nationalId,
      },
    });

    return user;
  }

  private async assignRole(userId: string, role: string, prisma: any) {
    switch (role) {
      case 'OWNER':
        await prisma.owner.create({ data: { userId } });
        break;
      case 'TENANT':
        await prisma.tenant.create({ data: { userId } });
        break;
      case 'FAMILY':
        // FAMILY role doesn't require additional role table entry
        break;
      default:
        throw new BadRequestException(`Invalid role: ${role}`);
    }
  }

  private async assignResidentUnit(
    userId: string,
    dto: ApprovePendingRegistrationDto,
    prisma: any,
  ) {
    if (dto.isPrimary) {
      const existingPrimary = await prisma.residentUnit.findFirst({
        where: { unitId: dto.unitId, isPrimary: true },
      });
      if (existingPrimary) {
        throw new BadRequestException(
          'This unit already has a primary resident',
        );
      }
    }

    await prisma.residentUnit.create({
      data: {
        residentId: userId,
        unitId: dto.unitId,
        isPrimary: dto.isPrimary,
      },
    });
  }

  private async finalizeApproval(id: string, userId: string, prisma: any) {
    await prisma.pendingRegistration.update({
      where: { id },
      data: { status: 'VERIFIED' },
    });

    await prisma.userStatusLog.create({
      data: {
        userId,
        oldStatus: 'PENDING',
        newStatus: 'ACTIVE',
        source: 'ADMIN',
        note: 'Approved via pending registration',
      },
    });
  }

  async approve(
    id: string,
    dto: ApprovePendingRegistrationDto,
    approvedBy: string,
  ) {
    const pending = await this.validatePendingRegistration(id);

    const user = await this.prisma.$transaction(async (prisma) => {
      await this.lockPendingRegistration(id, prisma);
      await this.checkUniqueness(pending, prisma);

      const user = await this.createUserAndResident(pending, prisma);
      await this.assignRole(user.id, dto.role, prisma);
      await this.assignResidentUnit(user.id, dto, prisma);
      await this.finalizeApproval(id, user.id, prisma);

      return user;
    });

    this.eventEmitter.emit(
      'pending.registration.approved',
      new PendingRegistrationApprovedEvent(id, approvedBy, user.id),
    );

    return user;
  }
}
