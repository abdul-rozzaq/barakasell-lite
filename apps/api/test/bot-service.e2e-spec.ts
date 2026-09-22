import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { BotService } from '../src/modules/bot/bot.service.js';

// The Telegram bot now calls BotService directly, in-process — there is no
// more HTTP surface for register/link/search/reports to exercise. These
// tests call the service the same way the bot's flows and agent tools do
// (see modules/telegram-bot), using app.get() the same way
// inventory-verify.e2e-spec.ts reaches PrismaService directly.
describe('BotService (e2e)', () => {
  let app: INestApplication<App>;
  let botService: BotService;
  let adminToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    botService = app.get(BotService);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'admin', password: 'admin123' });
    adminToken = login.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  function auth() {
    return { Authorization: `Bearer ${adminToken}` };
  }

  function uniquePhone() {
    return `+998${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }

  it('registers a new customer, assigns a card, and is idempotent on retry', async () => {
    const telegramId = String(Date.now());
    const phone = uniquePhone();

    const first = await botService.register({ telegramId, phone, name: 'Bot mijoz' });
    expect(first.cardCode).toMatch(/^28\d{11}$/);
    expect(String(first.telegramId)).toBe(telegramId);

    const retry = await botService.register({ telegramId, phone, name: 'Bot mijoz' });
    expect(retry.id).toBe(first.id);
    expect(retry.cardCode).toBe(first.cardCode);

    const byTelegram = await botService.findByTelegramId(telegramId);
    expect(byTelegram?.id).toBe(first.id);
  });

  it('links an existing phone-matched customer instead of creating a duplicate', async () => {
    const phone = uniquePhone();
    const existing = await request(app.getHttpServer())
      .post('/api/customers')
      .set(auth())
      .send({ name: "Do'kondagi mijoz", phone });

    const telegramId = String(Date.now());
    const registered = await botService.register({
      telegramId,
      phone,
      name: 'Ignored, phone already has a name',
    });

    expect(registered.id).toBe(existing.body.id);
    expect(registered.name).toBe("Do'kondagi mijoz");
  });

  it('reports loyalty balance and an empty purchase history for a fresh customer', async () => {
    const telegramId = String(Date.now());
    const phone = uniquePhone();
    const registered = await botService.register({ telegramId, phone, name: 'Xarid tarixi mijozi' });

    const loyalty = await botService.loyalty(registered.id);
    expect(loyalty.pointsBalance).toBe(0);
    expect(loyalty.cardCode).toBe(registered.cardCode);

    const purchases = await botService.purchases(registered.id);
    expect(purchases).toEqual([]);
  });

  it('generates a one-time link code and links the calling admin to a telegramId', async () => {
    const codeRes = await request(app.getHttpServer())
      .post('/api/users/me/telegram-link-code')
      .set(auth())
      .expect(201);
    expect(codeRes.body.code).toMatch(/^\d{6}$/);

    const telegramId = String(Date.now());
    const owner = await botService.linkOwner(codeRes.body.code, telegramId);
    expect(owner.role).toBe('ADMIN');

    const byTelegram = await botService.findOwnerByTelegramId(telegramId);
    expect(byTelegram?.id).toBe(owner.id);

    // A code can only be used once.
    await expect(
      botService.linkOwner(codeRes.body.code, String(Date.now() + 1)),
    ).rejects.toThrow();
  });

  it('rejects an unknown or expired link code', async () => {
    await expect(botService.linkOwner('000000', '1')).rejects.toThrow();
  });

  it('searches products and reflects stock correctly', async () => {
    const sku = `SKU-BOT-${Date.now()}`;
    const name = `Bot qidiruv tovari ${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        sku,
        name,
        units: [{ label: 'dona', factor: 1, price: 15000, isBase: true }],
      })
      .expect(201);

    const found = await botService.searchProducts(name);
    expect(found).toHaveLength(1);
    expect(found[0].inStock).toBe(false);
    expect(Number(found[0].price)).toBe(15000);
  });

  it("reports today's sales summary and open shifts", async () => {
    const summary = await botService.salesSummary();
    expect(summary).toHaveProperty('todayRevenue');

    const openShifts = await botService.openShifts();
    expect(Array.isArray(openShifts)).toBe(true);
  });
});
