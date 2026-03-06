import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddInternalNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  note!: string;
}

