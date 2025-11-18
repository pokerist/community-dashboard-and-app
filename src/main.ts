// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; // Import Swagger modules

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Validation Pipe (Keep this!)
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true, 
    transform: true, 
  }));

  // --- Swagger Configuration ---
  const config = new DocumentBuilder()
    .setTitle('Community App Dashboard API')
    .setDescription('The API documentation for the PMS/Community App backend.')
    .setVersion('1.0')
    .addTag('units', 'Endpoints for managing unit inventory')
    .addTag('auth', 'User registration and login')
    .addBearerAuth() // Prepare for JWT authentication later
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Serve the documentation at http://localhost:3000/api
  SwaggerModule.setup('api', app, document);
  // -----------------------------

  await app.listen(3000);
}
bootstrap();