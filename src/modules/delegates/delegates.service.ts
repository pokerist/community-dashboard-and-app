import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { CreateDelegateDto } from './dto/create-delegate.dto';
import { UpdateDelegateDto } from './dto/update-delegate.dto';

@Injectable()
export class DelegatesService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // Create delegate request (by owner)
  async createDelegateRequest(dto: CreateDelegateDto, requestedBy: string) {
    // Check if unit is delivered
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }
    if (unit.status !== 'DELIVERED') {
      throw new ForbiddenException('Cannot add delegates until unit is delivered');
    }

    // Check if requester is the owner
    const ownerAccess = await this.prisma.unitAccess.findFirst({
      where: {
        unitId: dto.unitId,
        userId: requestedBy,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    if (!ownerAccess) {
      throw new ForbiddenException('Only owner can add delegates');
    }

    // Check if user already has access
    const existingAccess = await this.prisma.unitAccess.findFirst({
      where: {
        unitId: dto.unitId,
        userId: dto.userId,
        status: 'ACTIVE',
      },
    });
    if (existingAccess) {
      throw new BadRequestException('User already has access to this unit');
    }

    // Update user's national ID file
    await this.prisma.user.update({
      where: { id: dto.userId },
      data: { nationalIdFileId: dto.idFileId },
    });

    // Create pending delegate access
    return this.prisma.unitAccess.create({
      data: {
        unitId: dto.unitId,
        userId: dto.userId,
        role: 'DELEGATE',
        delegateType: dto.type,
        startsAt: dto.startsAt || new Date(),
        endsAt: dto.endsAt,
        grantedBy: requestedBy,
        status: 'PENDING', // Wait for admin approval
        source: 'OWNER_DELEGATION',
        canViewFinancials: dto.canViewFinancials || false,
        canReceiveBilling: dto.canReceiveBilling || false,
        canBookFacilities: dto.canBookFacilities || true,
        canGenerateQR: dto.canGenerateQR || false,
        canManageWorkers: dto.canManageWorkers || false,
      },
    });
  }

  // Approve delegate (by admin)
  async approveDelegate(unitAccessId: string, approvedBy: string) {
    const access = await this.prisma.unitAccess.findUnique({
      where: { id: unitAccessId },
    });
    if (!access || access.role !== 'DELEGATE') {
      throw new NotFoundException('Delegate access not found');
    }
    if (access.status !== 'PENDING') {
      throw new BadRequestException('Delegate is not pending approval');
    }

    // Update status to ACTIVE
    const updatedAccess = await this.prisma.unitAccess.update({
      where: { id: unitAccessId },
      data: { status: 'ACTIVE' },
    });

    // Send email to delegate about approval
    const delegate = await this.prisma.user.findUnique({
      where: { id: access.userId },
      include: { unitAccesses: { include: { unit: true } } },
    });

    if (delegate?.email) {
      const unitAccess = delegate.unitAccesses.find(ua => ua.id === unitAccessId);
      const subject = `Delegate Access Approved - Alkarma Community`;
      const content = `
        <h2>Delegate Access Approved</h2>
        <p>Dear ${delegate.nameEN},</p>
        <p>Your delegate access request for unit ${unitAccess?.unit?.unitNumber || 'N/A'} has been approved.</p>
        <p>You can now access the community dashboard with your existing credentials.</p>
        <p><a href="https://app.alkarma.com/login">Login to your account</a></p>
      `;
      await this.emailService.sendEmail(subject, delegate.email, content);
    }

    return updatedAccess;
  }

  // Revoke delegate (by admin or owner)
  async revokeDelegate(unitAccessId: string, revokedBy: string) {
    const access = await this.prisma.unitAccess.findUnique({
      where: { id: unitAccessId },
      include: { unit: true },
    });
    if (!access || access.role !== 'DELEGATE') {
      throw new NotFoundException('Delegate access not found');
    }

    // Check permission: admin or owner
    const isAdmin = await this.prisma.admin.findUnique({
      where: { userId: revokedBy },
    });
    const isOwner = access.unit && await this.prisma.unitAccess.findFirst({
      where: {
        unitId: access.unitId,
        userId: revokedBy,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Not authorized to revoke delegate');
    }

    // Update status to REVOKED
    const updatedAccess = await this.prisma.unitAccess.update({
      where: { id: unitAccessId },
      data: { status: 'REVOKED' },
    });

    // Send email to delegate about revocation
    const delegate = await this.prisma.user.findUnique({
      where: { id: access.userId },
    });

    if (delegate?.email) {
      const subject = `Delegate Access Revoked - Alkarma Community`;
      const content = `
        <h2>Delegate Access Revoked</h2>
        <p>Dear ${delegate.nameEN},</p>
        <p>Your delegate access for unit ${access.unit?.unitNumber || 'N/A'} has been revoked.</p>
        <p>If you believe this was done in error, please contact the administration.</p>
      `;
      await this.emailService.sendEmail(subject, delegate.email, content);
    }

    return updatedAccess;
  }

  // Get delegates for a unit
  async getDelegatesForUnit(unitId: string) {
    return this.prisma.unitAccess.findMany({
      where: {
        unitId,
        role: 'DELEGATE',
      },
      include: {
        user: true,
      },
    });
  }

  // Get pending delegate requests
  async getPendingRequests() {
    return this.prisma.unitAccess.findMany({
      where: {
        role: 'DELEGATE',
        status: 'PENDING',
      },
      include: {
        user: true,
        unit: true,
      },
    });
  }

  // Update delegate permissions
  async updateDelegate(unitAccessId: string, dto: UpdateDelegateDto) {
    const access = await this.prisma.unitAccess.findUnique({
      where: { id: unitAccessId },
    });
    if (!access || access.role !== 'DELEGATE') {
      throw new NotFoundException('Delegate access not found');
    }

    return this.prisma.unitAccess.update({
      where: { id: unitAccessId },
      data: dto,
    });
  }

  // Remove delegate (hard delete)
  async remove(unitAccessId: string) {
    const access = await this.prisma.unitAccess.findUnique({
      where: { id: unitAccessId },
    });
    if (!access || access.role !== 'DELEGATE') {
      throw new NotFoundException('Delegate access not found');
    }

    return this.prisma.unitAccess.delete({
      where: { id: unitAccessId },
    });
  }
}
