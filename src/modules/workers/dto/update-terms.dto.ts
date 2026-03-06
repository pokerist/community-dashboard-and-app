import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateTermsDto {
  @ApiProperty({ example: 'Workers must carry valid identification at all times.' })
  @IsString()
  @IsNotEmpty()
  terms!: string;
}
