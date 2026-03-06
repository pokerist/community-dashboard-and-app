import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateCommunityGateDto } from './dto/create-community-gate.dto';
import { GatesService } from './gates.service';

@ApiTags('Gates')
@Controller('communities/:communityId/gates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CommunityGatesController {
  constructor(private readonly gatesService: GatesService) {}

  @Get()
  @Permissions('gate.view_all', 'admin.view')
  listByCommunity(@Param('communityId') communityId: string) {
    return this.gatesService.listCommunityGates(communityId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('gate.create', 'admin.update')
  createByCommunity(
    @Param('communityId') communityId: string,
    @Body() dto: CreateCommunityGateDto,
  ) {
    return this.gatesService.createForCommunity(communityId, dto);
  }
}

