import type { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');

// Vision-capable client — separate from DEEPSEEK_CLIENT (deepseek.provider.ts)
// because DeepSeek's hosted API has no image input; the Telegram text agent
// stays on DeepSeek, only OCR uses this client.
export const openaiClientProvider: FactoryProvider<OpenAI> = {
  provide: OPENAI_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
    }),
};
