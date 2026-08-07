import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorResponseBody {
  code: string;
  message: string;
}

interface ExceptionResponse {
  code?: string;
  message?: string | string[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorResponseBody = {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong. Please try again.',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as string | ExceptionResponse;
      const resObj = typeof res === 'string' ? { message: res } : res;
      const rawMessage = resObj.message ?? exception.message;

      const code = resObj.code ?? this.statusToCode(status);
      body = {
        code,
        message: Array.isArray(rawMessage) ? rawMessage[0] : rawMessage,
      };
    }

    response.status(status).json(body);
  }

  // Known error codes surfaced by this filter (in addition to any code present on a thrown HttpException):
  // INVALID_CREDENTIALS, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR,
  // COOLING_OFF_ACTIVE, INSUFFICIENT_POINTS, LIMIT_EXCEEDED, INTERNAL_SERVER_ERROR.
  private statusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'COOLING_OFF_ACTIVE';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'LIMIT_EXCEEDED';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
