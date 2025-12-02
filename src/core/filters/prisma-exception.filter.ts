// src/common/filters/prisma-exception.filter.ts

import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Response } from 'express';

@Catch(PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database operation failed due to an unhandled error.';

    // Check specific Prisma Error Codes
    switch (exception.code) {
      case 'P2003': // Foreign key constraint failed (e.g., unitId not found)
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid input: Cannot link record. A provided ID (e.g., Unit, Resident, or Issuer ID) does not exist.';
        break;
      case 'P2002': // Unique constraint violation (e.g., trying to create a duplicate invoiceNumber)
        status = HttpStatus.CONFLICT;
        const target = exception.meta?.target || 'a unique field';
        message = `Conflict: A record with this value already exists for ${target}.`;
        break;
      case 'P2025': // Record to update/delete not found
        status = HttpStatus.NOT_FOUND;
        message = 'The specified record for this operation was not found in the database.';
        break;
      // You can add other codes (P2000, P2007, etc.) for completeness
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: 'Database Error',
      message: message, // <-- This is your clear, actionable message
    });
  }
}