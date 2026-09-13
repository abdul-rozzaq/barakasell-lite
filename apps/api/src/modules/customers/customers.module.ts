import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import { CustomerDebtService } from './customer-debt.service.js';
import { ShiftsModule } from '../shifts/shifts.module.js';

@Module({
  imports: [ShiftsModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerDebtService],
  exports: [CustomerDebtService],
})
export class CustomersModule {}
