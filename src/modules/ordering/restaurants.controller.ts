import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateRestaurantDto, UpdateRestaurantDto } from './dto/create-restaurant.dto';
import { ListRestaurantsDto } from './dto/list-restaurants.dto';
import { ReorderMenuItemsDto } from './dto/reorder-menu-items.dto';
import { RestaurantService } from './restaurant.service';

@ApiTags('Ordering - Restaurants')
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RestaurantsController {
  constructor(private readonly restaurantService: RestaurantService) {}

  @Get('restaurants')
  @Permissions('restaurant.view_all', 'restaurant.view_own')
  listRestaurants(@Query() query: ListRestaurantsDto) {
    return this.restaurantService.listRestaurants(query);
  }

  @Get('restaurants/:id')
  @Permissions('restaurant.view_all', 'restaurant.view_own')
  getRestaurantDetail(@Param('id') id: string) {
    return this.restaurantService.getRestaurantDetail(id);
  }

  @Post('restaurants')
  @Permissions('restaurant.create')
  createRestaurant(@Body() dto: CreateRestaurantDto) {
    return this.restaurantService.createRestaurant(dto);
  }

  @Patch('restaurants/:id')
  @Permissions('restaurant.update')
  updateRestaurant(@Param('id') id: string, @Body() dto: UpdateRestaurantDto) {
    return this.restaurantService.updateRestaurant(id, dto);
  }

  @Patch('restaurants/:id/toggle')
  @Permissions('restaurant.update')
  toggleRestaurant(@Param('id') id: string) {
    return this.restaurantService.toggleRestaurant(id);
  }

  @Delete('restaurants/:id')
  @Permissions('restaurant.delete')
  deleteRestaurant(@Param('id') id: string) {
    return this.restaurantService.deleteRestaurant(id);
  }

  @Post('restaurants/:id/menu')
  @Permissions('restaurant.update')
  addMenuItem(@Param('id') restaurantId: string, @Body() dto: CreateMenuItemDto) {
    return this.restaurantService.addMenuItem(restaurantId, dto);
  }

  @Patch('menu-items/:id')
  @Permissions('restaurant.update')
  updateMenuItem(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.restaurantService.updateMenuItem(id, dto);
  }

  @Patch('menu-items/:id/toggle')
  @Permissions('restaurant.update')
  toggleMenuItem(@Param('id') id: string) {
    return this.restaurantService.toggleMenuItem(id);
  }

  @Delete('menu-items/:id')
  @Permissions('restaurant.delete')
  deleteMenuItem(@Param('id') id: string) {
    return this.restaurantService.deleteMenuItem(id);
  }

  @Patch('restaurants/:id/menu/reorder')
  @Permissions('restaurant.update')
  reorderMenuItems(@Param('id') restaurantId: string, @Body() dto: ReorderMenuItemsDto) {
    return this.restaurantService.reorderMenuItems(restaurantId, dto);
  }
}
