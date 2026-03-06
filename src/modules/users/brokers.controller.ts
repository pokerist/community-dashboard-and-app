import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateBrokerDto, UpdateBrokerDto } from './dto/broker.dto';
import { UsersService } from './users.service';

@ApiTags('Brokers')
@Controller('brokers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class BrokersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('admin.update', 'user.create')
  createBroker(@Body() dto: CreateBrokerDto) {
    return this.usersService.createBroker(dto);
  }

  @Patch(':id')
  @Permissions('admin.update', 'user.update')
  updateBroker(@Param('id') brokerId: string, @Body() dto: UpdateBrokerDto) {
    return this.usersService.updateBroker(brokerId, dto);
  }
}

