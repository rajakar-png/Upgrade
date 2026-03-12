import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : res;
    } else {
      // Log full error internally but never expose to client
      this.logger.error(
        'Unhandled exception',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Strip any Prisma-specific details from non-HTTP exceptions
    if (!(exception instanceof HttpException)) {
      const errMsg = exception instanceof Error ? exception.message : '';
      if (errMsg.includes('prisma') || errMsg.includes('Unique constraint') || errMsg.includes('Foreign key')) {
        message = 'A database error occurred';
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(status === HttpStatus.INTERNAL_SERVER_ERROR ? {} : {}),
    });
  }
}
