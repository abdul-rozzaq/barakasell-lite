import { Inject, Injectable, Logger } from '@nestjs/common';
import type OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/index.js';
import { BotService } from '../../bot/bot.service.js';
import { DEEPSEEK_CLIENT } from './deepseek.provider.js';
import { customerTools } from './tools/customer.tools.js';
import { ownerTools } from './tools/owner.tools.js';

export type AgentRole = 'customer' | 'owner';

interface ConversationEntry {
  messages: ChatCompletionMessageParam[];
  expiresAt: number;
}

// Sent with parse_mode: 'HTML' (see flows/agent.flow.ts) — Telegram's HTML
// subset only understands a handful of tags and no Markdown at all. Spelling
// this out here instead of leaving it to the model's default guess is what
// makes ctx.reply(answer, {parse_mode:'HTML'}) actually render instead of
// throwing a "can't parse entities" error or showing literal ** asterisks.
const TELEGRAM_HTML_FORMATTING =
  "Javobingizni Telegram HTML formatida yozing (parse_mode=HTML bilan yuboriladi), Markdown EMAS — ya'ni **qalin** " +
  "yoki *kursiv* yozmang, ular oddiy yulduzcha bo'lib ko'rinadi. Faqat quyidagi teglardan foydalaning: " +
  "<b>qalin</b>, <i>kursiv</i>, <code>kod/raqam</code>, <a href=\"URL\">havola</a>. Sarlavha, ro'yxat (<ul>/<li>) yoki " +
  "jadval teglari Telegram'da ISHLAMAYDI — ro'yxat kerak bo'lsa har qatorni yangi qatorga \"• \" bilan yozing. " +
  "Matn ichida oddiy \"<\", \">\" yoki \"&\" belgisi ishlatmang (masalan \"5 dan katta\" deng, \"5 dan >\" demang) — " +
  "aks holda xabar yuborilmay qoladi. Qisqa xabarlarda umuman teg ishlatmasangiz ham bo'ladi, faqat muhim raqam yoki " +
  "so'zni ajratib ko'rsatish uchun <b> dan foydalaning.";

const SYSTEM_PROMPT: Record<AgentRole, string> = {
  customer:
    "Siz BarakaSELL do'konining Telegram botidagi yordamchisiz. Mijozga tovar borligi, narxi, uning loyalty ball " +
    "balansi, nasiya qarzi va xarid tarixi haqida savollarga javob berasiz — shu uchun sizga vosita(tool)lar berilgan, " +
    "ulardan foydalaning, taxmin qilmang. Faqat berilgan vositalar orqali olingan ma'lumotga tayanib javob bering. " +
    "Qisqa va aniq, o'zbek tilida javob bering. Sotuv qilish, chegirma berish yoki narxni o'zgartirish sizning " +
    "vazifangiz emas — buni faqat do'kondagi kassir qila oladi. " +
    TELEGRAM_HTML_FORMATTING,
  owner:
    "Siz BarakaSELL do'kon egasi uchun shaxsiy yordamchisiz. Sizga sotuv/foyda hisobotlari, kam qolgan tovarlar, " +
    "harakatsiz tovarlar va ochiq smenalar haqida vositalar(tool) berilgan. Faqat shu vositalar orqali olingan " +
    "haqiqiy ma'lumotga tayanib, qisqa va aniq o'zbek tilida javob bering. Raqamlarni taxmin qilmang. " +
    TELEGRAM_HTML_FORMATTING,
};

const MAX_TOOL_ITERATIONS = 5;
const REQUEST_TIMEOUT_MS = 30_000;
const CONTEXT_TTL_MS = 30 * 60 * 1000;
const HISTORY_MESSAGES = 6;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly conversations = new Map<string, ConversationEntry>();
  private readonly requestLog = new Map<string, number[]>();

  constructor(
    @Inject(DEEPSEEK_CLIENT) private readonly client: OpenAI,
    private readonly botService: BotService,
  ) {}

  async ask(sessionKey: string, role: AgentRole, subjectId: string, question: string): Promise<string> {
    if (!this.withinRateLimit(sessionKey)) {
      return "Juda ko'p so'rov yubordingiz, biroz kuting va qayta urinib ko'ring.";
    }

    try {
      return await this.withTimeout(this.run(sessionKey, role, subjectId, question), REQUEST_TIMEOUT_MS);
    } catch (err) {
      this.logger.error('Agent xatosi', err instanceof Error ? err.stack : err);
      return "Kechirasiz, hozir javob bera olmadim. Birozdan keyin qayta urinib ko'ring.";
    }
  }

  private async run(sessionKey: string, role: AgentRole, subjectId: string, question: string): Promise<string> {
    const { defs, handlers } =
      role === 'customer' ? customerTools(this.botService, subjectId) : ownerTools(this.botService);
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT[role] },
      ...this.getHistory(sessionKey),
      { role: 'user', content: question },
    ];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const completion = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages,
        tools: defs as ChatCompletionTool[],
      });
      const message = completion.choices[0].message;
      messages.push(message);

      if (!message.tool_calls || message.tool_calls.length === 0) {
        const answer = message.content ?? "Kechirasiz, javob topa olmadim.";
        this.remember(sessionKey, question, answer);
        return answer;
      }

      for (const call of message.tool_calls) {
        const handler = handlers[call.function.name];
        let result: unknown;
        try {
          const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          result = handler ? await handler(args) : { error: "Noma'lum vosita" };
        } catch (err) {
          result = { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
        }
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return "So'rovingiz juda murakkab, iltimos qayta va aniqroq so'rang.";
  }

  private getHistory(sessionKey: string): ChatCompletionMessageParam[] {
    const entry = this.conversations.get(sessionKey);
    if (!entry || entry.expiresAt < Date.now()) return [];
    return entry.messages;
  }

  private remember(sessionKey: string, question: string, answer: string) {
    const entry = this.conversations.get(sessionKey) ?? { messages: [], expiresAt: 0 };
    entry.messages.push({ role: 'user', content: question }, { role: 'assistant', content: answer });
    entry.messages = entry.messages.slice(-HISTORY_MESSAGES);
    entry.expiresAt = Date.now() + CONTEXT_TTL_MS;
    this.conversations.set(sessionKey, entry);
  }

  private withinRateLimit(sessionKey: string): boolean {
    const now = Date.now();
    const timestamps = (this.requestLog.get(sessionKey) ?? []).filter(
      (t) => now - t < RATE_WINDOW_MS,
    );
    timestamps.push(now);
    this.requestLog.set(sessionKey, timestamps);
    return timestamps.length <= RATE_LIMIT;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Agent timeout')), ms);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }
}
