import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ReceiptOcrController } from './receipt-ocr.controller.js';
import { ReceiptOcrService } from './receipt-ocr.service.js';
import { openaiClientProvider } from './openai.provider.js';

@Module({
  imports: [CatalogModule],
  controllers: [ReceiptOcrController],
  providers: [ReceiptOcrService, openaiClientProvider],
  exports: [ReceiptOcrService],
})
export class ReceiptOcrModule {}
