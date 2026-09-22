import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { BotService } from '../src/modules/bot/bot.service.js';

describe('Product requests / waitlist (e2e)', () => {
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

  async function createProduct(name: string) {
    const sku = `SKU-WAIT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        sku,
        name,
        units: [{ label: 'dona', factor: 1, price: 10000, isBase: true }],
      });
    return res.body.id as string;
  }

  it('resolves an OPEN request and queues an outbox message once a matching receipt is posted', async () => {
    const productId = await createProduct(`Navbat tovari ${Date.now()}`);

    // Register a bot customer (gets a telegramId) so the request is
    // actually deliverable.
    const telegramId = String(Date.now());
    const phone = `+998${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const customer = await botService.register({ telegramId, phone, name: 'Navbatchi mijoz' });

    await botService.createWaitlistEntry(customer.id, { productId });

    // Posting an unrelated receipt must not resolve the request.
    const otherProductId = await createProduct(`Boshqa tovar ${Date.now()}`);
    const unrelatedReceipt = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth())
      .send({
        lines: [{ productId: otherProductId, unitLabel: 'dona', qtyInUnit: 5, unitCostPack: 4000 }],
      });
    await request(app.getHttpServer())
      .post(`/api/receipts/${unrelatedReceipt.body.id}/post`)
      .set(auth())
      .expect(201);

    const outboxBefore = await botService.listOutbox();
    expect(
      outboxBefore.some((o) => (o.payload as { productId?: string })?.productId === productId),
    ).toBe(false);

    // Now post the matching receipt.
    const receipt = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth())
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: 10, unitCostPack: 4000 }],
      });
    await request(app.getHttpServer())
      .post(`/api/receipts/${receipt.body.id}/post`)
      .set(auth())
      .expect(201);

    const outbox = await botService.listOutbox();
    const entry = outbox.find((o) => (o.payload as { productId?: string })?.productId === productId);
    expect(entry).toBeDefined();
    expect(entry!.kind).toBe('product_arrived');
    expect(String(entry!.targetTelegramId)).toBe(telegramId);

    // Acking removes it from the pending list.
    await botService.ackOutbox(entry!.id, 'sent');

    const outboxAfter = await botService.listOutbox();
    expect(outboxAfter.some((o) => o.id === entry!.id)).toBe(false);
  });

  it('does not queue an outbox message for a request with no linked telegramId, but still resolves it', async () => {
    const productId = await createProduct(`Telegramsiz tovar ${Date.now()}`);

    await request(app.getHttpServer())
      .post('/api/product-requests')
      .set(auth())
      .send({ productId, phone: '+998900000001' })
      .expect(201);

    const receipt = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth())
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: 5, unitCostPack: 3000 }],
      });
    await request(app.getHttpServer())
      .post(`/api/receipts/${receipt.body.id}/post`)
      .set(auth())
      .expect(201);

    const outbox = await botService.listOutbox();
    expect(
      outbox.some((o) => (o.payload as { productId?: string })?.productId === productId),
    ).toBe(false);
  });

  it('shows up in the demand report while out of stock and requested', async () => {
    const productId = await createProduct(`Talab hisoboti tovari ${Date.now()}`);
    await request(app.getHttpServer())
      .post('/api/product-requests')
      .set(auth())
      .send({ productId })
      .expect(201);

    const demand = await request(app.getHttpServer())
      .get('/api/reports/demand')
      .set(auth())
      .expect(200);
    const entry = demand.body.find((d: { productId: string }) => d.productId === productId);
    expect(entry).toBeDefined();
    expect(entry.requestCount).toBe(1);
  });

  it('rejects a product request with neither productId nor rawText', async () => {
    await request(app.getHttpServer())
      .post('/api/product-requests')
      .set(auth())
      .send({})
      .expect(400);
  });
});
