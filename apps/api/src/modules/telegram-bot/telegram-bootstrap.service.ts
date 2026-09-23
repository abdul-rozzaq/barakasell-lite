import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Bot } from 'grammy';
import { GRAMMY_BOT } from './bot.provider.js';
import { BotService } from '../bot/bot.service.js';
import { SessionService } from './session.service.js';
import { AgentService } from './agent/agent.service.js';
import { registerStartFlow } from './flows/start.flow.js';
import { registerMenuFlow } from './flows/menu.flow.js';
import { registerCardFlow } from './flows/card.flow.js';
import { registerOwnerLinkFlow } from './flows/owner-link.flow.js';
import { registerReceiptPhotoFlow } from './flows/receipt-photo.flow.js';
import { registerAgentFlow } from './flows/agent.flow.js';

// Wires the flows onto the shared Bot instance and points Telegram at our
// webhook on startup — grammY's setWebhook is idempotent, so this is safe
// to run on every boot rather than only once at first deploy.
@Injectable()
export class TelegramBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBootstrapService.name);

  constructor(
    @Inject(GRAMMY_BOT) private readonly bot: Bot,
    private readonly botService: BotService,
    private readonly session: SessionService,
    private readonly agent: AgentService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    registerStartFlow(this.bot, this.botService, this.session);
    registerMenuFlow(this.bot, this.botService, this.session);
    registerCardFlow(this.bot, this.botService, this.session);
    registerOwnerLinkFlow(this.bot, this.botService, this.session);
    registerReceiptPhotoFlow(this.bot, this.botService, this.session);
    registerAgentFlow(this.bot, this.agent, this.session);
    this.bot.catch((err) => this.logger.error('Bot xatosi', err));

    // Vitest sets NODE_ENV=test automatically — every e2e/unit test spins
    // up a full AppModule via Test.createTestingModule(), and this used to
    // mean each one made a real network call to Telegram's setWebhook API
    // on boot. Flow handlers are still registered above (harmless, no
    // network) so unit tests exercising them directly are unaffected.
    if (process.env.NODE_ENV === 'test') return;

    const publicUrl = this.config.getOrThrow<string>('PUBLIC_URL');
    const secretToken = this.config.getOrThrow<string>('TELEGRAM_WEBHOOK_SECRET');
    // '/api' — main.ts sets that as the app's global route prefix, which
    // also applies to WebhookController.
    await this.bot.api.setWebhook(`${publicUrl}/api/telegram/webhook`, {
      secret_token: secretToken,
    });
    this.logger.log("Telegram webhook o'rnatildi");
  }
}
