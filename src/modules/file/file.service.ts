import { Injectable } from '@nestjs/common';
import { IFileStorageAdapter } from '../../common/interfaces/file-storage.interface';
import { SupabaseStorageAdapter } from './adapters/supabase-storage.adapter';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FileService {
  private readonly storageAdapter: IFileStorageAdapter;

  constructor(private readonly prisma: PrismaService) {
    // Initialize the concrete adapter (Supabase in your case)
    this.storageAdapter = new SupabaseStorageAdapter(); 
  }

  async handleUpload(file: Express.Multer.File, bucket: string): Promise<FileUploadResult> {
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
    return fileRecord; 
  }

  // ... methods for deleteFile, getFileStream, etc., implemented similarly
}