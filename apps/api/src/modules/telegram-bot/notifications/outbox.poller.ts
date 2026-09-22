import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { Bot } from 'grammy';
import { GRAMMY_BOT } from '../bot.provider.js';
import { BotService } from '../../bot/bot.service.js';

const POLL_INTERVAL_MS = 15_000;

// Polls the durable outbox (see modules/waitlist) instead of being called
// directly from ReceiptsService — a row survives a process restart between
// the API committing it and the message actually being sent. ackOutbox()
// marks a row FAILED after 3 attempts so a permanently-broken chat (e.g.
// the user blocked the bot) doesn't retry forever.
@Injectable()
export class OutboxPoller {
  private readonly logger = new Logger(OutboxPoller.name);
  private polling = false;

  constructor(
    @Inject(GRAMMY_BOT) private readonly bot: Bot,
    private readonly botService: BotService,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const items = await this.botService.listOutbox();
      for (const item of items) {
        await this.deliver(item);
      }
    } catch (err) {
      this.logger.error('Outbox poll xatosi', err instanceof Error ? err.stack : err);
    } finally {
      this.polling = false;
    }
  }

  private async deliver(item: {
    id: string;
    kind: string;
    payload: unknown;
    targetTelegramId: bigint | null;
  }) {
    if (!item.targetTelegramId) {
      await this.ack(item.id, 'failed', "targetTelegramId yo'q");
      return;
    }
    try {
      await this.bot.api.sendMessage(Number(item.targetTelegramId), this.renderMessage(item));
      await this.ack(item.id, 'sent');
    } catch (err) {
      await this.ack(item.id, 'failed', err instanceof Error ? err.message : "Noma'lum xatolik");
    }
  }

  private renderMessage(item: { kind: string; payload: unknown }): string {
    const payload = item.payload as Record<string, unknown> | null;
    if (item.kind === 'product_arrived') {
      const name = typeof payload?.productName === 'string' ? payload.productName : 'Tovar';
      return `\u{1F4E6} Siz so'ragan "${name}" tovari keldi!`;
    }
    return JSON.stringify(payload);
  }

  private async ack(id: string, status: 'sent' | 'failed', error?: string) {
    try {
      await this.botService.ackOutbox(id, status, error);
    } catch (err) {
      this.logger.error(`Outbox ack xatosi (${id})`, err instanceof Error ? err.stack : err);
    }
  }
}
