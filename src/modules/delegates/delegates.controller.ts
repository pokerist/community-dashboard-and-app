import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { DelegatesService } from './delegates.service';
import { CreateDelegateDto } from './dto/create-delegate.dto';
import { UpdateDelegateDto } from './dto/update-delegate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('delegates')
@UseGuards(JwtAuthGuard)
export class DelegatesController {
  constructor(private readonly delegatesService: DelegatesService) {}

  @Post('request')
  createRequest(@Body() dto: CreateDelegateDto) {
    // TODO: get userId from auth
    const requestedBy = 'user-id'; // req.user.id
    return this.delegatesService.createDelegateRequest(dto, requestedBy);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    // TODO: get approvedBy from auth
    const approvedBy = 'admin-id'; // req.user.id
    return this.delegatesService.approveDelegate(id, approvedBy);
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string) {
    // TODO: get revokedBy from auth
    const revokedBy = 'user-id'; // req.user.id
    return this.delegatesService.revokeDelegate(id, revokedBy);
  }

  @Get('pending')
  getPendingRequests() {
    return this.delegatesService.getPendingRequests();
  }

  @Get('unit/:unitId')
  getDelegatesForUnit(@Param('unitId') unitId: string) {
    return this.delegatesService.getDelegatesForUnit(unitId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDelegateDto) {
    return this.delegatesService.updateDelegate(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.delegatesService.remove(id);
  }
}
