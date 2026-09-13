import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { AUDIT_KEY, type AuditMeta } from '../decorators/audit.decorator.js';
import { AuditService } from '../../modules/audit/audit.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

const REDACTED_KEYS = new Set(['password', 'pin', 'passwordHash', 'pinHash']);

function redact(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) => [
      k,
      REDACTED_KEYS.has(k) ? '***' : v,
    ]),
  );
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap((result: unknown) => {
        const rawEntityId =
          (result as { id?: string | number } | undefined)?.id ?? request.params?.id ?? undefined;
        const entityId = rawEntityId !== undefined ? String(rawEntityId) : undefined;
        this.auditService.writeAsync({
          action: meta.action,
          entity: meta.entity,
          entityId,
          detail: redact(request.body) as Prisma.InputJsonValue,
          userId: request.user?.sub,
          ip: request.ip,
        });
      }),
    );
  }
}
