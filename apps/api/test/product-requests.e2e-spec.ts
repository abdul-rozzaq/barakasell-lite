import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Product requests / waitlist (e2e)', () => {
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
    const customer = await request(app.getHttpServer())
      .post('/api/bot/customers/register')
      .set(svc())
      .send({ telegramId, phone, name: 'Navbatchi mijoz' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/bot/customers/${customer.body.id}/waitlist`)
      .set(svc())
      .send({ productId })
      .expect(201);

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

    const outboxBefore = await request(app.getHttpServer())
      .get('/api/bot/outbox')
      .set(svc())
      .expect(200);
    expect(
      outboxBefore.body.some((o: { payload: { productId: string } }) => o.payload.productId === productId),
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

    const outbox = await request(app.getHttpServer())
      .get('/api/bot/outbox')
      .set(svc())
      .expect(200);
    const entry = outbox.body.find(
      (o: { payload: { productId: string } }) => o.payload.productId === productId,
    );
    expect(entry).toBeDefined();
    expect(entry.kind).toBe('product_arrived');
    expect(entry.targetTelegramId).toBe(telegramId);

    // Acking removes it from the pending list.
    await request(app.getHttpServer())
      .post(`/api/bot/outbox/${entry.id}/ack`)
      .set(svc())
      .send({ status: 'sent' })
      .expect(201);

    const outboxAfter = await request(app.getHttpServer())
      .get('/api/bot/outbox')
      .set(svc())
      .expect(200);
    expect(outboxAfter.body.some((o: { id: string }) => o.id === entry.id)).toBe(false);
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

    const outbox = await request(app.getHttpServer())
      .get('/api/bot/outbox')
      .set(svc())
      .expect(200);
    expect(
      outbox.body.some((o: { payload: { productId: string } }) => o.payload.productId === productId),
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
