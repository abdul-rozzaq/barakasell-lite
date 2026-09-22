import { describe, it, expect, vi } from 'vitest';
import type { Bot } from 'grammy';
import { registerStartFlow } from './start.flow.js';
import { registerMenuFlow, MENU_BUTTONS } from './menu.flow.js';
import type { BotService } from '../../bot/bot.service.js';
import type { SessionService } from '../session.service.js';

// A minimal stand-in for grammY's Bot — just enough surface for the flow
// registration functions (command/on/hears) — with no network access, so
// these tests run without a real Telegram token or webhook.
class FakeBot {
  private readonly commandHandlers = new Map<string, (ctx: unknown) => unknown>();
  private readonly hearsHandlers = new Map<string, (ctx: unknown) => unknown>();
  private readonly onHandlers = new Map<string, (ctx: unknown) => unknown>();

  command(name: string, handler: (ctx: unknown) => unknown) {
    this.commandHandlers.set(name, handler);
  }

  hears(text: string, handler: (ctx: unknown) => unknown) {
    this.hearsHandlers.set(text, handler);
  }

  // grammY's real bot.on filters by a query string like 'message:contact'.
  onFilter(query: string, handler: (ctx: unknown) => unknown) {
    this.onHandlers.set(query, handler);
  }

  runCommand(name: string, ctx: unknown) {
    return this.commandHandlers.get(name)?.(ctx);
  }

  runHears(text: string, ctx: unknown) {
    return this.hearsHandlers.get(text)?.(ctx);
  }

  runOn(query: string, ctx: unknown) {
    return this.onHandlers.get(query)?.(ctx);
  }
}

function asBot(fake: FakeBot): Bot {
  return {
    command: fake.command.bind(fake),
    hears: fake.hears.bind(fake),
    on: fake.onFilter.bind(fake),
  } as unknown as Bot;
}

function fakeBotService(overrides: Partial<BotService> = {}): BotService {
  return {
    register: vi.fn(),
    loyalty: vi.fn(),
    debt: vi.fn(),
    purchases: vi.fn(),
    ...overrides,
  } as unknown as BotService;
}

function fakeSession(customerId: string | null): SessionService {
  return {
    getCustomerId: vi.fn().mockResolvedValue(customerId),
    rememberCustomer: vi.fn(),
    rememberOwner: vi.fn(),
  } as unknown as SessionService;
}

describe('registerStartFlow', () => {
  it('asks an unregistered chat to share a contact', async () => {
    const bot = new FakeBot();
    const botService = fakeBotService();
    const session = fakeSession(null);
    registerStartFlow(asBot(bot), botService, session);

    const reply = vi.fn();
    await bot.runCommand('start', { chat: { id: 1 }, reply });

    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0][1]).toHaveProperty('reply_markup');
  });

  it('registers a shared contact and remembers the returned customer id', async () => {
    const bot = new FakeBot();
    const register = vi.fn().mockResolvedValue({ id: 'cust-1' });
    const botService = fakeBotService({ register });
    const session = fakeSession(null);
    registerStartFlow(asBot(bot), botService, session);

    const reply = vi.fn();
    await bot.runOn('message:contact', {
      chat: { id: 42 },
      from: { id: 42, first_name: 'Ali', username: 'ali' },
      message: {
        contact: { user_id: 42, phone_number: '+998901234567', first_name: 'Ali' },
      },
      reply,
    });

    expect(register).toHaveBeenCalledWith({
      telegramId: '42',
      phone: '+998901234567',
      name: 'Ali',
      telegramUsername: 'ali',
    });
    expect(session.rememberCustomer).toHaveBeenCalledWith(42, 'cust-1');
    expect(reply).toHaveBeenCalledWith(
      "Ro'yxatdan muvaffaqiyatli o'tdingiz!",
      expect.objectContaining({ reply_markup: expect.anything() }),
    );
  });

  it('rejects a contact that belongs to someone else', async () => {
    const bot = new FakeBot();
    const register = vi.fn();
    const botService = fakeBotService({ register });
    const session = fakeSession(null);
    registerStartFlow(asBot(bot), botService, session);

    const reply = vi.fn();
    await bot.runOn('message:contact', {
      chat: { id: 42 },
      from: { id: 42 },
      message: { contact: { user_id: 999, phone_number: '+998901234567' } },
      reply,
    });

    expect(register).not.toHaveBeenCalled();
  });
});

describe('registerMenuFlow', () => {
  it('reports the points balance for a registered customer', async () => {
    const bot = new FakeBot();
    const loyalty = vi.fn().mockResolvedValue({ pointsBalance: 30 });
    const botService = fakeBotService({ loyalty });
    const session = fakeSession('cust-1');
    registerMenuFlow(asBot(bot), botService, session);

    const reply = vi.fn();
    await bot.runHears(MENU_BUTTONS.points, { chat: { id: 1 }, reply });

    expect(loyalty).toHaveBeenCalledWith('cust-1');
    expect(reply).toHaveBeenCalledWith('Sizda 30 ball bor.');
  });

  it('asks an unregistered chat to /start before answering', async () => {
    const bot = new FakeBot();
    const debt = vi.fn();
    const botService = fakeBotService({ debt });
    const session = fakeSession(null);
    registerMenuFlow(asBot(bot), botService, session);

    const reply = vi.fn();
    await bot.runHears(MENU_BUTTONS.debt, { chat: { id: 1 }, reply });

    expect(debt).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith("Avval ro'yxatdan o'ting: /start");
  });
});
