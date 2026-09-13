import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller.js';
import { ReceiptsService } from './receipts.service.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

@Module({
  controllers: [ReceiptsController, SuppliersController],
  providers: [ReceiptsService, SuppliersService],
})
export class ReceivingModule {}
