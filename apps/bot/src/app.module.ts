import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiModule } from './api/api.module.js';
import { TelegramModule } from './telegram/telegram.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ApiModule,
    TelegramModule,
    NotificationsModule,
  ],
})
export class AppModule {}
