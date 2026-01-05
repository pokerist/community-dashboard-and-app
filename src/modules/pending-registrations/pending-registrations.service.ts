import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreatePendingRegistrationDto } from './dto/create-pending-registration.dto';
import { UpdatePendingRegistrationDto } from './dto/update-pending-registration.dto';
import { ApprovePendingRegistrationDto } from './dto/approve-pending-registration.dto';
import * as crypto from 'crypto';

@Injectable()
export class PendingRegistrationsService {
  constructor(private prisma: PrismaService) {}

  // Create a new pending registration
  async create(dto: CreatePendingRegistrationDto) {
    const exists = await this.prisma.pendingRegistration.findUnique({
      where: { phone: dto.phone },
    });
    if (exists)
      throw new BadRequestException(
        'Phone number already pending or registered',
      );

    let passwordHash: string | undefined;
    if (dto.password) passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.pendingRegistration.create({
      data: {
        ...dto,
        passwordHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // expires in 7 days
      },
    });
  }

  // List all pending registrations
  async findAll() {
    return this.prisma.pendingRegistration.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get one pending registration
  async findOne(id: string) {
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { id },
      include: { personalPhoto: true },
    });
    if (!pending) throw new NotFoundException('Pending registration not found');
    return pending;
  }

  // Update pending registration (optional)
  async update(id: string, dto: UpdatePendingRegistrationDto) {
    return this.prisma.pendingRegistration.update({ where: { id }, data: dto });
  }

  // Reject a pending registration
  async reject(id: string) {
    const pending = await this.findOne(id);
    if (pending.status !== 'PENDING')
      throw new BadRequestException('Cannot reject non-pending registration');

    return this.prisma.pendingRegistration.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }

  // Approve registration → create User + Resident + Unit assignment + optional Owner/Tenant
  async approve(id: string, dto: ApprovePendingRegistrationDto) {
    const pending = await this.findOne(id);

    if (pending.status !== 'PENDING') {
      throw new BadRequestException('Cannot approve non-pending registration');
    }

    // Wrap entire operation in a transaction to prevent race conditions
    return this.prisma.$transaction(async (prisma) => {
      // --- Check email uniqueness ---
      if (pending.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email: pending.email },
        });
        if (emailExists) {
          throw new BadRequestException('Email already registered.');
        }
      }

      // --- Create User with hashed password ---
      let passwordHash = pending.passwordHash;
      if (!passwordHash) {
        const randomPassword = crypto.randomBytes(12).toString('hex');
        passwordHash = await bcrypt.hash(randomPassword, 12);
        // Optional: store temp password somewhere to email user
      }

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

      // --- Create Resident + Owner/Tenant if applicable ---
      const resident = await prisma.resident.create({
        data: {
          userId: user.id,
          nationalId: pending.nationalId,
        },
      });

      if (dto.role === 'OWNER') {
        await prisma.owner.create({ data: { userId: user.id } });
      } else if (dto.role === 'TENANT') {
        await prisma.tenant.create({ data: { userId: user.id } });
      }

      // --- Handle primary resident conflict ---
      if (dto.isPrimary) {
        const existingPrimary = await prisma.residentUnit.findFirst({
          where: { unitId: dto.unitId, isPrimary: true },
        });
        if (existingPrimary) {
          throw new BadRequestException(
            'This unit already has a primary resident.',
          );
        }
      }

      // --- Assign to unit ---
      await prisma.residentUnit.create({
        data: {
          residentId: user.id,
          unitId: dto.unitId,
          isPrimary: dto.isPrimary,
        },
      });

      // --- Update pending registration ---
      await prisma.pendingRegistration.update({
        where: { id },
        data: { status: 'VERIFIED' },
      });

      // --- Log status change ---
      await prisma.userStatusLog.create({
        data: {
          userId: user.id,
          oldStatus: 'PENDING',
          newStatus: 'ACTIVE',
          source: 'ADMIN',
          note: 'Approved via pending registration',
        },
      });

      return user;
    });
  }
}
