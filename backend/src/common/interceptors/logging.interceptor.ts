import {
  Injectable, NestInterceptor, ExecutionContext,
  CallHandler, Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req  = context.switchToHttp().getRequest();
    const now  = Date.now();
    const { method, url } = req;

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - now;
        if (ms > 1000) {
          this.logger.warn(`SLOW ${method} ${url} — ${ms}ms`);
        }
      }),
    );
  }
}
