import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Bot owner-facing tools (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  const serviceKey = process.env.SERVICE_API_KEY!;

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

  function svc() {
    return { 'X-Service-Key': serviceKey };
  }

  it('generates a one-time link code and links the calling admin to a telegramId', async () => {
    const codeRes = await request(app.getHttpServer())
      .post('/api/users/me/telegram-link-code')
      .set(auth())
      .expect(201);
    expect(codeRes.body.code).toMatch(/^\d{6}$/);

    const telegramId = String(Date.now());
    const link = await request(app.getHttpServer())
      .post('/api/bot/link/owner')
      .set(svc())
      .send({ code: codeRes.body.code, telegramId })
      .expect(201);
    expect(link.body.role).toBe('ADMIN');

    const byTelegram = await request(app.getHttpServer())
      .get(`/api/bot/owner/by-telegram/${telegramId}`)
      .set(svc())
      .expect(200);
    expect(byTelegram.body.id).toBe(link.body.id);

    // A code can only be used once.
    await request(app.getHttpServer())
      .post('/api/bot/link/owner')
      .set(svc())
      .send({ code: codeRes.body.code, telegramId: String(Date.now() + 1) })
      .expect(400);
  });

  it('rejects an unknown or expired link code', async () => {
    await request(app.getHttpServer())
      .post('/api/bot/link/owner')
      .set(svc())
      .send({ code: '000000', telegramId: '1' })
      .expect(400);
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

    const found = await request(app.getHttpServer())
      .get(`/api/bot/products/search?q=${encodeURIComponent(name)}`)
      .set(svc())
      .expect(200);
    expect(found.body).toHaveLength(1);
    expect(found.body[0].inStock).toBe(false);
    expect(Number(found.body[0].price)).toBe(15000);
  });

  it('reports today\'s sales summary and open shifts', async () => {
    const summary = await request(app.getHttpServer())
      .get('/api/bot/reports/sales-summary')
      .set(svc())
      .expect(200);
    expect(summary.body).toHaveProperty('todayRevenue');

    const openShifts = await request(app.getHttpServer())
      .get('/api/bot/reports/open-shifts')
      .set(svc())
      .expect(200);
    expect(Array.isArray(openShifts.body)).toBe(true);
  });
});
