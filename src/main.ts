import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- 1. Global Validation Pipe (Crucial for DTOs) ---
  // Ensures all incoming request bodies are validated against DTOs.
  // whitelist: true removes any extra, non-defined properties from the body.
  // forbidNonWhitelisted: true returns an error if extra properties are sent.
  // transform: true converts path and query params to the correct types (e.g., string to number).
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true, 
    transform: true, 
  }));

  // --- 2. Swagger (OpenAPI) Configuration ---
  const config = new DocumentBuilder()
    .setTitle('Community App Dashboard API')
    .setDescription('The API documentation for the PMS/Community App backend.')
    .setVersion('1.0')
    .addTag('users', 'Endpoints for user, resident, and contractor management.')
    .addTag('units', 'Endpoints for managing unit inventory and summaries.')
    // This decorator is essential if you plan to use JWT authentication later.
    .addBearerAuth() 
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Serve the documentation at http://localhost:3000/api
  SwaggerModule.setup('api', app, document);
  // ------------------------------------------

  // Enable CORS if you are running a frontend on a different port (e.g., React on 3001)
  // app.enableCors(); 

  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger documentation is available at: ${await app.getUrl()}/api`);
}
bootstrap();
