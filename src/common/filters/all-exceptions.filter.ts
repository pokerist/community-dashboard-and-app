import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    // 1️⃣ If it's already an HttpException → respect it
    if (exception instanceof HttpException) {
      return response
        .status(exception.getStatus())
        .json(exception.getResponse());
    }

    // 2️⃣ Prisma known errors (constraints, relations, etc.)
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return response.status(400).json({
        message: exception.message,
        code: exception.code,
        meta: exception.meta,
      });
    }

    // 3️⃣ Prisma validation errors
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return response.status(422).json({
        message: exception.message,
      });
    }

    // 4️⃣ Anything else → true 500
    console.error('UNHANDLED ERROR:', exception);

    return response.status(500).json({
      message: 'Internal server error',
    });
  }
}
