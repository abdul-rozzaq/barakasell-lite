import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Sales (e2e)', () => {
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
    await request(app.getHttpServer())
      .patch('/api/settings')
      .set(auth(adminToken))
      .send({ allowNegativeStock: false });
    await app.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createProduct(name: string, price: number) {
    const sku = `SKU-SALE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth(adminToken))
      .send({
        sku,
        name,
        units: [{ label: 'dona', factor: 1, price, isBase: true }],
      });
    return res.body.id as string;
  }

  async function receive(productId: string, qty: number, unitCost: number) {
    const receipt = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth(adminToken))
      .send({
        lines: [
          {
            productId,
            unitLabel: 'dona',
            qtyInUnit: qty,
            unitCostPack: unitCost,
          },
        ],
      });
    await request(app.getHttpServer())
      .post(`/api/receipts/${receipt.body.id}/post`)
      .set(auth(adminToken))
      .expect(201);
  }

  it('rejects a sale when the cashier has no open shift', async () => {
    const productId = await createProduct('Mix bez smena', 10000);
    await receive(productId, 10, 4000);

    await request(app.getHttpServer())
      .post('/api/sales')
      .set(auth(adminToken)) // admin never opened a shift
      .set('Idempotency-Key', `key-${Date.now()}`)
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: 1 }],
        tenders: [{ type: 'CASH', amount: 10000 }],
      })
      .expect(409);
  });

  it('completes a mixed-tender sale, snapshots cost, decrements stock, and stays idempotent on retry', async () => {
    const productId = await createProduct("Mix to'lov tovari", 10000);
    await receive(productId, 100, 4000);

    const idempotencyKey = `key-${Date.now()}`;
    const create = () =>
      request(app.getHttpServer())
        .post('/api/sales')
        .set(auth(cashierToken))
        .set('Idempotency-Key', idempotencyKey)
        .send({
          lines: [{ productId, unitLabel: 'dona', qtyInUnit: 5 }],
          tenders: [
            { type: 'CASH', amount: 30000 },
            { type: 'CARD', amount: 20000 },
          ],
        });

    const first = await create().expect(201);
    expect(Number(first.body.total)).toBe(50000);
    expect(Number(first.body.paidAmount)).toBe(50000);
    expect(Number(first.body.changeAmount)).toBe(0);
    expect(Number(first.body.lines[0].unitCostBase)).toBe(4000);

    const afterFirst = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set(auth(adminToken));
    expect(Number(afterFirst.body.stock)).toBe(95);

    // A later receipt at a different cost must not retroactively change the
    // already-completed sale's cost snapshot.
    await receive(productId, 10, 8000);
    const saleAfterReceipt = await request(app.getHttpServer())
      .get(`/api/sales/${first.body.id}`)
      .set(auth(cashierToken));
    expect(Number(saleAfterReceipt.body.lines[0].unitCostBase)).toBe(4000);

    const retry = await create().expect(201);
    expect(retry.body.id).toBe(first.body.id);

    const afterRetry = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set(auth(adminToken));
    expect(Number(afterRetry.body.stock)).toBe(105); // 100 - 5 (sale, once) + 10 (receipt)
  });

  it('blocks a negative-stock sale by default and allows it once Settings.allowNegativeStock is on', async () => {
    const productId = await createProduct('Kam qoldiq tovari', 5000);
    await receive(productId, 3, 2000);

    await request(app.getHttpServer())
      .post('/api/sales')
      .set(auth(cashierToken))
      .set('Idempotency-Key', `key-${Date.now()}-a`)
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: 10 }],
        tenders: [{ type: 'CASH', amount: 50000 }],
      })
      .expect(409);

    await request(app.getHttpServer())
      .patch('/api/settings')
      .set(auth(adminToken))
      .send({ allowNegativeStock: true })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/sales')
      .set(auth(cashierToken))
      .set('Idempotency-Key', `key-${Date.now()}-b`)
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: 10 }],
        tenders: [{ type: 'CASH', amount: 50000 }],
      })
      .expect(201);
  });

  it('rejects a sale request with no Idempotency-Key header', async () => {
    const productId = await createProduct('Idempotensiz tovar', 5000);
    await receive(productId, 5, 2000);

    await request(app.getHttpServer())
      .post('/api/sales')
      .set(auth(cashierToken))
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: 1 }],
        tenders: [{ type: 'CASH', amount: 5000 }],
      })
      .expect(400);
  });
});
