import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  FileUploadResult,
  IFileStorageAdapter,
} from '../../common/interfaces/file-storage.interface';
import { SupabaseStorageAdapter } from './adapters/supabase-storage.adapter';
import { PrismaService } from '../../../prisma/prisma.service';
import { $Enums } from '@prisma/client';

const ATTACHMENTS_BUCKET = 'service-attachments';
const PROFILE_BUCKET = 'profile-photos';
const IDENTITY_DOCS_BUCKET = 'identity-docs';

@Injectable()
export class FileService {
  private readonly storageAdapter: IFileStorageAdapter;

  constructor(private readonly prisma: PrismaService) {
    // Initialize the concrete adapter (Supabase in your case)
    this.storageAdapter = new SupabaseStorageAdapter();
  }

  private resolveBucket(category: $Enums.FileCategory): string {
    switch (category) {
      case $Enums.FileCategory.PROFILE_PHOTO:
        return PROFILE_BUCKET;
      case $Enums.FileCategory.SERVICE_ATTACHMENT:
        return ATTACHMENTS_BUCKET;
      case $Enums.FileCategory.NATIONAL_ID:
      case $Enums.FileCategory.CONTRACT:
      case $Enums.FileCategory.DELEGATE_ID:
      case $Enums.FileCategory.WORKER_ID:
      case $Enums.FileCategory.MARRIAGE_CERTIFICATE:
      case $Enums.FileCategory.BIRTH_CERTIFICATE:
      case $Enums.FileCategory.DELIVERY:
        return IDENTITY_DOCS_BUCKET;
      default:
        return ATTACHMENTS_BUCKET;
    }
  }

  private isSuperAdminRole(roles: unknown): boolean {
    return (
      Array.isArray(roles) &&
      roles.some(
        (r) => typeof r === 'string' && r.toUpperCase() === 'SUPER_ADMIN',
      )
    );
  }

  async handleUpload(
    file: Express.Multer.File,
    bucket: string,
    category: $Enums.FileCategory,
  ): Promise<FileUploadResult> {
    const uploadResult = await this.storageAdapter.uploadFile(file, bucket);

    // Save the metadata to your File table
    const fileRecord = await this.prisma.file.create({
      data: {
        id: uploadResult.id,
        key: uploadResult.key,
        name: uploadResult.name,
        mimeType: uploadResult.mimeType,
        size: uploadResult.size,
        category,
      },
    });

    // Return the full record for the module to use its ID (e.g., set profilePhotoId)
    return {
      id: fileRecord.id,
      key: fileRecord.key,
      name: fileRecord.name,
      mimeType: fileRecord.mimeType ?? 'application/octet-stream',
      size: fileRecord.size ?? 0,
    };
  }

