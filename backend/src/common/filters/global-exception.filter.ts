import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    let status  = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Внутренняя ошибка сервера';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      message = typeof resp === 'string'
        ? resp
        : (resp as any).message || message;
    } else if (exception instanceof Error) {
      this.logger.error(`${request.method} ${request.url} — ${exception.message}`, exception.stack);
    }

    // Don't log 4xx as errors
    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} → ${status}: ${message}`);
    }

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
