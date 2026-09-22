import type { Bot } from 'grammy';
import { BotService } from '../../bot/bot.service.js';
import { SessionService } from '../session.service.js';

// The admin panel's "Telegram'ga ulash" button issues a 6-digit code
// (POST /users/me/telegram-link-code); the owner pastes it here to bind
// their Telegram account, unlocking the owner-facing report tools.
export function registerOwnerLinkFlow(bot: Bot, botService: BotService, session: SessionService) {
  bot.command('link', async (ctx) => {
    const code = ctx.match?.toString().trim();
    if (!code) {
      await ctx.reply('Kodni shunday yuboring: /link 123456');
      return;
    }

    try {
      const owner = await botService.linkOwner(code, String(ctx.from!.id));
      session.rememberOwner(ctx.chat.id, owner.id);
      await ctx.reply(
        `Xush kelibsiz, ${owner.name}! Endi savol berishingiz mumkin, masalan: "bugun qancha sotildi?"`,
      );
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : "Kod noto'g'ri yoki muddati o'tgan.");
    }
  });
}
