import { Injectable } from '@nestjs/common';
import { Prisma, FiscalStatus, type TenderType } from '../../generated/prisma/client.js';

export const FISCAL_GATEWAY = Symbol('FISCAL_GATEWAY');

export interface FiscalSaleLine {
  name: string;
  qtyBase: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

export interface FiscalTender {
  type: TenderType;
  amount: Prisma.Decimal;
}

export interface FiscalSaleContext {
  saleId: string;
  code: string;
  soldAt: Date;
  total: Prisma.Decimal;
  lines: FiscalSaleLine[];
  tenders: FiscalTender[];
  cashierId: string;
}

export interface FiscalReturnContext {
  returnId: string;
  code: string;
  saleCode: string;
  refundTotal: Prisma.Decimal;
}

export interface FiscalResult {
  status: FiscalStatus;
  ref?: string;
  payload?: unknown;
}

// Replaceable seam for the future OFD/fiscal-receipt integration — see
// plan.md "Kelajakka seam". Nothing in SalesModule (next milestone) should
// know about OFD directly; it only depends on this interface.
export interface FiscalGateway {
  registerSale(ctx: FiscalSaleContext): Promise<FiscalResult>;
  registerReturn(ctx: FiscalReturnContext): Promise<FiscalResult>;
}

@Injectable()
export class NoopFiscalGateway implements FiscalGateway {
  async registerSale(): Promise<FiscalResult> {
    return { status: FiscalStatus.NOT_REQUIRED };
  }

  async registerReturn(): Promise<FiscalResult> {
    return { status: FiscalStatus.NOT_REQUIRED };
  }
}
