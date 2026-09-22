import { Module } from '@nestjs/common';
import { OutboxPoller } from './outbox.poller.js';
import { ApiModule } from '../api/api.module.js';
import { TelegramModule } from '../telegram/telegram.module.js';

@Module({
  imports: [ApiModule, TelegramModule],
  providers: [OutboxPoller],
})
export class NotificationsModule {}
