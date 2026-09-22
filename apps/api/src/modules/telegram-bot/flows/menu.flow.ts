import { Keyboard, type Bot, type Context } from 'grammy';
import { BotService } from '../../bot/bot.service.js';
import { SessionService } from '../session.service.js';

export const MENU_BUTTONS = {
  card: '🪪 Mening kartam',
  points: '⭐ Ball',
  debt: '💳 Qarzim',
  purchases: '🧾 Xaridlarim',
};

export function mainMenuKeyboard() {
  return new Keyboard()
    .text(MENU_BUTTONS.card)
    .text(MENU_BUTTONS.points)
    .row()
    .text(MENU_BUTTONS.debt)
    .text(MENU_BUTTONS.purchases)
    .resized();
}

export async function requireCustomer(ctx: Context, session: SessionService): Promise<string | null> {
  const chatId = ctx.chat?.id;
  if (!chatId) return null;
  const customerId = await session.getCustomerId(chatId);
  if (!customerId) {
    await ctx.reply("Avval ro'yxatdan o'ting: /start");
    return null;
  }
  return customerId;
}

export function registerMenuFlow(bot: Bot, botService: BotService, session: SessionService) {
  bot.hears(MENU_BUTTONS.points, async (ctx) => {
    const customerId = await requireCustomer(ctx, session);
    if (!customerId) return;
    const loyalty = await botService.loyalty(customerId);
    await ctx.reply(`Sizda ${loyalty.pointsBalance} ball bor.`);
  });

  bot.hears(MENU_BUTTONS.debt, async (ctx) => {
    const customerId = await requireCustomer(ctx, session);
    if (!customerId) return;
    const debt = await botService.debt(customerId);
    const amount = Number(debt.debtBalance);
    await ctx.reply(
      amount > 0 ? `Joriy qarzingiz: ${amount.toLocaleString('uz-UZ')} so'm` : "Qarzingiz yo'q.",
    );
  });

  bot.hears(MENU_BUTTONS.purchases, async (ctx) => {
    const customerId = await requireCustomer(ctx, session);
    if (!customerId) return;
    const purchases = await botService.purchases(customerId, 10);
    if (purchases.length === 0) {
      await ctx.reply("Hali xaridlaringiz yo'q.");
      return;
    }
    const lines = purchases.map(
      (p) =>
        `${p.code} — ${Number(p.total).toLocaleString('uz-UZ')} so'm (${new Date(p.soldAt).toLocaleDateString('uz-UZ')})`,
    );
    await ctx.reply(lines.join('\n'));
  });
}
