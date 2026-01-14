import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FileUploadResult,
  IFileStorageAdapter,
} from '../../common/interfaces/file-storage.interface';
import { SupabaseStorageAdapter } from './adapters/supabase-storage.adapter';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FileService {
  private readonly storageAdapter: IFileStorageAdapter;

  constructor(private readonly prisma: PrismaService) {
    // Initialize the concrete adapter (Supabase in your case)
    this.storageAdapter = new SupabaseStorageAdapter();
  }

  async handleUpload(
    file: Express.Multer.File,
    bucket: string,
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

  async deleteFile(fileId: string, bucket: string): Promise<void> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File not found');
    }

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

  async getFileStream(
    fileId: string,
    bucket: string,
  ): Promise<NodeJS.ReadableStream> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return this.storageAdapter.getFileStream(file.key, bucket);
  }
}
