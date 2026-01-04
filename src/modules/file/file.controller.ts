// src/file/file.controller.ts

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

// Define the bucket name constants centrally
const ATTACHMENTS_BUCKET = 'service-attachments';
const PROFILE_BUCKET = 'profile-photos';

@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  // POST /files/upload/attachment
  // This is the endpoint the client calls before creating the ServiceRequest
  @Post('upload/attachment')
  @UseInterceptors(FileInterceptor('file')) // 'file' is the key in the form-data
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('File is missing.');
    }
    // Use your dedicated attachments bucket
    return this.fileService.handleUpload(file, ATTACHMENTS_BUCKET);
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
