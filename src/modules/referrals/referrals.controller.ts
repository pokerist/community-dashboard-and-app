import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ReferralQueryDto } from './dto/referral-query.dto';
import { RejectReferralDto } from './dto/reject-referral.dto';
import { ValidateReferralResponseDto } from './dto/validate-referral.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Referrals')
@Controller('referrals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('referral.create')
  @ApiOperation({ summary: 'Create a new referral invitation' })
  @ApiResponse({ status: 201, description: 'Referral created successfully' })
  create(@Body() dto: CreateReferralDto, @Req() req: any) {
    return this.referralsService.create(dto, req.user.id);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Permissions('referral.view_all')
  @ApiOperation({ summary: 'Get paginated list of referrals with filters' })
  @ApiResponse({ status: 200, description: 'Paginated referrals list' })
  findAll(@Query() query: ReferralQueryDto) {
    return this.referralsService.findAll(query);
  }

  @Get('validate')
  @HttpCode(HttpStatus.OK)
  @Permissions('referral.validate')
  @ApiOperation({ summary: 'Validate if a phone number has a valid referral' })
  @ApiQuery({ name: 'phone', description: 'Phone number to validate' })
  @ApiResponse({
    status: 200,
    description: 'Referral validation result',
    type: ValidateReferralResponseDto,
  })
  validate(
    @Query('phone') phone: string,
  ): Promise<ValidateReferralResponseDto> {
    return this.referralsService.validateReferral(phone);
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Permissions('referral.view_all') // Admin permission to reject
  @ApiOperation({ summary: 'Reject a referral invitation' })
  @ApiResponse({ status: 200, description: 'Referral rejected successfully' })
  reject(@Param('id') id: string, @Body() dto: RejectReferralDto) {
    return this.referralsService.reject(id, dto.reason);
  }
}
