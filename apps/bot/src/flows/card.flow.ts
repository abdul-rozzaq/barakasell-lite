import bwipjs from 'bwip-js';
import { InputFile, type Bot } from 'grammy';
import { ApiClient } from '../api/api.client.js';
import { SessionService } from '../telegram/session.service.js';
import { MENU_BUTTONS, requireCustomer } from './menu.flow.js';

export function registerCardFlow(bot: Bot, api: ApiClient, session: SessionService) {
  bot.hears(MENU_BUTTONS.card, async (ctx) => {
    const customerId = await requireCustomer(ctx, session);
    if (!customerId) return;

    const loyalty = await api.get<{ cardCode: string | null; pointsBalance: number }>(
      `/bot/customers/${customerId}/loyalty`,
    );
    if (!loyalty.cardCode) {
      await ctx.reply("Kartangiz hali yaratilmagan, iltimos keyinroq urinib ko'ring.");
      return;
    }

    // "28" prefix — see loyalty-card.util.ts on the API — so a cashier
    // scanning this at the POS resolves it as a customer card, not a
    // product barcode. height=22 leaves EAN-13's guard bars enough room
    // that the human-readable digits don't collide with them (bwip-js's
    // own text placement is fine here — don't override textyoffset).
    // paddingwidth/height keep the bars off the image edge, which a
    // scanner needs as a quiet zone to lock on.
    const png = await bwipjs.toBuffer({
      bcid: 'ean13',
      text: loyalty.cardCode,
      scale: 3,
      height: 22,
      includetext: true,
      textxalign: 'center',
      paddingwidth: 10,
      paddingheight: 10,
    });

    await ctx.replyWithPhoto(new InputFile(png), {
      caption: `Kartangiz: ${loyalty.cardCode}\nBall: ${loyalty.pointsBalance}`,
    });
  });
}
