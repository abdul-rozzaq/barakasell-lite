import { describe, it, expect, vi } from 'vitest';
import type OpenAI from 'openai';
import { AgentService } from './agent.service.js';
import type { BotService } from '../../bot/bot.service.js';

function fakeClient(
  responses: Array<{ content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }>,
): OpenAI {
  let call = 0;
  return {
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => {
          const message = responses[Math.min(call, responses.length - 1)];
          call++;
          return { choices: [{ message: { role: 'assistant', ...message } }] };
        }),
      },
    },
  } as unknown as OpenAI;
}

function fakeBotService(overrides: Partial<BotService> = {}): BotService {
  return { ...overrides } as unknown as BotService;
}

describe('AgentService', () => {
  it('answers directly when the model needs no tool', async () => {
    const client = fakeClient([{ content: 'Salom!' }]);
    const botService = fakeBotService();
    const agent = new AgentService(client, botService);

    const answer = await agent.ask('customer:1', 'customer', 'cust-1', 'Salom');
    expect(answer).toBe('Salom!');
  });

  it('executes a tool call and feeds the result back for a final answer', async () => {
    const client = fakeClient([
      {
        content: null,
        tool_calls: [
          { id: 'call_1', function: { name: 'get_loyalty_balance', arguments: '{}' } },
        ],
      },
      { content: 'Sizda 42 ball bor.' },
    ]);
    const loyalty = vi.fn().mockImplementation(async (customerId: string) => {
      expect(customerId).toBe('cust-1');
      return { pointsBalance: 42 };
    });
    const botService = fakeBotService({ loyalty });
    const agent = new AgentService(client, botService);

    const answer = await agent.ask('customer:cust-1', 'customer', 'cust-1', 'Nechta ballim bor?');
    expect(answer).toBe('Sizda 42 ball bor.');
    expect(loyalty).toHaveBeenCalledTimes(1);
  });

  it('stops after the iteration cap instead of looping forever', async () => {
    const client = fakeClient([
      {
        content: null,
        tool_calls: [{ id: 'call_x', function: { name: 'top_products', arguments: '{}' } }],
      },
    ]);
    const topProducts = vi.fn().mockResolvedValue([]);
    const botService = fakeBotService({ topProducts });
    const agent = new AgentService(client, botService);

    const answer = await agent.ask('owner:u1', 'owner', 'u1', 'top mahsulotlar?');
    expect(answer).toMatch(/murakkab/);
    expect((client.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls.length).toBe(5);
  });

  it('rate-limits a session that sends too many requests too fast', async () => {
    const client = fakeClient([{ content: 'ok' }]);
    const botService = fakeBotService();
    const agent = new AgentService(client, botService);

    for (let i = 0; i < 10; i++) {
      await agent.ask('customer:spammer', 'customer', 'cust-1', `savol ${i}`);
    }
    const eleventh = await agent.ask('customer:spammer', 'customer', 'cust-1', 'savol 11');
    expect(eleventh).toMatch(/Juda ko'p so'rov/);
  });
});
