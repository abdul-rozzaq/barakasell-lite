import type { Bot } from 'grammy';
import { ApiClient, ApiError } from '../api/api.client.js';
import { SessionService } from '../telegram/session.service.js';

interface LinkedOwner {
  id: string;
  name: string;
}

// The admin panel's "Telegram'ga ulash" button issues a 6-digit code
// (POST /users/me/telegram-link-code); the owner pastes it here to bind
// their Telegram account, unlocking the owner-facing report tools.
export function registerOwnerLinkFlow(bot: Bot, api: ApiClient, session: SessionService) {
  bot.command('link', async (ctx) => {
    const code = ctx.match?.toString().trim();
    if (!code) {
      await ctx.reply('Kodni shunday yuboring: /link 123456');
      return;
    }

    try {
      const owner = await api.post<LinkedOwner>('/bot/link/owner', {
        code,
        telegramId: String(ctx.from!.id),
      });
      session.rememberOwner(ctx.chat.id, owner.id);
      await ctx.reply(
        `Xush kelibsiz, ${owner.name}! Endi savol berishingiz mumkin, masalan: "bugun qancha sotildi?"`,
      );
    } catch (err) {
      await ctx.reply(
        err instanceof ApiError ? err.message : "Kod noto'g'ri yoki muddati o'tgan.",
      );
    }
  });
}
