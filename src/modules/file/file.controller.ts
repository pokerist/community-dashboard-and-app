import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Param,
  Delete,
  Get,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService, FileCategory } from './file.service';
import { FileUploadResult } from '../../common/interfaces/file-storage.interface';
import type { Response } from 'express';

// Define the bucket name constants centrally
const ATTACHMENTS_BUCKET = 'service-attachments';
const PROFILE_BUCKET = 'profile-photos';
const IDENTITY_DOCS_BUCKET = 'identity-docs';

// Validation functions
function validateImageOrPdf(file: Express.Multer.File) {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf',
  ];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new BadRequestException(
      'Only JPEG, PNG images and PDF files are allowed',
    );
  }
  // Check file size (5MB limit for documents)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new BadRequestException('File size must be less than 5MB');
  }
}

function validateImage(file: Express.Multer.File) {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new BadRequestException('Only JPEG and PNG images are allowed');
  }
  // Check file size (2MB limit for photos)
  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    throw new BadRequestException('File size must be less than 2MB');
  }
}

@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  // Specific upload endpoints as per guide
  @Post('upload/profile-photo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfilePhoto(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('File is missing.');
    }
    validateImage(file);
    return this.fileService.handleUpload(
      file,
      PROFILE_BUCKET,
      FileCategory.PROFILE_PHOTO,
    );
  }

  @Post('upload/national-id')
  @UseInterceptors(FileInterceptor('file'))
  async uploadNationalId(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('File is missing.');
    }
    validateImageOrPdf(file);
    return this.fileService.handleUpload(
      file,
      IDENTITY_DOCS_BUCKET,
      FileCategory.NATIONAL_ID,
    );
  }

  @Post('upload/contract')
  @UseInterceptors(FileInterceptor('file'))
  async uploadContract(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('File is missing.');
    }
    validateImageOrPdf(file);
    return this.fileService.handleUpload(
      file,
      IDENTITY_DOCS_BUCKET,
      FileCategory.CONTRACT,
    );
  }

  @Post('upload/delegate-id')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDelegateId(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('File is missing.');
    }
    validateImageOrPdf(file);
    return this.fileService.handleUpload(
      file,
      IDENTITY_DOCS_BUCKET,
      FileCategory.DELEGATE_ID,
    );
  }

  @Post('upload/worker-id')
  @UseInterceptors(FileInterceptor('file'))
  async uploadWorkerId(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('File is missing.');
    }
    validateImageOrPdf(file);
    return this.fileService.handleUpload(
      file,
      IDENTITY_DOCS_BUCKET,
      FileCategory.WORKER_ID,
    );
  }

  @Post('upload/service-attachment')
  @UseInterceptors(FileInterceptor('file'))
  async uploadServiceAttachment(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('File is missing.');
    }
    validateImageOrPdf(file);
    return this.fileService.handleUpload(
      file,
      ATTACHMENTS_BUCKET,
      FileCategory.SERVICE_ATTACHMENT,
    );
  }

  // DELETE /files/:fileId
  @Delete(':fileId')
  async deleteFile(@Param('fileId') fileId: string) {
    // You'd need logic here to determine the correct bucket based on file usage (e.g., by checking the File table)
    // For simplicity, we assume one bucket for attachments here, but in production, you'd check file relations.
    await this.fileService.deleteFile(fileId, ATTACHMENTS_BUCKET);
    return {
      success: true,
      message: 'File and all associated records deleted.',
    };
  }

  // GET /files/:fileId/stream
  @Get(':fileId/stream')
  async getFile(@Param('fileId') fileId: string, @Res() res: Response) {
    const stream = await this.fileService.getFileStream(
      fileId,
      ATTACHMENTS_BUCKET,
    );
    // pipe the stream to the response
    stream.pipe(res);
  }
}
