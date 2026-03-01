import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { $Enums } from '@prisma/client';
import { DiscoverService } from './discover.service';
import { UpsertDiscoverPlaceDto } from './dto/discover.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { FileService } from '../file/file.service';

const ATTACHMENTS_BUCKET = 'service-attachments';

function validateImage(file: Express.Multer.File) {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new BadRequestException('Only JPEG, PNG, and WEBP images are allowed');
  }
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new BadRequestException('File size must be less than 5MB');
  }
}

@ApiTags('Discover')
@Controller('discover')
export class DiscoverController {
  constructor(
    private readonly discoverService: DiscoverService,
    private readonly fileService: FileService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Public/mobile list of active discover places' })
  listPublic() {
    return this.discoverService.listPublic();
  }

  @Get('admin')
  @ApiOperation({ summary: 'Admin list of discover places' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.view')
  listAdmin() {
    return this.discoverService.listAdmin();
  }

  @Post('admin')
  @ApiOperation({ summary: 'Admin create discover place' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.update')
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() dto: UpsertDiscoverPlaceDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    let imageFileId = dto.imageFileId;
    if (image) {
      validateImage(image);
      const uploaded = await this.fileService.handleUpload(
        image,
        ATTACHMENTS_BUCKET,
        $Enums.FileCategory.SERVICE_ATTACHMENT,
      );
      imageFileId = uploaded.id;
    }
    return this.discoverService.create({
      ...dto,
      imageFileId: imageFileId ?? undefined,
    });
  }

  @Patch('admin/:id')
  @ApiOperation({ summary: 'Admin update discover place' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.update')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id') id: string,
    @Body() dto: UpsertDiscoverPlaceDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    let imageFileId = dto.imageFileId;
    if (image) {
      validateImage(image);
      const uploaded = await this.fileService.handleUpload(
        image,
        ATTACHMENTS_BUCKET,
        $Enums.FileCategory.SERVICE_ATTACHMENT,
      );
      imageFileId = uploaded.id;
    }
    return this.discoverService.update(id, {
      ...dto,
      imageFileId: imageFileId ?? undefined,
    });
  }

  @Delete('admin/:id')
  @ApiOperation({ summary: 'Admin delete discover place' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.update')
  remove(@Param('id') id: string) {
    return this.discoverService.remove(id);
  }
}
