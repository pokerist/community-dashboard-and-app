import { IsArray, IsString } from 'class-validator';

export class SetUserPersonaOverrideDto {
  @IsArray()
  @IsString({ each: true })
  personaKeys!: string[];
}
