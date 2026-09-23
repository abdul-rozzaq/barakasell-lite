import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller.js';
import { ReceiptsService } from './receipts.service.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';
import { WaitlistModule } from '../waitlist/waitlist.module.js';

@Module({
  imports: [WaitlistModule],
  controllers: [ReceiptsController, SuppliersController],
  providers: [ReceiptsService, SuppliersService],
  exports: [ReceiptsService],
})
export class ReceivingModule {}
