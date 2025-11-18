import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { ApiTags, ApiBody } from '@nestjs/swagger';

@ApiTags('units')
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  // GET /units
  @Get()
  findAll() {
    return this.unitsService.findAll();
  }

  // GET /units/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.unitsService.findOne(id);
  }

  // GET /units/number/:unitNumber
  // @Get('number/:unitNumber')
  // findOneByNumber(@Param('unitNumber') unitNumber: string) {
  //   return this.unitsService.findOneByNumber(unitNumber);
  // }

  // POST /units
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUnitDto: CreateUnitDto) {
    return this.unitsService.create(createUnitDto);
  }

  // PUT /units/:id
  @Patch(':id')
  @ApiBody({ type: UpdateUnitDto }) // UpdateUnitDto can extend Partial<CreateUnitDto>
  update(@Param('id') id: string, @Body() updateData: UpdateUnitDto) {
    return this.unitsService.update(id, updateData);
  }

  // DELETE /units/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.unitsService.remove(id);
  }
}
