import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { Bot } from 'grammy';
import { GRAMMY_BOT } from '../telegram/bot.provider.js';
import { ApiClient } from '../api/api.client.js';

interface OutboxItem {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  targetType: 'CUSTOMER' | 'OWNER';
  targetTelegramId: string | null;
}

const POLL_INTERVAL_MS = 15_000;

// Polls the durable outbox (see modules/waitlist on the API) instead of
// being called directly — a row survives a bot restart between the API
// committing it and the message actually being sent. ackOutbox() marks a
// row FAILED after 3 attempts so a permanently-broken chat (e.g. the user
// blocked the bot) doesn't retry forever.
@Injectable()
export class OutboxPoller {
  private readonly logger = new Logger(OutboxPoller.name);
  private polling = false;

  constructor(
    @Inject(GRAMMY_BOT) private readonly bot: Bot,
    private readonly api: ApiClient,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const items = await this.api.get<OutboxItem[]>('/bot/outbox?limit=50');
      for (const item of items) {
        await this.deliver(item);
      }
    } catch (err) {
      this.logger.error('Outbox poll xatosi', err instanceof Error ? err.stack : err);
    } finally {
      this.polling = false;
    }
  }

  private async deliver(item: OutboxItem) {
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

  private renderMessage(item: OutboxItem): string {
    if (item.kind === 'product_arrived') {
      const name = typeof item.payload.productName === 'string' ? item.payload.productName : 'Tovar';
      return `\u{1F4E6} Siz so'ragan "${name}" tovari keldi!`;
    }
    return JSON.stringify(item.payload);
  }

  private async ack(id: string, status: 'sent' | 'failed', error?: string) {
    try {
      await this.api.post(`/bot/outbox/${id}/ack`, { status, error });
    } catch (err) {
      this.logger.error(`Outbox ack xatosi (${id})`, err instanceof Error ? err.stack : err);
    }
  }
}
