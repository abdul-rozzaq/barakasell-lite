import { SetMetadata } from '@nestjs/common';

export interface AuditMeta {
  action: string;
  entity: string;
}

export const AUDIT_KEY = 'audit';
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);
