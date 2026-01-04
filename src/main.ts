import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- 1. Global Validation Pipe (Crucial for DTOs) ---
  // Ensures all incoming request bodies are validated against DTOs.
  // whitelist: true removes any extra, non-defined properties from the body.
  // forbidNonWhitelisted: true returns an error if extra properties are sent.
  // transform: true converts path and query params to the correct types (e.g., string to number).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // --- 2. Global Exception Filter ---
  app.useGlobalFilters(new HttpExceptionFilter());

  // --- 3. Swagger (OpenAPI) Configuration ---
  const config = new DocumentBuilder()
    .setTitle('Community App Dashboard API')
    .setDescription('API documentation for the PMS/Community App backend.')
    .setVersion('1.0')
    .addBearerAuth()

    .addTag('Users', 'User, resident, and contractor management.')
    .addTag('Units', 'Unit inventory, ownership, and summary endpoints.')
    .addTag('Leases', 'Lease agreements and rental contract workflows.')
    .addTag('Invoices', 'Billing, charges, and payment workflows.')
    .addTag('Complaints', 'Resident complaint submission and handling.')
    .addTag('Violations', 'Community violations, penalties, and appeals.')
    .addTag('Facilities', 'Facility creation and management.')
    .addTag('Bookings', 'Facility booking requests and schedules.')
    .addTag(
      'Services',
      'Service catalog (types), availability, eligibility, and pricing.',
    )
    .addTag('Service Fields', 'Dynamic form fields configuration per service.')
    .addTag(
      'Service Requests',
      'Resident service requests, attachments, and staff processing workflows.',
    )
    .addTag('Devices', 'Smart device registration and integration.')
    .addTag('AccessControl', 'QR codes and access authorization flows.')
    .addTag('Notifications', 'In-app and external notification management.')
    .addTag('Registrations', 'Pending user registrations and verification.')
    .addTag('Auth', 'Authentication, roles, and permissions management.')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Serve the documentation at http://localhost:3000/api
  SwaggerModule.setup('api', app, document);
  // ------------------------------------------

  // Enable CORS if you are running a frontend on a different port (e.g., React on 3001)
  // app.enableCors();

  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(
    `Swagger documentation is available at: ${await app.getUrl()}/api`,
  );
}
bootstrap();
