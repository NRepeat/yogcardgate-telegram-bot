import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

// Отдельный токен от бота: PAYOUT_FIELDS_TOKEN. Фолбэк на API_TOKEN, чтобы
// сервис поднялся без нового env.
const TOKEN =
  process.env.PAYOUT_FIELDS_TOKEN ||
  process.env.API_TOKEN ||
  'super-secret-token-123';

@Injectable()
export class PayoutFieldsTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const token = req.headers['x-api-token'] || req.headers['x-api-key'];
    if (token !== TOKEN) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    return true;
  }
}
