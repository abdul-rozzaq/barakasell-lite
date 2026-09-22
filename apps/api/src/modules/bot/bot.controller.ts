import { Controller, Get, Param, Post, Query, UseGuards, Body } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { ServiceKeyGuard } from '../../common/guards/service-key.guard.js';
import { BotService } from './bot.service.js';
import { BotRegisterDto } from './dto/bot-register.dto.js';
import { LinkOwnerDto } from './dto/link-owner.dto.js';
import { CreateBotWaitlistDto } from './dto/create-bot-waitlist.dto.js';
import { AckOutboxDto } from './dto/ack-outbox.dto.js';
import type { StockFilter } from '../catalog/products.service.js';

// Service-to-service surface for apps/bot: guarded by X-Service-Key, not a
// user JWT — @Public() bypasses JwtAuthGuard, ServiceKeyGuard replaces it.
@Public()
@UseGuards(ServiceKeyGuard)
@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post('customers/register')
  register(@Body() dto: BotRegisterDto) {
    return this.botService.register(dto);
  }

  @Get('customers/by-telegram/:telegramId')
  byTelegram(@Param('telegramId') telegramId: string) {
    return this.botService.findByTelegramId(telegramId);
  }

  @Get('customers/:id/loyalty')
  loyalty(@Param('id') id: string) {
    return this.botService.loyalty(id);
  }

  @Get('customers/:id/debt')
  debt(@Param('id') id: string) {
    return this.botService.debt(id);
  }

  @Get('customers/:id/purchases')
  purchases(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.botService.purchases(id, limit ? Number(limit) : undefined);
  }

  @Post('link/owner')
  linkOwner(@Body() dto: LinkOwnerDto) {
    return this.botService.linkOwner(dto.code, dto.telegramId);
  }

  @Get('owner/by-telegram/:telegramId')
  ownerByTelegram(@Param('telegramId') telegramId: string) {
    return this.botService.findOwnerByTelegramId(telegramId);
  }

  @Get('products/search')
  searchProducts(@Query('q') q?: string, @Query('stockFilter') stockFilter?: StockFilter) {
    return this.botService.searchProducts(q, stockFilter);
  }

  @Get('reports/sales-summary')
  salesSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.botService.salesSummary(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @Get('reports/top-products')
  topProducts() {
    return this.botService.topProducts();
  }

  @Get('reports/low-stock')
  lowStock() {
    return this.botService.lowStock();
  }

  @Get('reports/out-of-stock')
  outOfStock() {
    return this.botService.outOfStock();
  }

  @Get('reports/dead-stock')
  deadStock(@Query('days') days?: string) {
    return this.botService.deadStock(days ? Number(days) : 30);
  }

  @Get('reports/profit')
  profit(
    @Query('groupBy') groupBy: 'period' | 'product' | 'category' = 'period',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.botService.profit(groupBy, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @Get('reports/open-shifts')
  openShifts() {
    return this.botService.openShifts();
  }

  @Get('reports/demand')
  demand(@Query('days') days?: string) {
    return this.botService.demand(days ? Number(days) : 30);
  }

  @Post('customers/:id/waitlist')
  createWaitlistEntry(@Param('id') id: string, @Body() dto: CreateBotWaitlistDto) {
    return this.botService.createWaitlistEntry(id, dto);
  }

  @Get('outbox')
  listOutbox(@Query('limit') limit?: string) {
    return this.botService.listOutbox(limit ? Number(limit) : undefined);
  }

  @Post('outbox/:id/ack')
  ackOutbox(@Param('id') id: string, @Body() dto: AckOutboxDto) {
    return this.botService.ackOutbox(id, dto.status, dto.error);
  }
}
