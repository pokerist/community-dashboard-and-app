import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { BookingsService } from './bookings.service';

interface AuthUserContext {
  id: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthUserContext;
}

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @Permissions('booking.view_all')
  listBookings(@Query() query: BookingsQueryDto) {
    return this.bookingsService.listBookings(query);
  }

  @Get(':id')
  @Permissions('booking.view_all', 'booking.view_own')
  getBookingDetail(@Param('id') id: string) {
    return this.bookingsService.getBookingDetail(id);
  }

  @Post(':id/approve')
  @Permissions('booking.update')
  approveBooking(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const adminId = req.user?.id;
    if (!adminId) {
      throw new BadRequestException('Invalid auth context');
    }
    return this.bookingsService.approveBooking(id, adminId);
  }

  @Post(':id/reject')
  @Permissions('booking.update')
  rejectBooking(
    @Param('id') id: string,
    @Body() dto: RejectBookingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user?.id;
    if (!adminId) {
      throw new BadRequestException('Invalid auth context');
    }
    return this.bookingsService.rejectBooking(id, adminId, dto);
  }

  @Post(':id/cancel')
  @Permissions('booking.update', 'booking.cancel_own')
  cancelBooking(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const cancelledById = req.user?.id;
    if (!cancelledById) {
      throw new BadRequestException('Invalid auth context');
    }
    return this.bookingsService.cancelBooking(id, cancelledById, dto);
  }
}
