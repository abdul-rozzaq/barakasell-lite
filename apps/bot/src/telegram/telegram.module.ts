import { Module } from '@nestjs/common';
import { botProvider, GRAMMY_BOT } from './bot.provider.js';
import { SessionService } from './session.service.js';
import { WebhookController } from './webhook.controller.js';
import { TelegramBootstrapService } from './telegram-bootstrap.service.js';
import { ApiModule } from '../api/api.module.js';
import { AgentModule } from '../agent/agent.module.js';

@Module({
  imports: [ApiModule, AgentModule],
  controllers: [WebhookController],
  providers: [botProvider, SessionService, TelegramBootstrapService],
  exports: [GRAMMY_BOT],
})
export class TelegramModule {}
