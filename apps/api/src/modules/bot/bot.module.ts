import { Module } from '@nestjs/common';
import { BotService } from './bot.service.js';
import { CustomersModule } from '../customers/customers.module.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ReportsModule } from '../reports/reports.module.js';
import { OwnerLinkModule } from '../owner-link/owner-link.module.js';
import { WaitlistModule } from '../waitlist/waitlist.module.js';
import { ReceivingModule } from '../receiving/receiving.module.js';
import { ReceiptOcrModule } from '../receipt-ocr/receipt-ocr.module.js';

@Module({
  imports: [
    CustomersModule,
    LoyaltyModule,
    CatalogModule,
    ReportsModule,
    OwnerLinkModule,
    WaitlistModule,
    ReceivingModule,
    ReceiptOcrModule,
  ],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
