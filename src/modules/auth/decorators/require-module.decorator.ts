import { SetMetadata } from '@nestjs/common';
export const RequireModule = (...moduleKeys: string[]) =>
  SetMetadata('requiredModules', moduleKeys);
