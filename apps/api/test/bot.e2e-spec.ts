import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Bot (e2e)', () => {
  let app: INestApplication<App>;
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
  });

  afterEach(async () => {
    await app.close();
  });

  function svc() {
    return { 'X-Service-Key': serviceKey };
  }

  // Distinct per call — Date.now() alone collides across nearby tests once
  // truncated to a phone-length string, since only its low-order digits
  // change from one call to the next within the same test run.
  function uniquePhone() {
    return `+998${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }

  it('rejects requests with no or a wrong service key', async () => {
    await request(app.getHttpServer())
      .post('/api/bot/customers/register')
      .send({ telegramId: '1', phone: '+998900000000', name: 'Test' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/bot/customers/register')
      .set('X-Service-Key', 'wrong-key')
      .send({ telegramId: '1', phone: '+998900000000', name: 'Test' })
      .expect(401);
  });

  it('registers a new customer, assigns a card, and is idempotent on retry', async () => {
    const telegramId = String(Date.now());
    const phone = uniquePhone();

    const first = await request(app.getHttpServer())
      .post('/api/bot/customers/register')
      .set(svc())
      .send({ telegramId, phone, name: 'Bot mijoz' })
      .expect(201);
    expect(first.body.cardCode).toMatch(/^28\d{11}$/);
    expect(String(first.body.telegramId)).toBe(telegramId);

    const retry = await request(app.getHttpServer())
      .post('/api/bot/customers/register')
      .set(svc())
      .send({ telegramId, phone, name: 'Bot mijoz' })
      .expect(201);
    expect(retry.body.id).toBe(first.body.id);
    expect(retry.body.cardCode).toBe(first.body.cardCode);

    const byTelegram = await request(app.getHttpServer())
      .get(`/api/bot/customers/by-telegram/${telegramId}`)
      .set(svc())
      .expect(200);
    expect(byTelegram.body.id).toBe(first.body.id);
  });

  it('links an existing phone-matched customer instead of creating a duplicate', async () => {
    const phone = uniquePhone();

    // Simulate a customer created in-store (e.g. for a credit sale) before
    // they ever open the bot.
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'admin', password: 'admin123' });
    const adminToken = loginRes.body.accessToken;
    const existing = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Do\'kondagi mijoz', phone });

    const telegramId = String(Date.now());
    const registered = await request(app.getHttpServer())
      .post('/api/bot/customers/register')
      .set(svc())
      .send({ telegramId, phone, name: 'Ignored, phone already has a name' })
      .expect(201);

    expect(registered.body.id).toBe(existing.body.id);
    expect(registered.body.name).toBe("Do'kondagi mijoz");
  });

  it('reports loyalty balance and purchase history', async () => {
    const telegramId = String(Date.now());
    const phone = uniquePhone();
    const registered = await request(app.getHttpServer())
      .post('/api/bot/customers/register')
      .set(svc())
      .send({ telegramId, phone, name: 'Xarid tarixi mijozi' })
      .expect(201);

    const loyalty = await request(app.getHttpServer())
      .get(`/api/bot/customers/${registered.body.id}/loyalty`)
      .set(svc())
      .expect(200);
    expect(loyalty.body.pointsBalance).toBe(0);
    expect(loyalty.body.cardCode).toBe(registered.body.cardCode);

    const purchases = await request(app.getHttpServer())
      .get(`/api/bot/customers/${registered.body.id}/purchases`)
      .set(svc())
      .expect(200);
    expect(purchases.body).toEqual([]);
  });
});
