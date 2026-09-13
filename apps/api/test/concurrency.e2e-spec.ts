import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Concurrency (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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

  it('20 parallel receipt posts on the same product never corrupt stock or average cost', async () => {
    const sku = `SKU-CONC-${Date.now()}`;
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        sku,
        name: 'Test Kabel',
        units: [{ label: 'metr', factor: 1, price: 5000, isBase: true }],
      });
    const productId = product.body.id;

    // All 20 receipts use the same qty (10) — with equal weights, a moving
    // average is order-independent, so the expected result is a plain
    // weighted average regardless of which of the 20 commits first.
    const N = 20;
    const qty = 10;
    const costs = Array.from({ length: N }, (_, i) => 100 * (i + 1)); // 100..2000

    const receiptIds: string[] = [];
    for (const cost of costs) {
      const r = await request(app.getHttpServer())
        .post('/api/receipts')
        .set(auth())
        .send({ lines: [{ productId, unitLabel: 'metr', qtyInUnit: qty, unitCostPack: cost }] });
      receiptIds.push(r.body.id);
    }

    await Promise.all(
      receiptIds.map((id) =>
        request(app.getHttpServer()).post(`/api/receipts/${id}/post`).set(auth()).expect(201),
      ),
    );

    const expectedStock = qty * N;
    const expectedAvg = (qty * costs.reduce((a, b) => a + b, 0)) / expectedStock;

    const detail = await request(app.getHttpServer()).get(`/api/products/${productId}`).set(auth());
    expect(Number(detail.body.stock)).toBe(expectedStock);
    // avgCost is DECIMAL(18,6): each of the 20 sequential blends truncates to
    // 6dp, so tiny rounding drift (a few parts per million) versus the
    // infinite-precision weighted average is expected, not corruption.
    expect(Number(detail.body.avgCost)).toBeCloseTo(expectedAvg, 3);

    const ledger = await request(app.getHttpServer())
      .get('/api/inventory/ledger')
      .query({ productId, type: 'RECEIPT' })
      .set(auth());
    expect(ledger.body).toHaveLength(N);

    const byAscendingSeq = [...ledger.body].sort((a, b) => Number(a.seq) - Number(b.seq));
    const balances = byAscendingSeq.map((e: { balanceAfter: string }) => Number(e.balanceAfter));
    for (let i = 1; i < balances.length; i++) {
      expect(balances[i]).toBe(balances[i - 1] + qty);
    }
    expect(balances[balances.length - 1]).toBe(expectedStock);

    const verify = await request(app.getHttpServer()).get('/api/inventory/verify').set(auth());
    expect(verify.body.find((d: { productId: string }) => d.productId === productId)).toBeUndefined();
  });
});
