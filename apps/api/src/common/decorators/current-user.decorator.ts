import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  sub: string;
  role: 'ADMIN' | 'CASHIER';
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
