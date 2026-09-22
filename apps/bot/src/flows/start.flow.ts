import { Keyboard, type Bot } from 'grammy';
import { ApiClient } from '../api/api.client.js';
import { SessionService } from '../telegram/session.service.js';
import { mainMenuKeyboard } from './menu.flow.js';

interface RegisteredCustomer {
  id: string;
}

export function registerStartFlow(bot: Bot, api: ApiClient, session: SessionService) {
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id;
    const existingId = await session.getCustomerId(chatId);
    if (existingId) {
      await ctx.reply('Xush kelibsiz!', { reply_markup: mainMenuKeyboard() });
      return;
    }

    const keyboard = new Keyboard().requestContact('📱 Kontaktni yuborish').resized();
    await ctx.reply("Assalomu alaykum! Ro'yxatdan o'tish uchun kontaktingizni yuboring.", {
      reply_markup: keyboard,
    });
  });

  bot.on('message:contact', async (ctx) => {
    const contact = ctx.message.contact;
    if (contact.user_id !== ctx.from.id) {
      await ctx.reply("Iltimos, faqat o'zingizning kontaktingizni yuboring.");
      return;
    }

    const name =
      [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || ctx.from.first_name;
    const customer = await api.post<RegisteredCustomer>('/bot/customers/register', {
      telegramId: String(ctx.from.id),
      phone: contact.phone_number,
      name,
      telegramUsername: ctx.from.username,
    });

    session.rememberCustomer(ctx.chat.id, customer.id);
    await ctx.reply("Ro'yxatdan muvaffaqiyatli o'tdingiz!", { reply_markup: mainMenuKeyboard() });
  });
}
