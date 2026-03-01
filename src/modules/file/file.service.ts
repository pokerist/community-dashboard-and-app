import {
  Logger,
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
import { S3StorageAdapter } from './adapters/s3-storage.adapter';
import { PrismaService } from '../../../prisma/prisma.service';
import { $Enums, Audience, BannerStatus, Prisma } from '@prisma/client';
import { IntegrationConfigService } from '../system-settings/integration-config.service';

const ATTACHMENTS_BUCKET = 'service-attachments';
const PROFILE_BUCKET = 'profile-photos';
const IDENTITY_DOCS_BUCKET = 'identity-docs';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationConfigService: IntegrationConfigService,
  ) {}

  private async getStorageAdapter(): Promise<IFileStorageAdapter> {
    const runtime = await this.integrationConfigService.getStorageRuntimeConfig();

    if (runtime.enabled && runtime.provider === 'S3' && runtime.configured) {
      return new S3StorageAdapter({
        bucket: runtime.bucket,
        region: runtime.region,
        endpoint: runtime.endpoint || undefined,
        accessKeyId: runtime.accessKeyId,
        secretAccessKey: runtime.secretAccessKey,
        forcePathStyle: runtime.forcePathStyle,
      });
    }

    if (
      runtime.enabled &&
      runtime.provider === 'SUPABASE' &&
      runtime.configured
    ) {
      return new SupabaseStorageAdapter({
        supabaseUrl: runtime.supabaseUrl,
        serviceRoleKey: runtime.supabaseServiceRoleKey,
      });
    }

    if (runtime.enabled && !runtime.configured) {
      this.logger.warn(
        `Storage provider "${runtime.provider}" is enabled but not configured. Falling back to local storage.`,
      );
    }

    return new SupabaseStorageAdapter({ forceLocal: true });
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

  private readStringArrayFromJsonObject(
    value: unknown,
    key: 'userIds' | 'unitIds' | 'blocks',
  ): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const raw = (value as Record<string, unknown>)[key];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
  }

  private bannerAudienceMatches(
    banner: { targetAudience: Audience; audienceMeta: Prisma.JsonValue | null },
    scope: { userId: string; unitIds: Set<string>; blocks: Set<string> },
  ) {
    if (banner.targetAudience === Audience.ALL) return true;
    if (banner.targetAudience === Audience.SPECIFIC_RESIDENCES) {
      return this.readStringArrayFromJsonObject(banner.audienceMeta, 'userIds').includes(
        scope.userId,
      );
    }
    if (banner.targetAudience === Audience.SPECIFIC_UNITS) {
      const ids = this.readStringArrayFromJsonObject(banner.audienceMeta, 'unitIds');
      return ids.some((id) => scope.unitIds.has(id));
    }
    if (banner.targetAudience === Audience.SPECIFIC_BLOCKS) {
      const blocks = this.readStringArrayFromJsonObject(banner.audienceMeta, 'blocks').map((b) =>
        b.toLowerCase(),
      );
      for (const b of scope.blocks) {
        if (blocks.includes(String(b).toLowerCase())) return true;
      }
      return false;
    }
    return false;
  }

  private async canReadBannerImageFile(
    fileId: string,
    ctx: { actorUserId: string; permissions: string[]; roles: string[] },
  ) {
    if (!ctx.permissions?.includes('banner.view')) return false;

    const accesses = await this.prisma.unitAccess.findMany({
      where: {
        userId: ctx.actorUserId,
        status: 'ACTIVE',
      },
      select: {
        unitId: true,
        unit: { select: { block: true } },
      },
    });
    const unitIds = new Set(accesses.map((a) => a.unitId));
    const blocks = new Set(
      accesses.map((a) => a.unit?.block).filter((b): b is string => Boolean(b)),
    );

    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        imageFileId: fileId,
        status: BannerStatus.ACTIVE,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: {
        targetAudience: true,
        audienceMeta: true,
      },
      take: 10,
    });

    return banners.some((banner) =>
      this.bannerAudienceMatches(
        {
          targetAudience: banner.targetAudience,
          audienceMeta: banner.audienceMeta as Prisma.JsonValue | null,
        },
        {
          userId: ctx.actorUserId,
          unitIds,
          blocks,
        },
      ),
    );
  }

  async handleUpload(
    file: Express.Multer.File,
    bucket: string,
    category: $Enums.FileCategory,
  ): Promise<FileUploadResult> {
    const storageAdapter = await this.getStorageAdapter();
    const uploadResult = await storageAdapter.uploadFile(file, bucket);

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

    if (await this.canReadBannerImageFile(fileId, ctx)) {
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
    const storageAdapter = await this.getStorageAdapter();
    await storageAdapter.deleteFile(file.key, bucket);

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
    const storageAdapter = await this.getStorageAdapter();
    return storageAdapter.getFileStream(file.key, bucket);
  }

  async getFileStreamWithMetaForActor(
    fileId: string,
    ctx: { actorUserId: string; permissions: string[]; roles: string[] },
  ): Promise<{
    file: {
      id: string;
      key: string;
      name: string;
      mimeType: string | null;
      size: number | null;
      category: $Enums.FileCategory;
    };
    stream: NodeJS.ReadableStream;
  }> {
    await this.assertCanReadFile(fileId, ctx);

    const file = await this.getFileOrThrow(fileId);
    const bucket = this.resolveBucket(file.category);
    const storageAdapter = await this.getStorageAdapter();
    const stream = await storageAdapter.getFileStream(file.key, bucket);
    return { file, stream };
  }

  async getPublicActiveBannerImageStream(fileId: string): Promise<{
    file: {
      id: string;
      key: string;
      name: string;
      mimeType: string | null;
      size: number | null;
      category: $Enums.FileCategory;
    };
    stream: NodeJS.ReadableStream;
  }> {
    const now = new Date();
    const linkedBanner = await this.prisma.banner.findFirst({
      where: {
        imageFileId: fileId,
        status: BannerStatus.ACTIVE,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: { id: true },
    });
    if (!linkedBanner) {
      throw new NotFoundException('Banner image not found');
    }

    const file = await this.getFileOrThrow(fileId);
    const bucket = this.resolveBucket(file.category);
    const storageAdapter = await this.getStorageAdapter();
    const stream = await storageAdapter.getFileStream(file.key, bucket);
    return { file, stream };
  }

  async getPublicBrandLogoStream(fileId: string): Promise<{
    file: {
      id: string;
      key: string;
      name: string;
      mimeType: string | null;
      size: number | null;
      category: $Enums.FileCategory;
    };
    stream: NodeJS.ReadableStream;
  }> {
    const brandRow = await this.prisma.systemSetting.findUnique({
      where: { section: 'brand' },
      select: { value: true },
    });
    const value =
      brandRow?.value && typeof brandRow.value === 'object' && !Array.isArray(brandRow.value)
        ? (brandRow.value as Record<string, unknown>)
        : null;
    const linkedFileId =
      value && typeof value.logoFileId === 'string' ? value.logoFileId.trim() : '';
    if (!linkedFileId || linkedFileId !== fileId) {
      throw new NotFoundException('Brand logo not found');
    }

    const file = await this.getFileOrThrow(fileId);
    const bucket = this.resolveBucket(file.category);
    const storageAdapter = await this.getStorageAdapter();
    const stream = await storageAdapter.getFileStream(file.key, bucket);
    return { file, stream };
  }

  async getPublicOfferBannerStream(fileId: string): Promise<{
    file: {
      id: string;
      key: string;
      name: string;
      mimeType: string | null;
      size: number | null;
      category: $Enums.FileCategory;
    };
    stream: NodeJS.ReadableStream;
  }> {
    const offersRow = await this.prisma.systemSetting.findUnique({
      where: { section: 'offers' },
      select: { value: true },
    });
    const value =
      offersRow?.value &&
      typeof offersRow.value === 'object' &&
      !Array.isArray(offersRow.value)
        ? (offersRow.value as Record<string, unknown>)
        : null;

    const offersEnabled = value?.enabled === true;
    const banners = Array.isArray(value?.banners) ? value.banners : [];
    const now = Date.now();
    const linkedBanner = banners.find((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
      const row = raw as Record<string, unknown>;
      const linkedFileId =
        typeof row.imageFileId === 'string' ? row.imageFileId.trim() : '';
      const isActive = row.active !== false;
      const startAt =
        typeof row.startAt === 'string' && row.startAt.trim()
          ? Date.parse(row.startAt)
          : NaN;
      const endAt =
        typeof row.endAt === 'string' && row.endAt.trim()
          ? Date.parse(row.endAt)
          : NaN;
      if (Number.isFinite(startAt) && startAt > now) return false;
      if (Number.isFinite(endAt) && endAt < now) return false;
      return linkedFileId === fileId && isActive;
    });

    if (!offersEnabled || !linkedBanner) {
      throw new NotFoundException('Offer banner image not found');
    }

    const file = await this.getFileOrThrow(fileId);
    const bucket = this.resolveBucket(file.category);
    const storageAdapter = await this.getStorageAdapter();
    const stream = await storageAdapter.getFileStream(file.key, bucket);
    return { file, stream };
  }
}
