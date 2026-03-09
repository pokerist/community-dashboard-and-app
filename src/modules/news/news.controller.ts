import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { ListNewsDto } from './dto/list-news.dto';

@ApiTags('news')
@Controller('news')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post()
  @Permissions('news.manage')
  @ApiOperation({ summary: 'Create news / community update' })
  create(@Body() dto: CreateNewsDto, @Request() req: any) {
    return this.newsService.create(dto, req.user.id);
  }

  @Get()
  @Permissions('news.view', 'news.manage')
  @ApiOperation({ summary: 'List all news (admin)' })
  findAll(@Query() query: ListNewsDto) {
    return this.newsService.findAll(query);
  }

  @Get(':id([0-9a-fA-F-]{36})')
  @Permissions('news.view', 'news.manage')
  @ApiOperation({ summary: 'Get news item by id' })
  findOne(@Param('id') id: string) {
    return this.newsService.findOne(id);
  }

  @Patch(':id([0-9a-fA-F-]{36})')
  @Permissions('news.manage')
  @ApiOperation({ summary: 'Update news item' })
  update(@Param('id') id: string, @Body() dto: UpdateNewsDto) {
    return this.newsService.update(id, dto);
  }

  @Delete(':id([0-9a-fA-F-]{36})')
  @Permissions('news.manage')
  @ApiOperation({ summary: 'Delete news item' })
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }
}
