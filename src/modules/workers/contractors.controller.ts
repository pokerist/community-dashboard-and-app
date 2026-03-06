import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { WorkersService } from './workers.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@ApiTags('Contractors')
@Controller('contractors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContractorsController {
  constructor(private readonly workersService: WorkersService) {}

  @Post()
  @ApiOperation({
    summary:
      'Delegate creates a contractor company (and becomes an ACTIVE ADMIN member)',
  })
  create(@Body() dto: CreateContractorDto, @Req() req: AuthenticatedRequest) {
    return this.workersService.createContractor(dto, req.user.id);
  }

  @Get()
  @ApiOperation({
    summary:
      'List contractors (optionally scoped to a unit). Delegates only see contractors they belong to.',
  })
  list(@Query('unitId') unitId: string | undefined, @Req() req: AuthenticatedRequest) {
    return this.workersService.listContractors(req.user.id, unitId);
  }
}

