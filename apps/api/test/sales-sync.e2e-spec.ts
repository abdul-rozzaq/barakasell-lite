import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Sales sync (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let cashierToken: string;

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

    const users = await request(app.getHttpServer())
      .get('/api/users')
      .set(auth(adminToken));
    const cashier = users.body.find(
      (u: { role: string }) => u.role === 'CASHIER',
    );
    const cashierLogin = await request(app.getHttpServer())
      .post('/api/auth/pin-login')
      .send({ userId: cashier.id, pin: '1234' });
    cashierToken = cashierLogin.body.accessToken;

    const current = await request(app.getHttpServer())
      .get('/api/shifts/current')
      .set(auth(cashierToken));
    if (current.body) {
      await request(app.getHttpServer())
        .post(`/api/shifts/${current.body.id}/close`)
        .set(auth(cashierToken))
        .send({ countedCash: Number(current.body.expectedCash) });
    }
    await request(app.getHttpServer())
      .post('/api/shifts/open')
      .set(auth(cashierToken))
      .send({ openingCash: 0 });
  });

  afterEach(async () => {
    await app.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('processes a batch independently: created, duplicate (retried key), and failed', async () => {
    const sku = `SKU-SYNC-${Date.now()}`;
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth(adminToken))
      .send({
        sku,
        name: 'Offline navbat tovari',
        units: [{ label: 'dona', factor: 1, price: 8000, isBase: true }],
      });
    const productId = product.body.id;

    const receipt = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth(adminToken))
      .send({
        lines: [
          { productId, unitLabel: 'dona', qtyInUnit: 50, unitCostPack: 3000 },
        ],
      });
    await request(app.getHttpServer())
      .post(`/api/receipts/${receipt.body.id}/post`)
      .set(auth(adminToken))
      .expect(201);

    const repeatedKey = `sync-key-${Date.now()}`;
    const item = {
      idempotencyKey: repeatedKey,
      lines: [{ productId, unitLabel: 'dona', qtyInUnit: 2 }],
      tenders: [{ type: 'CASH', amount: 16000 }],
    };

    const res = await request(app.getHttpServer())
      .post('/api/sales/sync')
      .set(auth(cashierToken))
      .send({
        sales: [
          item,
          item, // same key again -> the offline queue's own retry
          {
            idempotencyKey: `sync-key-${Date.now()}-bad`,
            lines: [
              { productId: 'does-not-exist', unitLabel: 'dona', qtyInUnit: 1 },
            ],
            tenders: [{ type: 'CASH', amount: 8000 }],
          },
        ],
      })
      .expect(201);

    expect(res.body.map((r: { status: string }) => r.status)).toEqual([
      'created',
      'duplicate',
      'failed',
    ]);
    expect(res.body[0].saleId).toBeDefined();
    expect(res.body[1].saleId).toBe(res.body[0].saleId);
    expect(res.body[2].message).toBeDefined();

    const productAfter = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set(auth(adminToken));
    expect(Number(productAfter.body.stock)).toBe(48); // only ONE of the two identical items actually sold stock
  });
});
