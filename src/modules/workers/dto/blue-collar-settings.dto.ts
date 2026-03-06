import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class BlueCollarSettingsDto {
  @ApiProperty({ example: '07:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  workingHoursStart!: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  workingHoursEnd!: string;

  @ApiProperty({ type: [Number], example: [1, 2, 3, 4, 5] })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  allowedDays!: number[];
}
