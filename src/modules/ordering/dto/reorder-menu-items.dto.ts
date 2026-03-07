import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ReorderMenuItemsDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty({ each: true })
  orderedIds!: string[];
}

