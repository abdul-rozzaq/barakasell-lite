import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Bot } from 'grammy';
import { GRAMMY_BOT } from './bot.provider.js';
import { ApiClient } from '../api/api.client.js';
import { SessionService } from './session.service.js';
import { AgentService } from '../agent/agent.service.js';
import { registerStartFlow } from '../flows/start.flow.js';
import { registerMenuFlow } from '../flows/menu.flow.js';
import { registerCardFlow } from '../flows/card.flow.js';
import { registerOwnerLinkFlow } from '../flows/owner-link.flow.js';
import { registerAgentFlow } from '../flows/agent.flow.js';

// Wires the flows onto the shared Bot instance and points Telegram at our
// webhook on startup — grammY's setWebhook is idempotent, so this is safe
// to run on every boot rather than only once at first deploy.
@Injectable()
export class TelegramBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBootstrapService.name);

  constructor(
    @Inject(GRAMMY_BOT) private readonly bot: Bot,
    private readonly api: ApiClient,
    private readonly session: SessionService,
    private readonly agent: AgentService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    registerStartFlow(this.bot, this.api, this.session);
    registerMenuFlow(this.bot, this.api, this.session);
    registerCardFlow(this.bot, this.api, this.session);
    registerOwnerLinkFlow(this.bot, this.api, this.session);
    registerAgentFlow(this.bot, this.agent, this.session);
    this.bot.catch((err) => this.logger.error('Bot xatosi', err));

    const publicUrl = this.config.getOrThrow<string>('PUBLIC_URL');
    const secretToken = this.config.getOrThrow<string>('TELEGRAM_WEBHOOK_SECRET');
    await this.bot.api.setWebhook(`${publicUrl}/telegram/webhook`, {
      secret_token: secretToken,
    });
    this.logger.log("Telegram webhook o'rnatildi");
  }
}
