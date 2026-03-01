import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CreateRentRequestDto } from './dto/create-rent-request.dto';
import { ReviewRentRequestDto } from './dto/review-rent-request.dto';
import { RentRequestsService } from './rent-requests.service';

@ApiTags('Rent Requests')
@ApiBearerAuth()
@Controller('rent-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RentRequestsController {
  constructor(private readonly rentRequestsService: RentRequestsService) {}

  @Post()
  @Permissions('unit.view_own')
  @ApiOperation({ summary: 'Owner creates rent request for one of own units' })
  create(@Body() dto: CreateRentRequestDto, @Req() req: any) {
    return this.rentRequestsService.create(req.user.id, dto);
  }

  @Get('my')
  @Permissions('unit.view_own')
  @ApiOperation({ summary: 'Owner list own rent requests' })
  listMy(@Req() req: any) {
    return this.rentRequestsService.listMy(req.user.id);
  }

  @Get('admin')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'Admin list all rent requests' })
  listAdmin(@Req() req: any) {
    return this.rentRequestsService.listAdmin(req.user.id);
  }

  @Patch(':id/review')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Admin review a rent request' })
  review(@Param('id') id: string, @Body() dto: ReviewRentRequestDto, @Req() req: any) {
    return this.rentRequestsService.review(id, req.user.id, dto);
  }
}
