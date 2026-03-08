import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { $Enums } from '@prisma/client';
import { LeasesService } from './leases.service';
import { CreateLeaseDto, UpdateLeaseDto } from './dto/create-lease.dto';
import { AddTenantToLeaseDto } from './dto/add-tenant-to-lease.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { FileService } from '../file/file.service';

const IDENTITY_DOCS_BUCKET = 'identity-docs';

type LeaseCreateFiles = {
  contractFile?: Express.Multer.File[];
  nationalIdPhoto?: Express.Multer.File[];
};

@ApiTags('leases')
@Controller('leases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeasesController {
  constructor(
    private readonly leasesService: LeasesService,
    private readonly fileService: FileService,
  ) {}

  private validateImageOrPdf(file: Express.Multer.File) {
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

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 5MB');
    }
  }

  // POST /leases
  // Supports either:
  // - JSON body with contractFileId + nationalIdFileId
  // - multipart/form-data with files: contractFile, nationalIdPhoto
  @Post()
  @Permissions('lease.create')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'contractFile', maxCount: 1 },
      { name: 'nationalIdPhoto', maxCount: 1 },
    ]),
  )
  async create(
    @Body() createLeaseDto: CreateLeaseDto,
    @UploadedFiles() files: LeaseCreateFiles,
    @Req() req: any,
  ) {
    const contractFile = files?.contractFile?.[0];
    const nationalIdPhoto = files?.nationalIdPhoto?.[0];

    let contractFileId = createLeaseDto.contractFileId;
    let nationalIdFileId = createLeaseDto.nationalIdFileId;

    if (contractFile) {
      this.validateImageOrPdf(contractFile);
      const uploaded = await this.fileService.handleUpload(
        contractFile,
        IDENTITY_DOCS_BUCKET,
        $Enums.FileCategory.CONTRACT,
      );
      contractFileId = uploaded.id;
    }

    if (nationalIdPhoto) {
      this.validateImageOrPdf(nationalIdPhoto);
      const uploaded = await this.fileService.handleUpload(
        nationalIdPhoto,
        IDENTITY_DOCS_BUCKET,
        $Enums.FileCategory.NATIONAL_ID,
      );
      nationalIdFileId = uploaded.id;
    }

    if (!contractFileId) {
      throw new BadRequestException(
        'contractFileId is required when contractFile is not provided',
      );
    }

    return this.leasesService.create(
      {
        ...createLeaseDto,
        contractFileId,
        nationalIdFileId,
      },
      req.user.id,
    );
  }

  // GET /leases
  @Get()
  @Permissions('lease.view_all')
  findAll() {
    return this.leasesService.findAll();
  }

  // GET /leases/unit/:unitId
  @Get('unit/:unitId')
  @Permissions('lease.view_all', 'lease.view_own')
  findByUnit(@Param('unitId') unitId: string) {
    return this.leasesService.findByUnit(unitId);
  }

  // GET /leases/:id
  @Get(':id')
  @Permissions('lease.view_all', 'lease.view_own')
  findOne(@Param('id') id: string) {
    return this.leasesService.findOne(id);
  }

  // PATCH /leases/:id
  @Patch(':id')
  @Permissions('lease.update')
  update(
    @Param('id') id: string,
    @Body() updateLeaseDto: UpdateLeaseDto,
    @Req() req: any,
  ) {
    return this.leasesService.update(id, updateLeaseDto, req.user.id);
  }

  // DELETE /leases/:id
  @Delete(':id')
  @Permissions('lease.delete')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.leasesService.remove(id, req.user.id);
  }

  // POST /leases/:leaseId/add-tenant
  @Post(':leaseId/add-tenant')
  @Permissions('lease.add_tenant')
  @UseInterceptors(FileInterceptor('nationalIdPhoto'))
  async addTenantToLease(
    @Param('leaseId') leaseId: string,
    @Body() addTenantDto: AddTenantToLeaseDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    let nationalIdFileId = addTenantDto.nationalIdFileId;

    if (file) {
      this.validateImageOrPdf(file);
      const uploaded = await this.fileService.handleUpload(
        file,
        IDENTITY_DOCS_BUCKET,
        $Enums.FileCategory.NATIONAL_ID,
      );
      nationalIdFileId = uploaded.id;
    }

    if (!nationalIdFileId) {
      throw new BadRequestException(
        'nationalIdFileId is required when nationalIdPhoto is not provided',
      );
    }

    return this.leasesService.addTenantToLease(
      leaseId,
      { ...addTenantDto, nationalIdFileId },
      req.user.id,
    );
  }

  // POST /leases/:leaseId/terminate
  @Post(':leaseId/terminate')
  @Permissions('lease.terminate')
  terminateLease(
    @Param('leaseId') leaseId: string,
    @Body() dto: { reason?: string; terminationDate?: string },
    @Req() req: any,
  ) {
    return this.leasesService.terminateLease(leaseId, dto, req.user.id);
  }
}
