import type { Bot, Context } from 'grammy';
import { BotService } from '../../bot/bot.service.js';
import { SessionService } from '../session.service.js';

const RATE_LIMIT = 2;
const RATE_WINDOW_MS = 60_000;
// Telegram delivers an album ("media group") as several separate
// message:photo updates, not one — this buffers photos sharing the same
// media_group_id and fires a single combined OCR call once no new photo in
// that group has arrived for this long. A standalone photo (no group id)
// is processed immediately with no delay.
const MEDIA_GROUP_DEBOUNCE_MS = 1500;

interface OcrImage {
  buffer: Buffer;
  mimeType: string;
}

interface PendingGroup {
  images: OcrImage[];
  ctx: Context;
  userId: string;
  timer: ReturnType<typeof setTimeout>;
}

// Registered BEFORE registerAgentFlow (which only listens to message:text,
// so ordering wouldn't strictly matter here, but new handler types are
// added before the catch-all as a repo convention — see agent.flow.ts).
// Owner-only: a customer photographing a receipt has no meaning here.
// Telegram photos arrive as JPEG regardless of the original format.
export function registerReceiptPhotoFlow(bot: Bot, botService: BotService, session: SessionService) {
  const requestLog = new Map<number, number[]>();
  const pendingGroups = new Map<string, PendingGroup>();

  async function flushGroup(key: string) {
    const group = pendingGroups.get(key);
    if (!group) return;
    pendingGroups.delete(key);

    const chatId = group.ctx.chat!.id;
    if (!withinRateLimit(requestLog, chatId)) {
      await group.ctx.reply("Juda ko'p rasm yubordingiz, biroz kuting va qayta urinib ko'ring.");
      return;
    }
    await processImages(botService, group.ctx, group.userId, group.images);
  }

  bot.on('message:photo', async (ctx) => {
    const chatId = ctx.chat.id;
    const identity = await session.resolve(chatId);
    if (!identity || identity.role !== 'owner') {
      await ctx.reply(
        "Faktura rasmini faqat do'kon egasi yubora oladi. Egasiz, admin panelda \"Telegram'ga ulash\" orqali bog'laning.",
      );
      return;
    }

    let image: OcrImage;
    try {
      image = await downloadPhoto(ctx, bot.token);
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : "Rasmni yuklab bo'lmadi.");
      return;
    }

    const mediaGroupId = ctx.message.media_group_id;
    if (!mediaGroupId) {
      if (!withinRateLimit(requestLog, chatId)) {
        await ctx.reply("Juda ko'p rasm yubordingiz, biroz kuting va qayta urinib ko'ring.");
        return;
      }
      await processImages(botService, ctx, identity.userId, [image]);
      return;
    }

    // Part of an album — buffer it and (re)start the debounce timer so the
    // OCR call fires once after the last photo in the group, not once per
    // photo.
    const key = `${chatId}:${mediaGroupId}`;
    const existing = pendingGroups.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.images.push(image);
      existing.ctx = ctx;
      existing.timer = setTimeout(() => void flushGroup(key), MEDIA_GROUP_DEBOUNCE_MS);
    } else {
      pendingGroups.set(key, {
        images: [image],
        ctx,
        userId: identity.userId,
        timer: setTimeout(() => void flushGroup(key), MEDIA_GROUP_DEBOUNCE_MS),
      });
    }
  });
}

async function downloadPhoto(ctx: Context, token: string): Promise<OcrImage> {
  const file = await ctx.getFile();
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Faylni yuklab bo'lmadi: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mimeType: 'image/jpeg' };
}

async function processImages(
  botService: BotService,
  ctx: Context,
  userId: string,
  images: OcrImage[],
) {
  await ctx.replyWithChatAction('upload_photo');
  try {
    const result = await botService.ocrReceiptDraft(images, userId);

    if (!result.receipt) {
      await ctx.reply(
        "Rasmdan hech qanday tovarni aniqlab bo'lmadi. Iltimos, aniqroq rasm yuboring yoki admin panelda qo'lda kiriting.",
      );
      return;
    }

    const lines = [
      `Qoralama hujjat yaratildi: ${result.receipt.code}`,
      `${result.matchedCount} ta qator aniqlandi.`,
    ];
    if (result.unresolvedNames.length > 0) {
      lines.push(`Aniqlanmagan: ${result.unresolvedNames.join(', ')}`);
    }
    lines.push("Admin panelda kirim hujjatini ko'rib chiqib tasdiqlang.");
    await ctx.reply(lines.join('\n'));
  } catch (err) {
    await ctx.reply(err instanceof Error ? err.message : 'Rasmni qayta ishlashda xatolik yuz berdi.');
  }
}

function withinRateLimit(log: Map<number, number[]>, chatId: number): boolean {
  const now = Date.now();
  const timestamps = (log.get(chatId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  timestamps.push(now);
  log.set(chatId, timestamps);
  return timestamps.length <= RATE_LIMIT;
}
