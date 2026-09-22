import { Body, Controller, Post } from '@nestjs/common';
import { WaitlistService } from './waitlist.service.js';
import { CreateProductRequestDto } from './dto/create-product-request.dto.js';
import { Audit } from '../../common/decorators/audit.decorator.js';

// Cashier-facing: "mijoz so'radi" button on the POS search-empty state.
// Source is fixed to POS here — the bot has its own endpoint that writes
// source BOT (see modules/bot/bot.controller.ts).
@Controller('product-requests')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @Audit({ action: 'Tovar so\'rovi', entity: 'ProductRequest' })
  create(@Body() dto: CreateProductRequestDto) {
    return this.waitlistService.create({ ...dto, source: 'POS' });
  }
}
