import type { Bot } from 'grammy';
import { AgentService } from '../agent/agent.service.js';
import { SessionService } from '../telegram/session.service.js';

// Registered LAST in TelegramBootstrapService: grammY runs handlers in
// registration order and stops at the first one that doesn't call next(),
// so the exact-text menu/card/link handlers above always win over this
// catch-all — free text only reaches the AI agent when nothing else
// matched.
export function registerAgentFlow(bot: Bot, agent: AgentService, session: SessionService) {
  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const identity = await session.resolve(chatId);
    if (!identity) {
      await ctx.reply("Avval ro'yxatdan o'ting: /start");
      return;
    }

    await ctx.replyWithChatAction('typing');
    const subjectId = identity.role === 'owner' ? identity.userId : identity.customerId;
    const sessionKey = `${identity.role}:${subjectId}`;
    const answer = await agent.ask(sessionKey, identity.role, subjectId, ctx.message.text);
    await ctx.reply(answer);
  });
}
