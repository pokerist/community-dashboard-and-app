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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { FileUploadResult } from '../../common/interfaces/file-storage.interface';
import type { Response } from 'express';
import { $Enums } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { extname } from 'path';

// Define the bucket name constants centrally
const ATTACHMENTS_BUCKET = 'service-attachments';
const PROFILE_BUCKET = 'profile-photos';
const IDENTITY_DOCS_BUCKET = 'identity-docs';

function inferMimeTypeFromName(name?: string | null) {
  const ext = extname(name ?? '').toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.pdf') return 'application/pdf';
  return null;
}

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

@ApiBearerAuth()
@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  // Specific upload endpoints as per guide
  @Post('upload/profile-photo')
  @ApiOperation({ summary: 'Upload a profile photo' })
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
  @ApiOperation({ summary: 'Upload a national ID document (image/pdf)' })
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
  @ApiOperation({ summary: 'Upload a contract document (image/pdf)' })
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
  @ApiOperation({ summary: 'Upload a delegate ID document (image/pdf)' })
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
  @ApiOperation({ summary: 'Upload a worker ID document (image/pdf)' })
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
  @ApiOperation({ summary: 'Upload a marriage certificate (image/pdf)' })
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
      $Enums.FileCategory.MARRIAGE_CERTIFICATE,
    );
  }

  @Post('upload/birth-certificate')
  @ApiOperation({ summary: 'Upload a birth certificate (image/pdf)' })
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
      $Enums.FileCategory.BIRTH_CERTIFICATE,
    );
  }

  @Post('upload/service-attachment')
  @ApiOperation({ summary: 'Upload a service attachment (image/pdf)' })
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

  @Post('upload/brand-logo')
  @ApiOperation({ summary: 'Upload a brand logo image (admin branding settings)' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadBrandLogo(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('File is missing.');
    }
    validateImage(file);
    return this.fileService.handleUpload(
      file,
      ATTACHMENTS_BUCKET,
      $Enums.FileCategory.SERVICE_ATTACHMENT,
    );
  }

  // DELETE /files/:fileId
  @Delete(':fileId')
  @ApiOperation({ summary: 'Delete a file (access-controlled)' })
  async deleteFile(@Param('fileId') fileId: string, @Req() req: any) {
    await this.fileService.deleteFileForActor(fileId, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
    return {
      success: true,
      message: 'File and all associated records deleted.',
    };
  }

  // GET /files/:fileId/stream
  @Get(':fileId/stream')
  @ApiOperation({ summary: 'Stream a file (access-controlled)' })
  async getFile(@Param('fileId') fileId: string, @Req() req: any, @Res() res: Response) {
    const { file, stream } = await this.fileService.getFileStreamWithMetaForActor(fileId, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
    const contentType =
      file.mimeType?.trim() ||
      inferMimeTypeFromName(file.name) ||
      inferMimeTypeFromName(file.key) ||
      'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    if (typeof file.size === 'number' && Number.isFinite(file.size) && file.size >= 0) {
      res.setHeader('Content-Length', String(file.size));
    }
    res.setHeader('Cache-Control', 'private, max-age=60');
    if (file.name?.trim()) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      );
    }
    stream.pipe(res);
  }
}
