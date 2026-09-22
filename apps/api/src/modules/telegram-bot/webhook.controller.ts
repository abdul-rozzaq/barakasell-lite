import { Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { webhookCallback, type Bot } from 'grammy';
import { GRAMMY_BOT } from './bot.provider.js';
import { Public } from '../../common/decorators/public.decorator.js';

// @Public() bypasses the global JwtAuthGuard — Telegram calls this with no
// bearer token, only its own X-Telegram-Bot-Api-Secret-Token header, which
// grammY's webhookCallback verifies itself via the secretToken option below.
@Public()
@Controller('telegram')
export class WebhookController {
  // Annotated as a plain Express handler rather than
  // ReturnType<typeof webhookCallback> — that generic-less form widens to a
  // union across every framework adapter grammY supports, which no single
  // concrete adapter's function type satisfies structurally.
  private readonly handler: (req: Request, res: Response) => Promise<void>;

  constructor(
    @Inject(GRAMMY_BOT) bot: Bot,
    config: ConfigService,
  ) {
    this.handler = webhookCallback(bot, 'express', {
      secretToken: config.getOrThrow<string>('TELEGRAM_WEBHOOK_SECRET'),
    });
  }

  @Post('webhook')
  handle(@Req() req: Request, @Res() res: Response) {
    return this.handler(req, res);
  }
}
