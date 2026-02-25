import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { $Enums } from '@prisma/client';
import { FileService } from './file.service';
import { FileUploadResult } from '../../common/interfaces/file-storage.interface';
import type { Response } from 'express';
import { extname } from 'path';

const PROFILE_BUCKET = 'profile-photos';

function validateSignupPhoto(file: Express.Multer.File) {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new BadRequestException('Only JPEG and PNG images are allowed');
  }
  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    throw new BadRequestException('File size must be less than 2MB');
  }
}

function inferMimeTypeFromName(name?: string | null) {
  const ext = extname(name ?? '').toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.pdf') return 'application/pdf';
  return null;
}

@ApiTags('Files')
@Controller('files')
export class PublicFileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload/public-signup-photo')
  @ApiOperation({
    summary: 'Public upload endpoint for signup personal photo (mobile register flow)',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPublicSignupPhoto(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('File is missing.');
    }
    validateSignupPhoto(file);
    return this.fileService.handleUpload(
      file,
      PROFILE_BUCKET,
      $Enums.FileCategory.PROFILE_PHOTO,
    );
  }

  @Get('public/banner-image/:fileId')
  @ApiOperation({
    summary: 'Public stream for active banner image files (mobile banner rendering)',
  })
  async getPublicBannerImage(
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const { file, stream } = await this.fileService.getPublicActiveBannerImageStream(fileId);
    const contentType =
      file.mimeType?.trim() ||
      inferMimeTypeFromName(file.name) ||
      inferMimeTypeFromName(file.key) ||
      'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    if (typeof file.size === 'number' && Number.isFinite(file.size) && file.size >= 0) {
      res.setHeader('Content-Length', String(file.size));
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    stream.pipe(res);
  }

  @Get('public/brand-logo/:fileId')
  @ApiOperation({
    summary: 'Public stream for current mobile brand logo',
  })
  async getPublicBrandLogo(@Param('fileId') fileId: string, @Res() res: Response) {
    const { file, stream } = await this.fileService.getPublicBrandLogoStream(fileId);
    const contentType =
      file.mimeType?.trim() ||
      inferMimeTypeFromName(file.name) ||
      inferMimeTypeFromName(file.key) ||
      'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    if (typeof file.size === 'number' && Number.isFinite(file.size) && file.size >= 0) {
      res.setHeader('Content-Length', String(file.size));
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    stream.pipe(res);
  }
}
