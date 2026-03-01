import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { PublicFileController } from './public-file.controller';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [SystemSettingsModule],
  providers: [FileService],
  controllers: [PublicFileController, FileController],
  exports: [FileService],
})
export class FileModule {}