  private async getFileOrThrow(fileId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  private async assertCanReadFile(
    fileId: string,
    ctx: { actorUserId: string; permissions: string[]; roles: string[] },
  ) {
    if (this.isSuperAdminRole(ctx.roles)) return;

    // Direct user-owned files (profile photo / national id)
    const owner = await this.prisma.user.findUnique({
      where: { id: ctx.actorUserId },
      select: { profilePhotoId: true, nationalIdFileId: true },
    });

    if (owner?.profilePhotoId === fileId || owner?.nationalIdFileId === fileId) {
      return;
    }

    // Lease contract
    const lease = await this.prisma.lease.findFirst({
      where: { contractFileId: fileId },
      select: { unitId: true },
    });
    if (lease) {
      const access = await this.prisma.unitAccess.findFirst({
        where: {
          userId: ctx.actorUserId,
          unitId: lease.unitId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (access) return;
    }

    const attachments = await this.prisma.attachment.findMany({
      where: { fileId },
      select: {
        entity: true,
        entityId: true,
        serviceRequestId: true,
        incidentId: true,
        invoiceId: true,
      },
    });

    for (const a of attachments) {
      if (a.serviceRequestId || a.entity === 'SERVICE_REQUEST') {
        const requestId = a.serviceRequestId ?? a.entityId;
        const request = await this.prisma.serviceRequest.findUnique({
          where: { id: requestId },
          select: { createdById: true },
        });
        if (!request) continue;
        if (
          ctx.permissions?.includes('service_request.view_all') ||
          (ctx.permissions?.includes('service_request.view_own') &&
            request.createdById === ctx.actorUserId)
        ) {
          return;
        }
      }

      if (a.invoiceId) {
        const invoice = await this.prisma.invoice.findUnique({
          where: { id: a.invoiceId },
          select: { residentId: true, unitId: true },
        });
        if (!invoice) continue;

        if (ctx.permissions?.includes('invoice.view_all')) return;
        if (ctx.permissions?.includes('invoice.view_own')) {
          if (invoice.residentId && invoice.residentId === ctx.actorUserId) {
            return;
          }
          const access = await this.prisma.unitAccess.findFirst({
            where: {
              userId: ctx.actorUserId,
              unitId: invoice.unitId,
              status: 'ACTIVE',
            },
            select: { id: true },
          });
          if (access) return;
        }
      }

      if (a.incidentId || a.entity === 'INCIDENT') {
        if (ctx.permissions?.includes('incidents.view')) return;
      }

      if (a.entity === 'COMPLAINT') {
        const complaint = await this.prisma.complaint.findUnique({
          where: { id: a.entityId },
          select: { reporterId: true },
        });
        if (!complaint) continue;

        if (ctx.permissions?.includes('complaint.view_all')) return;
        if (
          ctx.permissions?.includes('complaint.view_own') &&
          complaint.reporterId === ctx.actorUserId
        ) {
          return;
        }
      }

      if (a.entity === 'VIOLATION') {
        const violation = await this.prisma.violation.findUnique({
          where: { id: a.entityId },
          select: { residentId: true, unitId: true },
        });
        if (!violation) continue;

        if (ctx.permissions?.includes('violation.view_all')) return;
        if (ctx.permissions?.includes('violation.view_own')) {
          if (violation.residentId && violation.residentId === ctx.actorUserId) {
            return;
          }
          const access = await this.prisma.unitAccess.findFirst({
            where: {
              userId: ctx.actorUserId,
              unitId: violation.unitId,
              status: 'ACTIVE',
            },
            select: { id: true },
          });
          if (access) return;
        }
      }
    }

    throw new ForbiddenException('You do not have access to this file');
  }

  private async assertCanDeleteFile(
    fileId: string,
    ctx: { actorUserId: string; permissions: string[]; roles: string[] },
  ) {
    if (this.isSuperAdminRole(ctx.roles)) return;

    const owner = await this.prisma.user.findUnique({
      where: { id: ctx.actorUserId },
      select: { profilePhotoId: true, nationalIdFileId: true },
    });

    // Allow deleting own profile photo (but never identity documents)
    if (owner?.profilePhotoId === fileId) return;

    // Allow deleting attachments only if you can read them (ownership rules are checked there)
    await this.assertCanReadFile(fileId, ctx);
  }

  async deleteFileForActor(
    fileId: string,
    ctx: { actorUserId: string; permissions: string[]; roles: string[] },
  ): Promise<void> {
    await this.assertCanDeleteFile(fileId, ctx);

    const file = await this.getFileOrThrow(fileId);

    // Deletion rules based on category
    if (file.category === $Enums.FileCategory.NATIONAL_ID) {
      throw new BadRequestException('Identity documents cannot be deleted');
    }

    if (file.category === $Enums.FileCategory.CONTRACT) {
      // Check if lease is still active - for now, allow deletion but this should be checked
      // throw new BadRequestException('Contracts cannot be deleted after lease starts');
    }

    const bucket = this.resolveBucket(file.category);
    await this.storageAdapter.deleteFile(file.key, bucket);

    await this.prisma.$transaction([
      this.prisma.attachment.deleteMany({ where: { fileId } }),
      this.prisma.user.updateMany({
        where: { profilePhotoId: fileId },
        data: { profilePhotoId: null },
      }),
      this.prisma.lease.updateMany({
        where: { contractFileId: fileId },
        data: { contractFileId: null },
      }),
      this.prisma.file.delete({ where: { id: fileId } }),
    ]);
  }

  async getFileStreamForActor(
    fileId: string,
    ctx: { actorUserId: string; permissions: string[]; roles: string[] },
  ): Promise<NodeJS.ReadableStream> {
    await this.assertCanReadFile(fileId, ctx);

    const file = await this.getFileOrThrow(fileId);
    const bucket = this.resolveBucket(file.category);
    return this.storageAdapter.getFileStream(file.key, bucket);
  }
}
