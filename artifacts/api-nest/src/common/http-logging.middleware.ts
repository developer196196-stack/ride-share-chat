import { Injectable, Logger, NestMiddleware } from '@nestjs/common';

type HttpRequest = {
  method: string;
  originalUrl: string;
};

type HttpResponse = {
  statusCode: number;
  on(event: 'finish', listener: () => void): void;
};

type NextFn = () => void;

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: HttpRequest, res: HttpResponse, next: NextFn): void {
    const started = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const ms = Date.now() - started;
      const line = `${method} ${originalUrl} → ${res.statusCode} (${ms}ms)`;
      if (res.statusCode >= 500) {
        this.logger.error(line);
      } else if (res.statusCode >= 400) {
        this.logger.warn(line);
      } else {
        this.logger.log(line);
      }
    });

    next();
  }
}
