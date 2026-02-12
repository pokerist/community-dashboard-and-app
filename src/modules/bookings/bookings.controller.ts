import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-status.dto';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Permissions('booking.create')
  @ApiOperation({
    summary: 'Create a booking with full slot validation & rule checks',
  })
  create(@Body() dto: CreateBookingDto, @Request() req) {
    return this.bookingsService.createForActor(req.user.id, dto);
  }

  @Get()
  @Permissions('booking.view_all')
  @ApiOperation({ summary: 'View all bookings (admin)' })
  findAll(@Query() query: BookingsQueryDto) {
    return this.bookingsService.findAll(query);
  }

  @Get('me')
  @Permissions('booking.view_own')
  findMyBookings(@Request() req) {
    return this.bookingsService.findByUser(req.user.id);
  }

  @Get(':id')
  @Permissions('booking.view_all', 'booking.view_own')
  @ApiOperation({ summary: 'Get booking by ID' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.bookingsService.findOneForActor(id, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
  }

  @Patch(':id/status')
  @Permissions('booking.update')
  @ApiOperation({ summary: 'Admin updates booking status (approve/cancel)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateBookingStatusDto) {
    return this.bookingsService.updateStatus(id, dto);
  }

  @Get('facility/:facilityId')
  @Permissions('booking.view_by_facility')
  getFacilityBookings(@Param('facilityId') id: string) {
    return this.bookingsService.findByFacility(id);
  }

  @Patch(':id/cancel')
  @Permissions('booking.cancel_own')
  cancelMyBooking(@Param('id') id: string, @Request() req) {
    return this.bookingsService.cancelOwn(id, req.user.id);
  }

  @Delete(':id')
  @Permissions('booking.delete')
  @ApiOperation({ summary: 'Admin deletes a booking' })
  removeBooking(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
