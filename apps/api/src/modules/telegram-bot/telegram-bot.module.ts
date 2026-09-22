import { Module } from '@nestjs/common';
import { BotModule } from '../bot/bot.module.js';
import { botProvider } from './bot.provider.js';
import { SessionService } from './session.service.js';
import { WebhookController } from './webhook.controller.js';
import { TelegramBootstrapService } from './telegram-bootstrap.service.js';
import { AgentService } from './agent/agent.service.js';
import { deepseekClientProvider } from './agent/deepseek.provider.js';
import { OutboxPoller } from './notifications/outbox.poller.js';

@Module({
  imports: [BotModule],
  controllers: [WebhookController],
  providers: [
    botProvider,
    SessionService,
    TelegramBootstrapService,
    AgentService,
    deepseekClientProvider,
    OutboxPoller,
  ],
})
export class TelegramBotModule {}
