import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';
import { ShiftsModule } from '../shifts/shifts.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';

@Module({
  imports: [ShiftsModule, CustomersModule, SettingsModule, LoyaltyModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
