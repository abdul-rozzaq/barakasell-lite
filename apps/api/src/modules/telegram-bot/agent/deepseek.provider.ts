import type { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export const DEEPSEEK_CLIENT = Symbol('DEEPSEEK_CLIENT');

// DeepSeek's chat API is OpenAI-compatible, so the official openai SDK
// works unmodified against it — just a different baseURL and API key.
export const deepseekClientProvider: FactoryProvider<OpenAI> = {
  provide: DEEPSEEK_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new OpenAI({
      apiKey: config.getOrThrow<string>('DEEPSEEK_API_KEY'),
      baseURL: 'https://api.deepseek.com',
    }),
};
