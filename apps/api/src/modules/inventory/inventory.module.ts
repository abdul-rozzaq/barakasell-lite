import { Global, Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';
import { StockService } from './stock.service.js';

@Global()
@Module({
  controllers: [InventoryController],
  providers: [StockService],
  exports: [StockService],
})
export class InventoryModule {}
