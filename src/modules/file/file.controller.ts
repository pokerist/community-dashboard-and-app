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
import { FileService } from './file.service';
import { FileUploadResult } from '../../common/interfaces/file-storage.interface';
import type { Response } from 'express';
import { $Enums } from '@prisma/client';

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
      $Enums.FileCategory.PROFILE_PHOTO,
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
      $Enums.FileCategory.NATIONAL_ID,
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
      $Enums.FileCategory.CONTRACT,
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
      $Enums.FileCategory.DELEGATE_ID,
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
      $Enums.FileCategory.WORKER_ID,
    );
  }

  @Post('upload/marriage-certificate')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMarriageCertificate(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('File is missing.');
    }
    validateImageOrPdf(file);
    return this.fileService.handleUpload(
      file,
      IDENTITY_DOCS_BUCKET,
      'MARRIAGE_CERTIFICATE' as $Enums.FileCategory,
    );
  }

  @Post('upload/birth-certificate')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBirthCertificate(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('File is missing.');
    }
    validateImageOrPdf(file);
    return this.fileService.handleUpload(
      file,
      IDENTITY_DOCS_BUCKET,
      'BIRTH_CERTIFICATE' as $Enums.FileCategory,
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
      $Enums.FileCategory.SERVICE_ATTACHMENT,
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
