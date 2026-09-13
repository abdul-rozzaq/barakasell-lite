import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller.js';
import { ReturnsService } from './returns.service.js';
import { ShiftsModule } from '../shifts/shifts.module.js';
import { CustomersModule } from '../customers/customers.module.js';

@Module({
  imports: [ShiftsModule, CustomersModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
