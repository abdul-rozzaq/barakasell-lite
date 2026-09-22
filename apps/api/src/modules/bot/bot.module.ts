import { Module } from '@nestjs/common';
import { BotController } from './bot.controller.js';
import { BotService } from './bot.service.js';
import { CustomersModule } from '../customers/customers.module.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ReportsModule } from '../reports/reports.module.js';
import { OwnerLinkModule } from '../owner-link/owner-link.module.js';
import { WaitlistModule } from '../waitlist/waitlist.module.js';

@Module({
  imports: [CustomersModule, LoyaltyModule, CatalogModule, ReportsModule, OwnerLinkModule, WaitlistModule],
  controllers: [BotController],
  providers: [BotService],
})
export class BotModule {}
