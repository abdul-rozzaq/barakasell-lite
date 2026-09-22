import type { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';

export const GRAMMY_BOT = Symbol('GRAMMY_BOT');

export const botProvider: FactoryProvider<Bot> = {
  provide: GRAMMY_BOT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => new Bot(config.getOrThrow<string>('TELEGRAM_BOT_TOKEN')),
};
