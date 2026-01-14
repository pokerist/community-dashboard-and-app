import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let statusCode: number;
    let message: string;
    let errorCode: string;
    const errorDetails: unknown = {};

    if (exception instanceof HttpException) {
      // 1. Handle standard NestJS HTTP Errors (400, 404, 500, etc.)
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
        errorCode =
          (exceptionResponse as any).error || exception.constructor.name;
      } else {
        message = exceptionResponse || 'An unexpected error occurred.';
        errorCode = exception.constructor.name;
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      // 2. Handle known Prisma database errors (e.g., unique constraint violation)
      statusCode = HttpStatus.BAD_REQUEST;
      errorCode = `DB_PRISMA_${exception.code}`;

      switch (exception.code) {
        case 'P2002': // Unique constraint violation
          const target = exception.meta?.target;
          message = `A record with this value already exists for: ${Array.isArray(target) ? target.join(', ') : target}`;
          break;
        case 'P2025': // Record not found (e.g., update/delete target not found)
          message =
            'The requested resource could not be found or does not exist.';
          statusCode = HttpStatus.NOT_FOUND;
          break;
        default:
          message =
            'Database operation failed due to invalid data or constraints.';
          break;
      }
    } else {
      // 3. Handle unknown and unhandled errors (500)
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal Server Error';
      errorCode = 'SERVER_ERROR';

      // Log the full stack trace for unhandled errors
      this.logger.error(
        `Unhandled Error: ${exception instanceof Error ? exception.message : JSON.stringify(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
        request.url,
      );
    }

    response.status(statusCode).json({
      statusCode: statusCode,
      message: Array.isArray(message) ? message.join('; ') : message,
      errorCode: errorCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      errorDetails, // For deep debugging
    });
  }
}
